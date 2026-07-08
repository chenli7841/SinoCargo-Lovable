import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(supabase: any, userId: string) {
  const { data } = await supabase.rpc("is_staff", { _user_id: userId });
  if (!data) throw new Error("Forbidden: staff only");
}

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();
    const sevenAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

    const [
      ordersTodayR, waybillsTodayR, inTransitR, pendingIntakeR,
      unpaidInvR, monthRevR, detainedR, usersR,
      recentLogsR, waybillsTrendR, routeDistR,
    ] = await Promise.all([
      supabaseAdmin.from("orders").select("id", { count: "exact", head: true }).gte("created_at", todayISO),
      supabaseAdmin.from("waybills").select("id", { count: "exact", head: true }).gte("created_at", todayISO),
      supabaseAdmin.from("waybills").select("id", { count: "exact", head: true }).in("status", ["shipped", "in_transit"]),
      supabaseAdmin.from("waybills").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabaseAdmin.from("invoices").select("total_cny").in("status", ["unpaid", "overdue"]),
      supabaseAdmin.from("invoices").select("paid_cny, fx_rate").eq("status", "paid").gte("paid_at", monthStart),
      supabaseAdmin.from("detained_packages").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("admin_action_logs").select("*").order("created_at", { ascending: false }).limit(10),
      supabaseAdmin.from("waybills").select("created_at, status").gte("created_at", sevenAgo),
      supabaseAdmin.from("waybills").select("shipping_method").gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
    ]);

    const unpaidTotal = (unpaidInvR.data ?? []).reduce((s: number, r: any) => s + Number(r.total_cny || 0), 0);
    const monthRevCAD = (monthRevR.data ?? []).reduce((s: number, r: any) => s + Number(r.paid_cny || 0) * Number(r.fx_rate || 0.19), 0);

    // Build 7-day trend
    const days: { date: string; orders: number; waybills: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      days.push({ date: d.toISOString().slice(5, 10), orders: 0, waybills: 0 });
    }
    for (const w of waybillsTrendR.data ?? []) {
      const k = new Date(w.created_at).toISOString().slice(5, 10);
      const day = days.find(d => d.date === k);
      if (day) day.waybills++;
    }

    // Route distribution
    const dist: Record<string, number> = {};
    for (const w of routeDistR.data ?? []) {
      const k = w.shipping_method || "unknown";
      dist[k] = (dist[k] ?? 0) + 1;
    }

    return {
      kpi: {
        ordersToday: ordersTodayR.count ?? 0,
        waybillsToday: waybillsTodayR.count ?? 0,
        inTransit: inTransitR.count ?? 0,
        pendingIntake: pendingIntakeR.count ?? 0,
        unpaidCNY: +unpaidTotal.toFixed(2),
        monthRevenueCAD: +monthRevCAD.toFixed(2),
        detained: detainedR.count ?? 0,
        users: usersR.count ?? 0,
      },
      trend: days,
      routeDistribution: Object.entries(dist).map(([name, value]) => ({ name, value })),
      recentLogs: recentLogsR.data ?? [],
    };
  });
