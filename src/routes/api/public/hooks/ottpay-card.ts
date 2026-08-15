import { createFileRoute } from "@tanstack/react-router";

// OTT Pay callback for Elavon Converge Hosted Payment (credit card).
// Payload: { rsp_code, rsp_msg, merchant_id, data (AES-128-ECB base64), md5 }
export const Route = createFileRoute("/api/public/hooks/ottpay-card")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { decryptHosted } = await import("@/lib/ottpay-hosted.server");
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

        const rsp = String(payload.rsp_code ?? "").toUpperCase();
        const paid = rsp === "SUCCESS";
        const cents = Number(info.amount ?? 0);
        if (paid && cents && Math.abs(cents / 100 - Number(tx.amount_cad)) > 0.01) {
          console.error("[ottpay-card] amount mismatch", reference, cents, tx.amount_cad);
          return new Response("SUCCESS");
        }
        if (rsp === "PROCESSING") return new Response("SUCCESS");

        const patch: Record<string, any> = { status: paid ? "completed" : "failed" };
        if (info.bizpay_order_id && !/pid=/.test(tx.note ?? "")) {
          patch.note = `${tx.note ?? ""} · pid=${info.bizpay_order_id}`;
        }
        await supabaseAdmin.from("wallet_transactions").update(patch as any).eq("id", tx.id);

        return new Response("SUCCESS");
      },
    },
  },
});
