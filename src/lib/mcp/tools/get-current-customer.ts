import { defineTool } from "@lovable.dev/mcp-js";
import { isPermissionError, permissionDeniedResult, queryFailedResult, supabaseForUser, unauthenticatedResult } from "../supabase-user";

export default defineTool({
  name: "get_current_customer",
  title: "Get current EPLUS customer",
  description:
    "Return the signed-in customer's own EPLUS profile. Use this to confirm which EPLUS account is connected. Never use a name or customer code supplied in chat as proof of identity.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticatedResult();

    const { data, error } = await supabaseForUser(ctx)
      .from("profiles")
      .select("customer_code, full_name, preferred_lang, preferred_currency, vip_level, fee_scheme_preference")
      .maybeSingle();

    if (error) {
      console.error("MCP get_current_customer failed", { code: error.code });
      return isPermissionError(error) ? permissionDeniedResult() : queryFailedResult();
    }
    if (!data) {
      return { content: [{ type: "text", text: "No EPLUS customer profile is connected." }], isError: true };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { customer: data },
    };
  },
});
