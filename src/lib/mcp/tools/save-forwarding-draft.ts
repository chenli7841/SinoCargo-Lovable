import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { queryFailedResult, supabaseForUser, unauthenticatedResult } from "../supabase-user";

const itemSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  unit_price_cad: z.number().nonnegative().describe("Declared unit value in CAD."),
  extras: z.record(z.string(), z.unknown()).optional(),
});

export default defineTool({
  name: "save_forwarding_draft",
  title: "Save a forwarding draft",
  description:
    "Create or update the signed-in customer's forwarding draft. This does not create an order. All item values must be CAD; never convert or relabel them as yuan.",
  inputSchema: {
    draft_id: z.string().uuid().optional(),
    route_code: z.string().min(1),
    warehouse: z.string().min(1),
    domestic_tracking_no: z.string().optional(),
    address_id: z.string().uuid().optional(),
    cargo_type: z.string().optional(),
    insured: z.boolean().optional(),
    note: z.string().max(1000).optional(),
    items: z.array(itemSchema).min(1),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ draft_id, ...draftData }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticatedResult();
    const sb = supabaseForUser(ctx);
    const payload = { ...draftData, currency: "CAD" };
    const query = draft_id
      ? sb
          .from("ai_forwarding_drafts")
          .update({ draft_data: payload, version: undefined, updated_at: new Date().toISOString() })
          .eq("id", draft_id)
          .eq("status", "active")
          .select("id, status, version, draft_data, updated_at, expires_at")
          .single()
      : sb
          .from("ai_forwarding_drafts")
          .insert({ draft_data: payload })
          .select("id, status, version, draft_data, updated_at, expires_at")
          .single();
    const { data, error } = await query;
    if (error) {
      console.error("MCP save_forwarding_draft failed", { code: error.code });
      return queryFailedResult();
    }
    return {
      content: [{ type: "text", text: `Draft saved. No order has been created.\n${JSON.stringify(data, null, 2)}` }],
      structuredContent: { currency: "CAD", order_created: false, draft: data },
    };
  },
});
