import JsBarcode from "jsbarcode";

export function barcodeSVG(text: string, width = 1.6, height = 40, displayValue = true) {
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
      fontSize: 11,
      margin: 0,
      background: "#ffffff",
    });
    return new XMLSerializer().serializeToString(svg);
  } catch {
    return `<div style="font-family:monospace;font-size:11px">${text}</div>`;
  }
}
