import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  getBatchDetail, updateBatchStatus, assignWaybillsToBatch, listWaybills,
  updateBatch, batchUpdateWaybillsByBatch, deductWalletForBatch, type BatchStatus, type WaybillStatus,
} from "@/lib/orders.functions";
import { listCartons, listPallets, updateCarton, updatePallet, getContainerLabelData, splitPallet } from "@/lib/cartons.functions";
import { getMyRoles } from "@/lib/admin.functions";
import {
  BATCH_STATUS_LABEL, BATCH_STATUS_COLOR, WAYBILL_STATUS_LABEL, WAYBILL_STATUS_COLOR,
  METHOD_LABEL, StatusBadge, Card, fmtDate, BackLink,
} from "@/lib/admin-shared";
import { SurchargePanel } from "@/components/admin/SurchargePanel";
import { CustomerDrawer } from "@/components/admin/CustomerDrawer";
import { WaybillCompactList, CartonCompactList, PalletCompactList } from "@/components/admin/ContainerChildList";
import { renderLabel } from "@/lib/label-render";
import { Loader2, X, Wand2, Printer, ScanLine, ChevronRight, AlertCircle, Wallet } from "lucide-react";
import { ScanAddDialog } from "@/components/admin/ScanAddDialog";
import { DateInput } from "@/components/admin/DateInput";
import { WorkflowStepper, BATCH_FLOW } from "@/components/admin/WorkflowStepper";

export const Route = createFileRoute("/admin/batches/$batchId")({ component: BatchDetail });

const STATUSES: BatchStatus[] = ["draft","locked","shipped","arrived","closed"];
const WAYBILL_STATUSES: WaybillStatus[] = ["pending","received","packed","shipped","in_transit","ready_pickup","delivered","cancelled"];

