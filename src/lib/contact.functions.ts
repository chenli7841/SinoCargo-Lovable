import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function pubClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

// Sends the "new contact message" notification via Gmail SMTP using the admin-configured
// from/to/cc addresses (app_settings.contact_email_notify — non-secret, world-readable).
// The Gmail App Password itself is deliberately NOT stored in the database; it must be set
// as the server-only env var GMAIL_APP_PASSWORD (see .env.local).
async function sendNotifyEmail(supabase: any, msg: { name: string; email: string; phone: string | null; message: string }) {
  const { data: setting } = await supabase.from("app_settings").select("value").eq("key", "contact_email_notify").maybeSingle();
  const cfg = (setting?.value ?? {}) as { enabled?: boolean; from_email?: string; to_email?: string; cc_emails?: string[] };
  if (!cfg.enabled || !cfg.from_email) return;

  const appPassword = process.env.GMAIL_APP_PASSWORD;
  if (!appPassword) {
    console.error("[contact] GMAIL_APP_PASSWORD is not set — skipping notification email");
    return;
  }

  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.default.createTransport({
    service: "gmail",
    auth: { user: cfg.from_email, pass: appPassword },
  });

  await transporter.sendMail({
    from: cfg.from_email,
    to: cfg.to_email || cfg.from_email,
    cc: (cfg.cc_emails ?? []).filter(Boolean),
    replyTo: msg.email,
    subject: `[SinoCargo 官网留言] ${msg.name}`,
    text: [
      `姓名：${msg.name}`,
      `邮箱：${msg.email}`,
      `电话：${msg.phone || "（未填写）"}`,
      "",
      "留言内容：",
      msg.message,
    ].join("\n"),
  });
}

export const submitContactMessage = createServerFn({ method: "POST" })
  .inputValidator((d: { name: string; email: string; phone?: string; message: string }) => d)
  .handler(async ({ data }) => {
    const name = data.name?.trim();
    const email = data.email?.trim();
    const message = data.message?.trim();
    const phone = data.phone?.trim() || null;
    if (!name || !email || !message) throw new Error("请填写姓名、邮箱和留言内容");

    const supabase = pubClient();
    const { error } = await supabase.from("contact_messages").insert({ name, email, phone, message });
    if (error) throw new Error(error.message);

    try {
      await sendNotifyEmail(supabase, { name, email, phone, message });
    } catch (e: any) {
      // Never fail the submission just because the notification email couldn't be sent.
      console.error("[contact] failed to send notification email:", e?.message ?? e);
    }

    return { ok: true };
  });
