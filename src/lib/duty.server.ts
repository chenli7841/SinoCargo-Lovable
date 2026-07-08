// 关税计算 · 统一入口
// - 全部按 HS 编码逐项税率计算 (mfn + gst + anti_dumping)
// - customs_rules.rate_pct 已弃用；只用 customs_rules.enabled 决定该线路是否征税
// - 匹配优先级: forwarding_items.hs_code (manual) → name_zh/name_en 精确 → aliases 精确 → 包含
// - 声明价 = unit_price_cad × 每张运单的数量
//   数量 = extras.items_per_carton (手工填) || quantity / box_count
// - 供 computeWaybillFeesCad / computeAndPersistWaybillFees / computeBatchFeeSummary 共同使用

export type HsMatchSource = "manual" | "name" | "alias" | "fuzzy" | "none";

export type DutyItemRow = {
  forwarding_item_id: string | null;
  name: string;
  hs_code: string | null;
  hs_matched: HsMatchSource;
  box_count: number;
  quantity_total: number;              // forwarding 层面总数量
  quantity_per_waybill: number;
  quantity_display: string;            // 分数展示 (10/3)
  quantity_fraction: { numerator: number; denominator: number };
  quantity_source: "items_per_carton" | "quantity/box_count" | "quantity";
  unit_price_cad: number;
  declared_value_cad: number;
  mfn_rate: number;
  gst_rate: number;
  anti_dumping_rate: number;
  tax_rate: number;
  duty_cad: number;
  duty_applied: boolean;               // customs_rules.enabled && 达到免税额
};

export type DutyBreakdown = {
  items: DutyItemRow[];
  declared_cad: number;
  duty_cad: number;
  customs_enabled: boolean;
  threshold_cad: number;
  unmatched_names: string[];
  route_id: string | null;
};

function toFraction(x: number): { value: number; display: string; numerator: number; denominator: number } {
  const value = +Number(x || 0).toFixed(6);
  if (Number.isInteger(value)) return { value, display: String(value), numerator: value, denominator: 1 };
  const denom = 12; // 常见箱数（1..12）足以覆盖分箱情形
  let bestN = 1, bestD = 1, bestErr = Infinity;
  for (let d = 1; d <= denom; d++) {
    const n = Math.round(value * d);
    const err = Math.abs(value - n / d);
    if (err < bestErr) { bestErr = err; bestN = n; bestD = d; }
  }
  // reduce
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const g = gcd(Math.abs(bestN), bestD);
  const n = bestN / g, d = bestD / g;
  return { value, display: d === 1 ? String(n) : `${n}/${d}`, numerator: n, denominator: d };
}

type HsRow = {
  hs_code: string;
  name_zh: string | null;
  name_en: string | null;
  aliases: string[] | null;
  mfn_rate: number | null;
  gst_rate: number | null;
  anti_dumping_rate: number | null;
};

export function buildHsIndex(rows: HsRow[]) {
  const byCode = new Map<string, HsRow>();
  const byExact = new Map<string, HsRow>();  // name_zh / name_en / alias 精确 (lower)
  const byContains: HsRow[] = [];
  for (const h of rows ?? []) {
    if (!h?.hs_code) continue;
    byCode.set(h.hs_code, h);
    const push = (s?: string | null) => { if (s) byExact.set(String(s).trim().toLowerCase(), h); };
    push(h.name_zh); push(h.name_en);
    for (const a of (h.aliases ?? [])) push(a);
    byContains.push(h);
  }
  return { byCode, byExact, byContains };
}

export function matchHsForName(name: string, index: ReturnType<typeof buildHsIndex>, explicitCode?: string | null): { hs: HsRow | null; matched: HsMatchSource } {
  if (explicitCode) {
    const h = index.byCode.get(explicitCode);
    if (h) return { hs: h, matched: "manual" };
  }
  const s = (name ?? "").trim().toLowerCase();
  if (!s) return { hs: null, matched: "none" };
  const exact = index.byExact.get(s);
  if (exact) {
    // 判定来源：精确命中 name_zh/name_en 视为 name，否则 alias
    const nm = (exact.name_zh ?? "").toLowerCase() === s || (exact.name_en ?? "").toLowerCase() === s;
    return { hs: exact, matched: nm ? "name" : "alias" };
  }
  // 包含匹配
  const fuzzy = index.byContains.find(h =>
    (h.name_zh ?? "").toLowerCase().includes(s) ||
    (h.name_en ?? "").toLowerCase().includes(s) ||
    s.includes((h.name_zh ?? "").toLowerCase() || "\0") ||
    s.includes((h.name_en ?? "").toLowerCase() || "\0")
  );
  if (fuzzy) return { hs: fuzzy, matched: "fuzzy" };
  return { hs: null, matched: "none" };
}

