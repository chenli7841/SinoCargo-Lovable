import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { VipLevel } from "@/lib/vip-levels";

export type AppRole =
  | "owner" | "manager" | "warehouse_cn" | "warehouse_ca"
  | "driver" | "pickup_point" | "sales" | "support" | "customer";


async function assertStaff(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_staff", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}
async function assertOwner(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: owner only");
}
async function getCallerLevel(supabase: any, userId: string): Promise<"owner" | "manager" | "none"> {
  const [{ data: isOwner }, { data: isManager }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "owner" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "manager" }),
  ]);
  if (isOwner) return "owner";
  if (isManager) return "manager";
  return "none";
}

export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { roles: (data ?? []).map((r: any) => r.role as AppRole) };
  });

export const listUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search?: string; role?: AppRole | "all"; vipLevel?: VipLevel | "all"; page?: number; pageSize?: number }) => d)
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const page = Math.max(1, data.page ?? 1);
    const pageSize = Math.min(100, Math.max(5, data.pageSize ?? 25));

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // fetch profiles via admin (covers everyone)
    let q = supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, phone, customer_code, created_at, vip_level, points, is_blacklisted, blacklist_reason", { count: "exact" })
      .order("created_at", { ascending: false });

    if (data.search && data.search.trim()) {
      const s = data.search.trim();
      q = q.or(`email.ilike.%${s}%,full_name.ilike.%${s}%,customer_code.ilike.%${s}%,phone.ilike.%${s}%`);
    }

    if (data.role && data.role !== "all") {
      const { data: ur, error: urE } = await supabaseAdmin
        .from("user_roles").select("user_id").eq("role", data.role);
      if (urE) throw new Error(urE.message);
      const ids = (ur ?? []).map((r: any) => r.user_id);
      if (ids.length === 0) return { users: [], total: 0, page, pageSize };
      q = q.in("id", ids);
    }

    if (data.vipLevel && data.vipLevel !== "all") {
      q = q.eq("vip_level", data.vipLevel);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data: profiles, error, count } = await q.range(from, to);
    if (error) throw new Error(error.message);

    const ids = (profiles ?? []).map((p: any) => p.id);
    let rolesByUser: Record<string, AppRole[]> = {};
    let walletByUser: Record<string, { balance_cad: number }> = {};
    let unpaidByUser: Record<string, { count: number; amount_cny: number }> = {};
    if (ids.length) {
      const [rolesR, walletsR, invR] = await Promise.all([
        supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids),
        supabaseAdmin.from("wallets").select("user_id, balance_cad").in("user_id", ids),
        supabaseAdmin.from("invoices")
          .select("user_id, total_cny, paid_cny, status")
          .in("user_id", ids)
          .in("status", ["unpaid", "overdue"]),
      ]);
      for (const r of rolesR.data ?? []) (rolesByUser[r.user_id] ??= []).push(r.role as AppRole);
      for (const w of walletsR.data ?? []) walletByUser[w.user_id] = {
        balance_cad: Number(w.balance_cad ?? 0),
      };
      for (const inv of invR.data ?? []) {
        const due = Math.max(0, Number(inv.total_cny ?? 0) - Number(inv.paid_cny ?? 0));
        const bucket = (unpaidByUser[inv.user_id] ??= { count: 0, amount_cny: 0 });
        bucket.count += 1;
        bucket.amount_cny += due;
      }
    }

    return {
      users: (profiles ?? []).map((p: any) => ({
        id: p.id, email: p.email, full_name: p.full_name, phone: p.phone,
        customer_code: p.customer_code, created_at: p.created_at,
        vip_level: (p.vip_level ?? "normal") as VipLevel,
        points: Number(p.points ?? 0),
        is_blacklisted: !!p.is_blacklisted,
        blacklist_reason: p.blacklist_reason ?? null,
        roles: rolesByUser[p.id] ?? [],
        wallet: walletByUser[p.id] ?? { balance_cad: 0 },
        unpaid: unpaidByUser[p.id] ?? { count: 0, amount_cny: 0 },
      })),
      total: count ?? 0, page, pageSize,
    };
  });


export const getUserDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profile }, { data: roles }, { data: wallet }, { count: ordersCount }, { data: unpaidInvoices }, { data: unpaidOrders }, { data: unpaidForwardings }] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", data.userId).maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", data.userId),
      supabaseAdmin.from("wallets").select("balance_cad").eq("user_id", data.userId).maybeSingle(),
      supabaseAdmin.from("orders").select("id", { count: "exact", head: true }).eq("user_id", data.userId),
      supabaseAdmin.from("invoices")
        .select("id, invoice_no, total_cny, paid_cny, status, due_date, created_at")
        .eq("user_id", data.userId)
        .in("status", ["unpaid", "overdue"])
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("orders")
        .select("id, order_no, total_cny, status, payment_status, created_at")
        .eq("user_id", data.userId)
        .neq("payment_status", "paid")
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin.from("forwarding_orders")
        .select("id, status, created_at")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (!profile) throw new Error("User not found");
    const unpaidAmountCny = (unpaidInvoices ?? []).reduce(
      (sum: number, inv: any) => sum + Math.max(0, Number(inv.total_cny ?? 0) - Number(inv.paid_cny ?? 0)),
      0,
    );
    return {
      profile,
      roles: (roles ?? []).map((r: any) => r.role as AppRole),
      wallet: wallet ?? { balance_cad: 0 },
      ordersCount: ordersCount ?? 0,
      unpaidInvoices: unpaidInvoices ?? [],
      unpaidOrders: unpaidOrders ?? [],
      unpaidForwardings: unpaidForwardings ?? [],
      unpaidAmountCny,
    };
  });

