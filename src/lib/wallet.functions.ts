import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getFxCadPerCny } from "@/lib/orders.functions";

// Self-service wallet top-up. No real payment gateway is wired in yet, so this
// completes the transaction immediately (service role bypasses the customer
// RLS policy, which only allows self-inserting 'pending' rows) and credits
// wallets.balance_cad via the apply_wallet_tx trigger. Swap this to
// status: "pending" once a real gateway confirms payment asynchronously.
export const rechargeWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { amountCad: number; channel: "card" | "wechat" | "alipay" | "paypal" }) => d)
  .handler(async ({ data, context }) => {
    if (!(data.amountCad >= 2)) throw new Error("最低充值 CA$2");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const fx = await getFxCadPerCny(supabaseAdmin); // CAD per CNY
    const amountCad = Number(data.amountCad.toFixed(2));
    const amountCny = +(amountCad / fx).toFixed(2);

    const { error } = await supabaseAdmin.from("wallet_transactions").insert({
      user_id: context.userId,
      type: "recharge",
      amount_cad: amountCad,
      amount_cny: amountCny,
      fx_rate_cny_to_cad: fx,
      status: "completed",
      channel: data.channel,
      note: `用户充值 CA$${amountCad}`,
    } as any);
    if (error) throw new Error(error.message);

    return { ok: true, amount_cad: amountCad, amount_cny: amountCny };
  });
