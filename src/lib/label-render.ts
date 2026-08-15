// Client-side label rendering with CODE128 barcodes (jsbarcode)
// Label size: 150mm × 100mm (landscape)
import JsBarcode from "jsbarcode";

type WaybillEntry = {
  waybill_no: string;
  weight_kg?: number | null;
  items_name?: string | null;
  mark_no?: string | null;
};

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
      format: "CODE128",
      width,
      height,
      displayValue,
      fontSize: 20,
      textMargin: 8,
      fontOptions: "bold",
      lineColor: "#000000",
      margin: 0,
      background: "#ffffff",
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
  const addressLine =
    [
      addr.line1 ?? addr.address1,
      addr.line2,
      addr.city,
      addr.province ?? addr.state,
      addr.postal_code ?? addr.zip,
      addr.country,
    ]
      .filter(Boolean)
      .join(", ") || "—";
  const list = d.waybills?.length ? d.waybills : [{ waybill_no: "—" } as WaybillEntry];
  const xx = String(d.total || list.length).padStart(2, "0");
  const entityLabel = d.entityType === "order" ? "订单" : "集运单";

  return list
    .map((w, i) => {
      const aa = String(i + 1).padStart(2, "0");
      const markNo = w.mark_no ?? (d.parent as any)?.mark_no ?? null;
      return `
<div class="label">
  ${markNo ? `<div class="mark">唛头号 · ${markNo}</div>` : ""}
  <div class="stack">
    <div class="barcodes">
      <div class="block">
        <div class="muted">${entityLabel}</div>
        <div class="bc-lg">${barcodeSVG(d.entityNo || "—", 1.8, 46)}</div>
      </div>
      <div class="block">
        <div class="muted">运单号 · 箱号 ${aa}/${xx}</div>
        <div class="bc-lg">${barcodeSVG(w.waybill_no || "—", 1.8, 46)}</div>
      </div>
    </div>
    <div class="info">
      <div class="colL">
        <div class="row"><span class="muted">客户号</span><b class="mono">${u.customer_code ?? "—"}</b></div>
        <div class="row"><span class="muted">重量</span><b>${w.weight_kg ?? "—"} kg</b></div>
        <div class="row"><span class="muted">物品</span><b>${w.items_name ?? d.parent?.items_desc ?? "—"}</b></div>
      </div>
      <div class="colR">
        <div class="row"><span class="muted">收件人</span><b>${recipient}</b></div>
        <div class="row"><span class="muted">电话</span><b>${phone}</b></div>
        <div class="row addr"><span class="muted">地址</span><b class="addr-body">${addressLine}</b></div>
      </div>
    </div>
  </div>
</div>`;
    })
    .join("");
}

function renderContainer(d: LabelData): string {
  const m = d.meta ?? {};
  const titleMap = { carton: "箱号", pallet: "托盘号", batch: "批次号" } as const;
  const title = titleMap[d.entityType as "carton" | "pallet" | "batch"];
  const markNoEarly = m.mark_no ?? null;

  // Carton, pallet and batch labels all follow the order/forwarding standard layout
  // (top barcode, bold black two-column info below) instead of the generic field list.
  if (d.entityType === "carton" || d.entityType === "pallet") {
    const counts = m.counts || {};
    const pieces =
      d.entityType === "pallet"
        ? `${counts.cartons ?? 0} 箱 · ${counts.waybills ?? 0} 单`
        : `${counts.waybills ?? 0} 单`;
    // Only bound once this container has locked onto a single customer's address
    // (see assignToCarton/assignToPallet) — otherwise it's a mixed container and
    // there's no one recipient to print, so every identity field reads "--".
    const addr = m.address ?? null;
    const addressLine = addr
      ? [
          addr.line1 ?? addr.address1,
          addr.line2,
          addr.city,
          addr.province ?? addr.state,
          addr.postal_code ?? addr.zip,
          addr.country,
        ]
          .filter(Boolean)
          .join(", ") || "--"
      : "--";
    const left: [string, any][] = [
      ["客户号", m.customer_code ?? "--"],
      ["件数", pieces],
      ["目的地", m.destination_code ?? "—"],
      ["运输方式", m.shipping_method ?? "—"],
    ];
    return `
<div class="label">
  ${markNoEarly ? `<div class="mark">唛头号 · ${markNoEarly}</div>` : ""}
  <div class="stack">
    <div class="barcodes">
      <div class="block">
        <div class="muted">${title}</div>
        <div class="entity">${d.entityNo}</div>
        <div class="bc-lg">${barcodeSVG(d.entityNo, 1.8, 46)}</div>
      </div>
    </div>
    <div class="info">
      <div class="colL">
        ${left.map(([k, v]) => `<div class="row"><span class="muted">${k}</span><b>${v}</b></div>`).join("")}
      </div>
      <div class="colR">
        <div class="row"><span class="muted">收件人</span><b>${addr?.recipient ?? "--"}</b></div>
        <div class="row"><span class="muted">电话</span><b>${addr?.phone ?? "--"}</b></div>
        <div class="row addr"><span class="muted">地址</span><b class="addr-body">${addressLine}</b></div>
      </div>
    </div>
  </div>
</div>`;
  }

  if (d.entityType === "batch") {
    const counts = m.counts || {};
    const left: [string, any][] = [
      ["重量（实重）", m.weight_kg != null ? `${m.weight_kg} kg` : "—"],
      ["体积", m.volume_m3 != null ? `${m.volume_m3} m³` : "—"],
      ["件数", `${counts.waybills ?? 0} 单 · ${counts.cartons ?? 0} 箱 · ${counts.pallets ?? 0} 托`],
    ];
    const right: [string, any][] = [
      ["运输方式", m.shipping_method ?? "—"],
      ["目的地", m.destination_code ?? "—"],
      ["船号/航空号", m.vessel_no ?? "—"],
    ];
    return `
<div class="label">
  ${markNoEarly ? `<div class="mark">唛头号 · ${markNoEarly}</div>` : ""}
  <div class="stack">
    <div class="barcodes">
      <div class="block">
        <div class="muted">${title}</div>
        <div class="entity">${d.entityNo}</div>
        <div class="bc-lg">${barcodeSVG(d.entityNo, 1.8, 46)}</div>
      </div>
    </div>
    <div class="info">
      <div class="colL">
        ${left.map(([k, v]) => `<div class="row"><span class="muted">${k}</span><b>${v}</b></div>`).join("")}
      </div>
      <div class="colR">
        ${right.map(([k, v]) => `<div class="row"><span class="muted">${k}</span><b>${v}</b></div>`).join("")}
      </div>
    </div>
  </div>
</div>`;
  }

  // entityType is always one of carton/pallet/batch here (order/forwarding go through
  // renderOrderOrForwarding above) and all three now return early, so this is unreachable —
  // kept only as a defensive fallback in case a new container kind is added later.
  return `
<div class="label">
  ${markNoEarly ? `<div class="mark">唛头号 · ${markNoEarly}</div>` : ""}
  <div class="grid">
    <div class="left">
      <div class="block">
        <div class="muted">${title}</div>
        <div class="entity">${d.entityNo}</div>
      </div>
      <div class="bc-lg">${barcodeSVG(d.entityNo, 1.8, 46)}</div>
    </div>
    <div class="right"></div>
  </div>
</div>`;
}

