import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getFxCadPerCny, computeBatchFeeSummary } from "@/lib/orders.functions";

// Backs the admin "客户视图" page: owner/warehouse/support/sales (see
// NAV_GROUPS in admin/route.tsx, where this link overrides its group's
// default owner+manager access) can look a customer up by customer_code and
// view/edit a slice of their account data on their behalf, without ever
// switching sessions (the acting admin's identity is preserved
// end-to-end). Every write here is attributed via admin_action_logs — same
// table/shape src/lib/orders.functions.ts already uses for staff actions.
// The nav hides this from everyone else, but that's client-side only —
// this check is what actually enforces it.
const CUSTOMER_VIEW_ROLES = ["owner", "warehouse_cn", "warehouse_ca", "support", "sales"] as const;
async function assertCustomerViewAccess(supabase: any, userId: string) {
  const results = await Promise.all(
    CUSTOMER_VIEW_ROLES.map((role) => supabase.rpc("has_role", { _user_id: userId, _role: role })),
  );
  for (const { error } of results) if (error) throw new Error(error.message);
  if (!results.some((r) => r.data)) throw new Error("Forbidden: no customer-view access");
}

async function getOperatorName(admin: any, userId: string): Promise<string> {
  const { data } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();
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
    await assertCustomerViewAccess(context.supabase, context.userId);
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
    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", profile.id);
    return { profile, roles: (roleRows ?? []).map((r: any) => r.role as string) };
  });

// ============ Overview (read-only) ============
export const getCustomerOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCustomerViewAccess(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: wallet }, { data: orders }, { data: fwd }, { data: unpaidInv }] =
      await Promise.all([
        supabaseAdmin
          .from("wallets")
          .select("balance_cad")
          .eq("user_id", data.userId)
          .maybeSingle(),
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
    await assertCustomerViewAccess(context.supabase, context.userId);
    const { userId, username, ...rest } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (!before) throw new Error("客户不存在");

    const patch: Record<string, unknown> = { ...rest };
    if (username !== undefined) {
      const trimmed = username.trim();
      if (!trimmed) throw new Error("登录名不能为空");
      if (trimmed.toLowerCase() !== ((before as any).username ?? "").toLowerCase()) {
        const { data: available, error: checkErr } = await supabaseAdmin.rpc(
          "check_username_available",
          {
            p_username: trimmed,
          },
        );
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
    await assertCustomerViewAccess(context.supabase, context.userId);
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
    await assertCustomerViewAccess(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...rest } = data.address ?? {};
    if (rest.is_default) {
      await supabaseAdmin
        .from("addresses")
        .update({ is_default: false })
        .eq("user_id", data.userId);
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
    await assertCustomerViewAccess(context.supabase, context.userId);
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
    await assertCustomerViewAccess(context.supabase, context.userId);
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
    await assertCustomerViewAccess(context.supabase, context.userId);
    if (!data.name.trim()) throw new Error("请填写物品名称");
    if (!data.hs_code.trim()) throw new Error("请填写 HS 编码");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const hsCode = data.hs_code.trim().replace(/\s+/g, "");

    const { data: resolved, error: resolveError } = await supabaseAdmin.rpc(
      "resolve_hs_code_rates",
      {
        p_hs_code: hsCode,
        p_name_zh: data.name.trim(),
        p_unit: data.unit?.trim() || "",
        p_mfn_rate: data.mfn_rate ?? 0,
        p_gst_rate: data.gst_rate ?? 0.05,
        p_sima_involved: data.sima_involved ?? false,
      },
    );
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
    await assertCustomerViewAccess(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("my_items")
      .delete()
      .eq("id", data.itemId)
      .eq("user_id", data.userId);
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

// ============ Orders / waybills (read-only) — mirrors the customer's own
// "我的订单/运单" tab. Rows link out to the existing /admin/orders/$orderId and
// /admin/forwardings/$forwardingId pages, which already have the full staff
// toolset (status changes, payment, tracking) — this list doesn't duplicate that. ============
export const getCustomerOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCustomerViewAccess(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: orders, error: oErr }, { data: fwds, error: fErr }] = await Promise.all([
      supabaseAdmin
        .from("orders")
        .select(
          "id, order_no, status, payment_status, total_cny, tracking_no, shipping_method, created_at",
        )
        .eq("user_id", data.userId)
        .eq("source", "shop")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("forwarding_orders")
        .select(
          "id, request_no, status, payment_status, fee_cny, items_desc, tracking_no, shipping_method, created_at",
        )
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false }),
    ]);
    if (oErr) throw new Error(oErr.message);
    if (fErr) throw new Error(fErr.message);
    const items = [
      ...(orders ?? []).map((o: any) => ({
        kind: "order" as const,
        id: o.id,
        no: o.order_no,
        status: o.status,
        payment_status: o.payment_status,
        amount_cny: o.total_cny,
        tracking_no: o.tracking_no,
        shipping_method: o.shipping_method,
        created_at: o.created_at,
      })),
      ...(fwds ?? []).map((f: any) => ({
        kind: "forwarding" as const,
        id: f.id,
        no: f.request_no,
        status: f.status,
        payment_status: f.payment_status,
        amount_cny: f.fee_cny,
        label: f.items_desc,
        tracking_no: f.tracking_no,
        shipping_method: f.shipping_method,
        created_at: f.created_at,
      })),
    ].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return { items };
  });

// ============ Inventory (read-only) — mirrors "我的库存": waybills currently
// sitting in a warehouse (status='storage'), grouped by product/SKU/warehouse.
// The real page's "发起集运" handoff creates a NEW forwarding order under the
// customer's own session (sessionStorage prefill → /forwarding); there's no
// admin-safe equivalent yet, so this view is read-only — staff can see what's
// in storage but not start a shipment from here. Flagged in the UI, not silently
// dropped. ============
export const getCustomerInventory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCustomerViewAccess(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: wbRows, error } = await supabaseAdmin
      .from("waybills")
      .select("id,waybill_no,items_summary,updated_at,forwarding_id")
      .eq("user_id", data.userId)
      .eq("status", "storage")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = wbRows ?? [];
    const fwdIds = Array.from(new Set(rows.map((w: any) => w.forwarding_id).filter(Boolean)));
    const [{ data: fwdRows }, { data: whRows }] = await Promise.all([
      fwdIds.length
        ? supabaseAdmin.from("forwarding_orders").select("id,warehouse").in("id", fwdIds)
        : Promise.resolve({ data: [] as any[] }),
      supabaseAdmin.from("warehouses").select("id,code,name_zh,name_en").eq("is_active", true),
    ]);
    const whByCode = new Map((whRows ?? []).map((w: any) => [w.code, w]));
    const warehouseByFwdId = new Map(
      (fwdRows ?? []).map((f: any) => [
        f.id,
        f.warehouse ? (whByCode.get(f.warehouse) ?? null) : null,
      ]),
    );
    const items = rows.map((w: any) => ({
      ...w,
      warehouse: w.forwarding_id ? (warehouseByFwdId.get(w.forwarding_id) ?? null) : null,
    }));
    return { items };
  });

