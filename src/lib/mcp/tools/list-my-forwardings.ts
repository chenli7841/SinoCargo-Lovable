import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { queryFailedResult, supabaseForUser, unauthenticatedResult } from "../supabase-user";

export default defineTool({
  name: "list_my_forwardings",
  title: "List my forwarding orders",
  description: "List the signed-in user's international forwarding (集运) orders, newest first.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Max rows (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return unauthenticatedResult();
    }
    const { data, error } = await supabaseForUser(ctx)
      .from("forwarding_orders")
      .select(
        "id, request_no, domestic_tracking_no, intl_tracking_no, status, payment_status, shipping_method, route_code, fee_cny, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (error) {
      console.error("MCP list_my_forwardings failed", { code: error.code });
      return queryFailedResult();
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { forwardings: data ?? [] },
    };
  },
});
