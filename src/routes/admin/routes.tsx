import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listRoutes, upsertRoute, deleteRoute, quoteFreight,
  type ShippingRoute, type FreightRule, type CustomsRule, type ShippingMethod, type WeightMode, type ItemFieldKey,
} from "@/lib/settings.functions";
import { listDestinations } from "@/lib/presets.functions";
import { getMyRoles } from "@/lib/admin.functions";
import { VIP_LEVELS, VIP_LABEL, type VipLevel } from "@/lib/vip-levels";
import { Loader2, Plus, Pencil, Trash2, Route as RouteIcon, X, Calculator } from "lucide-react";


export const ITEM_FIELD_OPTIONS: { v: ItemFieldKey; label: string }[] = [
  { v: "name", label: "品名/名称" },
  { v: "hscode", label: "HSCODE" },
  { v: "box_count", label: "箱数/板数" },
  { v: "inner_qty", label: "内件数/箱·板" },
  { v: "material", label: "材质" },
  { v: "origin", label: "产地" },
  { v: "unit_price", label: "单价 (¥)" },
  { v: "quantity", label: "数量" },
  { v: "brand", label: "品牌" },
  { v: "length_cm", label: "每箱/板 长 (cm)" },
  { v: "width_cm", label: "每箱/板 宽 (cm)" },
  { v: "height_cm", label: "每箱/板 高 (cm)" },
  { v: "weight_kg", label: "每箱/板 重 (kg)" },
];

export const Route = createFileRoute("/admin/routes")({
  component: RoutesPage,
});

const METHOD_OPTIONS: { v: ShippingMethod; label: string }[] = [
  { v: "air", label: "空运" }, { v: "sea", label: "海运" },
  { v: "express", label: "快递" }, { v: "truck", label: "陆运" },
];
const WEIGHT_MODE_OPTIONS: { v: WeightMode; label: string }[] = [
  { v: "actual", label: "只算实重" },
  { v: "volumetric", label: "只算体积重" },
  { v: "max", label: "取大 (实重 vs 体积重)" },
];

