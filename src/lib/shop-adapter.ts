import type { Product } from "./mock-data";
import type { PublicProduct } from "./shop-public.functions";

const CAT_EMOJI: Record<string, string> = {
  electronics: "📱", fashion: "👗", beauty: "💄", home: "🛋️",
  food: "🍜", "mom-baby": "🍼", health: "🌿", stationery: "✏️",
};

export function adaptProduct(p: PublicProduct): Product {
  const catSlug = p.category?.slug ?? "home";
  const img = p.cover_url || (Array.isArray(p.images) && p.images[0]) || CAT_EMOJI[catSlug] || "🛍️";
  return {
    slug: p.slug,
    name: { zh: p.name, en: p.name },
    description: { zh: p.subtitle ?? p.description ?? "", en: p.subtitle ?? p.description ?? "" },
    priceCNY: Number(p.price_cny ?? 0),
    weightKg: Number(p.weight_kg ?? 0.5),
    category: catSlug,
    image: img,
    purchaseType: (p.purchase_type === "business" ? "business" : "personal"),
    moq: p.moq ?? 1,
  } as Product;
}

export function adaptCategories(cats: { slug: string; name: string; name_en: string | null }[]) {
  return cats.map((c) => ({
    slug: c.slug,
    name: { zh: c.name, en: c.name_en ?? c.name },
    icon: CAT_EMOJI[c.slug] ?? "🛍️",
  }));
}
