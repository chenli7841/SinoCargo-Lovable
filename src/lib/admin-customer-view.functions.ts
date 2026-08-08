import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Backs the admin "客户视图" page: owner-only (see NAV_GROUPS in
// admin/route.tsx, where this link overrides its group's default
// owner+manager access) can look a customer up by customer_code and
// view/edit a slice of their account data on their behalf, without ever
// switching sessions (the acting admin's identity is preserved
// end-to-end). Every write here is attributed via admin_action_logs — same
// table/shape src/lib/orders.functions.ts already uses for staff actions.
// The nav hides this from everyone else, but that's client-side only —
// this check is what actually enforces it.
async function assertOwner(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: owner only");
}

async function getOperatorName(admin: any, userId: string): Promise<string> {
  const { data } = await admin.from("profiles").select("full_name, email").eq("id", userId).maybeSingle();
  return data?.full_name || data?.email || userId;
}

async function recordLog(
  admin: any,
  opts: {
    entity_type: string;
    entity_id: string;
    action: string;
    before?: any;
    after?: any;
    operator_id: string;
    operator_name?: string;
    note?: string;
  },
) {
  await admin.from("admin_action_logs").insert({
    entity_type: opts.entity_type,
    entity_id: opts.entity_id,
    action: opts.action,
    before: opts.before ?? null,
    after: opts.after ?? null,
    operator_id: opts.operator_id,
    operator_name: opts.operator_name ?? null,
    note: opts.note ?? null,
  });
}

// ============ Look up a customer by customer_code ============
export const findCustomerByCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) => d)
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const code = data.code.trim();
    if (!code) throw new Error("请输入客户号");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select(
        "id, customer_code, full_name, email, phone, username, preferred_lang, vip_level, points, is_blacklisted, blacklist_reason, created_at",
      )
      .ilike("customer_code", code)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!profile) return { profile: null, roles: [] as string[] };
    const { data: roleRows } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", profile.id);
    return { profile, roles: (roleRows ?? []).map((r: any) => r.role as string) };
  });

// ============ Overview (read-only) ============
export const getCustomerOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: wallet }, { data: orders }, { data: fwd }, { data: unpaidInv }] = await Promise.all([
      supabaseAdmin.from("wallets").select("balance_cad").eq("user_id", data.userId).maybeSingle(),
      supabaseAdmin.from("orders").select("id,status").eq("user_id", data.userId),
      supabaseAdmin.from("forwarding_orders").select("id,status").eq("user_id", data.userId),
      supabaseAdmin
        .from("invoices")
        .select("invoice_no,total_cny,paid_cny,status,due_date")
        .eq("user_id", data.userId)
        .in("status", ["unpaid", "overdue"]),
    ]);
    const oRows = orders ?? [];
    const fRows = fwd ?? [];
    const inTransit =
      oRows.filter((r: any) => r.status === "shipped").length +
      fRows.filter((r: any) => ["shipped", "in_transit"].includes(r.status)).length;
    const unwarehoused = fRows.filter((r: any) => r.status === "pending").length;
    const unpaidInvoices = (unpaidInv ?? []).map((inv: any) => ({
      invoice_no: inv.invoice_no,
      due_cny: Math.max(0, Number(inv.total_cny ?? 0) - Number(inv.paid_cny ?? 0)),
      status: inv.status,
      due_date: inv.due_date,
    }));
    return {
      wallet_balance_cad: Number((wallet as any)?.balance_cad ?? 0),
      total_orders: oRows.length + fRows.length,
      in_transit: inTransit,
      unwarehoused,
      unpaid_invoices: unpaidInvoices,
      unpaid_total_cny: unpaidInvoices.reduce((s, i) => s + i.due_cny, 0),
    };
  });

