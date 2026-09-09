import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "C:/Users/zeyan/Desktop/乐高收纳盒系列.xlsx";
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));

const overview = await workbook.inspect({
  kind: "workbook,sheet,table,drawing",
  maxChars: 18000,
  tableMaxRows: 20,
  tableMaxCols: 20,
  tableMaxCellChars: 160,
});
console.log(overview.ndjson);

for (const sheet of workbook.worksheets.items) {
  const used = sheet.getUsedRange();
  console.log(`SHEET:${sheet.name} USED:${used?.address ?? "none"}`);
  if (used) {
    const safe = sheet.name.replace(/[\\/:*?"<>|]/g, "_");
    for (let start = 1; start <= 36; start += 5) {
      const end = Math.min(36, start + 4);
      const preview = await workbook.render({ sheetName: sheet.name, range: `A${start}:P${end}`, scale: 0.6, format: "png" });
      await fs.writeFile(`C:/Users/zeyan/Desktop/代码/SinoCargo-Lovable/artifact_work/${safe}_${start}_${end}.png`, new Uint8Array(await preview.arrayBuffer()));
    }
  }
}