export const setUserVipAndPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; vipLevel?: VipLevel; points?: number; pointsDelta?: number }) => d)
  .handler(async ({ data, context }) => {
    const level = await getCallerLevel(context.supabase, context.userId);
    if (level === "none") throw new Error("Forbidden: owner or manager only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: any = {};
    if (data.vipLevel) patch.vip_level = data.vipLevel;
    if (typeof data.points === "number") patch.points = Math.max(0, Math.floor(data.points));
    if (typeof data.pointsDelta === "number" && data.pointsDelta !== 0) {
      const { data: cur } = await supabaseAdmin.from("profiles").select("points").eq("id", data.userId).maybeSingle();
      patch.points = Math.max(0, Number(cur?.points ?? 0) + Math.floor(data.pointsDelta));
    }
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserFeeScheme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; scheme: "merged" | "split" }) => d)
  .handler(async ({ data, context }) => {
    const level = await getCallerLevel(context.supabase, context.userId);
    if (level === "none") throw new Error("Forbidden: owner or manager only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.scheme !== "merged" && data.scheme !== "split") throw new Error("Invalid scheme");
    const { error } = await supabaseAdmin.from("profiles").update({ fee_scheme_preference: data.scheme }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserBlacklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; blacklisted: boolean; reason?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const level = await getCallerLevel(context.supabase, context.userId);
    if (level === "none") throw new Error("Forbidden: owner or manager only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.userId === context.userId) throw new Error("不能将自己加入黑名单");
    const { error } = await supabaseAdmin.from("profiles").update({
      is_blacklisted: !!data.blacklisted,
      blacklist_reason: data.blacklisted ? (data.reason ?? null) : null,
    }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adjustUserWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    userId: string;
    mode: "delta" | "set";
    amount: number;
    note?: string | null;
  }) => d)
  .handler(async ({ data, context }) => {
    const level = await getCallerLevel(context.supabase, context.userId);
    if (level === "none") throw new Error("Forbidden: owner or manager only");
    if (!Number.isFinite(data.amount)) throw new Error("金额无效");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin.from("wallets")
      .select("balance_cad").eq("user_id", data.userId).maybeSingle();
    const cur = Number(existing?.balance_cad ?? 0);
    const next = data.mode === "set" ? Number(data.amount) : cur + Number(data.amount);
    const delta = next - cur;

    // type "adjust" is in the trigger's credit list, so amount_cad (positive
    // or negative) is applied to wallets.balance_cad directly — no manual
    // balance write needed, avoiding double-applying the delta.
    const { error: terr } = await supabaseAdmin.from("wallet_transactions").insert({
      user_id: data.userId,
      type: "adjust",
      amount_cad: delta,
      status: "completed",
      channel: "admin",
      note: data.note ?? (data.mode === "set" ? "管理员设置余额" : "管理员手动调整"),
    } as any);
    if (terr) throw new Error(terr.message);

    // Admin log
    try {
      await supabaseAdmin.from("admin_action_logs").insert({
        entity_type: "wallet",
        entity_id: data.userId,
        action: data.mode === "set" ? "wallet.set" : "wallet.adjust",
        after: { before: cur, after: next, delta },
        operator_id: context.userId,
        note: data.note ?? null,
      });
    } catch { /* ignore log failure */ }

    return { ok: true, balance_cad: next };
  });




export const setUserRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; roles: AppRole[] }) => d)
  .handler(async ({ data, context }) => {
    const level = await getCallerLevel(context.supabase, context.userId);
    if (level === "none") throw new Error("Forbidden: owner or manager only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Read target's current roles to enforce manager restrictions
    const { data: existing } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", data.userId);
    const currentRoles = new Set<AppRole>((existing ?? []).map((r: any) => r.role));
    const desiredRoles = new Set<AppRole>(data.roles);

    if (level === "manager") {
      // Managers cannot manage owners or grant/revoke owner role
      if (currentRoles.has("owner")) throw new Error("Managers cannot modify an owner's roles.");
      if (desiredRoles.has("owner") !== currentRoles.has("owner")) {
        throw new Error("Managers cannot assign or revoke the 'owner' role.");
      }
      // Managers cannot promote/demote other managers (only owners can)
      if (desiredRoles.has("manager") !== currentRoles.has("manager")) {
        throw new Error("Only the owner can assign or revoke the 'manager' role.");
      }
    }

    if (data.userId === context.userId && currentRoles.has("owner") && !desiredRoles.has("owner")) {
      throw new Error("You cannot remove the 'owner' role from yourself.");
    }

    const desired = Array.from(new Set([...data.roles, "customer"])) as AppRole[];
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const rows = desired.map((role) => ({ user_id: data.userId, role }));
    const { error } = await supabaseAdmin.from("user_roles").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true, roles: desired };
  });

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [users, orders, forwardings, staff] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("orders").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("forwarding_orders").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("user_roles").select("user_id").neq("role", "customer"),
    ]);
    const staffIds = new Set((staff.data ?? []).map((r: any) => r.user_id));
    return {
      usersCount: users.count ?? 0,
      ordersCount: orders.count ?? 0,
      forwardingCount: forwardings.count ?? 0,
      staffCount: staffIds.size,
    };
  });
