import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useApp } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Calculator, Plane, Ship, Package, ArrowRight, User } from "lucide-react";

export const Route = createFileRoute("/shipping")({
  head: () => ({
    meta: [
      { title: "集运服务 / Shipping — SinoCargo" },
      { name: "description", content: "International consolidation from China to Canada. Air 7-12 days, sea 30-45 days. Free freight calculator inside." },
      { property: "og:title", content: "China → Canada Consolidation — SinoCargo" },
      { property: "og:description", content: "Air & sea freight from China to Canada with a free calculator." },
    ],
  }),
  component: ShippingPage,
});

// CNY rate per kg, demo
const RATES = { air: 75, sea: 22 };
const MIN_KG = 0.5;

function ShippingPage() {
  const { t, lang, formatPrice } = useApp();
  const { user } = useAuth();
  const [method, setMethod] = useState<"air" | "sea">("air");
  const [weight, setWeight] = useState("1.5");
  const [l, setL] = useState("30");
  const [w, setW] = useState("20");
  const [h, setH] = useState("15");
  const [result, setResult] = useState<number | null>(null);

  const calc = () => {
    const actual = parseFloat(weight) || 0;
    const vol = ((parseFloat(l) || 0) * (parseFloat(w) || 0) * (parseFloat(h) || 0)) / 6000;
    const billable = Math.max(actual, vol, MIN_KG);
    const total = billable * RATES[method];
    setResult(total);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-20">
      <header className="text-center">
        <h1 className="font-display text-4xl font-bold sm:text-5xl">{t("shipping.title")}</h1>
        <p className="mx-auto mt-3 max-w-2xl text-ink-soft">{t("shipping.sub")}</p>
        {user ? (
          <Link
            to="/forwarding"
            className="group mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-cta-gradient px-6 py-3 text-sm font-semibold text-cta-foreground shadow-elevated transition hover:brightness-110"
          >
            {lang === "zh" ? "立即申请" : "Request now"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ) : (
          <div className="mt-6 flex flex-col items-center gap-2">
            <Link
              to="/auth"
              search={{ redirect: "/forwarding" }}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-foreground shadow-elevated transition hover:brightness-95"
            >
              <User className="h-4 w-4" />
              {t("shipping.login_to_apply")}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <span className="text-sm text-ink-soft">{t("shipping.login_hint")}</span>
          </div>
        )}
      </header>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-hero p-6 text-white">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/60"><Plane className="h-3.5 w-3.5" /> {t("shipping.air")}</div>
          <div className="mt-3 font-display text-3xl font-bold">¥{RATES.air} / kg</div>
          <p className="mt-2 text-sm text-white/70">{lang === "zh" ? "广州 → 多伦多/温哥华，含清关、本地派送" : "Guangzhou → Toronto / Vancouver, customs & last-mile included"}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-ink-soft"><Ship className="h-3.5 w-3.5" /> {t("shipping.sea")}</div>
          <div className="mt-3 font-display text-3xl font-bold text-brand-gradient">¥{RATES.sea} / kg</div>
          <p className="mt-2 text-sm text-ink-soft">{lang === "zh" ? "整柜海运，适合大件、家具、囤货" : "Container freight, great for bulk, furniture, restocking"}</p>
        </div>
      </div>

      <section className="mt-12 overflow-hidden rounded-3xl border border-border bg-surface">
        <div className="border-b border-border bg-background/50 p-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-ink-soft">
            <Calculator className="h-4 w-4" /> {t("shipping.calc_title")}
          </div>
        </div>
        <div className="grid gap-6 p-6 lg:grid-cols-2">
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium">{t("shipping.method")}</label>
              <div className="grid grid-cols-2 gap-2 rounded-full bg-accent p-1">
                {(["air", "sea"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMethod(m)}
                    className={`rounded-full py-2 text-sm font-medium transition ${method === m ? "bg-foreground text-background" : "text-ink-soft"}`}
                  >
                    {t(m === "air" ? "shipping.air" : "shipping.sea")}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">{t("shipping.weight_label")}</label>
              <input
                type="number" step="0.1" min="0"
                value={weight} onChange={(e) => setWeight(e.target.value)}
                className="h-11 w-full rounded-md border border-border bg-background px-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">{t("shipping.volume_label")}</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { v: l, set: setL, p: "L" },
                  { v: w, set: setW, p: "W" },
                  { v: h, set: setH, p: "H" },
                ].map((f) => (
                  <div key={f.p} className="relative">
                    <input
                      type="number" min="0"
                      value={f.v} onChange={(e) => f.set(e.target.value)}
                      className="h-11 w-full rounded-md border border-border bg-background pl-8 pr-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                    />
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-ink-soft">{f.p}</span>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={calc}
              className="inline-flex w-full items-center justify-center rounded-full bg-cta-gradient px-6 py-3 text-sm font-semibold text-cta-foreground shadow-elevated transition hover:brightness-110"
            >
              {t("shipping.calc_btn")}
            </button>
          </div>
          <div className="rounded-2xl bg-hero p-6 text-white">
            <div className="text-xs uppercase tracking-wider text-white/60">{t("shipping.result")}</div>
            <div className="mt-2 font-display text-5xl font-bold">
              {result === null ? "¥ — " : `¥${result.toFixed(0)}`}
            </div>
            {result !== null && (
              <div className="mt-1 text-sm text-white/70">{formatPrice(result)}</div>
            )}
            <p className="mt-6 text-xs leading-relaxed text-white/60">{t("shipping.note")}</p>
          </div>
        </div>
      </section>

      <section className="mt-10 overflow-hidden rounded-3xl border border-border bg-hero p-6 text-white sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-white/60">
              <Package className="h-3.5 w-3.5" /> {lang === "zh" ? "申请集运" : "Request shipment"}
            </div>
            <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
              {lang === "zh" ? "已经在国内买好了？提交集运单" : "Already shopping in China? Submit a request"}
            </h2>
            <p className="mt-1 max-w-xl text-sm text-white/70">
              {lang === "zh"
                ? "把国内快递寄到我们的广州/义乌仓，我们合箱清关，门到门送到加拿大。集运客户需绑定手机号以接收短信通知。"
                : "Send your domestic parcels to our Guangzhou/Yiwu warehouse — we'll consolidate, clear customs, and deliver door-to-door in Canada. Shipping customers must link a phone number for SMS updates."}
            </p>
          </div>
          <Link
            to="/forwarding"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-foreground shadow-elevated transition hover:brightness-95"
          >
            {lang === "zh" ? "立即申请" : "Request now"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