// ============ Reference data for the "代客发起集运" form ============
// Warehouses + active forwarding-usable routes — same tables/filters the
// customer's own /forwarding page reads directly (public reference data,
// nothing customer-specific), just re-exposed through a server fn to keep
// this whole page's convention of "every read goes through
// admin-customer-view.functions.ts".
export const listShippingOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCustomerViewAccess(context.supabase, context.userId);
    const [{ data: warehouses }, { data: routes }] = await Promise.all([
      context.supabase
        .from("warehouses")
        .select("id,code,name_zh,name_en")
        .eq("is_active", true)
        .order("sort_order"),
      context.supabase
        .from("shipping_routes")
        .select(
          "id,code,name_zh,name_en,shipping_method,origin_warehouse_id,destination_warehouse_id,is_bidirectional",
        )
        .eq("is_active", true)
        .in("usage_scope", ["forwarding", "both"])
        .order("sort_order"),
    ]);
    return { warehouses: warehouses ?? [], routes: routes ?? [] };
  });

// ============ Storage fee: preview + pay on behalf of the customer ============
// Both wrap the storage-fee RPCs' new optional _target_user_id (see the
// pay_storage_fees/preview_storage_fees migration) — same fee math, same
// invoice, the only difference is whose wallet gets charged. Uses
// context.supabase (not supabaseAdmin) so auth.uid() inside the RPC resolves
// to the acting staff member, which is what the RPC's own staff check and
// admin_action_logs entry are keyed on.
export const previewCustomerStorageFee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCustomerViewAccess(context.supabase, context.userId);
    const { data: result, error } = await context.supabase.rpc("preview_storage_fees", {
      _target_user_id: data.userId,
    });
    if (error) throw new Error(error.message);
    return result as any;
  });

export const payCustomerStorageFee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCustomerViewAccess(context.supabase, context.userId);
    const { data: result, error } = await context.supabase.rpc("pay_storage_fees", {
      _target_user_id: data.userId,
    });
    if (error) throw new Error(error.message);
    return result as any;
  });

// ============ Forwarding: file a new request on behalf of the customer ============
// Same wrap of place_forwarding's new optional _target_user_id. The admin-side
// form is deliberately simpler than the customer's own /forwarding page (no
// per-route dynamic required-field validation UI) — if a route needs fields
// this form doesn't collect, place_forwarding still rejects it with a clear
// message, it just won't be caught client-side first.
export const createCustomerForwarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; payload: any }) => d)
  .handler(async ({ data, context }) => {
    await assertCustomerViewAccess(context.supabase, context.userId);
    const { data: result, error } = await context.supabase.rpc("place_forwarding", {
      _payload: data.payload,
      _target_user_id: data.userId,
    });
    if (error) throw new Error(error.message);
    const r = result as any;
    if (!r?.ok) throw new Error(r?.reason ?? "发起集运失败");
    return r;
  });