// ============ Profile: view + edit (business fields only — never email/password) ============
export const saveCustomerProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      userId: string;
      full_name?: string | null;
      phone?: string | null;
      username?: string;
      preferred_lang?: string;
      reg_country?: string | null;
      reg_province?: string | null;
      reg_city?: string | null;
      reg_address?: string | null;
      reg_postal_code?: string | null;
      reg_phone?: string | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { userId, username, ...rest } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before } = await supabaseAdmin.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!before) throw new Error("客户不存在");

    const patch: Record<string, unknown> = { ...rest };
    if (username !== undefined) {
      const trimmed = username.trim();
      if (!trimmed) throw new Error("登录名不能为空");
      if (trimmed.toLowerCase() !== ((before as any).username ?? "").toLowerCase()) {
        const { data: available, error: checkErr } = await supabaseAdmin.rpc("check_username_available", {
          p_username: trimmed,
        });
        if (checkErr) throw new Error(checkErr.message);
        if (!available) throw new Error("登录名已被占用");
      }
      patch.username = trimmed;
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update(patch as any)
      .eq("id", userId);
    if (error) throw new Error(error.message);

    const operator_name = await getOperatorName(supabaseAdmin, context.userId);
    await recordLog(supabaseAdmin, {
      entity_type: "customer_profile",
      entity_id: userId,
      action: "admin_edit_profile",
      before,
      after: patch,
      operator_id: context.userId,
      operator_name,
    });
    return { ok: true };
  });

// ============ Addresses: full CRUD on behalf of the customer ============
export const listCustomerAddresses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("addresses")
      .select("*")
      .eq("user_id", data.userId)
      .order("is_default", { ascending: false });
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

export const saveCustomerAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; address: any }) => d)
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...rest } = data.address ?? {};
    if (rest.is_default) {
      await supabaseAdmin.from("addresses").update({ is_default: false }).eq("user_id", data.userId);
    }
    const payload = { ...rest, user_id: data.userId };
    const op = id
      ? supabaseAdmin.from("addresses").update(payload).eq("id", id).eq("user_id", data.userId)
      : supabaseAdmin.from("addresses").insert(payload);
    const { error } = await op;
    if (error) throw new Error(error.message);

    const operator_name = await getOperatorName(supabaseAdmin, context.userId);
    await recordLog(supabaseAdmin, {
      entity_type: "customer_address",
      entity_id: id || data.userId,
      action: id ? "admin_edit_address" : "admin_add_address",
      after: payload,
      operator_id: context.userId,
      operator_name,
    });
    return { ok: true };
  });

export const deleteCustomerAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; addressId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("addresses")
      .delete()
      .eq("id", data.addressId)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);

    const operator_name = await getOperatorName(supabaseAdmin, context.userId);
    await recordLog(supabaseAdmin, {
      entity_type: "customer_address",
      entity_id: data.addressId,
      action: "admin_delete_address",
      operator_id: context.userId,
      operator_name,
    });
    return { ok: true };
  });

// ============ My Items (SKU library): full CRUD on behalf of the customer ============
export const listCustomerItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("my_items")
      .select("*")
      .eq("user_id", data.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

export const saveCustomerItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      userId: string;
      id?: string;
      name: string;
      hs_code: string;
      sku?: string | null;
      declared_value_cad?: number;
      inner_qty?: number | null;
      unit?: string | null;
      mfn_rate?: number;
      gst_rate?: number;
      sima_involved?: boolean;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    if (!data.name.trim()) throw new Error("请填写物品名称");
    if (!data.hs_code.trim()) throw new Error("请填写 HS 编码");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const hsCode = data.hs_code.trim().replace(/\s+/g, "");

    const { data: resolved, error: resolveError } = await supabaseAdmin.rpc("resolve_hs_code_rates", {
      p_hs_code: hsCode,
      p_name_zh: data.name.trim(),
      p_unit: data.unit?.trim() || "",
      p_mfn_rate: data.mfn_rate ?? 0,
      p_gst_rate: data.gst_rate ?? 0.05,
      p_sima_involved: data.sima_involved ?? false,
    });
    if (resolveError) throw new Error(resolveError.message);

    const payload = {
      user_id: data.userId,
      name: data.name.trim(),
      hs_code: hsCode,
      sku: data.sku?.trim() || null,
      declared_value_cad: data.declared_value_cad ?? 0,
      inner_qty: data.inner_qty ?? null,
      unit: (resolved as any)?.unit ?? (data.unit?.trim() || null),
      mfn_rate: (resolved as any)?.mfn_rate ?? data.mfn_rate ?? 0,
      gst_rate: (resolved as any)?.gst_rate ?? data.gst_rate ?? 0.05,
      sima_involved: (resolved as any)?.sima_involved ?? data.sima_involved ?? false,
    };
    const op = data.id
      ? supabaseAdmin.from("my_items").update(payload).eq("id", data.id).eq("user_id", data.userId)
      : supabaseAdmin.from("my_items").insert(payload);
    const { error } = await op;
    if (error) throw new Error(error.message);

    const operator_name = await getOperatorName(supabaseAdmin, context.userId);
    await recordLog(supabaseAdmin, {
      entity_type: "customer_item",
      entity_id: data.id || data.userId,
      action: data.id ? "admin_edit_item" : "admin_add_item",
      after: payload,
      operator_id: context.userId,
      operator_name,
    });
    return { ok: true };
  });

