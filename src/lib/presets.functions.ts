import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertManager(supabase: any, userId: string) {
  const [{ data: o }, { data: m }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "owner" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "manager" }),
  ]);
  if (!o && !m) throw new Error("Forbidden: owner/manager only");
}

// ===== Cargo types =====
export const listCargoTypes = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("cargo_types").select("*").order("sort_order").order("code");
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

export const upsertCargoType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; code: string; name_zh: string; name_en?: string; sort_order?: number; active?: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: any = {
      code: data.code.trim().toUpperCase(),
      name_zh: data.name_zh, name_en: data.name_en ?? null,
      sort_order: data.sort_order ?? 0, active: data.active ?? true,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("cargo_types").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("cargo_types").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteCargoType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("cargo_types").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===== Destinations =====
export const listDestinations = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("destinations").select("*").order("sort_order").order("code");
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

export const upsertDestination = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; code: string; name_zh: string; name_en?: string; country?: string; sort_order?: number; active?: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: any = {
      code: data.code.trim().toUpperCase(),
      name_zh: data.name_zh, name_en: data.name_en ?? null,
      country: data.country ?? null,
      sort_order: data.sort_order ?? 0, active: data.active ?? true,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("destinations").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("destinations").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteDestination = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("destinations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
