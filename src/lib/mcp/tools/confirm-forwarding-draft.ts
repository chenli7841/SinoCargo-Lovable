import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { queryFailedResult, supabaseForUser, unauthenticatedResult } from "../supabase-user";

export default defineTool({
  name: "confirm_forwarding_draft",
  title: "Confirm and create forwarding order",
  description:
    "Create the real forwarding order from a saved draft, only after the customer explicitly confirms the final CAD summary. Never call this tool merely to save or preview a draft.",
  inputSchema: {
    draft_id: z.string().uuid(),
    confirmation: z.literal("CONFIRM").describe("Must be CONFIRM after the customer explicitly approves the final summary."),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  handler: async ({ draft_id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticatedResult();
    const { data, error } = await supabaseForUser(ctx).rpc("confirm_ai_forwarding_draft", { _draft_id: draft_id });
    if (error) {
      console.error("MCP confirm_forwarding_draft failed", { code: error.code });
      return queryFailedResult();
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { currency: "CAD", result: data },
    };
  },
});