function RoutesPage() {
  const fetchList = useServerFn(listRoutes);
  const fetchRoles = useServerFn(getMyRoles);
  const q = useQuery({ queryKey: ["admin-routes"], queryFn: () => fetchList() });
  const meQ = useQuery({ queryKey: ["my-roles"], queryFn: () => fetchRoles(), staleTime: 60_000 });
  const canEdit = (meQ.data?.roles ?? []).some((r) => r === "owner" || r === "manager");

  const [editing, setEditing] = useState<any | null>(null);

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold inline-flex items-center gap-2">
            <RouteIcon className="h-5 w-5 text-blue-400" />线路 / 运费 / 关税
          </h1>
          <p className="mt-1 text-sm text-slate-400">{q.data ? `共 ${q.data.routes.length} 条线路` : "加载中…"}</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setEditing({})}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand/90"
          >
            <Plus className="h-4 w-4" />新增线路
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02]">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-[11px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-2.5">编码 / 名称</th>
              <th className="px-4 py-2.5">方式</th>
              <th className="px-4 py-2.5">起点 → 终点</th>
              <th className="px-4 py-2.5">时效</th>
              <th className="px-4 py-2.5">运费公式</th>
              <th className="px-4 py-2.5">关税</th>
              <th className="px-4 py-2.5">状态</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {q.isLoading && (<tr><td colSpan={8} className="px-4 py-12 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-500" /></td></tr>)}
            {q.isError && (<tr><td colSpan={8} className="px-4 py-12 text-center text-rose-400">{(q.error as Error).message}</td></tr>)}
            {q.data?.routes.length === 0 && (<tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">暂无线路，请先新增</td></tr>)}
            {q.data?.routes.map((r: any) => {
              const wm = r.freight ? WEIGHT_MODE_OPTIONS.find((x) => x.v === r.freight.weight_mode)?.label : "—";
              return (
                <tr key={r.id} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-slate-300">{r.code}</div>
                    <div className="text-sm font-medium text-slate-100">{r.name_zh}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {METHOD_OPTIONS.find((m) => m.v === r.shipping_method)?.label}
                    <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] ${r.cargo_type === "sensitive" ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300"}`}>
                      {r.cargo_type === "sensitive" ? "敏感货" : "普货"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-300">
                    {r.origin?.name_zh ?? <span className="text-slate-500">未设</span>}
                    <span className="mx-1 text-slate-500">→</span>
                    {r.destination?.name_zh ?? <span className="text-slate-500">未设</span>}
                    {r.destination_code && <span className="ml-1 font-mono text-[10px] text-slate-500">[{r.destination_code}]</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {r.transit_days_min ?? "?"} – {r.transit_days_max ?? "?"} 天
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.freight ? (
                      <div>
                        <div>{wm}</div>
                        <div className="text-slate-400">CA${Number(r.freight.unit_price_cad ?? (Number(r.freight.unit_price_cny ?? 0) * 0.19)).toFixed(2)}/kg · 除数{r.freight.volumetric_divisor}</div>
                      </div>
                    ) : <span className="text-rose-400">未配置</span>}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.customs?.enabled
                      ? <span className="text-amber-300">{Number(r.customs.rate_pct).toFixed(1)}% · ≥CA${Number(r.customs.threshold_cad).toFixed(0)}</span>
                      : <span className="text-slate-500">免</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${r.is_active ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-slate-500/30 bg-slate-500/10 text-slate-400"}`}>
                      {r.is_active ? "启用" : "停用"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canEdit ? (
                      <button onClick={() => setEditing(r)} className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs hover:bg-white/5">
                        <Pencil className="h-3 w-3" />编辑
                      </button>
                    ) : <span className="text-xs text-slate-600">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && canEdit && q.data && (
        <RouteEditor
          initial={editing}
          warehouses={q.data.warehouses as any[]}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function RouteEditor({ initial, warehouses, onClose }: { initial: any; warehouses: any[]; onClose: () => void }) {
  const qc = useQueryClient();
  const save = useServerFn(upsertRoute);
  const del = useServerFn(deleteRoute);
  const quote = useServerFn(quoteFreight);
  const fetchDests = useServerFn(listDestinations);
  const destsQ = useQuery({ queryKey: ["destinations-active"], queryFn: () => fetchDests(), staleTime: 60_000 });
  const destOptions = (destsQ.data?.items ?? []).filter((d: any) => d.active);

  const [route, setRoute] = useState<Partial<ShippingRoute>>({
    code: initial.code ?? "",
    name_zh: initial.name_zh ?? "",
    name_en: initial.name_en ?? "",
    origin_warehouse_id: initial.origin_warehouse_id ?? null,
    destination_warehouse_id: initial.destination_warehouse_id ?? null,
    shipping_method: initial.shipping_method ?? "air",
    cargo_type: initial.cargo_type ?? "general",
    destination_code: initial.destination_code ?? "",
    transit_days_min: initial.transit_days_min ?? 7,
    transit_days_max: initial.transit_days_max ?? 14,
    is_active: initial.is_active ?? true,
    sort_order: initial.sort_order ?? 0,
    note: initial.note ?? "",
    item_fields: (initial.item_fields && initial.item_fields.length > 0
      ? initial.item_fields
      : ["name", "quantity", "unit_price"]) as ItemFieldKey[],
    item_field_required: (initial.item_field_required ?? { name: true }) as any,
    last_mile_fee_cad: Number(initial.last_mile_fee_cad ?? 0),
    last_mile_threshold_kg: Number(initial.last_mile_threshold_kg ?? 0),
    last_mile_step_kg: Number(initial.last_mile_step_kg ?? 1),
    last_mile_rate_cad: Number(initial.last_mile_rate_cad ?? 0),
    last_mile_formula: (initial.last_mile_formula ?? null) as string | null,
    is_bidirectional: !!initial.is_bidirectional,
    sales_tax_enabled: !!initial.sales_tax_enabled,
    sales_tax_rate_pct: Number(initial.sales_tax_rate_pct ?? 0),
    visible_vip_levels: (initial.visible_vip_levels && initial.visible_vip_levels.length > 0
      ? initial.visible_vip_levels
      : [...VIP_LEVELS]) as VipLevel[],
    visible_customer_codes: (initial.visible_customer_codes ?? []) as string[],
    blacklist_vip_levels: (initial.blacklist_vip_levels ?? []) as VipLevel[],
    blacklist_customer_codes: (initial.blacklist_customer_codes ?? []) as string[],
  });


  const [freight, setFreight] = useState<FreightRule>({
    weight_mode: initial.freight?.weight_mode ?? "max",
    volumetric_divisor: Number(initial.freight?.volumetric_divisor ?? 6000),
    unit_price_cad: Number(initial.freight?.unit_price_cad ?? (Number(initial.freight?.unit_price_cny ?? 0) * 0.19)),
    min_charge_cad: Number(initial.freight?.min_charge_cad ?? (Number(initial.freight?.min_charge_cny ?? 0) * 0.19)),
    clearance_fee_cad: Number(initial.freight?.clearance_fee_cad ?? (Number(initial.freight?.extra_fee_cny ?? 0) * 0.19)),
    insurance_rate_pct: Number(initial.freight?.insurance_rate_pct ?? 0),
    is_active: true,
    pricing_mode: (initial.freight?.pricing_mode as any) ?? "weight",
    pallet_unit_price_cad: Number(initial.freight?.pallet_unit_price_cad ?? 0),
    pallet_max_length_cm: initial.freight?.pallet_max_length_cm ?? null,
    pallet_max_width_cm: initial.freight?.pallet_max_width_cm ?? null,
    pallet_max_height_cm: initial.freight?.pallet_max_height_cm ?? null,
    pallet_max_weight_kg: initial.freight?.pallet_max_weight_kg ?? null,
    pallet_overflow_factor: Number(initial.freight?.pallet_overflow_factor ?? 2),
    clearance_fee_level: (initial.freight?.clearance_fee_level as any) ?? "waybill",
    min_charge_level: (initial.freight?.min_charge_level as any) ?? "waybill",
  });

  const mkFreight = (src: any): FreightRule => ({
    weight_mode: src?.weight_mode ?? "max",
    volumetric_divisor: Number(src?.volumetric_divisor ?? 6000),
    unit_price_cad: Number(src?.unit_price_cad ?? (Number(src?.unit_price_cny ?? 0) * 0.19)),
    min_charge_cad: Number(src?.min_charge_cad ?? (Number(src?.min_charge_cny ?? 0) * 0.19)),
    clearance_fee_cad: Number(src?.clearance_fee_cad ?? (Number(src?.extra_fee_cny ?? 0) * 0.19)),
    insurance_rate_pct: Number(src?.insurance_rate_pct ?? 0),
    is_active: true,
    pricing_mode: (src?.pricing_mode as any) ?? "weight",
    pallet_unit_price_cad: Number(src?.pallet_unit_price_cad ?? 0),
    pallet_max_length_cm: src?.pallet_max_length_cm ?? null,
    pallet_max_width_cm: src?.pallet_max_width_cm ?? null,
    pallet_max_height_cm: src?.pallet_max_height_cm ?? null,
    pallet_max_weight_kg: src?.pallet_max_weight_kg ?? null,
    pallet_overflow_factor: Number(src?.pallet_overflow_factor ?? 2),
    clearance_fee_level: (src?.clearance_fee_level as any) ?? "waybill",
    min_charge_level: (src?.min_charge_level as any) ?? "waybill",
  });
  const [freightReverse, setFreightReverse] = useState<FreightRule>(
    mkFreight(initial.freight_reverse ?? initial.freight ?? {})
  );
  const [quoteDirection, setQuoteDirection] = useState<"forward" | "reverse">("forward");

  const [customs, setCustoms] = useState<CustomsRule>({
    enabled: initial.customs?.enabled ?? false,
    rate_pct: Number(initial.customs?.rate_pct ?? 5),
    threshold_cad: Number(initial.customs?.threshold_cad ?? 20),
    note: initial.customs?.note ?? "",
  });

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // calculator
  const [calc, setCalc] = useState({ weight: 5, volume: 30000, declared: 100, L: 0, W: 0, H: 0 });
  const [calcResult, setCalcResult] = useState<any>(null);
  const [calcBusy, setCalcBusy] = useState(false);

  const runQuote = async () => {
    if (!initial.id) { setCalcResult({ error: "请先保存线路再试算" }); return; }
    setCalcBusy(true);
    try {
      const r = await quote({ data: {
        route_id: initial.id, weight_kg: calc.weight, volume_cm3: calc.volume, declared_cad: calc.declared,
        length_cm: calc.L || undefined, width_cm: calc.W || undefined, height_cm: calc.H || undefined,
        direction: quoteDirection,
      } });
      setCalcResult(r);
    } catch (e: any) { setCalcResult({ error: e?.message }); }
    finally { setCalcBusy(false); }
  };


  const onSave = async () => {
    setBusy(true); setErr(null);
    try {
      if (!route.code || !route.name_zh) throw new Error("线路编码与名称为必填");
      await save({
        data: {
          id: initial.id,
          route: {
            code: route.code!, name_zh: route.name_zh!, name_en: route.name_en ?? null,
            origin_warehouse_id: route.origin_warehouse_id ?? null,
            destination_warehouse_id: route.destination_warehouse_id ?? null,
            shipping_method: (route.shipping_method ?? "air") as any,
            cargo_type: (route.cargo_type ?? "general") as any,
            destination_code: route.destination_code ?? null,
            transit_days_min: route.transit_days_min ? Number(route.transit_days_min) : null,
            transit_days_max: route.transit_days_max ? Number(route.transit_days_max) : null,
            is_active: !!route.is_active,
            sort_order: Number(route.sort_order ?? 0),
            note: route.note ?? null,
            item_fields: (route.item_fields && route.item_fields.length > 0 ? route.item_fields : ["name","quantity","unit_price"]) as ItemFieldKey[],
            item_field_required: (route.item_field_required ?? {}) as any,
            last_mile_fee_cad: Number(route.last_mile_fee_cad ?? 0),
            last_mile_threshold_kg: Number(route.last_mile_threshold_kg ?? 0),
            last_mile_step_kg: Number(route.last_mile_step_kg ?? 1),
            last_mile_rate_cad: Number(route.last_mile_rate_cad ?? 0),
            last_mile_formula: route.last_mile_formula ?? null,
            is_bidirectional: !!route.is_bidirectional,
            sales_tax_enabled: !!route.sales_tax_enabled,
            sales_tax_rate_pct: Number(route.sales_tax_rate_pct ?? 0),
            visible_vip_levels: (route.visible_vip_levels && route.visible_vip_levels.length > 0 ? route.visible_vip_levels : [...VIP_LEVELS]) as VipLevel[],
            visible_customer_codes: (route.visible_customer_codes ?? []).filter((s) => s && s.trim()).map((s) => s.trim()),
            blacklist_vip_levels: (route.blacklist_vip_levels ?? []) as VipLevel[],
            blacklist_customer_codes: (route.blacklist_customer_codes ?? []).filter((s) => s && s.trim()).map((s) => s.trim()),
          },

          freight,
          freight_reverse: route.is_bidirectional ? freightReverse : null,
          customs,
        },
      });
      await qc.invalidateQueries({ queryKey: ["admin-routes"] });
      onClose();
    } catch (e: any) { setErr(e?.message ?? "保存失败"); }
    finally { setBusy(false); }
  };

  const onDelete = async () => {
    if (!initial.id) return;
    if (!confirm(`确定删除线路「${route.name_zh}」？相关运费/关税规则将一并删除。`)) return;
    setBusy(true); setErr(null);
    try {
      await del({ data: { id: initial.id } });
      await qc.invalidateQueries({ queryKey: ["admin-routes"] });
      onClose();
    } catch (e: any) { setErr(e?.message ?? "删除失败"); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0E1626] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{initial.id ? "编辑线路" : "新增线路"}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          {/* Left form */}
          <div className="space-y-5">
            <Section title="线路基本信息">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Field label="编码 *"><Input value={route.code ?? ""} onChange={(v) => setRoute({ ...route, code: v.toUpperCase() })} placeholder="AIR-GZ-YVR" /></Field>
                <Field label="排序"><Input type="number" value={String(route.sort_order ?? 0)} onChange={(v) => setRoute({ ...route, sort_order: Number(v) })} /></Field>
                <Field label="中文名 *"><Input value={route.name_zh ?? ""} onChange={(v) => setRoute({ ...route, name_zh: v })} placeholder="广州→温哥华 空运" /></Field>
                <Field label="英文名"><Input value={route.name_en ?? ""} onChange={(v) => setRoute({ ...route, name_en: v })} /></Field>
                <Field label="运输方式">
                  <Select value={route.shipping_method ?? "air"} onChange={(v) => setRoute({ ...route, shipping_method: v as any })} options={METHOD_OPTIONS as any} />
                </Field>
                <Field label="货物类型">
                  <Select value={route.cargo_type ?? "general"} onChange={(v) => setRoute({ ...route, cargo_type: v as any })}
                    options={[{ v: "general", label: "普货" }, { v: "sensitive", label: "敏感货" }] as any} />
                </Field>
                <Field label="目的地 (运单号用)">
                  <Select value={route.destination_code ?? ""} onChange={(v) => setRoute({ ...route, destination_code: v || null })}
                    options={[{ v: "", label: "— 未指定 —" }, ...destOptions.map((d: any) => ({ v: d.code, label: `${d.name_zh} (${d.code})` }))]} />
                </Field>
                <Field label="起点仓">
                  <Select value={route.origin_warehouse_id ?? ""} onChange={(v) => setRoute({ ...route, origin_warehouse_id: v || null })}
                    options={[{ v: "", label: "— 未指定 —" }, ...warehouses.filter((w) => w.can_origin).map((w) => ({ v: w.id, label: `${w.name_zh} (${w.code})` }))]} />
                </Field>
                <Field label="终点仓">
                  <Select value={route.destination_warehouse_id ?? ""} onChange={(v) => setRoute({ ...route, destination_warehouse_id: v || null })}
                    options={[{ v: "", label: "— 未指定 —" }, ...warehouses.filter((w) => w.can_destination).map((w) => ({ v: w.id, label: `${w.name_zh} (${w.code})` }))]} />
                </Field>
                <Field label="时效 最短 (天)"><Input type="number" value={String(route.transit_days_min ?? "")} onChange={(v) => setRoute({ ...route, transit_days_min: Number(v) })} /></Field>
                <Field label="时效 最长 (天)"><Input type="number" value={String(route.transit_days_max ?? "")} onChange={(v) => setRoute({ ...route, transit_days_max: Number(v) })} /></Field>
                <Field label="备注" full><Input value={route.note ?? ""} onChange={(v) => setRoute({ ...route, note: v })} /></Field>
                <Field label="状态">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!route.is_active} onChange={(e) => setRoute({ ...route, is_active: e.target.checked })} className="h-4 w-4 accent-brand" />
                    <span>启用</span>
                  </label>
                </Field>
                <Field label="双向线路">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!route.is_bidirectional} onChange={(e) => setRoute({ ...route, is_bidirectional: e.target.checked })} className="h-4 w-4 accent-brand" />
                    <span>本线路可双向使用（起点 ↔ 终点）</span>
                  </label>
                </Field>
                <Field label="消费税">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!route.sales_tax_enabled} onChange={(e) => setRoute({ ...route, sales_tax_enabled: e.target.checked })} className="h-4 w-4 accent-brand" />
                    <span>对本线路加收消费税</span>
                  </label>
                </Field>
                <Field label="消费税率 %">
                  <Input type="number" value={String(route.sales_tax_rate_pct ?? 0)} onChange={(v) => setRoute({ ...route, sales_tax_rate_pct: Number(v) })} />
                </Field>
              </div>
            </Section>

            <Section title="可见线路权限（按客户等级 / 客户号筛选）">
              <div className="space-y-3 text-sm">
                <div>
                  <div className="mb-1.5 text-[10px] uppercase tracking-wider text-slate-400">可见客户等级（白名单）</div>
                  <div className="flex flex-wrap gap-2">
                    {VIP_LEVELS.map((lv) => {
                      const checked = (route.visible_vip_levels ?? []).includes(lv);
                      return (
                        <label key={lv} className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs ${checked ? "border-brand/40 bg-brand/10 text-brand" : "border-white/10 bg-white/5 text-slate-300"} cursor-pointer`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const cur = new Set(route.visible_vip_levels ?? []);
                              if (e.target.checked) cur.add(lv); else cur.delete(lv);
                              setRoute({ ...route, visible_vip_levels: Array.from(cur) as VipLevel[] });
                            }}
                            className="h-3.5 w-3.5 accent-brand"
                          />
                          {VIP_LABEL[lv]}
                        </label>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">仅勾选等级的客户可见本线路。未勾选任何等级 = 默认全部等级可见。</p>
                </div>
                <div>
                  <div className="mb-1.5 text-[10px] uppercase tracking-wider text-slate-400">额外客户号白名单（不论等级一律可见）</div>
                  <textarea
                    value={(route.visible_customer_codes ?? []).join("\n")}
                    onChange={(e) => setRoute({ ...route, visible_customer_codes: e.target.value.split(/[\n,;\s]+/).filter(Boolean) })}
                    rows={3}
                    placeholder="每行 / 逗号 / 空格分隔，例如：&#10;LV0001&#10;LV0023"
                    className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-mono placeholder:text-slate-500 focus:border-brand focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">已添加 {(route.visible_customer_codes ?? []).length} 个客户号。留空则不附加额外白名单。</p>
                </div>

                <div className="mt-2 border-t border-white/5 pt-3">
                  <div className="mb-1.5 text-[10px] uppercase tracking-wider text-rose-300/80">客户等级黑名单（一律隐藏）</div>
                  <div className="flex flex-wrap gap-2">
                    {VIP_LEVELS.map((lv) => {
                      const checked = (route.blacklist_vip_levels ?? []).includes(lv);
                      return (
                        <label key={lv} className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs ${checked ? "border-rose-500/40 bg-rose-500/10 text-rose-300" : "border-white/10 bg-white/5 text-slate-300"} cursor-pointer`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const cur = new Set(route.blacklist_vip_levels ?? []);
                              if (e.target.checked) cur.add(lv); else cur.delete(lv);
                              setRoute({ ...route, blacklist_vip_levels: Array.from(cur) as VipLevel[] });
                            }}
                            className="h-3.5 w-3.5 accent-rose-400"
                          />
                          {VIP_LABEL[lv]}
                        </label>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">黑名单优先于白名单：勾选等级的客户始终看不到此线路。</p>
                </div>
                <div>
                  <div className="mb-1.5 text-[10px] uppercase tracking-wider text-rose-300/80">客户号黑名单（强制隐藏）</div>
                  <textarea
                    value={(route.blacklist_customer_codes ?? []).join("\n")}
                    onChange={(e) => setRoute({ ...route, blacklist_customer_codes: e.target.value.split(/[\n,;\s]+/).filter(Boolean) })}
                    rows={2}
                    placeholder="每行 / 逗号 / 空格分隔的客户号"
                    className="w-full rounded-md border border-rose-500/20 bg-rose-500/5 px-3 py-1.5 text-sm font-mono placeholder:text-slate-500 focus:border-rose-400 focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">已添加 {(route.blacklist_customer_codes ?? []).length} 个客户号。即便在白名单内，黑名单的客户号也无法看到本线路。</p>
                </div>
              </div>
            </Section>



            <Section title="客户填写项目（用户提交集运时所需填写的物品信息）">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ITEM_FIELD_OPTIONS.map((opt) => {
                  const checked = (route.item_fields ?? []).includes(opt.v);
                  const isName = opt.v === "name";
                  const reqMap = (route.item_field_required ?? {}) as Record<string, boolean>;
                  const required = isName ? true : !!reqMap[opt.v];
                  return (
                    <div key={opt.v} className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm">
                      <label className={`flex items-center gap-2 ${isName ? "opacity-70" : "cursor-pointer"}`}>
                        <input
                          type="checkbox"
                          checked={checked || isName}
                          disabled={isName}
                          onChange={(e) => {
                            const cur = new Set(route.item_fields ?? []);
                            if (e.target.checked) cur.add(opt.v); else cur.delete(opt.v);
                            cur.add("name");
                            setRoute({ ...route, item_fields: Array.from(cur) as ItemFieldKey[] });
                          }}
                          className="h-4 w-4 accent-brand"
                        />
                        <span>{opt.label}</span>
                      </label>
                      <label className={`inline-flex items-center gap-1.5 text-[11px] ${(!checked && !isName) ? "opacity-30" : "text-amber-300"}`}>
                        <input
                          type="checkbox"
                          checked={required}
                          disabled={isName || !checked}
                          onChange={(e) => {
                            const next = { ...reqMap, [opt.v]: e.target.checked };
                            setRoute({ ...route, item_field_required: next as any });
                          }}
                          className="h-3.5 w-3.5 accent-amber-400"
                        />
                        必填
                      </label>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-slate-500">勾选启用 + 勾选"必填"，用户提交时该项不能为空。品名固定必填。</p>
            </Section>

            <Section title={route.is_bidirectional ? "运费公式 · 正向（起点→终点）" : "运费公式（金额按 CAD 计算）"}>
              <FreightFields value={freight} onChange={setFreight} />
              <p className="mt-2 text-[11px] text-slate-500">
                运单运费 = 计费重量/板数 × 单价 + 清关费 + 关税 + 保费；不足最低收费时按最低收费。若启用消费税，会按以上合计 × 税率额外加收。
              </p>
            </Section>

            {route.is_bidirectional && (
              <Section title="运费公式 · 返程（终点→起点）">
                <FreightFields value={freightReverse} onChange={setFreightReverse} />
                <p className="mt-2 text-[11px] text-slate-500">用户在前端从「终点仓」发货时使用此返程价格。</p>
              </Section>
            )}

            <Section title="末端派送费">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Field label="触发门槛 (kg)">
                  <Input type="number" value={String(route.last_mile_threshold_kg ?? 0)} onChange={(v) => setRoute({ ...route, last_mile_threshold_kg: Number(v) })} />
                </Field>
                <Field label="分档单位 YYY (kg)">
                  <Input type="number" value={String(route.last_mile_step_kg ?? 1)} onChange={(v) => setRoute({ ...route, last_mile_step_kg: Number(v) })} />
                </Field>
                <Field label="每档费率 XXX (CA$)">
                  <Input type="number" value={String(route.last_mile_rate_cad ?? 0)} onChange={(v) => setRoute({ ...route, last_mile_rate_cad: Number(v) })} />
                </Field>
                <Field label="旧字段 · 批次末端费 CA$（保留兼容）">
                  <Input type="number" value={String(route.last_mile_fee_cad ?? 0)} onChange={(v) => setRoute({ ...route, last_mile_fee_cad: Number(v) })} />
                </Field>
                <Field label="末端派送公式占位（预留后期按邮编/城市/区域覆盖）" full>
                  <Input value={route.last_mile_formula ?? ""} onChange={(v) => setRoute({ ...route, last_mile_formula: v || null })} />
                </Field>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                规则：当箱号/托盘的<b>计费重量 &gt; 触发门槛</b>时，末端派送费 = <b>floor(计费重量 / YYY) × XXX</b> CAD（按整档收费）。
                门槛或费率为 0 则不触发。
                <br/>公式占位：后期支持按收件地址邮编 / 城市 / 区域覆盖，不同线路可配置不同公式。
              </p>
            </Section>




            <Section title="关税规则">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Field label="启用关税" full>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={customs.enabled} onChange={(e) => setCustoms({ ...customs, enabled: e.target.checked })} className="h-4 w-4 accent-brand" />
                    <span>对本线路计算关税</span>
                  </label>
                </Field>
                <Field label="税率 %">
                  <Input type="number" value={String(customs.rate_pct)} onChange={(v) => setCustoms({ ...customs, rate_pct: Number(v) })} />
                </Field>
                <Field label="起征金额 CA$">
                  <Input type="number" value={String(customs.threshold_cad)} onChange={(v) => setCustoms({ ...customs, threshold_cad: Number(v) })} />
                </Field>
                <Field label="备注" full><Input value={customs.note ?? ""} onChange={(v) => setCustoms({ ...customs, note: v })} /></Field>
              </div>
            </Section>
          </div>

          {/* Right: calculator */}
          <aside className="space-y-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 font-display text-sm font-bold">
                  <Calculator className="h-4 w-4 text-amber-400" />运费试算
                </div>
                {route.is_bidirectional && (
                  <div className="inline-flex overflow-hidden rounded-md border border-white/10 text-[11px]">
                    <button onClick={() => setQuoteDirection("forward")} className={`px-2 py-1 ${quoteDirection === "forward" ? "bg-brand/20 text-brand" : "text-slate-400"}`}>正向</button>
                    <button onClick={() => setQuoteDirection("reverse")} className={`px-2 py-1 ${quoteDirection === "reverse" ? "bg-brand/20 text-brand" : "text-slate-400"}`}>返程</button>
                  </div>
                )}
              </div>
              <div className="space-y-2 text-sm">
                <Field label="重量 (kg)"><Input type="number" value={String(calc.weight)} onChange={(v) => setCalc({ ...calc, weight: Number(v) })} /></Field>
                <Field label="体积 (cm³)"><Input type="number" value={String(calc.volume)} onChange={(v) => setCalc({ ...calc, volume: Number(v) })} /></Field>
                <Field label="申报金额 (CA$)"><Input type="number" value={String(calc.declared)} onChange={(v) => setCalc({ ...calc, declared: Number(v) })} /></Field>
                {(freight.pricing_mode ?? "weight") === "pallet" && (
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="长 cm"><Input type="number" value={String(calc.L)} onChange={(v) => setCalc({ ...calc, L: Number(v) })} /></Field>
                    <Field label="宽 cm"><Input type="number" value={String(calc.W)} onChange={(v) => setCalc({ ...calc, W: Number(v) })} /></Field>
                    <Field label="高 cm"><Input type="number" value={String(calc.H)} onChange={(v) => setCalc({ ...calc, H: Number(v) })} /></Field>
                  </div>
                )}
              </div>
              <button onClick={runQuote} disabled={calcBusy}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-amber-500/20 px-3 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/30 disabled:opacity-50">
                {calcBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}试算
              </button>
              {calcResult && (
                <div className="mt-3 rounded-md border border-white/5 bg-black/30 p-3 text-xs">
                  {calcResult.error ? (
                    <div className="text-rose-300">{calcResult.error}</div>
                  ) : calcResult.ok === false ? (
                    <div className="text-rose-300">{calcResult.message ?? "未找到生效运费规则"}</div>
                  ) : (
                    <dl className="space-y-1">
                      {calcResult.pricing_mode === "pallet" ? (
                        <Row k="板数" v={`${calcResult.pallets} 板${calcResult.pallet_reason === "missing_dims" ? "（缺尺寸默认 1）" : ""}`} accent />
                      ) : (
                        <>
                          <Row k="实重" v={`${calcResult.actual_weight} kg`} />
                          <Row k="体积重" v={`${calcResult.volumetric_weight} kg`} />
                          <Row k="计费重量" v={`${calcResult.chargeable_weight} kg`} accent />
                        </>
                      )}
                      <Row k="运费" v={`CA$${calcResult.freight_cad}`} />
                      <Row k="清关费" v={`CA$${calcResult.clearance_cad ?? 0}`} />
                      <Row k="关税" v={`CA$${calcResult.duty_cad}`} />
                      <Row k={`保费 (${calcResult.insurance_rate_pct ?? 0}%)`} v={`CA$${calcResult.insurance_cad ?? 0}`} />
                      {Number(calcResult.sales_tax_cad ?? 0) > 0 && (
                        <Row k={`消费税 (${calcResult.sales_tax_rate_pct ?? 0}%)`} v={`CA$${calcResult.sales_tax_cad}`} />
                      )}
                      <Row k="合计 (CAD)" v={`CA$${calcResult.total_cad}`} accent />
                    </dl>
                  )}
                </div>
              )}
              {!initial.id && (
                <p className="mt-2 text-[11px] text-slate-500">保存后即可试算。</p>
              )}
            </div>
          </aside>
        </div>

        {err && <div className="mt-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{err}</div>}

        <div className="mt-5 flex items-center justify-between">
          <div>
            {initial.id && (
              <button onClick={onDelete} disabled={busy}
                className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 px-3 py-2 text-xs text-rose-300 hover:bg-rose-500/10 disabled:opacity-50">
                <Trash2 className="h-3.5 w-3.5" />删除线路
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-md border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5">取消</button>
            <button onClick={onSave} disabled={busy}
              className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-50">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-300">{title}</div>
      {children}
    </section>
  );
}
function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      {children}
    </div>
  );
}
function Input(props: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <input type={props.type ?? "text"} value={props.value} placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
      className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm placeholder:text-slate-500 focus:border-brand focus:outline-none" />
  );
}
function Select(props: { value: string; onChange: (v: string) => void; options: { v: string; label: string }[] }) {
  return (
    <select value={props.value} onChange={(e) => props.onChange(e.target.value)}
      className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-100 focus:border-brand focus:outline-none [&>option]:bg-[#0E1626] [&>option]:text-slate-100">
      {props.options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
    </select>
  );
}
function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-400">{k}</dt>
      <dd className={accent ? "font-bold text-emerald-300" : "text-slate-200"}>{v}</dd>
    </div>
  );
}

function FreightFields({ value: f, onChange }: { value: FreightRule; onChange: (v: FreightRule) => void }) {
  const set = (patch: Partial<FreightRule>) => onChange({ ...f, ...patch });
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <Field label="计费方式" full>
        <Select value={f.pricing_mode ?? "weight"} onChange={(v) => set({ pricing_mode: v as any })}
          options={[{ v: "weight", label: "按重量计费" }, { v: "pallet", label: "按板计费" }]} />
      </Field>
      {(f.pricing_mode ?? "weight") === "weight" ? (
        <>
          <Field label="计重方式" full>
            <Select value={f.weight_mode} onChange={(v) => set({ weight_mode: v as WeightMode })} options={WEIGHT_MODE_OPTIONS as any} />
          </Field>
          <Field label="体积重除数 (cm³/kg)">
            <Input type="number" value={String(f.volumetric_divisor)} onChange={(v) => set({ volumetric_divisor: Number(v) })} />
          </Field>
          <Field label="单价 CA$/kg">
            <Input type="number" value={String(f.unit_price_cad)} onChange={(v) => set({ unit_price_cad: Number(v) })} />
          </Field>
        </>
      ) : (
        <>
          <Field label="每板单价 CA$">
            <Input type="number" value={String(f.pallet_unit_price_cad ?? 0)} onChange={(v) => set({ pallet_unit_price_cad: Number(v) })} />
          </Field>
          <Field label="超出倍数阈值">
            <Input type="number" value={String(f.pallet_overflow_factor ?? 2)} onChange={(v) => set({ pallet_overflow_factor: Number(v) })} />
          </Field>
          <Field label="标准板长 (cm)">
            <Input type="number" value={String(f.pallet_max_length_cm ?? "")} onChange={(v) => set({ pallet_max_length_cm: v === "" ? null : Number(v) })} />
          </Field>
          <Field label="标准板宽 (cm)">
            <Input type="number" value={String(f.pallet_max_width_cm ?? "")} onChange={(v) => set({ pallet_max_width_cm: v === "" ? null : Number(v) })} />
          </Field>
          <Field label="单板最高 (cm)">
            <Input type="number" value={String(f.pallet_max_height_cm ?? "")} onChange={(v) => set({ pallet_max_height_cm: v === "" ? null : Number(v) })} />
          </Field>
          <Field label="单板最重 (kg)">
            <Input type="number" value={String(f.pallet_max_weight_kg ?? "")} onChange={(v) => set({ pallet_max_weight_kg: v === "" ? null : Number(v) })} />
          </Field>
          <p className="col-span-2 text-[11px] text-slate-500">
            板数 = max(ceil(L/板长) × ceil(W/板宽) × ceil(H/单板最高), ceil(kg/单板最重))；任一维度超过阈值倍数将被判超规格。
          </p>
        </>
      )}
      <Field label="最低收费 CA$">
        <Input type="number" value={String(f.min_charge_cad)} onChange={(v) => set({ min_charge_cad: Number(v) })} />
      </Field>
      <Field label="最低收费级别">
        <select
          value={(f as any).min_charge_level ?? "waybill"}
          onChange={(e) => set({ min_charge_level: e.target.value } as any)}
          className="h-9 w-full rounded-md border border-white/10 bg-white/5 px-2 text-sm text-slate-100"
        >
          <option value="waybill">运单级（每张运单单独判断）</option>
          <option value="batch">批次级（合并后仅整批判断一次）</option>
        </select>
      </Field>
      <Field label="清关费 CA$">
        <Input type="number" value={String(f.clearance_fee_cad)} onChange={(v) => set({ clearance_fee_cad: Number(v) })} />
      </Field>
      <Field label="清关费计算级别">
        <select
          value={(f as any).clearance_fee_level ?? "waybill"}
          onChange={(e) => set({ clearance_fee_level: e.target.value } as any)}
          className="h-9 w-full rounded-md border border-white/10 bg-white/5 px-2 text-sm text-slate-100"
        >
          <option value="waybill">运单级（每张运单加一次）</option>
          <option value="batch">批次级（同线路同客户号合并加一次）</option>
        </select>
      </Field>

      <Field label="保险费率 %  (申报价值 × 费率 = 保费)" full>
        <Input type="number" value={String(f.insurance_rate_pct)} onChange={(v) => set({ insurance_rate_pct: Number(v) })} />
      </Field>
    </div>
  );
}
