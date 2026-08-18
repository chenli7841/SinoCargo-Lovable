import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "cache-control": "no-store",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS },
  });

// 去掉状态文案中的内部信息（员工邮箱 / 操作员 / 内部备注）
function sanitizeText(v: unknown): string {
  let s = typeof v === "string" ? v : "";
  s = s.replace(/[\s/|,·，、-]*(操作员|操作人|Operator|By)\s*[:：]?\s*\S*@\S+/gi, "");
  s = s.replace(/\S+@\S+\.\S+/g, "");
  s = s.replace(/[\s/|,·，、]*(操作员|操作人|Operator)\s*[:：]?\s*\S*/gi, "");
  return s.replace(/[\s/|·-]+$/g, "").trim();
}

export const Route = createFileRoute("/api/public/ai-track")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => json({ found: false, error: "use_post" }, 405),
      POST: async ({ request }) => {
        try {
          let body: any = {};
          try {
            body = await request.json();
          } catch {
            body = {};
          }
          const trackingNumber = String(body?.tracking_number ?? "").trim();
          if (!trackingNumber) {
            return json({ found: false, error: "tracking_number_required" }, 400);
          }

          const supabase = createClient(
            process.env["SUPABASE_URL"]!,
            process.env["SUPABASE_PUBLISHABLE_KEY"]!,
            { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
          );

          const { data, error } = await supabase.rpc("track_by_any_no", { _input: trackingNumber });
          if (error) {
            console.error("[ai-track] rpc error", error.message);
            return json({ found: false, error: "tracking_lookup_failed" }, 200);
          }
          const row: any = Array.isArray(data) ? data[0] : data;
          if (!row || !row.tracking_no) {
            return json({ found: false, tracking_number: trackingNumber }, 200);
          }

          const events = Array.isArray(row.events) ? row.events : [];
          return json({
            found: true,
            tracking_no: row.tracking_no ?? trackingNumber,
            shipping_method: row.shipping_method ?? null,
            status: row.status ?? null,
            current_location: row.current_location ?? null,
            eta: row.eta ?? null,
            carrier: row.carrier ?? null,
            created_at: row.created_at ?? null,
            events: events
              .map((e: any) => ({
                status_en: sanitizeText(e?.status_en),
                status_zh: sanitizeText(e?.status_zh),
                event_time: e?.event_time ?? null,
                location_en: e?.location_en ? sanitizeText(e.location_en) : null,
                location_zh: e?.location_zh ? sanitizeText(e.location_zh) : null,
              }))
              .sort(
                (a: any, b: any) =>
                  +new Date(a.event_time ?? 0) - +new Date(b.event_time ?? 0),
              ),
          });
        } catch (e) {
          console.error("[ai-track] unexpected", e);
          return json({ found: false, error: "tracking_lookup_failed" }, 200);
        }
      },
    },
  },
});