// 主入口：计算一条运单的关税明细
export async function computeWaybillDutyBreakdown(admin: any, wb: any): Promise<DutyBreakdown> {
  const empty: DutyBreakdown = {
    items: [], declared_cad: 0, duty_cad: 0,
    customs_enabled: false, threshold_cad: 0,
    unmatched_names: [], route_id: null,
  };
  if (!wb?.forwarding_id) return empty;

  const [{ data: fo }, { data: fi }, { data: hs }] = await Promise.all([
    admin.from("forwarding_orders").select("id, box_count, route_id").eq("id", wb.forwarding_id).maybeSingle(),
    admin.from("forwarding_items").select("id, name, quantity, unit_price_cad, unit_price_cny, extras, hs_code").eq("forwarding_id", wb.forwarding_id),
    admin.from("hs_codes").select("hs_code, name_zh, name_en, aliases, mfn_rate, gst_rate, anti_dumping_rate"),
  ]);
  const route_id = fo?.route_id ?? null;
  const boxCount = Math.max(Number(fo?.box_count ?? 1) || 1, 1);
  const index = buildHsIndex((hs ?? []) as HsRow[]);

  // customs_rules —— 只读 enabled + threshold_cad；rate_pct 已废弃
  let customs_enabled = false, threshold_cad = 0;
  if (route_id) {
    const { data: cr } = await admin.from("customs_rules").select("enabled, threshold_cad").eq("route_id", route_id).maybeSingle();
    customs_enabled = !!cr?.enabled;
    threshold_cad = Number(cr?.threshold_cad ?? 0);
  }

  // fx 兜底（unit_price_cad 缺失时用 unit_price_cny 折算）
  let fx = 0.19;
  try {
    const { data: s } = await admin.from("app_settings").select("value").eq("key", "fx_rate").maybeSingle();
    const cnyPerCad = Number((s?.value as any)?.cny_per_cad ?? 0);
    if (cnyPerCad > 0) fx = +(1 / cnyPerCad).toFixed(6);
  } catch {}

  // 若 items_summary 有指定 name，只算这些；否则全部按 box 均摊
  const summary: any[] = Array.isArray(wb.items_summary) ? wb.items_summary : [];
  const summaryByName = new Map<string, number>();  // name → 该运单数量
  for (const it of summary) {
    if (it?.name) summaryByName.set(String(it.name), Number(it.quantity ?? 0));
  }

  const items: DutyItemRow[] = [];
  const unmatched = new Set<string>();
  let declared_total = 0;

  for (const it of (fi ?? []) as any[]) {
    const explicitInner = Number(it?.extras?.items_per_carton ?? 0);
    const totalQty = Number(it.quantity ?? 0);
    let rawPerWb: number;
    let source: DutyItemRow["quantity_source"];
    if (summaryByName.has(it.name)) {
      rawPerWb = Number(summaryByName.get(it.name) || 0);
      source = "quantity";
    } else if (explicitInner > 0) {
      rawPerWb = explicitInner;
      source = "items_per_carton";
    } else {
      rawPerWb = boxCount > 0 ? totalQty / boxCount : totalQty;
      source = boxCount > 1 ? "quantity/box_count" : "quantity";
    }
    const qtyFrac = toFraction(rawPerWb);
    let unit = Number(it.unit_price_cad ?? 0);
    if (!(unit > 0) && Number(it.unit_price_cny ?? 0) > 0) unit = Number(it.unit_price_cny) * fx;
    const declared = +(unit * qtyFrac.value).toFixed(2);
    declared_total += declared;

    const { hs: hsRow, matched } = matchHsForName(it.name ?? "", index, it.hs_code ?? null);
    if (!hsRow) unmatched.add(it.name ?? "(未命名)");
    const mfn = Number(hsRow?.mfn_rate ?? 0);
    const gst = Number(hsRow?.gst_rate ?? 0);
    const ad  = Number(hsRow?.anti_dumping_rate ?? 0);
    const rate = mfn + gst + ad;

    items.push({
      forwarding_item_id: it.id,
      name: it.name ?? "",
      hs_code: hsRow?.hs_code ?? null,
      hs_matched: hsRow ? matched : "none",
      box_count: boxCount,
      quantity_total: totalQty,
      quantity_per_waybill: qtyFrac.value,
      quantity_display: qtyFrac.display,
      quantity_fraction: { numerator: qtyFrac.numerator, denominator: qtyFrac.denominator },
      quantity_source: source,
      unit_price_cad: +unit.toFixed(2),
      declared_value_cad: declared,
      mfn_rate: mfn, gst_rate: gst, anti_dumping_rate: ad, tax_rate: rate,
      duty_cad: 0,     // 下面按线路开关统一置位
      duty_applied: false,
    });
  }

  const applies = customs_enabled && declared_total >= threshold_cad;
  let duty_total = 0;
  for (const row of items) {
    if (applies) {
      row.duty_cad = +(row.declared_value_cad * row.tax_rate).toFixed(2);
      row.duty_applied = true;
      duty_total += row.duty_cad;
    }
  }

  return {
    items,
    declared_cad: +declared_total.toFixed(2),
    duty_cad: +duty_total.toFixed(2),
    customs_enabled,
    threshold_cad,
    unmatched_names: [...unmatched],
    route_id,
  };
}
