import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCart } from "@/lib/cart";
import { useApp, CNY_TO_CAD } from "@/lib/i18n";
import { Trash2, Minus, Plus, ShoppingBag, ArrowRight, CheckSquare, Square } from "lucide-react";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "购物车 / Cart — SinoCargo" }] }),
  component: CartPage,
});

function CartPage() {
  const c = useCart();
  const { items, update, remove, isSelected, toggleSelect, setAllSelected,
    selectedItems, selectedCount, selectedSubtotalCNY, selectedWeightKg } = c;
  const { lang, formatPrice } = useApp();
  const navigate = useNavigate();
  const tr = (zh: string, en: string) => (lang === "zh" ? zh : en);

  const allSel = items.length > 0 && selectedItems.length === items.length;

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <ShoppingBag className="mx-auto h-14 w-14 text-ink-soft" />
        <h1 className="mt-6 font-display text-3xl font-bold">{tr("购物车是空的", "Your cart is empty")}</h1>
        <p className="mt-2 text-ink-soft">{tr("快去挑几件好物吧", "Discover something you'll love")}</p>
        <Link to="/products" className="mt-6 inline-flex items-center gap-2 rounded-full bg-cta-gradient px-6 py-3 text-sm font-semibold text-cta-foreground shadow-elevated">
          {tr("去购物", "Browse products")}<ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  const goCheckout = () => {
    if (selectedItems.length === 0) return;
    const slugs = selectedItems.map((i) => i.slug).join(",");
    navigate({ to: "/checkout", search: { slugs } as any });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
      <div className="mb-6 flex items-end justify-between">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{tr("购物车", "Shopping cart")}</h1>
        <button onClick={() => setAllSelected(!allSel)}
          className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-foreground">
          {allSel ? <CheckSquare className="h-4 w-4 text-brand" /> : <Square className="h-4 w-4" />}
          {tr("全选", "Select all")}
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {items.map((i) => {
            const sel = isSelected(i.slug);
            return (
              <div key={i.slug} className={`flex gap-3 rounded-2xl border bg-surface p-4 transition ${sel ? "border-brand/40" : "border-border"}`}>
                <button onClick={() => toggleSelect(i.slug)} className="shrink-0 self-center">
                  {sel ? <CheckSquare className="h-5 w-5 text-brand" /> : <Square className="h-5 w-5 text-ink-soft" />}
                </button>
                <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-accent to-surface text-4xl">
                  {/^https?:\/\//.test(i.image) ? (
                    <img src={i.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span>{i.image}</span>
                  )}
                </div>
                <div className="flex flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <Link to="/products/$slug" params={{ slug: i.slug }} className="line-clamp-2 text-sm font-semibold hover:text-brand">{lang === "zh" ? i.nameZh : i.nameEn}</Link>
                    <button onClick={() => remove(i.slug)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <div className="mt-1 text-xs text-ink-soft">{i.weightKg}kg · {i.purchaseType === "business" ? tr("商业", "Business") : tr("个人", "Personal")}</div>
                  <div className="mt-auto flex items-end justify-between pt-2">
                    <div className="inline-flex items-center rounded-full border border-border">
                      <button onClick={() => update(i.slug, i.quantity - 1)} className="grid h-8 w-8 place-items-center text-ink-soft hover:text-foreground"><Minus className="h-3 w-3" /></button>
                      <span className="w-10 text-center text-sm font-medium">{i.quantity}</span>
                      <button onClick={() => update(i.slug, i.quantity + 1)} className="grid h-8 w-8 place-items-center text-ink-soft hover:text-foreground"><Plus className="h-3 w-3" /></button>
                    </div>
                    <div className="font-display text-lg font-bold text-brand-gradient">{formatPrice(i.priceCNY * i.quantity)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <aside className="h-fit rounded-2xl border border-border bg-surface p-6 lg:sticky lg:top-24">
          <h2 className="mb-4 font-display text-lg font-bold">{tr("订单摘要", "Order summary")}</h2>
          <dl className="space-y-2 text-sm">
            <Row label={tr("已选商品", "Selected")} value={`${selectedItems.length} / ${items.length}`} />
            <Row label={tr("小计", "Subtotal")} value={formatPrice(selectedSubtotalCNY)} />
            <Row label={tr("总重量", "Weight")} value={`${selectedWeightKg.toFixed(2)} kg`} muted />
          </dl>
          <div className="my-4 h-px bg-border" />
          <p className="text-[11px] text-ink-soft">{tr("运费、关税在结账页根据所选线路自动计算", "Shipping & duty are calculated on checkout based on the route")}</p>
          <button
            onClick={goCheckout} disabled={selectedItems.length === 0}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-cta-gradient px-6 py-3.5 text-sm font-semibold text-cta-foreground shadow-elevated transition hover:brightness-110 disabled:opacity-50"
          >
            {tr(`结算所选 (${selectedCount})`, `Checkout selected (${selectedCount})`)}<ArrowRight className="h-4 w-4" />
          </button>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? "text-ink-soft" : ""}`}>
      <dt>{label}</dt><dd>{value}</dd>
    </div>
  );
}
