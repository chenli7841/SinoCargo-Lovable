// Client-side label rendering with CODE128 barcodes (jsbarcode)
// Label size: 150mm × 100mm (landscape)
//
// 可用模板（在 renderLabel 的第二个参数指定）：
//   "standard"  - 默认，订单/集运单标准面单
//   "minimal"   - 极简面单
//   "detailed"  - 详细面单
//   "container" - 箱/托盘/批次容器面单
//
// 修改模板请编辑 src/lib/label-templates/ 下的对应文件。
import type { LabelData } from "./label-templates/types";
import { standardTemplate } from "./label-templates/standard";
import { containerTemplate } from "./label-templates/container";
import { minimalTemplate } from "./label-templates/minimal";
import { detailedTemplate } from "./label-templates/detailed";

export type { LabelData } from "./label-templates/types";

const templates = {
  standard: standardTemplate,
  minimal: minimalTemplate,
  detailed: detailedTemplate,
  container: containerTemplate,
};

export type LabelTemplateName = keyof typeof templates;

export function renderLabel(d: LabelData | LabelData[], template: LabelTemplateName = "standard") {
  const list = Array.isArray(d) ? d : [d];
  if (!list.length) return;

  const body = list.map((item) => {
    const tpl = item.entityType === "order" || item.entityType === "forwarding"
      ? templates[template] ?? standardTemplate
      : containerTemplate;
    return tpl(item);
  }).join("");

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

  /* standard template (full-width stacked barcodes) */
  .std { gap: 1.5mm; }
  .std .mark { font-size: 24px; letter-spacing: 3px; padding: 2.5mm 0; }
  .std-bc { border-bottom: 1.2px dashed #999; padding-bottom: 1.5mm; }
  .std-bc .muted { margin-bottom: 0.8mm; }
  .bc-full { display: flex; justify-content: center; }
  .bc-full svg { max-width: 100%; height: auto; display: block; }
  .std-info { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; min-height: 0; align-content: start; }
  .std-col { display: flex; flex-direction: column; gap: 0.5mm; min-width: 0; }
  .std .row { font-size: 12px; border-bottom: none; padding: 0.8mm 0; }
  .std .row b { font-size: 13px; }
  .std .muted { font-size: 10px; }
  .std .addr-body { font-size: 12px; font-weight: 700; text-align: left; }
  .std .row b.left { text-align: left; }
  .std .addr { margin-top: 1.5mm; }

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

  /* minimal template */
  .minimal { justify-content: center; align-items: center; text-align: center; gap: 4mm; }
  .minimal-header { display: flex; gap: 6mm; font-size: 22px; font-weight: 900; }
  .minimal-route { background: #000; color: #fff; padding: 1mm 3mm; border-radius: 2mm; }
  .minimal-dest { border: 2px solid #000; padding: 1mm 3mm; border-radius: 2mm; }
  .minimal-body { width: 100%; }
  .bc-xl svg { max-width: 100%; height: auto; display: block; margin: 0 auto; }
  .minimal-meta { display: flex; justify-content: center; gap: 8mm; margin-top: 3mm; font-size: 14px; }
  .minimal-meta .muted { font-size: 10px; display: block; margin-bottom: 1mm; }

  /* detailed template */
  .detailed-grid { flex: 1; display: grid; grid-template-columns: 78mm 1fr; gap: 3mm; min-height: 0; }
  .detailed-left { display: flex; flex-direction: column; gap: 1mm; border-right: 1.5px dashed #999; padding-right: 3mm; min-width: 0; }
  .detailed-right { display: flex; flex-direction: column; gap: 1mm; min-width: 0; }

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
