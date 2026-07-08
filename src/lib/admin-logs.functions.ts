import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(supabase: any, userId: string) {
  const { data } = await supabase.rpc("is_staff", { _user_id: userId });
  if (!data) throw new Error("Forbidden: staff only");
}

export const listAdminLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    page?: number; pageSize?: number;
    entity_type?: string; entity_id?: string; action?: string; operator_id?: string;
    date_from?: string; date_to?: string; q?: string;
  } = {}) => d)
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const page = Math.max(1, data.page ?? 1);
    const pageSize = Math.min(100, data.pageSize ?? 20);
    let q = supabaseAdmin.from("admin_action_logs").select("*", { count: "exact" })
      .order("created_at", { ascending: false });
    if (data.entity_type) q = q.eq("entity_type", data.entity_type);
    if (data.entity_id) q = q.eq("entity_id", data.entity_id);
    if (data.action) q = q.eq("action", data.action);
    if (data.operator_id) q = q.eq("operator_id", data.operator_id);
    if (data.date_from) q = q.gte("created_at", data.date_from);
    if (data.date_to) q = q.lte("created_at", data.date_to);
    if (data.q) q = q.or(`note.ilike.%${data.q}%,operator_name.ilike.%${data.q}%,entity_id.eq.${data.q}`);
    const { data: rows, error, count } = await q.range((page - 1) * pageSize, page * pageSize - 1);
    if (error) throw new Error(error.message);
    return { items: rows ?? [], total: count ?? 0, page, pageSize };
  });

export const logFacets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("admin_action_logs")
      .select("entity_type, action").order("created_at", { ascending: false }).limit(500);
    const types = Array.from(new Set((data ?? []).map((r: any) => r.entity_type).filter(Boolean)));
    const actions = Array.from(new Set((data ?? []).map((r: any) => r.action).filter(Boolean)));
    return { types, actions };
  });