export const deleteCustomerItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; itemId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("my_items").delete().eq("id", data.itemId).eq("user_id", data.userId);
    if (error) throw new Error(error.message);

    const operator_name = await getOperatorName(supabaseAdmin, context.userId);
    await recordLog(supabaseAdmin, {
      entity_type: "customer_item",
      entity_id: data.itemId,
      action: "admin_delete_item",
      operator_id: context.userId,
      operator_name,
    });
    return { ok: true };
  });

// ============ Orders / waybills (read-only, on behalf of the customer) ============
export const listCustomerOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: orders }, { data: fwd }, { data: wbs }] = await Promise.all([
      supabaseAdmin
        .from("orders")
        .select("id,order_no,status,total_cny,payment_status,created_at,shipping_method,tracking_no")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("forwarding_orders")
        .select(
          "id,request_no,status,fee_cny,payment_status,created_at,warehouse,route_code,shipping_method,domestic_tracking_no,items_desc",
        )
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("waybills")
        .select("id,waybill_no,status,order_id,forwarding_id")
        .eq("user_id", data.userId),
    ]);
    const byOrder = new Map<string, any[]>();
    const byFwd = new Map<string, any[]>();
    (wbs ?? []).forEach((w: any) => {
      const key = w.order_id ?? w.forwarding_id;
      if (!key) return;
      const m = w.order_id ? byOrder : byFwd;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push({ waybill_no: w.waybill_no, status: w.status });
    });
    return {
      orders: (orders ?? []).map((o: any) => ({ ...o, waybills: byOrder.get(o.id) ?? [] })),
      forwardings: (fwd ?? []).map((f: any) => ({ ...f, waybills: byFwd.get(f.id) ?? [] })),
    };
  });

// ============ Inventory (waybills parked in storage) ============
export const listCustomerInventory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("waybills")
      .select("id,waybill_no,items_summary,updated_at,forwarding_id,weight_kg,length_cm,width_cm,height_cm")
      .eq("user_id", data.userId)
      .eq("status", "storage")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    const fwdIds = Array.from(new Set((rows ?? []).map((r: any) => r.forwarding_id).filter(Boolean)));
    const { data: fwdRows } = fwdIds.length
      ? await supabaseAdmin.from("forwarding_orders").select("id,warehouse,request_no").in("id", fwdIds)
      : { data: [] as any[] };
    const fwdById = new Map((fwdRows ?? []).map((f: any) => [f.id, f]));
    return {
      items: (rows ?? []).map((r: any) => ({
        ...r,
        warehouse: fwdById.get(r.forwarding_id)?.warehouse ?? null,
        request_no: fwdById.get(r.forwarding_id)?.request_no ?? null,
      })),
    };
  });

// ============ Options for the on-behalf forwarding form ============
export const listForwardingOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: routes }, { data: warehouses }, { data: addresses }] = await Promise.all([
      supabaseAdmin
        .from("shipping_routes")
        .select("id,code,name_zh,shipping_method,destination_code")
        .eq("is_active", true)
        .order("code"),
      supabaseAdmin.from("warehouses").select("id,code,name_zh").eq("is_active", true).order("code"),
      supabaseAdmin.from("addresses").select("id,recipient,city,line1,is_default").eq("user_id", data.userId),
    ]);
    const routeIds = (routes ?? []).map((r: any) => r.id);
    let rules: any[] = [];
    if (routeIds.length) {
      const { data: fr } = await supabaseAdmin
        .from("freight_rules")
        .select("route_id,weight_mode,volumetric_divisor")
        .in("route_id", routeIds)
        .eq("is_active", true);
      rules = fr ?? [];
    }
    const withRules = (routes ?? []).map((r: any) => {
      const rule = rules.find((x) => x.route_id === r.id);
      return {
        ...r,
        weight_mode: rule?.weight_mode ?? null,
        volumetric_divisor: rule?.volumetric_divisor ?? null,
      };
    });
    return { routes: withRules, warehouses: warehouses ?? [], addresses: addresses ?? [] };
  });

