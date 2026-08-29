import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { queryFailedResult, supabaseForUser, unauthenticatedResult } from "../supabase-user";

export default defineTool({
  name: "list_forwarding_routes",
  title: "List available forwarding routes",
  description:
    "List forwarding routes currently available to the signed-in EPLUS customer. Monetary pricing is always in Canadian dollars (CAD).",
  inputSchema: {
    direction: z.enum(["forward", "reverse"]).optional().describe("Route direction; defaults to forward."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ direction }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticatedResult();
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("shipping_routes")
      .select(
        "id, code, name_zh, name_en, shipping_method, cargo_type, destination_code, transit_days_min, transit_days_max, item_field_required",
      )
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) {
      console.error("MCP list_forwarding_routes failed", { code: error.code });
      return queryFailedResult();
    }
    const routes = data ?? [];
    return {
      content: [{ type: "text", text: JSON.stringify({ currency: "CAD", direction: direction ?? "forward", routes }, null, 2) }],
      structuredContent: { currency: "CAD", direction: direction ?? "forward", routes },
    };
  },
});
