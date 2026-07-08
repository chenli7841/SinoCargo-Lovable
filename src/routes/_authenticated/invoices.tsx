import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listMyInvoices, payInvoice, getInvoice } from "@/lib/invoices.functions";
import { FileText, Loader2, Printer, Wallet, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/invoices")({
  head: () => ({ meta: [{ title: "我的账单 — SinoCargo" }] }),
  component: MyInvoicesPage,
});

const STATUS_LABEL: Record<string, string> = { unpaid: "待付", paid: "已付", overdue: "逾期", void: "作废" };
const STATUS_COLORS: Record<string, string> = {
  unpaid: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
  overdue: "bg-rose-100 text-rose-700",
  void: "bg-slate-200 text-slate-600",
};

function MyInvoicesPage() {
  const fetchList = useServerFn(listMyInvoices);
  const fetchOne = useServerFn(getInvoice);
  const pay = useServerFn(payInvoice);
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  const q = useQuery({ queryKey: ["my-invoices", page], queryFn: () => fetchList({ data: { page, pageSize: 20 } }) });
  const detailQ = useQuery({ queryKey: ["my-invoice", openId], queryFn: () => fetchOne({ data: { id: openId! } }), enabled: !!openId });

  const onPay = async (id: string) => {
    if (!confirm("使用钱包余额支付？")) return;
    const r: any = await pay({ data: { id } });
    if (!r.ok) { alert(r.reason === "insufficient" ? `余额不足，需 CA$${r.need_cad}，当前 CA$${r.balance_cad}` : "失败: " + r.reason); return; }
    qc.invalidateQueries({ queryKey: ["my-invoices"] });
    qc.invalidateQueries({ queryKey: ["my-invoice", id] });
  };

  if (openId) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <button onClick={() => setOpenId(null)} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 print:hidden"><ArrowLeft className="h-4 w-4" />返回</button>
        {detailQ.isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin" />}
        {detailQ.data && (
          <>
            <div className="mb-4 flex justify-end gap-2 print:hidden">
              <button onClick={() => window.print()} className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50"><Printer className="h-4 w-4" />打印 / PDF</button>
              {detailQ.data.invoice.status === "unpaid" && (
                <button onClick={() => onPay(detailQ.data.invoice.id)} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"><Wallet className="h-4 w-4" />钱包支付</button>
              )}
            </div>
            <InvoiceCard inv={detailQ.data.invoice} items={detailQ.data.items} customer={detailQ.data.customer} />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-5 font-display text-2xl font-bold inline-flex items-center gap-2"><FileText className="h-5 w-5 text-blue-500" />我的账单</h1>
      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-2.5">账单号</th>
              <th className="px-4 py-2.5">类型</th>
              <th className="px-4 py-2.5">金额</th>
              <th className="px-4 py-2.5">状态</th>
              <th className="px-4 py-2.5">到期</th>
              <th className="px-4 py-2.5 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {q.isLoading && <tr><td colSpan={6} className="py-12 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></td></tr>}
            {q.data?.items.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-slate-400">暂无账单</td></tr>}
            {q.data?.items.map((r: any) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs">{r.invoice_no}</td>
                <td className="px-4 py-3 text-xs">{r.type}</td>
                <td className="px-4 py-3 font-semibold">¥{Number(r.total_cny).toFixed(2)}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[r.status]}`}>{STATUS_LABEL[r.status]}</span></td>
                <td className="px-4 py-3 text-xs text-slate-500">{r.due_date ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setOpenId(r.id)} className="text-xs text-blue-600 hover:underline">查看</button>
                  {r.status === "unpaid" && <button onClick={() => onPay(r.id)} className="ml-2 text-xs text-emerald-600 hover:underline">支付</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InvoiceCard({ inv, items, customer }: any) {
  return (
    <div className="rounded-2xl border bg-white p-8 shadow-lg">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="font-display text-2xl font-bold">SinoCargo · 物流账单</div>
          <div className="mt-1 text-sm text-slate-500">INVOICE</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-lg font-bold">{inv.invoice_no}</div>
          <div className="mt-1 text-xs text-slate-500">开具: {new Date(inv.created_at).toLocaleDateString()}</div>
          {inv.due_date && <div className="text-xs text-slate-500">到期: {inv.due_date}</div>}
          <div className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[inv.status]}`}>{STATUS_LABEL[inv.status]}</div>
        </div>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-6 text-sm">
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">收款方</div>
          <div className="font-semibold">SinoCargo Logistics Inc.</div>
        </div>
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">付款方</div>
          <div className="font-semibold">{customer?.full_name ?? customer?.email ?? "—"}</div>
          <div className="font-mono text-xs text-slate-500">客户号 {customer?.customer_code}</div>
        </div>
      </div>
      <table className="mb-4 w-full text-sm">
        <thead className="border-b text-left text-[11px] uppercase tracking-wider text-slate-500">
          <tr><th className="py-2">明细</th><th className="py-2 text-right">运费</th><th className="py-2 text-right">关税</th><th className="py-2 text-right">保险</th><th className="py-2 text-right">小计</th></tr>
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
        <div className="flex justify-between"><span className="text-slate-500">运费合计</span><span>¥{Number(inv.freight_cny).toFixed(2)}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">关税合计</span><span>¥{Number(inv.customs_cny).toFixed(2)}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">保险合计</span><span>¥{Number(inv.insurance_cny).toFixed(2)}</span></div>
        <div className="my-2 border-t" />
        <div className="flex justify-between text-base font-bold"><span>应付总额 (CNY)</span><span>¥{Number(inv.total_cny).toFixed(2)}</span></div>
        <div className="flex justify-between text-xs text-slate-500"><span>折合</span><span>CA${(Number(inv.total_cny) * Number(inv.fx_rate)).toFixed(2)}</span></div>
      </div>
      {inv.note && <div className="mt-6 border-t pt-4 text-xs text-slate-500">备注: {inv.note}</div>}
    </div>
  );
}
