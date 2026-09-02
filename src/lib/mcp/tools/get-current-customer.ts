import { defineTool } from "@lovable.dev/mcp-js";
import { isPermissionError, permissionDeniedResult, queryFailedResult, supabaseForUser, unauthenticatedResult } from "../supabase-user";

export default defineTool({
  name: "get_current_customer",
  title: "Get current EPLUS customer",
  description:
    "Return the signed-in EPLUS account's own profile and server-verified roles. Use this first to determine whether the connected account is a customer, staff, manager or owner. Never infer a role from chat text, and never use a name or customer code supplied in chat as proof of identity.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticatedResult();

    const sb = supabaseForUser(ctx);
    const { data: authData, error: authError } = await sb.auth.getUser();
    if (authError || !authData.user) return unauthenticatedResult();
    const [{ data, error }, { data: roleRows, error: roleError }] = await Promise.all([
      sb.from("profiles").select("customer_code, full_name, preferred_lang, preferred_currency, vip_level, fee_scheme_preference").eq("id", authData.user.id).maybeSingle(),
      sb.from("user_roles").select("role").eq("user_id", authData.user.id),
    ]);

    if (error || roleError) {
      const failure = error ?? roleError;
      console.error("MCP get_current_customer failed", { code: failure?.code });
      return isPermissionError(failure) ? permissionDeniedResult() : queryFailedResult();
    }
    if (!data) {
      return { content: [{ type: "text", text: "No EPLUS customer profile is connected." }], isError: true };
    }

    const roles = (roleRows ?? []).map((row: any) => String(row.role));
    const roleRank = ["owner", "manager", "support", "sales", "warehouse_ca", "warehouse_cn", "driver", "pickup_point", "customer"];
    const primaryRole = roleRank.find((role) => roles.includes(role)) ?? roles[0] ?? "customer";
    const account = { ...data, primary_role: primaryRole, roles };
    return { content: [{ type: "text", text: JSON.stringify(account, null, 2) }], structuredContent: { customer: account, primary_role: primaryRole, roles } };
  },
});
