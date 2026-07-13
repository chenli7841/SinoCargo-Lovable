import { forwardRef } from "react";
import type { CompanyInfo, PrintTemplate } from "@/lib/company";

const STATUS_LABEL: Record<string, string> = { unpaid: "待付款", paid: "已付款", overdue: "已逾期", void: "已作废" };
const STATUS_COLOR: Record<string, string> = {
  unpaid: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
  overdue: "bg-rose-100 text-rose-700",
  void: "bg-slate-200 text-slate-600",
};

interface Props {
  inv: any;
  items: any[];
  customer: any;
  company: CompanyInfo;
  template: PrintTemplate;
  paidCad?: number;
  remainCad?: number;
}

export const InvoiceDocument = forwardRef<HTMLDivElement, Props>(function InvoiceDocument(
  { inv, items, customer, company, template, paidCad, remainCad },
  ref,
) {
  const totalCad = +(Number(inv.total_cny) * Number(inv.fx_rate ?? 0.19)).toFixed(2);
  const logo = template.logo_url || company.logo_url;

  return (
    <div ref={ref} className="rounded-2xl border border-border bg-white p-8 text-slate-900 shadow-2xl print:border-0 print:shadow-none">
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-3">
          {logo && <img src={logo} alt={company.name} className="h-12 w-12 shrink-0 rounded object-contain" />}
          <div>
            <div className="font-display text-2xl font-bold">{template.header || `${company.name} · 账单`}</div>
            <div className="mt-1 text-sm text-slate-500">INVOICE</div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-lg font-bold">{inv.invoice_no}</div>
          <div className="mt-1 text-xs text-slate-500">开具: {new Date(inv.created_at).toLocaleDateString()}</div>
          {inv.due_date && <div className="text-xs text-slate-500">到期: {inv.due_date}</div>}
          <div className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLOR[inv.status] ?? ""}`}>
            {STATUS_LABEL[inv.status] ?? inv.status}
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-6 text-sm">
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">收款方</div>
          <div className="font-semibold">{company.name}</div>
          {company.address && <div className="text-xs text-slate-600">{company.address}</div>}
          {company.phone && <div className="text-xs text-slate-500">{company.phone}</div>}
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
        <Row k="折合 (CAD)" v={`CA$${totalCad.toFixed(2)}`} />
        {paidCad != null && paidCad > 0 && <Row k="已收 (CAD)" v={`CA$${paidCad.toFixed(2)}`} />}
        {paidCad != null && remainCad != null && paidCad > 0 && paidCad < totalCad && <Row k="待收 (CAD)" v={`CA$${remainCad.toFixed(2)}`} />}
      </div>

      {inv.note && <div className="mt-6 border-t border-slate-200 pt-4 text-xs text-slate-500">备注: {inv.note}</div>}
      {template.footer && <div className="mt-6 border-t border-slate-200 pt-4 text-center text-[11px] text-slate-400">{template.footer}</div>}
    </div>
  );
});

function Row({ k, v, big }: { k: string; v: string; big?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${big ? "text-base font-bold" : ""}`}>
      <span className="text-slate-500">{k}</span><span>{v}</span>
    </div>
  );
}
