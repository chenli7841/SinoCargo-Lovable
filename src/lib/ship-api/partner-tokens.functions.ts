// 合作方 API 凭证管理——仅 owner 可用。按文档要求（system-change-guide-v3.md 第 8
// 节）"不要求先开发凭证管理页面"，这里先只提供后台可以调用的函数；要不要包一个最小
// 管理页面，后面需要时再加，不影响接口本身工作。
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generatePartnerApiToken, sha256Hex, SHIP_API_SCOPES, type ShipApiScope } from "./auth.server";

// 这里的 "owner" 是员工角色（has_role RPC），跟 profiles.vip_level 新增的 'owner' 客户
// 分级值是两回事，字面撞名但完全独立，见 auth.server.ts 顶部注释。
async function assertOwnerRole(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: owner only");
}

function validateScopes(scopes: string[]): ShipApiScope[] {
  const bad = scopes.filter((s) => !SHIP_API_SCOPES.includes(s as ShipApiScope));
  if (bad.length) throw new Error(`未知 scope：${bad.join(", ")}`);
  return scopes as ShipApiScope[];
}

// 生成一个新凭证。明文 token 只在这次响应里返回一次，之后无法再次查看——数据库只存哈希。
export const issuePartnerApiToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { partnerKey: string; name?: string; scopes: string[] }) => d)
  .handler(async ({ data, context }) => {
    await assertOwnerRole(context.supabase, context.userId);
    const partnerKey = data.partnerKey.trim();
    if (!partnerKey) throw new Error("partnerKey 不能为空");
    const scopes = validateScopes(data.scopes ?? []);
    if (scopes.length === 0) throw new Error("至少要给一个 scope");

    const token = generatePartnerApiToken();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ins, error } = await (supabaseAdmin as any)
      .from("partner_api_tokens")
      .insert({
        partner_key: partnerKey,
        name: data.name?.trim() || null,
        token_hash: sha256Hex(token),
        scopes,
        created_by: context.userId,
      })
      .select("id, partner_key, name, scopes, created_at")
      .single();
    if (error) throw new Error(error.message);

    return { ok: true, token, record: ins };
  });

export const listPartnerApiTokens = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { partnerKey?: string } = {}) => d)
  .handler(async ({ data, context }) => {
    await assertOwnerRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = (supabaseAdmin as any)
      .from("partner_api_tokens")
      // 明文/哈希都不返回——列表页只需要知道有哪些凭证、状态如何，不需要（也不该）拿到能拿去用的东西。
      .select("id, partner_key, name, scopes, is_active, created_at, revoked_at, last_used_at")
      .order("created_at", { ascending: false });
    if (data.partnerKey) q = q.eq("partner_key", data.partnerKey);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

export const revokePartnerApiToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertOwnerRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("partner_api_tokens")
      .update({ is_active: false, revoked_at: new Date().toISOString(), revoked_by: context.userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