export function renderLabel(d: LabelData | LabelData[]) {
  const list = Array.isArray(d) ? d : [d];
  if (!list.length) return;
  const body = list
    .map((item) =>
      item.entityType === "order" || item.entityType === "forwarding"
        ? renderOrderOrForwarding(item)
        : renderContainer(item),
    )
    .join("");
  const title = list.length === 1 ? `面单 ${list[0].entityNo}` : `面单 (${list.length})`;
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${title}</title>
<style>
  @page { size: 150mm 100mm; margin: 0; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; margin: 0; background: #f0f0f0; color: #000; }
  .label { width: 150mm; height: 100mm; padding: 4mm 5mm; background: #fff; page-break-after: always; break-after: page; display: flex; flex-direction: column; gap: 2mm; overflow: hidden; margin: 4mm auto; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
  .label:last-child { page-break-after: auto; break-after: auto; }
  .mark { text-align: center; font-weight: 900; font-size: 19px; letter-spacing: 2px; padding: 0.8mm 0; border: 1.5px solid #000; border-radius: 1.5mm; background: #000; color: #fff; flex-shrink: 0; }
  .grid { flex: 1; display: grid; grid-template-columns: 72mm 1fr; gap: 4mm; min-height: 0; }
  .left { display: flex; flex-direction: column; gap: 1.5mm; border-right: 1.5px dashed #999; padding-right: 3mm; min-width: 0; }
  .right { display: flex; flex-direction: column; gap: 1mm; min-width: 0; }
  .stack { flex: 1; display: flex; flex-direction: column; gap: 2mm; min-height: 0; }
  .stack .barcodes { display: flex; flex-direction: column; gap: 1.5mm; padding-bottom: 2mm; border-bottom: 1.5px dashed #999; flex-shrink: 0; }
  .stack .info { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; min-height: 0; }
  .stack .info .colL { display: flex; flex-direction: column; gap: 1mm; min-width: 0; border-right: 1.5px dashed #999; padding-right: 3mm; }
  .stack .info .colR { display: flex; flex-direction: column; gap: 1mm; min-width: 0; }
  .block .muted { margin-bottom: 0.5mm; }
  .entity { font-size: 18px; font-weight: 800; font-family: ui-monospace, Menlo, monospace; letter-spacing: 0.6px; word-break: break-all; line-height: 1.2; }
  .bc { max-width: 100%; overflow: hidden; }
  .bc svg, .bc-lg svg { max-width: 100%; height: auto; display: block; }
  .bc-lg { display: flex; justify-content: center; margin-top: 0.5mm; }
  .row { display: flex; gap: 3mm; font-size: 13.7px; font-weight: 800; padding: 0.5mm 0; border-bottom: 1px dotted #ccc; align-items: baseline; min-width: 0; }
  .row b { flex: 1; font-weight: 900; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .addr { align-items: flex-start; }
  /* .row b.addr-body (not .addr-body alone) — needs to out-specificity the
     nowrap/ellipsis .row b already sets, or those win and the address never wraps. */
  .row b.addr-body { white-space: normal; text-overflow: clip; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }
  .muted { color: #000; font-weight: 800; font-size: 11.7px; text-transform: uppercase; letter-spacing: 0.65px; flex-shrink: 0; }
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
  if (!w) {
    alert("请允许弹窗以打印面单");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