function BatchDetail() {
  const { batchId } = Route.useParams();
  const qc = useQueryClient();
  const fetchDetail = useServerFn(getBatchDetail);
  const fetchRoles = useServerFn(getMyRoles);
  const fetchWaybills = useServerFn(listWaybills);
  const setBatchStatus = useServerFn(updateBatchStatus);
  const assign = useServerFn(assignWaybillsToBatch);
  const updBatch = useServerFn(updateBatch);
  const bulkOp = useServerFn(batchUpdateWaybillsByBatch);
  const fetchCartons = useServerFn(listCartons);
  const fetchPallets = useServerFn(listPallets);
  const updCarton = useServerFn(updateCarton);
  const updPallet = useServerFn(updatePallet);
  const fetchLabel = useServerFn(getContainerLabelData);
  const deduct = useServerFn(deductWalletForBatch);
  const doSplitPallet = useServerFn(splitPallet);

  const detailQ = useQuery({ queryKey: ["admin-batch", batchId], queryFn: () => fetchDetail({ data: { batchId } }) });
  const cartonsQ = useQuery({ queryKey: ["batch-cartons", batchId], queryFn: () => fetchCartons({ data: { batch_id: batchId, pageSize: 100 } }) });
  const palletsQ = useQuery({ queryKey: ["batch-pallets", batchId], queryFn: () => fetchPallets({ data: { batch_id: batchId, pageSize: 100 } }) });
  const meQ = useQuery({ queryKey: ["my-roles"], queryFn: () => fetchRoles(), staleTime: 60_000 });
  const canEdit = (meQ.data?.roles ?? []).some(r => r === "owner" || r === "manager");

  const [tab, setTab] = useState<"waybills" | "cartons" | "pallets">("waybills");
  const [showAssign, setShowAssign] = useState(false);
  const [showAddCarton, setShowAddCarton] = useState(false);
  const [showAddPallet, setShowAddPallet] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [search, setSearch] = useState("");
  const availQ = useQuery({
    queryKey: ["admin-waybills-avail", search],
    queryFn: () => fetchWaybills({ data: { search, pageSize: 50, status: "all" } }),
    enabled: showAssign,
  });
  const allCartonsQ = useQuery({
    queryKey: ["all-cartons-pick"],
    queryFn: () => fetchCartons({ data: { pageSize: 100 } }),
    enabled: showAddCarton,
  });
  const allPalletsQ = useQuery({
    queryKey: ["all-pallets-pick"],
    queryFn: () => fetchPallets({ data: { pageSize: 100 } }),
    enabled: showAddPallet,
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const onPrintLabel = async () => { const d = await fetchLabel({ data: { kind: "batch", id: batchId } }); renderLabel(d as any); };

  // meta edit
  const [meta, setMeta] = useState({ eta_date: "", vessel_no: "" });
  const [metaInit, setMetaInit] = useState(false);

  // bulk form
  const [bulkStatus, setBulkStatus] = useState<WaybillStatus | "">("");
  const [bulkEvent, setBulkEvent] = useState({ status_zh: "", location_zh: "", event_time: "" });

  // Customer drawer state
  const [drawerCustomer, setDrawerCustomer] = useState<string | null>(null);
  const [deductState, setDeductState] = useState<{ user_id: string; customer_code: string; balance: number; subtotal: number } | null>(null);
  const [deductDiscount, setDeductDiscount] = useState("0");

  if (detailQ.isLoading) return <div className="grid place-items-center p-20"><Loader2 className="h-6 w-6 animate-spin text-slate-500"/></div>;
  if (detailQ.isError) return <div className="p-6 text-rose-400">{(detailQ.error as Error).message}</div>;
  const { batch, waybills, logs, waybill_total, independent_clearance, fee_summary } = detailQ.data!;
  if (!metaInit) { setMeta({ eta_date: batch.eta_date ?? "", vessel_no: batch.vessel_no ?? "" }); setMetaInit(true); }
  const isLocked = batch.status !== "draft";
  const storedTotal = Number(batch.grand_total_cny ?? 0);
  const liveTotal = fee_summary?.grand_total_cny ?? 0;
  const totalDrift = isLocked && Math.abs(storedTotal - liveTotal) > 0.01;

  const onAssign = async () => {
    if (!selected.size) { setShowAssign(false); return; }
    setBusy(true);
    try {
      await assign({ data: { batchId, waybillIds: Array.from(selected) } });
      setSelected(new Set()); setShowAssign(false);
      await qc.invalidateQueries({ queryKey: ["admin-batch", batchId] });
    } finally { setBusy(false); }
  };
  const onRemove = async (ids: string[]) => {
    if (!confirm("从批次移除选中运单？")) return;
    await assign({ data: { batchId, waybillIds: ids, remove: true } });
    await qc.invalidateQueries({ queryKey: ["admin-batch", batchId] });
  };
  const onSaveMeta = async () => {
    if (meta.eta_date && !/^\d{4}-\d{2}-\d{2}$/.test(meta.eta_date)) { alert("请输入完整的预计到货日期 YYYY-MM-DD"); return; }
    await updBatch({ data: { batchId, patch: { eta_date: meta.eta_date || null, vessel_no: meta.vessel_no || null } } });
    await qc.invalidateQueries({ queryKey: ["admin-batch", batchId] });
  };
  const onBulk = async () => {
    if (!bulkStatus && !bulkEvent.status_zh) return;
    setBusy(true);
    try {
      await bulkOp({
        data: {
          batchId,
          status: bulkStatus || undefined,
          event: bulkEvent.status_zh ? {
            status_zh: bulkEvent.status_zh,
            location_zh: bulkEvent.location_zh || undefined,
            event_time: bulkEvent.event_time ? new Date(bulkEvent.event_time).toISOString() : undefined,
          } : undefined,
        }
      });
      setShowBulk(false);
      setBulkStatus(""); setBulkEvent({ status_zh: "", location_zh: "", event_time: "" });
      await qc.invalidateQueries({ queryKey: ["admin-batch", batchId] });
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <BackLink to="/admin/batches">返回批次列表</BackLink>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold font-mono">{batch.batch_no}</h1>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
            <StatusBadge map={BATCH_STATUS_LABEL} color={BATCH_STATUS_COLOR} value={batch.status}/>
            <span>· 计划发货 {batch.planned_ship_date}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onPrintLabel}
            className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10">
            <Printer className="h-3 w-3"/>打印面单
          </button>
          {canEdit && (<>
            <button onClick={() => setShowScan(true)}
              className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand/90">
              <ScanLine className="h-3 w-3"/>扫码加入
            </button>
            <button onClick={() => setShowBulk(true)}
              className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10">
              <Wand2 className="h-3 w-3"/>批量操作运单
            </button>
            {(() => {
              const idx = BATCH_FLOW.findIndex(s => s.key === batch.status);
              const next = idx >= 0 && idx < BATCH_FLOW.length - 1 ? BATCH_FLOW[idx + 1] : null;
              return next ? (
                <button onClick={async () => {
                  if (!confirm(`将批次推进到「${next.label}」？状态将同步到所属箱号/托盘。`)) return;
                  await setBatchStatus({ data: { batchId, status: next.key as any } });
                  qc.invalidateQueries({ queryKey: ["admin-batch", batchId] });
                  qc.invalidateQueries({ queryKey: ["batch-cartons", batchId] });
                  qc.invalidateQueries({ queryKey: ["batch-pallets", batchId] });
                }}
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500">
                  推进到 {next.label} <ChevronRight className="h-3 w-3"/>
                </button>
              ) : null;
            })()}
            <select value={batch.status} onChange={async (e) => {
              await setBatchStatus({ data: { batchId, status: e.target.value as any } });
              qc.invalidateQueries({ queryKey: ["admin-batch", batchId] });
              qc.invalidateQueries({ queryKey: ["batch-cartons", batchId] });
              qc.invalidateQueries({ queryKey: ["batch-pallets", batchId] });
            }} className="rounded-md border border-slate-600 bg-slate-700 px-2 py-1.5 text-xs text-white [&>option]:bg-slate-700">
              {STATUSES.map(s => <option key={s} value={s}>{BATCH_STATUS_LABEL[s]}</option>)}
            </select>
          </>)}
        </div>
      </div>

      <WorkflowStepper flow={BATCH_FLOW} current={batch.status} title="批次流程 · 状态变化会自动同步所属箱号/托盘"/>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="批次信息">
          <div className="space-y-1 text-xs text-slate-300">
            <div>运输方式：{batch.shipping_method}</div>
            <div>货物类型：{batch.cargo_type ?? "—"}</div>
            <div>目的地：{batch.destination_code ?? "—"}</div>
            <div>序号：{batch.sequence_no}</div>
            <div>创建：{fmtDate(batch.created_at)}</div>
            <div>关闭：{batch.closed_at ? fmtDate(batch.closed_at) : "—"}</div>
          </div>
        </Card>
        <Card title="发运计划">
          <div className="grid grid-cols-1 gap-2 text-xs">
            <label className="text-slate-400">预计到货日期（直接输入年月日）
              <DateInput value={meta.eta_date} disabled={!canEdit} onChange={(v) => setMeta({ ...meta, eta_date: v })}/>
            </label>
            <label className="text-slate-400">船号 / 航空号
              <input disabled={!canEdit} value={meta.vessel_no} onChange={(e) => setMeta({ ...meta, vessel_no: e.target.value })}
                placeholder="如 COSCO-1234 / CX889"
                className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-slate-100"/>
            </label>
            {canEdit && <button onClick={onSaveMeta} className="mt-1 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white">保存</button>}
            <div className="mt-2 text-slate-500">运单总数：<span className="font-semibold text-slate-200">{waybill_total ?? waybills.length}</span>（直挂 {waybills.length} · 含箱号/托盘内）· 总重量 {batch.total_weight_kg ?? 0} kg · 总金额 CA${batch.total_cny ?? 0}</div>
            <div className="text-slate-500">备注：{batch.notes ?? "—"}</div>
          </div>
        </Card>
      </div>

      {independent_clearance && independent_clearance.groups?.length > 0 && (
        <Card title={`独立清关 × ${independent_clearance.customer_count} 个客户号`}>
          <div className="mb-2 text-[11px] text-slate-400">
            为本批次内含「批次级清关」线路的客户号各加一次<span className="text-slate-200">预设固定清关费</span>（非分摊，与运单数无关）。
            合计：<span className="ml-1 font-mono font-semibold text-emerald-300">CA${independent_clearance.total_fee_cny.toFixed(2)}</span>
            <span className="ml-2 text-slate-500">— 直接计入对应客户的本批账单</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">明细（线路 × 客户号 · 各加一次预设费）</div>
              <table className="w-full text-xs">
                <thead className="text-left text-[10px] uppercase text-slate-500">
                  <tr><th className="py-1">线路</th><th>客户号</th><th className="text-right">预设清关费</th></tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {independent_clearance.groups.map((g: any, i: number) => (
                    <tr key={i}>
                      <td className="py-1 font-mono">{g.route_code}</td>
                      <td className="font-mono">{g.customer_code}</td>
                      <td className="text-right font-mono text-emerald-300">CA${g.fee_cny.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">按客户号小计（账单口径）</div>
              <table className="w-full text-xs">
                <thead className="text-left text-[10px] uppercase text-slate-500">
                  <tr><th className="py-1">客户号</th><th className="text-right">独立清关费</th></tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {independent_clearance.per_customer.map((c: any, i: number) => (
                    <tr key={i}>
                      <td className="py-1 font-mono">{c.customer_code}</td>
                      <td className="text-right font-mono text-emerald-300">CA${c.fee_cny.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* ===== 批次费用汇总 ===== */}
      {fee_summary && (
        <Card title="批次费用汇总" action={
          isLocked
            ? <span className="text-[10px] text-emerald-300">已锁定 · 已写入 CA${storedTotal.toFixed(2)}{totalDrift && <span className="ml-2 text-amber-300">⚠ 与实时计算不一致：CA${liveTotal.toFixed(2)}（解锁后重算）</span>}</span>
            : <span className="text-[10px] text-slate-500">草稿状态 · 实时计算，锁定时写入</span>
        }>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FeeStat label="总运费"  value={fee_summary.totals.total_freight_cny}/>
            <FeeStat label="总关税"  value={fee_summary.totals.total_customs_cny}/>
            <FeeStat label="总保险"  value={fee_summary.totals.total_insurance_cny}/>
            <FeeStat label="总清关费" value={fee_summary.totals.total_clearance_cny}/>
            <FeeStat label="总仓储费" value={fee_summary.totals.total_storage_cny} pending/>
            <FeeStat label="总派送费" value={fee_summary.totals.total_delivery_cny} pending/>
            <FeeStat label="总检查费" value={fee_summary.totals.total_inspection_cny} pending/>
            <FeeStat label="总附加费" value={fee_summary.totals.total_surcharge_cny}/>
          </div>
          <div className="mt-3 flex items-baseline justify-end gap-2 border-t border-white/5 pt-3">
            <span className="text-xs text-slate-400">合计：</span>
            <span className="font-mono text-2xl font-bold text-emerald-300">CA${liveTotal.toFixed(2)}</span>
          </div>
        </Card>
      )}

      {/* ===== 按客户号账单 ===== */}
      {fee_summary && (
        <Card title={`按客户号账单（${fee_summary.per_customer.length} 个客户）`} action={
          <span className="text-[10px] text-slate-500">点击客户号查看明细 · 批次附加费在此层级归集</span>
        }>
          {fee_summary.per_customer.length === 0 && !fee_summary.unassigned ? (
            <div className="py-6 text-center text-xs text-slate-500">
              暂无客户号账单。请检查批次内的运单 / 客户号箱号 / 客户号托盘是否已正确绑定客户号。
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="py-2">客户号</th>
                  <th>线路</th>
                  <th className="text-right">运单数</th>
                  <th className="text-right">箱号</th>
                  <th className="text-right">托盘</th>
                  <th className="text-right">小计 CA$</th>
                  <th className="text-center">付款</th>
                  <th className="text-right">余额 CA$</th>
                  <th className="text-center">操作</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {fee_summary.per_customer.map((c: any) => (
                  <tr key={c.group_key ?? c.customer_code} className="cursor-pointer hover:bg-white/[0.03]" onClick={() => setDrawerCustomer(c.group_key ?? c.customer_code)}>
                    <td className="py-2 font-mono text-xs text-brand">{c.customer_code}{c.customer_name && <span className="ml-1 text-slate-500">· {c.customer_name}</span>}</td>
                    <td className="text-xs">
                      {c.route_code
                        ? <span className="inline-flex rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[10px] font-mono text-brand">{c.route_code}</span>
                        : <span className="text-[10px] text-slate-500">—</span>}
                    </td>
                    <td className="text-right text-xs font-mono">{c.waybill_count}</td>
                    <td className="text-right text-xs font-mono">{c.carton_count}</td>
                    <td className="text-right text-xs font-mono">{c.pallet_count}</td>
                    <td className="text-right text-xs font-mono font-semibold text-emerald-300">{c.subtotal_cny.toFixed(2)}</td>
                    <td className="text-center text-xs" onClick={(e) => e.stopPropagation()}>
                      {c.is_paid
                        ? <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300">已付款</span>
                        : <span className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-300">未付款</span>}
                    </td>
                    <td className="text-right text-xs font-mono text-slate-200">{c.user_id ? Number(c.balance_cad ?? 0).toFixed(2) : "—"}</td>
                    <td className="text-center" onClick={(e) => e.stopPropagation()}>
                      {canEdit && c.user_id ? (
                        <button
                          onClick={() => { setDeductState({ user_id: c.user_id, customer_code: c.customer_code, balance: Number(c.balance_cad ?? 0), subtotal: Number(c.subtotal_cny ?? 0) }); setDeductDiscount("0"); }}
                          className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 px-2 py-0.5 text-[10px] text-rose-300 hover:bg-rose-500/10">
                          <Wallet className="h-3 w-3"/>扣款
                        </button>
                      ) : <span className="text-[10px] text-slate-600">—</span>}
                    </td>
                    <td className="text-right pr-2"><ChevronRight className="inline h-3.5 w-3.5 text-slate-500"/></td>
                  </tr>
                ))}

                {fee_summary.unassigned && (
                  <tr className="bg-amber-500/5 text-slate-500">
                    <td className="py-2 text-xs" colSpan={2}><AlertCircle className="inline h-3 w-3 mr-1 text-amber-400"/>未指定客户（管理员排查）</td>
                    <td className="text-right text-xs font-mono">{fee_summary.unassigned.waybill_count}</td>
                    <td className="text-right text-xs font-mono">—</td>
                    <td className="text-right text-xs font-mono">—</td>
                    <td className="text-right text-xs font-mono text-slate-400">{fee_summary.unassigned.subtotal_cny.toFixed(2)}</td>
                    <td colSpan={4}></td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* ===== 批次附加费（按客户号归集） ===== */}
      <SurchargePanel scope="batch" id={batchId} canEdit={canEdit} showCustomerField
        title="批次附加费（按客户号账单层级 · 每条必须指定归属客户号）"
        onChanged={() => qc.invalidateQueries({ queryKey: ["admin-batch", batchId] })}/>

      {(() => {
        const wbTotal = waybills.reduce((s: number, w: any) => s + Number(w.total_cad ?? 0), 0);
        const ctItems = cartonsQ.data?.items ?? [];
        const ctTotal = ctItems.reduce((s: number, c: any) => s + Number(c.customer_code ? c.with_customer_total_cad ?? 0 : c.without_customer_total_cad ?? 0), 0);
        const plItems = palletsQ.data?.items ?? [];
        const plTotal = plItems.reduce((s: number, p: any) => s + Number(p.customer_code ? p.with_customer_total_cad ?? 0 : p.without_customer_total_cad ?? 0), 0);
        return (
          <div className="flex gap-2 border-b border-white/10 text-xs">
            {([
              ["waybills", `运单 (${waybills.length}) · CA$${wbTotal.toFixed(2)}`],
              ["cartons", `箱号 (${ctItems.length}) · CA$${ctTotal.toFixed(2)}`],
              ["pallets", `托盘 (${plItems.length}) · CA$${plTotal.toFixed(2)}`],
            ] as const).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k as any)}
                className={`px-3 py-2 ${tab === k ? "border-b-2 border-brand text-brand" : "text-slate-400 hover:text-slate-200"}`}>{l}</button>
            ))}
          </div>
        );
      })()}

      {tab === "waybills" && (
        <Card title={`运单 (${waybills.length})`} action={canEdit && (
          <button onClick={() => setShowScan(true)} className="inline-flex items-center gap-1 rounded-md bg-brand px-2 py-1 text-xs font-semibold text-white hover:bg-brand/90">
            <ScanLine className="h-3 w-3"/>扫码加入
          </button>
        )}>
          <WaybillCompactList waybills={waybills as any} onKick={canEdit ? async (w) => { await onRemove([w.id]); } : undefined}/>
        </Card>
      )}

      {tab === "cartons" && (
        <Card title={`箱号 (${cartonsQ.data?.items.length ?? 0})`} action={canEdit && (
          <button onClick={() => setShowScan(true)} className="inline-flex items-center gap-1 rounded-md bg-brand px-2 py-1 text-xs font-semibold text-white"><ScanLine className="h-3 w-3"/>扫码加入</button>
        )}>
          <CartonCompactList cartons={(cartonsQ.data?.items ?? []) as any}
            onKick={canEdit ? async (c) => { await updCarton({ data: { id: c.id, patch: { batch_id: null } } }); qc.invalidateQueries({ queryKey: ["batch-cartons", batchId] }); } : undefined}/>
        </Card>
      )}

      {tab === "pallets" && (
        <Card title={`托盘 (${palletsQ.data?.items.length ?? 0})`} action={canEdit && (
          <button onClick={() => setShowScan(true)} className="inline-flex items-center gap-1 rounded-md bg-brand px-2 py-1 text-xs font-semibold text-white"><ScanLine className="h-3 w-3"/>扫码加入</button>
        )}>
          <PalletCompactList pallets={(palletsQ.data?.items ?? []) as any}
            onKick={canEdit ? async (p) => { await updPallet({ data: { id: p.id, patch: { batch_id: null } } }); qc.invalidateQueries({ queryKey: ["batch-pallets", batchId] }); } : undefined}
            onSplit={canEdit ? async (p) => {
              if (!confirm(`拆分托盘 ${p.pallet_no}？下属箱号/运单将回到批次层级，托盘会被删除。`)) return;
              const r = await doSplitPallet({ data: { id: p.id } });
              alert(`已拆分：释放 ${r.released_cartons} 箱 / ${r.released_waybills} 单`);
              qc.invalidateQueries({ queryKey: ["batch-pallets", batchId] });
              qc.invalidateQueries({ queryKey: ["batch-cartons", batchId] });
              qc.invalidateQueries({ queryKey: ["admin-batch", batchId] });
            } : undefined}/>
        </Card>
      )}



      <Card title="操作记录">
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {logs.length === 0 && <div className="text-xs text-slate-500">暂无</div>}
          {logs.map((l: any) => (
            <div key={l.id} className="rounded-md border border-white/5 bg-white/[0.02] p-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">{l.action}</span>
                <span className="text-slate-500">{fmtDate(l.created_at)}</span>
              </div>
              <div className="text-slate-400">操作人：{l.operator_name ?? "—"}</div>
            </div>
          ))}
        </div>
      </Card>

      {showAssign && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#0A0F1A] p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">选择运单加入批次</h2>
              <button onClick={() => setShowAssign(false)} className="text-slate-400 hover:text-white"><X className="h-4 w-4"/></button>
            </div>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索运单号"
              className="mb-3 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-slate-100"/>
            <div className="max-h-96 overflow-y-auto rounded-lg border border-white/5">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-white/5">
                  {availQ.data?.waybills.filter((w: any) => w.assigned_batch_id !== batchId).map((w: any) => (
                    <tr key={w.id} className={selected.has(w.id) ? "bg-brand/10" : ""}>
                      <td className="px-2 py-1.5"><input type="checkbox" checked={selected.has(w.id)} onChange={() => {
                        const s = new Set(selected); s.has(w.id) ? s.delete(w.id) : s.add(w.id); setSelected(s);
                      }}/></td>
                      <td className="font-mono text-xs">{w.waybill_no}</td>
                      <td className="text-xs"><StatusBadge map={WAYBILL_STATUS_LABEL} color={WAYBILL_STATUS_COLOR} value={w.status}/></td>
                      <td className="text-xs text-slate-400">{w.batch_no ? `已属批次 ${w.batch_no}` : "未分配"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setShowAssign(false)} className="rounded-md border border-white/10 px-3 py-1.5 text-xs">取消</button>
              <button onClick={onAssign} disabled={busy || !selected.size}
                className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">加入 {selected.size} 条</button>
            </div>
          </div>
        </div>
      )}

      {showBulk && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0A0F1A] p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">批量操作 · 此批次全部运单</h2>
              <button onClick={() => setShowBulk(false)} className="text-slate-400"><X className="h-4 w-4"/></button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400">批量改状态</label>
                <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as any)}
                  className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-slate-100 [&>option]:bg-[#0E1626]">
                  <option value="">— 不更改 —</option>
                  {WAYBILL_STATUSES.map(s => <option key={s} value={s}>{WAYBILL_STATUS_LABEL[s]}</option>)}
                </select>
              </div>
              <div className="border-t border-white/10 pt-3">
                <div className="mb-1 text-slate-400">批量添加物流轨迹</div>
                <input placeholder="状态描述（中文）" value={bulkEvent.status_zh} onChange={(e) => setBulkEvent({ ...bulkEvent, status_zh: e.target.value })}
                  className="mb-2 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-slate-100"/>
                <input placeholder="位置（可选）" value={bulkEvent.location_zh} onChange={(e) => setBulkEvent({ ...bulkEvent, location_zh: e.target.value })}
                  className="mb-2 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-slate-100"/>
                <input type="datetime-local" value={bulkEvent.event_time} onChange={(e) => setBulkEvent({ ...bulkEvent, event_time: e.target.value })}
                  className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-slate-100"/>
              </div>
              <button disabled={busy} onClick={onBulk} className="w-full rounded-md bg-brand py-2 text-sm font-semibold text-white disabled:opacity-50">
                {busy ? "执行中…" : `应用到 ${waybills.length} 条运单`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddCarton && (
        <PickerDialog title="加入箱号" onClose={() => setShowAddCarton(false)}
          rows={allCartonsQ.data?.items.filter((c: any) => c.batch_id !== batchId) ?? []}
          renderRow={(c: any) => `${c.carton_no}${c.batch_no ? ` · 已在 ${c.batch_no}` : ""}`}
          onConfirm={async (ids) => {
            for (const id of ids) await updCarton({ data: { id, patch: { batch_id: batchId } } });
            await qc.invalidateQueries({ queryKey: ["batch-cartons", batchId] });
            setShowAddCarton(false);
          }}/>
      )}
      {showAddPallet && (
        <PickerDialog title="加入托盘" onClose={() => setShowAddPallet(false)}
          rows={allPalletsQ.data?.items.filter((p: any) => p.batch_id !== batchId) ?? []}
          renderRow={(p: any) => `${p.pallet_no}${p.batch_no ? ` · 已在 ${p.batch_no}` : ""}`}
          onConfirm={async (ids) => {
            for (const id of ids) await updPallet({ data: { id, patch: { batch_id: batchId } } });
            await qc.invalidateQueries({ queryKey: ["batch-pallets", batchId] });
            setShowAddPallet(false);
          }}/>
      )}
      <ScanAddDialog open={showScan} onClose={() => setShowScan(false)} container="batch" containerId={batchId}
        onChanged={() => {
          qc.invalidateQueries({ queryKey: ["admin-batch", batchId] });
          qc.invalidateQueries({ queryKey: ["batch-cartons", batchId] });
          qc.invalidateQueries({ queryKey: ["batch-pallets", batchId] });
        }}/>

      {drawerCustomer && (() => {
        const cd = fee_summary?.per_customer.find((c: any) => (c.group_key ?? c.customer_code) === drawerCustomer);
        if (!cd) return null;
        return (
          <CustomerDrawer batchId={batchId} customerCode={cd.customer_code ?? ""}
            customerData={cd}
            onClose={() => setDrawerCustomer(null)} canEdit={canEdit}/>
        );
      })()}


      {deductState && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0A0F1A] p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold inline-flex items-center gap-2"><Wallet className="h-4 w-4 text-rose-300"/>钱包扣款</h2>
              <button onClick={() => setDeductState(null)}><X className="h-4 w-4 text-slate-400"/></button>
            </div>
            {(() => {
              const sub = Number(deductState.subtotal ?? 0);
              const disc = Math.max(0, Math.min(sub, Number(deductDiscount || 0)));
              const finalAmt = +(sub - disc).toFixed(2);
              return (
                <>
                  <div className="space-y-2 text-xs text-slate-300">
                    <div>客户号：<span className="font-mono text-brand">{deductState.customer_code}</span></div>
                    <div>当前余额：<span className="font-mono text-emerald-300">CA${deductState.balance.toFixed(2)}</span></div>
                    <label className="block text-slate-400">应扣金额 (CAD) · 已锁定
                      <input readOnly value={sub.toFixed(2)}
                        className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-slate-400 cursor-not-allowed"/>
                    </label>
                    <label className="block text-slate-400">折扣 (CAD)
                      <input type="number" step="0.01" min="0" max={sub} value={deductDiscount}
                        onChange={(e) => setDeductDiscount(e.target.value)}
                        className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-slate-100"/>
                    </label>
                    <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-emerald-200">
                      实际扣款：<span className="font-mono font-bold">CA${finalAmt.toFixed(2)}</span>
                      {disc > 0 && <span className="ml-2 text-[10px] text-emerald-300/80">（折扣 CA${disc.toFixed(2)}）</span>}
                    </div>
                    <div className="text-[10px] text-slate-500">确认后：生成账单并结清 · 记录钱包流水 · 该客户批次未付运单标记为已付款 · 写入操作记录与物流轨迹 · 折扣计入批次账单明细。</div>
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <button onClick={() => setDeductState(null)} className="rounded-md border border-white/10 px-3 py-1.5 text-xs">取消</button>
                    <button
                      onClick={async () => {
                        if (!(sub > 0)) { alert("金额需大于 0"); return; }
                        try {
                          await deduct({ data: { batchId, userId: deductState.user_id, amountCad: sub, discountCad: disc, note: `批次 ${batch.batch_no} 扣款` } });
                          setDeductState(null); setDeductDiscount("0");
                          await qc.invalidateQueries({ queryKey: ["admin-batch", batchId] });
                        } catch (e: any) { alert(e.message); }
                      }}
                      className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500">确认扣款</button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

function FeeStat({ label, value, pending }: { label: string; value: number; pending?: boolean }) {
  return (
    <div className={`rounded-lg border p-2.5 ${pending ? "border-white/5 bg-white/[0.01]" : "border-white/10 bg-white/[0.03]"}`}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
        {pending && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-300">待定</span>}
      </div>
      <div className={`mt-1 font-mono text-sm font-bold ${pending ? "text-slate-500" : "text-slate-100"}`}>CA${Number(value ?? 0).toFixed(2)}</div>
    </div>
  );
}

function PickerDialog({ title, rows, renderRow, onConfirm, onClose }: {
  title: string; rows: any[]; renderRow: (r: any) => string; onConfirm: (ids: string[]) => Promise<void>; onClose: () => void;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0A0F1A] p-5">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-lg font-bold">{title}</h2>
          <button onClick={onClose}><X className="h-4 w-4 text-slate-400"/></button></div>
        <div className="max-h-96 overflow-y-auto rounded-lg border border-white/5">
          <table className="w-full text-sm"><tbody className="divide-y divide-white/5">
            {rows.length === 0 && <tr><td className="py-6 text-center text-slate-500">没有可选项</td></tr>}
            {rows.map((r: any) => (
              <tr key={r.id} className={sel.has(r.id) ? "bg-brand/10" : ""}>
                <td className="px-2 py-1.5"><input type="checkbox" checked={sel.has(r.id)} onChange={() => { const s = new Set(sel); s.has(r.id) ? s.delete(r.id) : s.add(r.id); setSel(s); }}/></td>
                <td className="font-mono text-xs">{renderRow(r)}</td>
              </tr>
            ))}
          </tbody></table>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-white/10 px-3 py-1.5 text-xs">取消</button>
          <button disabled={busy || !sel.size} onClick={async () => { setBusy(true); try { await onConfirm(Array.from(sel)); } finally { setBusy(false); } }}
            className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">加入 {sel.size} 条</button>
        </div>
      </div>
    </div>
  );
}