// ============ Create a forwarding request on behalf of the customer ============
export const createCustomerForwarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      userId: string;
      warehouse: string;
      route_code: string;
      address_id?: string | null;
      domestic_tracking_no?: string | null;
      note?: string | null;
      insured?: boolean;
      items: {
        name: string;
        quantity: number;
        unit_price_cny: number;
        hs_code?: string | null;
        material?: string | null;
        weight_kg?: number | null;
        volume_m3?: number | null;
      }[];
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const items = (data.items ?? []).filter((i) => i.name?.trim());
    if (!items.length) throw new Error("请至少填写一件物品");
    if (!data.warehouse) throw new Error("请选择仓库");

    const { data: route } = await supabaseAdmin
      .from("shipping_routes")
      .select("id,code,shipping_method,destination_code")
      .eq("code", data.route_code)
      .eq("is_active", true)
      .maybeSingle();
    if (!route) throw new Error("线路不可用");

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("customer_code")
      .eq("id", data.userId)
      .maybeSingle();

    const { data: fxRaw } = await supabaseAdmin.rpc("current_fx_cny_to_cad");
    const fx = Number(fxRaw ?? 0.19) || 0.19;

    const rows = items.map((i) => {
      const qty = Math.max(1, Math.floor(Number(i.quantity) || 1));
      const cny = Number(i.unit_price_cny) || 0;
      const extras: Record<string, unknown> = {};
      if (i.material) extras.material = String(i.material).trim();
      if (i.weight_kg != null && Number(i.weight_kg) > 0) extras.weight_kg = Number(i.weight_kg);
      if (i.volume_m3 != null && Number(i.volume_m3) > 0) extras.volume_m3 = Number(i.volume_m3);
      return {
        name: i.name.trim(),
        quantity: qty,
        unit_price_cny: cny,
        unit_price_cad: Number((cny * fx).toFixed(2)),
        hs_code: i.hs_code ? String(i.hs_code).trim() : null,
        extras,
      };
    });
    const declaredCad = Number(rows.reduce((s, r) => s + r.quantity * r.unit_price_cad, 0).toFixed(2));

    const { data: fo, error: foErr } = await supabaseAdmin
      .from("forwarding_orders")
      .insert({
        user_id: data.userId,
        warehouse: data.warehouse,
        shipping_method: (route as any).shipping_method,
        route_code: (route as any).code,
        destination_code: (route as any).destination_code,
        route_id: (route as any).id,
        address_id: data.address_id || null,
        customer_code: (prof as any)?.customer_code ?? null,
        domestic_tracking_no: data.domestic_tracking_no || null,
        status: "pending",
        payment_status: "unpaid",
        note: data.note || null,
        insured: !!data.insured,
        items_desc: rows.map((r) => `${r.name}×${r.quantity}`).join(", "),
        declared_value_cad: declaredCad,
      } as any)
      .select("id,request_no")
      .single();
    if (foErr) throw new Error(foErr.message);

    const { error: itemErr } = await supabaseAdmin
      .from("forwarding_items")
      .insert(rows.map((r) => ({ forwarding_id: (fo as any).id, ...r })) as any);
    if (itemErr) throw new Error(itemErr.message);

    const operator_name = await getOperatorName(supabaseAdmin, context.userId);
    await recordLog(supabaseAdmin, {
      entity_type: "forwarding_order",
      entity_id: (fo as any).id,
      action: "admin_place_forwarding_on_behalf",
      after: { user_id: data.userId, route_code: data.route_code, items: rows },
      operator_id: context.userId,
      operator_name,
      note: "客户视图代客发起集运",
    });
    return { ok: true, request_no: (fo as any).request_no };
  });

