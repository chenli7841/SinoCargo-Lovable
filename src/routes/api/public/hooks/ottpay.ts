import { createFileRoute } from "@tanstack/react-router";

// OTT Pay asynchronous payment notification.
// Payload: { data (AES-128-ECB, base64), md5, merchant_id, rsp_code, rsp_msg }
export const Route = createFileRoute("/api/public/hooks/ottpay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { decryptOttCallback, OTT_SUCCESS_STATES } = await import("@/lib/ottpay.server");
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
          info = decryptOttCallback({ data: String(payload.data), md5: String(payload.md5) });
        } catch (e: any) {
          console.error("[ottpay] decrypt failed", e?.message);
          return new Response("invalid signature", { status: 401 });
        }

        const reference: string | undefined = info.reference || info.remarks;
        if (!reference) return new Response("SUCCESS");

        const { data: tx } = await supabaseAdmin
          .from("wallet_transactions")
          .select("id, status, amount_cad, note")
          .eq("ref_no", reference)
          .maybeSingle();
        if (!tx) return new Response("SUCCESS");
        if (tx.status === "completed") return new Response("SUCCESS"); // idempotent

        const status = String(info.order_status ?? "").toLowerCase();
        const paid = OTT_SUCCESS_STATES.has(status) || !status; // wallet callbacks omit order_status
        const cents = Number(info.amount ?? 0);
        if (paid && cents && Math.abs(cents / 100 - Number(tx.amount_cad)) > 0.01) {
          console.error("[ottpay] amount mismatch", reference, cents, tx.amount_cad);
          return new Response("SUCCESS");
        }

        const patch: Record<string, any> = { status: paid ? "completed" : "failed" };
        if (info.order_id && !/pid=/.test(tx.note ?? "")) patch.note = `${tx.note ?? ""} · pid=${info.order_id}`;
        await supabaseAdmin.from("wallet_transactions").update(patch as any).eq("id", tx.id);

        return new Response("SUCCESS");
      },
    },
  },
});
