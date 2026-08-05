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
    await assertOwner(context.supabase, context.userId);
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
    await assertOwner(context.supabase, context.userId);
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
    await assertOwner(context.supabase, context.userId);
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