// ============ Batches (read-only list) — mirrors "我的批次". The pay action
// itself already has an admin-safe equivalent (deductWalletForBatch, used
// elsewhere in the batch admin screens) — this list just surfaces it here too. ============
export const getCustomerBatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCustomerViewAccess(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("customer_code")
      .eq("id", data.userId)
      .maybeSingle();
    const customerCode = (profile as any)?.customer_code ?? null;

    const { data: myWbs } = await supabaseAdmin
      .from("waybills")
      .select(
        "id, assigned_batch_id, order_id, forwarding_id, waybill_no, status, payment_status, intl_tracking_no",
      )
      .eq("user_id", data.userId)
      .not("assigned_batch_id", "is", null);
    const wbRows = (myWbs ?? []) as any[];
    const batchIds = Array.from(new Set(wbRows.map((w) => w.assigned_batch_id).filter(Boolean)));
    if (!batchIds.length) return { batches: [] };

    const { data: batchRows } = await supabaseAdmin
      .from("batches")
      .select("id, batch_no, status, shipping_method, eta_date")
      .in("id", batchIds)
      .in("status", ["shipped", "arrived", "closed"]);
    const visibleBatches = (batchRows ?? []) as any[];
    if (!visibleBatches.length) return { batches: [] };

    const FX = await getFxCadPerCny(supabaseAdmin);

    const wbByBatch = new Map<string, any[]>();
    for (const w of wbRows) {
      if (!w.assigned_batch_id) continue;
      const arr = wbByBatch.get(w.assigned_batch_id) ?? [];
      arr.push(w);
      wbByBatch.set(w.assigned_batch_id, arr);
    }
    const orderIds = Array.from(new Set(wbRows.map((w) => w.order_id).filter(Boolean)));
    const fwdIds = Array.from(new Set(wbRows.map((w) => w.forwarding_id).filter(Boolean)));
    const [oR, fR] = await Promise.all([
      orderIds.length
        ? supabaseAdmin
            .from("orders")
            .select("id, order_no, status, tracking_no")
            .in("id", orderIds)
        : Promise.resolve({ data: [] as any[] }),
      fwdIds.length
        ? supabaseAdmin
            .from("forwarding_orders")
            .select("id, request_no, status, tracking_no")
            .in("id", fwdIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const oMap = new Map<string, any>(((oR as any).data ?? []).map((o: any) => [o.id, o]));
    const fMap = new Map<string, any>(((fR as any).data ?? []).map((f: any) => [f.id, f]));

    const batches = [];
    for (const b of visibleBatches) {
      const summary = await computeBatchFeeSummary(supabaseAdmin, b.id);
      const mine = customerCode
        ? summary.per_customer.filter((p: any) => p.customer_code === customerCode)
        : [];
      const subtotalCny = +mine.reduce((s: number, p: any) => s + p.subtotal_cny, 0).toFixed(2);

      const wbs = wbByBatch.get(b.id) ?? [];
      const items = wbs.map((w: any) => {
        const o = w.order_id ? oMap.get(w.order_id) : null;
        const fo = w.forwarding_id ? fMap.get(w.forwarding_id) : null;
        return {
          kind: w.order_id ? ("order" as const) : ("forwarding" as const),
          id: w.order_id ?? w.forwarding_id ?? w.id,
          no: o?.order_no ?? fo?.request_no ?? w.waybill_no,
          status: o?.status ?? fo?.status ?? w.status,
          tracking_no: w.intl_tracking_no ?? o?.tracking_no ?? fo?.tracking_no ?? null,
          payment_status: w.payment_status,
        };
      });
      const allPaid = wbs.length > 0 && wbs.every((w: any) => w.payment_status === "paid");
      batches.push({
        batch_id: b.id,
        batch_no: b.batch_no,
        status: b.status as "shipped" | "arrived" | "closed",
        shipping_method: b.shipping_method,
        eta: b.eta_date,
        subtotal_cad: +(subtotalCny * FX).toFixed(2),
        is_paid: allPaid,
        items,
        intl_tracking_nos: Array.from(
          new Set(wbs.map((w: any) => w.intl_tracking_no).filter(Boolean)),
        ) as string[],
      });
    }
    return { batches };
  });

// ============ Fuzzy SKU/name/HS lookup over the customer's own item library ============
// Mirrors the customer-facing forwarding form (src/routes/_authenticated/
// forwarding.index.tsx): typing part of a SKU, product name or HS code pulls
// the saved record so staff don't retype it. Searches both my_items (the
// customer's own library) and customer_hs_items (their imported HS library),
// and converts the stored CAD unit price into the CNY the admin form expects.
// Not wired into the current admin forwarding form (which ships from existing
// inventory, not free-text item entry) — kept for a future free-form item flow.
export const searchCustomerItemLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; term: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCustomerViewAccess(context.supabase, context.userId);
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
    await assertCustomerViewAccess(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p, error } = await supabaseAdmin
      .from("profiles")
      .select(
        "username, email, wechat_openid, wechat_nickname, customer_code, full_name, phone, created_at",
      )
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
    await assertCustomerViewAccess(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: "123456",
    });
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
