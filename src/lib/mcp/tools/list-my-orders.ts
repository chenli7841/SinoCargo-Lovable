import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { queryFailedResult, supabaseForUser, unauthenticatedResult } from "../supabase-user";

export default defineTool({
  name: "list_my_orders",
  title: "List my orders",
  description: "List the signed-in user's SinoCargo shop orders, newest first.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Max rows (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return unauthenticatedResult();
    }
    const { data, error } = await supabaseForUser(ctx)
      .from("orders")
      .select(
        "id, order_no, status, payment_status, total_cny, display_currency, shipping_method, route_code, tracking_no, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (error) {
      console.error("MCP list_my_orders failed", { code: error.code });
      return queryFailedResult();
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { orders: data ?? [] },
    };
  },
});
