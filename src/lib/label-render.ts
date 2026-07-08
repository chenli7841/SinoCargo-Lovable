// Client-side label rendering with CODE128 barcodes (jsbarcode)
// Label size: 150mm × 100mm (landscape)
import JsBarcode from "jsbarcode";

type WaybillEntry = { waybill_no: string; weight_kg?: number | null; items_name?: string | null; mark_no?: string | null };

export type LabelData = {
  entityType: "order" | "forwarding" | "carton" | "pallet" | "batch";
  entityNo: string;
  parent?: any;
  waybills?: WaybillEntry[];
  address?: any;
  user?: any;
  total?: number;
  meta?: Record<string, any>;
};

function barcodeSVG(text: string, width = 1.6, height = 40, displayValue = true) {
  if (!text) return "";
  try {
    const svgNS = "http://www.w3.org/2000/svg";
    const doc = document.implementation.createDocument(svgNS, "svg", null);
    const svg = doc.documentElement;
    JsBarcode(svg as any, text, {
      format: "CODE128", width, height, displayValue, fontSize: 11, margin: 0, background: "#ffffff",
    });
    return new XMLSerializer().serializeToString(svg);
  } catch {
    return `<div style="font-family:monospace;font-size:11px">${text}</div>`;
  }
}

function renderOrderOrForwarding(d: LabelData): string {
  const addr = d.address ?? {};
  const u = d.user ?? {};
  const recipient = addr.recipient ?? addr.name ?? u.full_name ?? "—";
  const phone = addr.phone ?? u.phone ?? "—";
  const addressLine = [addr.line1 ?? addr.address1, addr.line2, addr.city, addr.province ?? addr.state, addr.postal_code ?? addr.zip, addr.country].filter(Boolean).join(", ") || "—";
  const list = d.waybills?.length ? d.waybills : [{ waybill_no: "—" } as WaybillEntry];
  const xx = String(d.total || list.length).padStart(2, "0");
  const entityLabel = d.entityType === "order" ? "订单" : "集运单";

  return list.map((w, i) => {
    const aa = String(i + 1).padStart(2, "0");
    const markNo = w.mark_no ?? (d.parent as any)?.mark_no ?? null;
    return `
<div class="label">
  ${markNo ? `<div class="mark">唛头号 · ${markNo}</div>` : ""}
  <div class="grid">
    <div class="left">
      <div class="block">
        <div class="muted">${entityLabel}</div>
        <div class="bc-lg">${barcodeSVG(d.entityNo || "—", 1.8, 46)}</div>
      </div>
      <div class="block">
        <div class="muted">运单号 · 箱号 ${aa}/${xx}</div>
        <div class="bc-lg">${barcodeSVG(w.waybill_no || "—", 1.8, 46)}</div>
      </div>
      <div class="row"><span class="muted">客户号</span><b class="mono">${u.customer_code ?? "—"}</b></div>
      <div class="row"><span class="muted">重量</span><b>${w.weight_kg ?? "—"} kg</b></div>
    </div>
    <div class="right">
      <div class="row"><span class="muted">物品</span><b class="clip">${w.items_name ?? d.parent?.items_desc ?? "—"}</b></div>
      <div class="row"><span class="muted">收件人</span><b>${recipient}</b></div>
      <div class="row"><span class="muted">电话</span><b>${phone}</b></div>
      <div class="addr"><div class="muted">地址</div><div class="addr-body">${addressLine}</div></div>
    </div>
  </div>
</div>`;
  }).join("");
}


