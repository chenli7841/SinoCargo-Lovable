import { createFileRoute } from "@tanstack/react-router";
import { useApp } from "@/lib/i18n";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "关于我们 / About — SinoCargo" },
      { name: "description", content: "SinoCargo is a China-to-Canada sourcing and consolidation platform with warehouses in Guangzhou and Yiwu and a local Canadian team." },
      { property: "og:title", content: "About SinoCargo" },
      { property: "og:description", content: "Bridging China and Canada through sourcing and consolidation." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  const { t, lang } = useApp();
  const story = lang === "zh" ? [
    "SinoCargo 成立于 2021 年，由一群在加拿大生活十年以上的华人工程师与物流人创立。",
    "我们厌倦了在加拿大买到溢价 3-5 倍的国货，也厌倦了不透明的代购报价。于是决定自己做：在广州、义乌设立集运仓，对接源头工厂与品牌方，直连加拿大门口。",
    "今天，我们服务超过 5 万名加拿大消费者，从数码到食品、从美妆到母婴，把整个中国搬到你家门口。",
  ] : [
    "SinoCargo was founded in 2021 by a small team of Chinese-Canadian engineers and logistics veterans who had lived in Canada for over a decade.",
    "We were tired of paying 3–5× markup for Chinese goods in Canadian stores, and tired of opaque agent quotes. So we built it ourselves: warehouses in Guangzhou and Yiwu, factory and brand partnerships at source, direct delivery to your Canadian door.",
    "Today we serve more than 50,000 Canadian shoppers across electronics, fashion, beauty, food and baby — bringing all of China to your doorstep.",
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:py-20">
      <h1 className="font-display text-4xl font-bold sm:text-5xl">{t("about.title")}</h1>
      <div className="mt-8 space-y-5 text-lg leading-relaxed text-ink-soft">
        {story.map((p, i) => <p key={i}>{p}</p>)}
      </div>
      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        {[
          { k: "50,000+", v: lang === "zh" ? "服务客户" : "Customers served" },
          { k: "3", v: lang === "zh" ? "中国集运仓" : "China hubs" },
          { k: "80+", v: lang === "zh" ? "覆盖加拿大城市" : "Cities reached" },
        ].map((s) => (
          <div key={s.v} className="rounded-2xl border border-border bg-surface p-6">
            <div className="font-display text-3xl font-bold text-brand-gradient">{s.k}</div>
            <div className="mt-1 text-sm text-ink-soft">{s.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
