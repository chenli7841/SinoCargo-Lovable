import { createFileRoute } from "@tanstack/react-router";
import { useApp } from "@/lib/i18n";
import { Mail, MapPin, Phone, Clock } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "联系我们 / Contact — SinoCargo" },
      { name: "description", content: "Contact SinoCargo — offices in Toronto and Guangzhou. Bilingual support, hours 9-21 EST / 21-09 CST." },
      { property: "og:title", content: "Contact SinoCargo" },
      { property: "og:description", content: "Reach our bilingual team in Toronto and Guangzhou." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { t, lang } = useApp();
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:py-20">
      <h1 className="font-display text-4xl font-bold sm:text-5xl">{t("contact.title")}</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        {lang === "zh"
          ? "邮件 1 小时内回复，工作日双语在线客服。"
          : "Email responses within 1 hour. Bilingual live chat on weekdays."}
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-brand">{t("contact.ca_office")}</div>
          <h2 className="mt-2 font-display text-xl font-bold">Toronto HQ</h2>
          <ul className="mt-4 space-y-2 text-sm text-ink-soft">
            <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /> 200 King St W, Toronto, ON M5H 3T4</li>
            <li className="flex items-center gap-2"><Phone className="h-4 w-4" /> +1 (416) 000-0000</li>
            <li className="flex items-center gap-2"><Mail className="h-4 w-4" /> support@sinocargo.app</li>
            <li className="flex items-center gap-2"><Clock className="h-4 w-4" /> Mon–Sat 9:00–21:00 EST</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-brand">{t("contact.cn_office")}</div>
          <h2 className="mt-2 font-display text-xl font-bold">广州集运中心</h2>
          <ul className="mt-4 space-y-2 text-sm text-ink-soft">
            <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /> 广东省广州市白云区机场路 88 号</li>
            <li className="flex items-center gap-2"><Phone className="h-4 w-4" /> +86 20 0000-0000</li>
            <li className="flex items-center gap-2"><Mail className="h-4 w-4" /> warehouse@sinocargo.app</li>
            <li className="flex items-center gap-2"><Clock className="h-4 w-4" /> 周一至周六 9:00–18:00 CST</li>
          </ul>
        </div>
      </div>

      <form className="mt-10 rounded-3xl border border-border bg-surface p-6 sm:p-8" onSubmit={(e) => { e.preventDefault(); alert(lang === "zh" ? "已收到！我们会尽快回复。" : "Received! We'll get back to you shortly."); }}>
        <h2 className="font-display text-xl font-bold">{lang === "zh" ? "在线留言" : "Send a message"}</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <input required maxLength={80} placeholder={lang === "zh" ? "您的姓名" : "Your name"} className="h-11 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30" />
          <input required type="email" maxLength={120} placeholder="Email" className="h-11 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30" />
        </div>
        <textarea required maxLength={1000} rows={5} placeholder={lang === "zh" ? "想咨询什么？" : "Tell us what you need…"} className="mt-4 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30" />
        <button type="submit" className="mt-4 rounded-full bg-cta-gradient px-6 py-3 text-sm font-semibold text-cta-foreground shadow-elevated transition hover:brightness-110">
          {lang === "zh" ? "提交" : "Submit"}
        </button>
      </form>
    </div>
  );
}