function renderContainer(d: LabelData): string {
  const m = d.meta ?? {};
  const titleMap = { carton: "箱号", pallet: "托盘号", batch: "批次号" } as const;
  const title = titleMap[d.entityType as "carton" | "pallet" | "batch"];
  const rows: [string, any][] = [];
  if (m.status) rows.push(["状态", m.status]);
  if (m.weight_kg != null) rows.push(["重量", `${m.weight_kg} kg`]);
  if (m.batch_no) rows.push(["所属批次", m.batch_no]);
  if (m.pallet_no) rows.push(["所属托盘", m.pallet_no]);
  if (m.shipping_method) rows.push(["运输方式", m.shipping_method]);
  if (m.destination_code) rows.push(["目的地", m.destination_code]);
  if (m.route_code) rows.push(["线路", m.route_code]);
  if (m.customer_code) rows.push(["客户号", m.customer_code]);
  if (m.pickup_warehouse) rows.push(["取货点", m.pickup_warehouse]);
  if (m.cargo_type) rows.push(["货物", m.cargo_type]);
  if (m.planned_ship_date) rows.push(["计划发货", m.planned_ship_date]);
  if (m.eta_date) rows.push(["预计到货", m.eta_date]);
  if (m.vessel_no) rows.push(["船号/航空", m.vessel_no]);
  if (m.payment_status) rows.push(["付款", m.payment_status === "paid" ? "已付款" : m.payment_status === "partial" ? "部分付款" : m.payment_status === "empty" ? "—" : "未付款"]);
  if (m.created_at) rows.push(["创建", new Date(m.created_at).toLocaleString("zh-CN", { hour12: false })]);
  const counts = m.counts || {};
  if (counts.waybills != null) rows.push(["运单数", counts.waybills]);
  if (counts.cartons != null) rows.push(["箱数", counts.cartons]);
  if (counts.pallets != null) rows.push(["托盘数", counts.pallets]);
  if (m.notes) rows.push(["备注", m.notes]);
  const markNo = m.mark_no ?? null;

  return `
<div class="label">
  ${markNo ? `<div class="mark">唛头号 · ${markNo}</div>` : ""}
  <div class="grid">
    <div class="left">
      <div class="block">
        <div class="muted">${title}</div>
        <div class="entity">${d.entityNo}</div>
      </div>
      <div class="bc-lg">${barcodeSVG(d.entityNo, 1.8, 46)}</div>
    </div>
    <div class="right">
      ${rows.map(([k, v]) => `<div class="row"><span class="muted">${k}</span><b class="clip">${v}</b></div>`).join("")}
    </div>
  </div>
</div>`;
}

export function renderLabel(d: LabelData | LabelData[]) {
  const list = Array.isArray(d) ? d : [d];
  if (!list.length) return;
  const body = list.map((item) =>
    (item.entityType === "order" || item.entityType === "forwarding") ? renderOrderOrForwarding(item) : renderContainer(item),
  ).join("");
  const title = list.length === 1 ? `面单 ${list[0].entityNo}` : `面单 (${list.length})`;
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${title}</title>
<style>
  @page { size: 150mm 100mm; margin: 0; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; margin: 0; background: #f0f0f0; color: #000; }
  .label { width: 150mm; height: 100mm; padding: 4mm 5mm; background: #fff; page-break-after: always; break-after: page; display: flex; flex-direction: column; gap: 2mm; overflow: hidden; margin: 4mm auto; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
  .label:last-child { page-break-after: auto; break-after: auto; }
  .mark { text-align: center; font-weight: 900; font-size: 20px; letter-spacing: 2px; padding: 2mm 0; border: 2px solid #000; border-radius: 2mm; background: #000; color: #fff; flex-shrink: 0; }
  .grid { flex: 1; display: grid; grid-template-columns: 72mm 1fr; gap: 4mm; min-height: 0; }
  .left { display: flex; flex-direction: column; gap: 1.5mm; border-right: 1.5px dashed #999; padding-right: 3mm; min-width: 0; }
  .right { display: flex; flex-direction: column; gap: 1mm; min-width: 0; }
  .block .muted { margin-bottom: 0.5mm; }
  .entity { font-size: 14px; font-weight: 800; font-family: ui-monospace, Menlo, monospace; letter-spacing: 0.5px; word-break: break-all; line-height: 1.2; }
  .bc { max-width: 100%; overflow: hidden; }
  .bc svg, .bc-lg svg { max-width: 100%; height: auto; display: block; }
  .bc-lg { display: flex; justify-content: center; margin-top: 0.5mm; }
  .row { display: flex; gap: 3mm; font-size: 10.5px; padding: 0.5mm 0; border-bottom: 1px dotted #ccc; align-items: baseline; min-width: 0; }
  .row b { flex: 1; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .row b.clip { text-align: left; }
  .addr { font-size: 10.5px; margin-top: 1mm; }
  .addr-body { margin-top: 0.5mm; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }
  .muted { color: #666; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; flex-shrink: 0; }
  .mono { font-family: ui-monospace, Menlo, monospace; }
  .toolbar { position: fixed; top: 8px; right: 8px; display: flex; gap: 6px; z-index: 10; }
  .toolbar button { padding: 6px 12px; font-size: 12px; cursor: pointer; border: 1px solid #ccc; background: #fff; border-radius: 4px; }
  .count { position: fixed; top: 12px; left: 12px; font-size: 12px; color: #666; z-index: 10; }
  @media print { .toolbar, .count { display: none; } body { background: #fff; } .label { margin: 0 !important; box-shadow: none !important; } }
</style></head><body>
<div class="count">共 ${list.length} 张面单</div>
<div class="toolbar"><button onclick="window.print()">打印全部</button><button onclick="window.close()">关闭</button></div>
${body}
</body></html>`;
  const w = window.open("", "_blank", "width=900,height=900");
  if (!w) { alert("请允许弹窗以打印面单"); return; }
  w.document.open(); w.document.write(html); w.document.close();
}
