import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { isPermissionError, permissionDeniedResult, queryFailedResult, supabaseForUser, unauthenticatedResult } from "../supabase-user";

export default defineTool({
  name: "list_forwarding_routes",
  title: "List available forwarding routes",
  description:
    "List forwarding routes currently available to the signed-in EPLUS customer. Monetary pricing is always CAD. Do not choose a route until destination, cargo type, weight and required dimensions are known; ask when information is missing.",
  inputSchema: {
    direction: z.enum(["forward", "reverse"]).optional().describe("Route direction; defaults to forward."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ direction }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticatedResult();
    const sb = supabaseForUser(ctx);
    const { data: authData, error: authError } = await sb.auth.getUser();
    if (authError || !authData.user) return unauthenticatedResult();
    const [{ data: profile, error: profileError }, { data, error }] = await Promise.all([
      sb.from("profiles").select("customer_code, vip_level").eq("id", authData.user.id).single(),
      sb
      .from("shipping_routes")
      .select(
        "id, code, name_zh, name_en, shipping_method, cargo_type, destination_code, transit_days_min, transit_days_max, item_field_required, usage_scope, is_bidirectional, visible_vip_levels, visible_customer_codes, blacklist_vip_levels, blacklist_customer_codes",
      )
      .eq("is_active", true)
      .in("usage_scope", ["forwarding", "both"])
      .order("sort_order", { ascending: true }),
    ]);
    if (profileError || error) {
      console.error("MCP list_forwarding_routes failed", { code: (profileError ?? error)?.code });
      const failure = profileError ?? error;
      return failure && isPermissionError(failure) ? permissionDeniedResult() : queryFailedResult();
    }
    const customerCode = String(profile?.customer_code ?? "").trim().toUpperCase();
    const vip = String(profile?.vip_level ?? "");
    const routes = (data ?? []).filter((route: any) => {
      if ((direction ?? "forward") === "reverse" && !route.is_bidirectional) return false;
      const blackCodes = (route.blacklist_customer_codes ?? []).map((code: unknown) => String(code).trim().toUpperCase());
      if (customerCode && blackCodes.includes(customerCode)) return false;
      if (vip && (route.blacklist_vip_levels ?? []).includes(vip)) return false;
      const visibleCodes = (route.visible_customer_codes ?? []).map((code: unknown) => String(code).trim().toUpperCase());
      const visibleVips = route.visible_vip_levels ?? [];
      if (!visibleCodes.length && !visibleVips.length) return true;
      return (customerCode && visibleCodes.includes(customerCode)) || (vip && visibleVips.includes(vip));
    }).map(({ usage_scope, is_bidirectional, visible_vip_levels, visible_customer_codes, blacklist_vip_levels, blacklist_customer_codes, ...route }: any) => route);
    return {
      content: [{ type: "text", text: JSON.stringify({ currency: "CAD", direction: direction ?? "forward", routes }, null, 2) }],
      structuredContent: { currency: "CAD", direction: direction ?? "forward", routes },
    };
  },
});
