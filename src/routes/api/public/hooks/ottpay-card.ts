import { createFileRoute } from "@tanstack/react-router";

// OTT Pay callback for Elavon Converge Hosted Payment (credit card).
// Payload: { rsp_code, rsp_msg, merchant_id, data (AES-128-ECB base64), md5 }
// where decrypted data = { finish_time, order_id, amount, tip, merchant_id,
// bizpay_order_id, convenience_fee? } — no status field. See handler comment
// below for why this callback is only a trigger, not the source of truth.
export const Route = createFileRoute("/api/public/hooks/ottpay-card")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const {
          decryptHosted,
          hostedConfig,
          hostedPost,
          txnTime,
          HOSTED_PAID_STATES,
          HOSTED_FAILED_STATES,
        } = await import("@/lib/ottpay-hosted.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let payload: any;
        try {
          payload = await request.json();
        } catch {
          const form = await request.formData().catch(() => null);
          payload = form ? Object.fromEntries(form.entries()) : null;
        }
        if (!payload?.data || !payload?.md5) return new Response("bad payload", { status: 400 });

        let info: Record<string, any>;
        try {
          info = decryptHosted({ data: String(payload.data), md5: String(payload.md5) });
        } catch (e: any) {
          console.error("[ottpay-card] decrypt failed", e?.message);
          return new Response("invalid signature", { status: 401 });
        }

        const reference: string | undefined = info.order_id ?? info.orderId;
        if (!reference) return new Response("SUCCESS");

        const { data: tx } = await supabaseAdmin
          .from("wallet_transactions")
          .select("id, status, amount_cad, note")
          .eq("ref_no", reference)
          .maybeSingle();
        if (!tx) return new Response("SUCCESS");
        if (tx.status === "completed") return new Response("SUCCESS"); // idempotent

        // Per OTT Pay's Elavon Hosted Payment API doc, the callback's own
        // decrypted payload carries no status field (only finish_time/order_id/
        // amount/tip/merchant_id/bizpay_order_id/convenience_fee) — and the
        // outer rsp_code/rsp_msg are plain, unsigned fields with nothing
        // covering them, so they can't be trusted as the actual paid/failed
        // decision (a client who's captured one genuine encrypted callback for
        // their own order could otherwise replay it with rsp_code swapped to
        // "SUCCESS" and self-credit without paying). Treat the callback purely
        // as a "go check now" trigger, and get the real answer from the same
        // authenticated STATUS_QUERY call syncOttTopup() already polls with —
        // that response does carry order_status, using our own signKey.
        const cfg = hostedConfig();
        let q: any;
        try {
          q = await hostedPost("STATUS_QUERY", "1.0", {
            orderId: reference,
            merchant_id: cfg.merchantId,
            bizType: "converge_hosted",
            txnTime: txnTime(),
            channelType: "ELAVONECOM",
          });
        } catch (e: any) {
          console.error("[ottpay-card] status query failed", reference, e?.message);
          return new Response("SUCCESS"); // leave pending — syncOttTopup() will retry
        }
        const st = String(q.order_status ?? q.orderStatus ?? "").toLowerCase();
        const paid = HOSTED_PAID_STATES.has(st);
        const failed = HOSTED_FAILED_STATES.has(st);
        if (!paid && !failed) return new Response("SUCCESS"); // still processing

        // amount is a required field on the callback payload — missing it on a
        // "paid" result is suspicious enough to hold off rather than trust it.
        const cents = Number(info.amount ?? 0);
        if (paid && !cents) {
          console.error("[ottpay-card] paid callback missing amount, leaving pending", reference);
          return new Response("SUCCESS");
        }
        if (paid && Math.abs(cents / 100 - Number(tx.amount_cad)) > 0.01) {
          console.error("[ottpay-card] amount mismatch", reference, cents, tx.amount_cad);
          return new Response("SUCCESS");
        }

        const patch: Record<string, any> = { status: paid ? "completed" : "failed" };
        if (info.bizpay_order_id && !/pid=/.test(tx.note ?? "")) {
          patch.note = `${tx.note ?? ""} · pid=${info.bizpay_order_id}`;
        }
        await supabaseAdmin
          .from("wallet_transactions")
          .update(patch as any)
          .eq("id", tx.id);

        return new Response("SUCCESS");
      },
    },
  },
});