// ============ Fuzzy SKU/name/HS lookup over the customer's own item library ============
// Mirrors the customer-facing forwarding form (src/routes/_authenticated/
// forwarding.index.tsx): typing part of a SKU, product name or HS code pulls
// the saved record so staff don't retype it. We search both my_items (the
// customer's own library) and customer_hs_items (their imported HS library),
// and convert the stored CAD unit price into the CNY the admin form expects.
export const searchCustomerItemLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; term: string }) => d)
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const term = data.term.trim();
    if (!term) return { items: [] as any[] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const like = `%${term.replace(/[%,]/g, "")}%`;

    const { data: fxRaw } = await supabaseAdmin.rpc("current_fx_cny_to_cad");
    const fx = Number(fxRaw ?? 0.19) || 0.19;
    const toCny = (cad: number | null | undefined) =>
      cad == null ? 0 : Number((Number(cad) / fx).toFixed(2));

    const [{ data: mine }, { data: hs }] = await Promise.all([
      supabaseAdmin
        .from("my_items")
        .select("id,sku,name,hs_code,declared_value_cad,inner_qty")
        .eq("user_id", data.userId)
        .or(`sku.ilike.${like},name.ilike.${like},hs_code.ilike.${like}`)
        .limit(8),
      supabaseAdmin
        .from("customer_hs_items")
        .select("id,sku,description,hs_code,unit_price_cad,items_per_carton")
        .eq("user_id", data.userId)
        .or(`sku.ilike.${like},description.ilike.${like},hs_code.ilike.${like}`)
        .limit(8),
    ]);

    const seen = new Set<string>();
    const rows: {
      id: string;
      sku: string | null;
      name: string;
      hs_code: string | null;
      unit_price_cny: number;
      inner_qty: number | null;
      source: "my_items" | "hs_lib";
    }[] = [];
    for (const r of (mine ?? []) as any[]) {
      const key = `${(r.sku ?? "").toLowerCase()}|${(r.name ?? "").toLowerCase()}`;
      seen.add(key);
      rows.push({
        id: r.id,
        sku: r.sku,
        name: r.name,
        hs_code: r.hs_code,
        unit_price_cny: toCny(r.declared_value_cad),
        inner_qty: r.inner_qty ?? null,
        source: "my_items",
      });
    }
    for (const r of (hs ?? []) as any[]) {
      const key = `${(r.sku ?? "").toLowerCase()}|${(r.description ?? "").toLowerCase()}`;
      if (seen.has(key)) continue;
      rows.push({
        id: r.id,
        sku: r.sku,
        name: r.description,
        hs_code: r.hs_code,
        unit_price_cny: toCny(r.unit_price_cad),
        inner_qty: r.items_per_carton != null ? Math.round(Number(r.items_per_carton)) : null,
        source: "hs_lib",
      });
    }
    return { items: rows.slice(0, 12) };
  });

// ============ Account security: read-only view + password reset ============
export const getCustomerAccountInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p, error } = await supabaseAdmin
      .from("profiles")
      .select("username, email, wechat_openid, wechat_nickname, customer_code, full_name, phone, created_at")
      .eq("id", data.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    let authEmail: string | null = null;
    let providers: string[] = [];
    try {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(data.userId);
      authEmail = u?.user?.email ?? null;
      providers = ((u?.user?.identities ?? []) as any[]).map((i) => i.provider);
    } catch {
      /* ignore */
    }
    return {
      username: (p as any)?.username ?? null,
      email: authEmail ?? (p as any)?.email ?? null,
      wechat_openid: (p as any)?.wechat_openid ?? null,
      wechat_nickname: (p as any)?.wechat_nickname ?? null,
      customer_code: (p as any)?.customer_code ?? null,
      full_name: (p as any)?.full_name ?? null,
      phone: (p as any)?.phone ?? null,
      created_at: (p as any)?.created_at ?? null,
      providers,
    };
  });

export const resetCustomerPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: "123456" });
    if (error) throw new Error(error.message);
    const operator_name = await getOperatorName(supabaseAdmin, context.userId);
    await recordLog(supabaseAdmin, {
      entity_type: "customer_profile",
      entity_id: data.userId,
      action: "admin_reset_password",
      operator_id: context.userId,
      operator_name,
      note: "重置为默认密码",
    });
    return { ok: true };
  });
