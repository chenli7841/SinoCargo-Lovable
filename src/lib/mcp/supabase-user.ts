import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

export function supabaseForUser(ctx: ToolContext) {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Supabase MCP configuration is missing");
  }

  return createClient(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function unauthenticatedResult() {
  return {
    content: [{ type: "text" as const, text: "Please connect your EPLUS account before using this tool." }],
    isError: true,
  };
}

export function queryFailedResult(requestId?: string) {
  return {
    content: [
      {
        type: "text" as const,
        text: requestId
          ? `EPLUS could not complete the request. Reference: ${requestId}`
          : "EPLUS could not complete the request. Please try again later.",
      },
    ],
    isError: true,
  };
}
