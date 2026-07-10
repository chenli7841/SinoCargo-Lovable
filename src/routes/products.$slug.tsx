import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/i18n";
import { useCart } from "@/lib/cart";

import { Check, Plane, Ship, Truck, ShoppingCart, Minus, Plus, Calculator } from "lucide-react";
import { toast } from "sonner";
import { getPublicProduct, listPublicRoutes } from "@/lib/shop-public.functions";
import { adaptProduct } from "@/lib/shop-adapter";
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

const productQO = (slug: string) => queryOptions({
  queryKey: ["public", "product", slug],
  queryFn: () => getPublicProduct({ data: { slug } }),
});
const routesQO = queryOptions({
  queryKey: ["public", "routes"],
  queryFn: () => listPublicRoutes(),
});

export const Route = createFileRoute("/products/$slug")({
  loader: ({ params, context }) => Promise.all([
    context.queryClient.ensureQueryData(productQO(params.slug)),
    context.queryClient.ensureQueryData(routesQO),
  ]),
  head: ({ loaderData }) => {
    const p = Array.isArray(loaderData) ? (loaderData[0] as any)?.product : (loaderData as any)?.product;
    return {
      meta: [
        { title: p ? `${p.name} — SinoCargo` : "Product — SinoCargo" },
        { name: "description", content: p?.subtitle ?? p?.description ?? "" },
        { property: "og:title", content: p?.name ?? "" },
        { property: "og:description", content: p?.subtitle ?? p?.description ?? "" },
        ...(p?.cover_url ? [{ property: "og:image", content: p.cover_url }] : []),
      ],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-7xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl font-bold">Product not found</h1>
      <Link to="/products" className="mt-4 inline-block text-brand hover:underline">← Back to shop</Link>
    </div>
  ),
  errorComponent: ({ error }) => <div className="p-10 text-center text-destructive">{error.message}</div>,
  component: ProductDetail,
});

function ProductDetail() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(productQO(slug));
  if (!data.product) throw notFound();

  const dp = data.product as any;
  const product = adaptProduct(dp);
  const variants = (data as any).variants ?? [];
  const stock = dp.total_stock;

  const allowPersonal = dp.allow_personal ?? (dp.purchase_type === "personal");
  const allowBusiness = dp.allow_business ?? (dp.purchase_type === "business");
  const [mode, setMode] = useState<"personal" | "business">(allowPersonal ? "personal" : "business");

  const { lang, formatPrice, t, currency, cnyToCad } = useApp();

  const { add } = useCart();
  const minQty = mode === "business" ? (dp.moq ?? 1) : 1;
  const stepQty = mode === "business" ? Math.max(dp.pack_qty ?? 1, 1) : 1;
  const [qty, setQty] = useState(minQty);
  useEffect(() => { if (qty < minQty) setQty(minQty); }, [minQty]);
  const [selVariantId, setSelVariantId] = useState<string | null>(variants[0]?.id ?? null);
  const selVariant = variants.find((v: any) => v.id === selVariantId) ?? null;
  const effectivePriceCNY = selVariant?.price_cny ?? product.priceCNY;

  const gallery = [dp.cover_url, ...(Array.isArray(dp.images) ? dp.images : [])].filter(Boolean) as string[];
  const [activeImg, setActiveImg] = useState(0);
  const currentImg = gallery[activeImg];

  const totalCustomsRate = Number(dp.customs_mfn_rate ?? 0) + Number(dp.customs_gst_rate ?? 0) + Number(dp.customs_antidumping_rate ?? 0);

  const otherPrice = currency === "CNY"
    ? `≈ CA$${cnyToCad(effectivePriceCNY).toFixed(2)}`
    : `≈ ¥${effectivePriceCNY.toFixed(0)}`;

  const handleAdd = () => {
    if (qty < minQty) return;
    add(product, qty);
    toast.success(lang === "zh" ? `已加入购物车 ×${qty}` : `Added ×${qty} to cart`);
  };

  // Real-time freight quote
  const { data: routesData } = useSuspenseQuery(routesQO);
  const allowedRoutes = useMemo(() => {
    const all = routesData?.items ?? [];
    const allow = (dp as any).available_route_codes as string[] | null;
    if (!allow || allow.length === 0) return all;
    return all.filter((r: any) => allow.includes(r.code));
  }, [routesData, dp]);
  const [quoteRoute, setQuoteRoute] = useState<string>("");
  useEffect(() => {
    if (!quoteRoute && allowedRoutes[0]) setQuoteRoute(allowedRoutes[0].code);
  }, [allowedRoutes.length]);
  const [quote, setQuote] = useState<any>(null);
  const [quoting, setQuoting] = useState(false);
  useEffect(() => {
    if (!quoteRoute) { setQuote(null); return; }
    setQuoting(true);
    sb.rpc("quote_shop_order", {
      _payload: { route_code: quoteRoute, mode, items: [{ slug: dp.slug, quantity: qty, mode }] },
    }).then(({ data }: any) => setQuote(data?.ok ? data : null)).finally(() => setQuoting(false));
  }, [quoteRoute, qty, mode, dp.slug]);
  const selRoute = allowedRoutes.find((r: any) => r.code === quoteRoute);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
      <nav className="mb-6 text-xs text-ink-soft">
        <Link to="/" className="hover:text-foreground">{t("nav.home")}</Link>
        <span className="mx-2">/</span>
        <Link to="/products" className="hover:text-foreground">{t("nav.products")}</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{product.name[lang]}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        {/* Gallery */}
        <div>
          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-accent via-surface to-accent">
            {currentImg ? (
              <img src={currentImg} alt={product.name[lang]} className="aspect-square h-full w-full object-cover" />
            ) : (
              <div className="grid aspect-square place-items-center text-[12rem]">{product.image}</div>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {gallery.slice(0, 5).map((url, i) => (
                <button key={i} onClick={() => setActiveImg(i)}
                  className={`aspect-square overflow-hidden rounded-lg border-2 transition ${i === activeImg ? "border-brand" : "border-border hover:border-ink-soft"}`}>
                  <img src={url} alt="" className="h-full w-full object-cover"/>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {allowPersonal && allowBusiness ? (
              <div className="inline-flex rounded-full border border-border bg-surface p-0.5 text-[11px] font-semibold uppercase tracking-wider">
                <button onClick={() => setMode("personal")}
                  className={`rounded-full px-2.5 py-0.5 transition ${mode === "personal" ? "bg-foreground text-background" : "text-ink-soft"}`}>
                  {t("ptype.personal")}
                </button>
                <button onClick={() => setMode("business")}
                  className={`rounded-full px-2.5 py-0.5 transition ${mode === "business" ? "bg-foreground text-background" : "text-ink-soft"}`}>
                  {t("ptype.business")}
                </button>
              </div>
            ) : (
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
                mode === "business" ? "bg-foreground text-background" : "bg-accent text-ink-soft"
              }`}>
                {mode === "business" ? t("ptype.business") : t("ptype.personal")}
              </span>
            )}
            {mode === "business" && (
              <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                MOQ {dp.moq}
              </span>
            )}
            <span className="text-xs text-ink-soft">
              {lang === "zh" ? "库存" : "Stock"}: {stock}
            </span>
          </div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">{product.name[lang]}</h1>
          <p className="mt-3 text-ink-soft">{product.description[lang]}</p>

          <div className="mt-6 rounded-2xl border border-border bg-surface p-6">
            <div className="flex items-baseline gap-3">
              <span className="font-display text-4xl font-bold text-brand-gradient">{formatPrice(effectivePriceCNY)}</span>
              <span className="text-sm text-ink-soft">{otherPrice}</span>
              {dp.compare_price_cad != null && Number(dp.compare_price_cad) > 0 && (
                <span className="text-sm text-ink-soft line-through">CA${Number(dp.compare_price_cad).toFixed(2)}</span>
              )}
            </div>
            <div className="mt-2 text-xs text-ink-soft">{t("product.from")} · {t("product.weight")} {product.weightKg}kg</div>
            {totalCustomsRate > 0 && (
              <div className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                {lang === "zh" ? `按 ${(totalCustomsRate * 100).toFixed(1)}% 收取关税（MFN+GST+反倾销）` : `${(totalCustomsRate * 100).toFixed(1)}% customs duty (MFN+GST+anti-dumping)`}
              </div>
            )}
            {mode === "business" && qty < (dp.moq ?? 1) && (
              <div className="mt-1 text-xs text-rose-500">
                {lang === "zh" ? `商业采购最少 ${dp.moq} 件` : `Min ${dp.moq} for business`}
              </div>
            )}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            {allowedRoutes.length === 0 ? (
              <div className="col-span-2 rounded-xl border border-dashed border-border bg-surface p-4 text-xs text-ink-soft">
                {lang === "zh" ? "该商品暂未配置运输线路" : "No shipping route configured for this product"}
              </div>
            ) : (
              allowedRoutes.map((r: any) => {
                const Icon = r.shipping_method === "sea" ? Ship : r.shipping_method === "express" || r.shipping_method === "truck" ? Truck : Plane;
                const eta = [r.transit_days_min, r.transit_days_max].filter((n) => n != null).join("-");
                return (
                  <div key={r.code} className="rounded-xl border border-border bg-surface p-4">
                    <div className="flex items-center gap-2 text-xs text-ink-soft">
                      <Icon className="h-3.5 w-3.5" /> {lang === "zh" ? r.name_zh : (r.name_en ?? r.name_zh)}
                    </div>
                    <div className="mt-1 font-semibold">{eta ? `${eta} ${lang === "zh" ? "天" : "days"}` : "—"}</div>
                  </div>
                );
              })
            )}
          </div>

          {variants.length > 0 && (
            <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
              <div className="mb-3 text-sm font-display font-bold">{lang === "zh" ? "规格选择" : "Choose variant"}</div>
              <div className="flex flex-wrap gap-2">
                {variants.map((v: any) => {
                  const label = [v.attrs?.color, v.attrs?.size].filter(Boolean).join(" / ") || v.sku;
                  const active = v.id === selVariantId;
                  const out = (v.stock ?? 0) <= 0;
                  return (
                    <button key={v.id} onClick={() => !out && setSelVariantId(v.id)} disabled={out}
                      className={`rounded-full border px-3 py-1.5 text-xs transition ${active ? "border-brand bg-brand/10 font-semibold text-brand" : "border-border hover:border-brand/40"} ${out ? "opacity-40 line-through" : ""}`}>
                      {label}
                      {v.price_cny != null && Number(v.price_cny) !== Number(product.priceCNY) && (
                        <span className="ml-1 text-[10px] text-ink-soft">· {formatPrice(Number(v.price_cny))}</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {selVariant && (
                <div className="mt-2 text-[11px] text-ink-soft">
                  SKU: <span className="font-mono">{selVariant.sku}</span> · {lang === "zh" ? "库存" : "Stock"} {selVariant.stock}
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex items-stretch gap-3">
            <div className="inline-flex items-center rounded-full border border-border bg-surface">
              <button onClick={() => setQty(Math.max(minQty, qty - stepQty))} className="grid h-12 w-12 place-items-center text-ink-soft hover:text-foreground"><Minus className="h-4 w-4" /></button>
              <span className="w-12 text-center font-semibold">{qty}</span>
              <button onClick={() => setQty(qty + stepQty)} className="grid h-12 w-12 place-items-center text-ink-soft hover:text-foreground"><Plus className="h-4 w-4" /></button>
            </div>
            <button onClick={handleAdd} disabled={stock <= 0 || qty < minQty} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-cta-gradient px-6 py-4 text-sm font-semibold text-cta-foreground shadow-elevated transition hover:brightness-110 disabled:opacity-50">
              <ShoppingCart className="h-4 w-4" />
              {stock <= 0 ? (lang === "zh" ? "暂时缺货" : "Out of stock") : qty < minQty ? (lang === "zh" ? `至少 ${minQty} 件` : `Min ${minQty}`) : t("product.add")}
            </button>
          </div>

          {/* Live freight quote */}
          {allowedRoutes.length > 0 && (
            <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-display font-bold">
                <Calculator className="h-4 w-4 text-brand"/>
                {lang === "zh" ? "运费试算" : "Freight calculator"}
              </div>
              <div className="mb-3 grid gap-2 sm:grid-cols-2">
                {allowedRoutes.slice(0, 4).map((r: any) => {
                  const Icon = r.shipping_method === "sea" ? Ship : r.shipping_method === "express" ? Truck : Plane;
                  const eta = [r.transit_days_min, r.transit_days_max].filter(Boolean).join("-");
                  return (
                    <button key={r.code} onClick={() => setQuoteRoute(r.code)}
                      className={`flex items-center gap-2 rounded-xl border p-2.5 text-left transition ${quoteRoute === r.code ? "border-brand bg-brand/5" : "border-border hover:border-brand/40"}`}>
                      <span className={`grid h-7 w-7 place-items-center rounded-lg ${quoteRoute === r.code ? "bg-brand text-brand-foreground" : "bg-accent text-ink-soft"}`}><Icon className="h-3.5 w-3.5"/></span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold">{lang === "zh" ? r.name_zh : (r.name_en ?? r.name_zh)}</div>
                        <div className="truncate text-[10px] text-ink-soft font-mono">{r.code}{eta && ` · ${eta}${lang === "zh" ? "天" : "d"}`}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {quoting ? (
                <div className="py-2 text-center text-xs text-ink-soft">{lang === "zh" ? "计算中…" : "Calculating…"}</div>
              ) : quote?.lines?.[0] ? (
                <dl className="grid grid-cols-2 gap-y-1.5 text-xs sm:grid-cols-4">
                  <QRow k={lang === "zh" ? "计费重" : "Chargeable"} v={`${Number(quote.lines[0].chargeable_kg).toFixed(2)} kg`}/>
                  <QRow k={lang === "zh" ? "运费" : "Freight"} v={formatPrice(quote.freight_cny)}/>
                  <QRow k={lang === "zh" ? "关税" : "Duty"} v={formatPrice(quote.customs_cny)}/>
                  <QRow k={lang === "zh" ? "保险" : "Insurance"} v={formatPrice(quote.insurance_cny)}/>
                  <div className="col-span-2 sm:col-span-4 mt-2 flex items-center justify-between border-t border-border pt-2">
                    <span className="text-ink-soft">{lang === "zh" ? `合计 (×${qty}${selRoute ? ` · ${selRoute.code}` : ""})` : `Total (×${qty}${selRoute ? ` · ${selRoute.code}` : ""})`}</span>
                    <span className="font-display text-base font-bold text-brand-gradient">{formatPrice(quote.total_cny)}</span>
                  </div>
                  {!quote.has_freight_rule && (
                    <p className="col-span-full mt-1 text-[10px] text-amber-500">{lang === "zh" ? "该线路未配置运费规则，运费按 0 计算" : "No freight rule for this route; freight = 0"}</p>
                  )}
                </dl>
              ) : (
                <div className="py-2 text-center text-xs text-ink-soft">{lang === "zh" ? "选择线路查看运费" : "Select a route to see freight"}</div>
              )}
            </div>
          )}


          {/* Specs */}
          <div className="mt-6 rounded-2xl border border-border bg-surface p-5 text-sm">
            <div className="mb-3 font-display font-bold">{lang === "zh" ? "商品规格" : "Specifications"}</div>
            <dl className="grid grid-cols-2 gap-y-2 text-xs">
              {dp.brand && <SpecRow k={lang === "zh" ? "品牌" : "Brand"} v={dp.brand}/>}
              {/* manufacturer hidden from frontend per business rule */}
              {dp.hs_code && <SpecRow k="HS Code" v={dp.hs_code}/>}
              {dp.pack_qty && <SpecRow k={lang === "zh" ? "每包装件数" : "Pcs/Pack"} v={String(dp.pack_qty)}/>}
              {dp.pack_weight_kg && <SpecRow k={lang === "zh" ? "包装重量" : "Pack weight"} v={`${dp.pack_weight_kg} kg`}/>}
              {dp.pack_length_cm && <SpecRow k={lang === "zh" ? "包装尺寸" : "Pack size"} v={`${dp.pack_length_cm}×${dp.pack_width_cm}×${dp.pack_height_cm} cm`}/>}
              {dp.pack_volume_m3 && <SpecRow k={lang === "zh" ? "包装体积" : "Pack volume"} v={`${dp.pack_volume_m3} m³`}/>}
            </dl>
          </div>

          <ul className="mt-6 space-y-2 text-sm text-ink-soft">
            {[
              lang === "zh" ? "国内官方渠道直采，保证正品" : "Sourced from official China channels, guaranteed authentic",
              lang === "zh" ? "支持合箱集运，节省 40% 运费" : "Box consolidation supported, saves up to 40% on freight",
              lang === "zh" ? "全程运单追踪，节点透明" : "Full tracking with visibility at every node",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Detail blocks */}
      {Array.isArray(dp.detail_blocks) && dp.detail_blocks.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 font-display text-2xl font-bold">{lang === "zh" ? "商品详情" : "Product Details"}</h2>
          <div className="space-y-4">
            {dp.detail_blocks.map((b: any, i: number) => {
              if (b.type === "image" && b.url) return <img key={i} src={b.url} alt="" className="w-full rounded-2xl border border-border"/>;
              if (b.type === "video" && b.url) return (
                <video key={i} src={b.url} controls className="w-full rounded-2xl border border-border bg-black"/>
              );
              if (b.type === "text" && b.content) return (
                <p key={i} className="whitespace-pre-wrap text-base leading-relaxed text-foreground">{b.content}</p>
              );
              return null;
            })}
          </div>
        </section>
      )}

    </div>
  );
}

function SpecRow({ k, v }: { k: string; v: string }) {
  return <><dt className="text-ink-soft">{k}</dt><dd className="text-right font-medium">{v}</dd></>;
}
function QRow({ k, v }: { k: string; v: string }) {
  return <div><dt className="text-[10px] uppercase tracking-wider text-ink-soft">{k}</dt><dd className="font-semibold">{v}</dd></div>;
}
