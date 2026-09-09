import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "C:/Users/zeyan/Desktop/乐高收纳盒系列.xlsx";
const outputDir = "C:/Users/zeyan/Desktop/代码/SinoCargo-Lovable/outputs/01a081ab-29b3-7c60-9070-a4cee061404d";
const outputPath = `${outputDir}/乐高收纳盒系列_10件装_已更新.xlsx`;
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
const sheet = workbook.worksheets.getItem("Sheet1");

sheet.getRange("Q1:X1").values = [[
  "10件批发价（CNY）",
  "10件代发运费（CNY）",
  "10件合计（CNY）",
  "Amazon类比价/件（CAD）",
  "Amazon类比价/10件（CAD）",
  "Amazon ASIN",
  "Amazon来源",
  "查询日期",
]];
sheet.getRange("Q1:X1").format = {
  fill: "#70AD47",
  font: { name: "Arial", bold: true, color: "#000000", size: 11 },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  wrapText: true,
  borders: { preset: "all", style: "thin", color: "#000000" },
};
sheet.getRange("Q1:X1").format.rowHeight = 42;

sheet.getRange("Q2").formulas = [['=IF(O2="","",O2*10)']];
sheet.getRange("Q2:Q36").fillDown();
sheet.getRange("R2").formulas = [['=IF(P2="","",P2*10)']];
sheet.getRange("R2:R36").fillDown();
sheet.getRange("S2").formulas = [['=IF(OR(Q2="",R2=""),"",Q2+R2)']];
sheet.getRange("S2:S36").fillDown();
sheet.getRange("T2:T36").values = Array.from({ length: 35 }, () => [24.29]);
sheet.getRange("U2").formulas = [["=ROUND(T2*10,2)"]];
sheet.getRange("U2:U36").fillDown();
sheet.getRange("V2:V36").values = Array.from({ length: 35 }, () => ["B0DW8L4YLM"]);
sheet.getRange("W2:W36").values = Array.from({ length: 35 }, () => ["https://www.amazon.ca/dp/B0DW8L4YLM"]);
sheet.getRange("X2:X36").values = Array.from({ length: 35 }, () => [new Date("2026-09-08T00:00:00Z")]);

sheet.getRange("Q2:S36").format.numberFormat = "¥#,##0.00";
sheet.getRange("T2:U36").format.numberFormat = 'CA$#,##0.00';
sheet.getRange("X2:X36").format.numberFormat = "yyyy-mm-dd";
sheet.getRange("Q2:X36").format.font = { name: "Arial", size: 10, color: "#000000" };
sheet.getRange("Q2:X36").format.borders = { preset: "all", style: "thin", color: "#808080" };
sheet.getRange("Q2:V36").format.horizontalAlignment = "center";
sheet.getRange("W2:W36").format.wrapText = true;
sheet.getRange("Q:X").format.columnWidth = 18;
sheet.getRange("W:W").format.columnWidth = 42;

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

const check = await workbook.inspect({
  kind: "table",
  range: "Sheet1!O1:X10",
  include: "values,formulas",
  tableMaxRows: 10,
  tableMaxCols: 10,
  maxChars: 12000,
});
console.log(check.ndjson);
const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);
const preview = await workbook.render({ sheetName: "Sheet1", range: "O1:X10", scale: 1.2, format: "png" });
await fs.writeFile(`${outputDir}/乐高收纳盒系列_10件装_预览.png`, new Uint8Array(await preview.arrayBuffer()));
console.log(outputPath);
