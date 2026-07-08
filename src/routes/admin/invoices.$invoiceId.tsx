import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  getInvoice, updateInvoiceStatus, payInvoice,
  listOfflinePayments, addOfflinePayment, deleteOfflinePayment, splitInvoice,
} from "@/lib/invoices.functions";
import {
  ArrowLeft, Loader2, Printer, CheckCircle2, Wallet, Plus, Trash2, Scissors, Receipt,
} from "lucide-react";

export const Route = createFileRoute("/admin/invoices/$invoiceId")({ component: InvoiceDetail });

const METHODS = ["bank_transfer", "wechat", "alipay", "interac", "cash", "other"];
const METHOD_LABEL: Record<string, string> = {
  bank_transfer: "银行转账", wechat: "微信", alipay: "支付宝", interac: "Interac", cash: "现金", other: "其他",
};

function InvoiceDetail() {
  const { invoiceId } = Route.useParams();
  const fetchOne = useServerFn(getInvoice);
  const update = useServerFn(updateInvoiceStatus);
  const pay = useServerFn(payInvoice);
  const fetchOff = useServerFn(listOfflinePayments);
  const addOff = useServerFn(addOfflinePayment);
  const delOff = useServerFn(deleteOfflinePayment);
  const split = useServerFn(splitInvoice);
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["invoice", invoiceId], queryFn: () => fetchOne({ data: { id: invoiceId } }) });
  const offQ = useQuery({ queryKey: ["invoice-offline", invoiceId], queryFn: () => fetchOff({ data: { invoice_id: invoiceId } }) });

  const [showOff, setShowOff] = useState(false);
  const [showSplit, setShowSplit] = useState(false);
  const [splitSel, setSplitSel] = useState<Set<string>>(new Set());

  if (q.isLoading) return <div className="grid h-[60vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>;
  if (q.isError || !q.data) return <div className="p-6 text-rose-400">{(q.error as Error)?.message ?? "未找到"}</div>;

  const inv = q.data.invoice;
  const items = q.data.items;
  const customer = q.data.customer;
  const offItems = offQ.data?.items ?? [];
  const totalCAD = +(Number(inv.total_cny) * Number(inv.fx_rate)).toFixed(2);
  const paidCAD = Number(inv.paid_cad ?? 0);
  const remainCAD = +(totalCAD - paidCAD).toFixed(2);

  const onMarkPaid = async () => {
    if (!confirm("确认标记为已付？")) return;
    await update({ data: { id: inv.id, status: "paid" } });
    qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
  };
  const onPay = async () => {
    if (!confirm("使用钱包余额支付？")) return;
    const r: any = await pay({ data: { id: inv.id } });
    if (!r.ok) alert("失败: " + r.reason);
    qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
  };
  const onDoSplit = async () => {
    if (splitSel.size === 0 || splitSel.size === items.length) { alert("请选择部分明细"); return; }
    try {
      const r: any = await split({ data: { id: inv.id, item_ids: Array.from(splitSel) } });
      alert(`已拆出新账单：${r.invoice.invoice_no}`);
      setShowSplit(false); setSplitSel(new Set());
      qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
    } catch (e: any) { alert("失败: " + e.message); }
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link to="/admin/invoices" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" />返回</Link>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => window.print()} className="inline-flex items-center gap-1 rounded-md border border-white/10 px-3 py-1.5 text-sm hover:bg-white/5"><Printer className="h-4 w-4" />打印 / PDF</button>
          {inv.status === "unpaid" && (
            <>
              <button onClick={() => setShowOff(true)} className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 px-3 py-1.5 text-sm text-amber-200 hover:bg-amber-500/10"><Receipt className="h-4 w-4"/>登记线下付款</button>
              <button onClick={() => setShowSplit(true)} className="inline-flex items-center gap-1 rounded-md border border-blue-500/30 px-3 py-1.5 text-sm text-blue-200 hover:bg-blue-500/10"><Scissors className="h-4 w-4"/>拆分账单</button>
              <button onClick={onPay} className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 px-3 py-1.5 text-sm text-emerald-200 hover:bg-emerald-500/30"><Wallet className="h-4 w-4" />钱包支付</button>
              <button onClick={onMarkPaid} className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 px-3 py-1.5 text-sm text-emerald-300 hover:bg-emerald-500/10"><CheckCircle2 className="h-4 w-4" />标记已付</button>
            </>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white p-8 text-slate-900 shadow-2xl print:border-0 print:shadow-none">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="font-display text-2xl font-bold">SinoCargo · 物流账单</div>
            <div className="mt-1 text-sm text-slate-500">INVOICE</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-lg font-bold">{inv.invoice_no}</div>
            <div className="mt-1 text-xs text-slate-500">开具: {new Date(inv.created_at).toLocaleDateString()}</div>
            {inv.due_date && <div className="text-xs text-slate-500">到期: {inv.due_date}</div>}
            <div className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              inv.status === "paid" ? "bg-emerald-100 text-emerald-700" :
              inv.status === "overdue" ? "bg-rose-100 text-rose-700" :
              inv.status === "void" ? "bg-slate-200 text-slate-600" :
              "bg-amber-100 text-amber-700"
            }`}>{inv.status === "paid" ? "已付款" : inv.status === "overdue" ? "已逾期" : inv.status === "void" ? "已作废" : "待付款"}</div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-6 text-sm">
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">收款方</div>
            <div className="font-semibold">SinoCargo Logistics Inc.</div>
            <div className="text-slate-600">中加跨境物流</div>
          </div>
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">付款方</div>
            <div className="font-semibold">{customer?.full_name ?? customer?.email ?? "—"}</div>
            <div className="font-mono text-xs text-slate-500">客户号 {customer?.customer_code}</div>
            {customer?.phone && <div className="text-xs text-slate-500">{customer.phone}</div>}
            {customer?.email && <div className="text-xs text-slate-500">{customer.email}</div>}
          </div>
        </div>

        <table className="mb-4 w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="py-2">明细</th>
              <th className="py-2 text-right">运费</th>
              <th className="py-2 text-right">关税</th>
              <th className="py-2 text-right">保险</th>
              <th className="py-2 text-right">小计</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((it: any) => (
              <tr key={it.id}>
                <td className="py-2">{it.description}</td>
                <td className="py-2 text-right">¥{Number(it.freight_cny).toFixed(2)}</td>
                <td className="py-2 text-right">¥{Number(it.customs_cny).toFixed(2)}</td>
                <td className="py-2 text-right">¥{Number(it.insurance_cny).toFixed(2)}</td>
                <td className="py-2 text-right font-semibold">¥{Number(it.amount_cny).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto w-72 space-y-1 text-sm">
          <Row k="运费合计" v={`¥${Number(inv.freight_cny).toFixed(2)}`} />
          <Row k="关税合计" v={`¥${Number(inv.customs_cny).toFixed(2)}`} />
          <Row k="保险合计" v={`¥${Number(inv.insurance_cny).toFixed(2)}`} />
          {Number(inv.other_cny) > 0 && <Row k="其他" v={`¥${Number(inv.other_cny).toFixed(2)}`} />}
          <div className="my-2 border-t border-slate-200" />
          <Row k="应付总额 (CNY)" v={`¥${Number(inv.total_cny).toFixed(2)}`} big />
          <Row k="折合 (CAD)" v={`CA$${totalCAD.toFixed(2)}`} />
          {paidCAD > 0 && <Row k="已收 (CAD)" v={`CA$${paidCAD.toFixed(2)}`} />}
          {paidCAD > 0 && paidCAD < totalCAD && <Row k="待收 (CAD)" v={`CA$${remainCAD.toFixed(2)}`} />}
        </div>

        {inv.note && <div className="mt-6 border-t border-slate-200 pt-4 text-xs text-slate-500">备注: {inv.note}</div>}
      </div>

      {/* Offline payments list */}
      <div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.02] p-5 print:hidden">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-display font-bold inline-flex items-center gap-2"><Receipt className="h-4 w-4 text-amber-300"/>线下付款记录</div>
          <div className="text-xs text-slate-400">合计 CA${paidCAD.toFixed(2)} / CA${totalCAD.toFixed(2)}</div>
        </div>
        {offItems.length === 0 ? (
          <div className="py-3 text-center text-xs text-slate-500">暂无线下付款</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-left text-[10px] uppercase tracking-wider text-slate-500">
              <tr><th className="py-1.5">付款时间</th><th>方式</th><th>金额 CAD</th><th>参考号</th><th>备注</th><th></th></tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {offItems.map((p: any) => (
                <tr key={p.id}>
                  <td className="py-1.5">{new Date(p.paid_at).toLocaleString("zh-CN")}</td>
                  <td>{METHOD_LABEL[p.method] ?? p.method}</td>
                  <td className="font-semibold text-emerald-300">CA${Number(p.amount_cad).toFixed(2)}</td>
                  <td className="font-mono text-[10px]">{p.reference ?? "—"}</td>
                  <td className="text-slate-400">{p.note ?? "—"}</td>
                  <td>
                    <button onClick={async () => {
                      if (!confirm("删除此条付款记录？")) return;
                      await delOff({ data: { id: p.id } });
                      qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
                      qc.invalidateQueries({ queryKey: ["invoice-offline", invoiceId] });
                    }} className="text-rose-300 hover:text-rose-200"><Trash2 className="h-3.5 w-3.5"/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showOff && (
        <OfflineDialog
          remaining={remainCAD}
          onClose={() => setShowOff(false)}
          onSubmit={async (payload) => {
            try {
              await addOff({ data: { invoice_id: invoiceId, ...payload } });
              setShowOff(false);
              qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
              qc.invalidateQueries({ queryKey: ["invoice-offline", invoiceId] });
            } catch (e: any) { alert("失败: " + e.message); }
          }}
        />
      )}

      {showSplit && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0A0F1A] p-5 text-slate-100">
            <h2 className="mb-3 font-display text-lg font-bold inline-flex items-center gap-2"><Scissors className="h-5 w-5 text-blue-300"/>拆分账单</h2>
            <p className="mb-3 text-xs text-slate-400">勾选要拆到新账单的明细（至少 1 条，且不能全选）。</p>
            <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-white/5 bg-white/[0.02] p-2">
              {items.map((it: any) => (
                <label key={it.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-white/5">
                  <input type="checkbox" checked={splitSel.has(it.id)} onChange={() => {
                    const s = new Set(splitSel);
                    s.has(it.id) ? s.delete(it.id) : s.add(it.id);
                    setSplitSel(s);
                  }}/>
                  <span className="flex-1 text-xs">{it.description}</span>
                  <span className="text-xs font-semibold">¥{Number(it.amount_cny).toFixed(2)}</span>
                </label>
              ))}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setShowSplit(false)} className="rounded-md border border-white/10 px-3 py-1.5 text-sm hover:bg-white/5">取消</button>
              <button onClick={onDoSplit} className="rounded-md bg-blue-500/30 px-3 py-1.5 text-sm font-semibold text-blue-100 hover:bg-blue-500/40">拆分</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OfflineDialog({ onClose, onSubmit, remaining }: {
  onClose: () => void;
  onSubmit: (p: { method: string; amount_cad: number; reference?: string; paid_at?: string; attachment_url?: string; note?: string }) => Promise<void>;
  remaining: number;
}) {
  const [method, setMethod] = useState("bank_transfer");
  const [amount, setAmount] = useState(remaining > 0 ? String(remaining) : "");
  const [reference, setRef] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 16));
  const [attach, setAttach] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <form onClick={(e) => e.stopPropagation()} onSubmit={async (e) => {
        e.preventDefault(); setBusy(true);
        try {
          await onSubmit({
            method, amount_cad: Number(amount),
            reference: reference || undefined,
            paid_at: paidAt ? new Date(paidAt).toISOString() : undefined,
            attachment_url: attach || undefined, note: note || undefined,
          });
        } finally { setBusy(false); }
      }} className="w-full max-w-md space-y-3 rounded-2xl border border-white/10 bg-[#0A0F1A] p-5 text-slate-100">
        <h2 className="font-display text-lg font-bold inline-flex items-center gap-2"><Plus className="h-5 w-5 text-amber-300"/>登记线下付款</h2>
        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wider text-slate-400">付款方式</div>
          <select value={method} onChange={(e) => setMethod(e.target.value)}
            className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm [&>option]:bg-[#0E1626]">
            {METHODS.map(m => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-wider text-slate-400">金额 (CAD)</div>
            <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required
              className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm"/>
          </div>
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-wider text-slate-400">付款时间</div>
            <input type="datetime-local" value={paidAt} onChange={(e) => setPaidAt(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm"/>
          </div>
        </div>
        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wider text-slate-400">参考号 / 交易号</div>
          <input value={reference} onChange={(e) => setRef(e.target.value)}
            className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm"/>
        </div>
        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wider text-slate-400">附件 URL（截图）</div>
          <input value={attach} onChange={(e) => setAttach(e.target.value)} placeholder="https://..."
            className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm"/>
        </div>
        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wider text-slate-400">备注</div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm"/>
        </div>
        <p className="text-[11px] text-slate-500">累计金额 ≥ 账单总额时，系统自动标记账单为「已付」并同步运单/订单付款状态。</p>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-md border border-white/10 px-3 py-1.5 text-sm hover:bg-white/5">取消</button>
          <button type="submit" disabled={busy}
            className="inline-flex items-center gap-1 rounded-md bg-amber-500/30 px-3 py-1.5 text-sm font-semibold text-amber-100 hover:bg-amber-500/40 disabled:opacity-50">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Plus className="h-3.5 w-3.5"/>}保存
          </button>
        </div>
      </form>
    </div>
  );
}

function Row({ k, v, big }: { k: string; v: string; big?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${big ? "text-base font-bold" : ""}`}>
      <span className="text-slate-500">{k}</span><span>{v}</span>
    </div>
  );
}
