import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function pubClient() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export type PublicProduct = {
  id: string;
  slug: string;
  name: string;
  name_en: string | null;
  subtitle: string | null;
  subtitle_en: string | null;
  description: string | null;
  description_en: string | null;
  brand: string | null;
  price_cny: number;
  compare_price_cny: number | null;
  weight_kg: number | null;
  cover_url: string | null;
  images: string[];
  tags: string[];
  total_stock: number;
  sold_count: number;
  category: { slug: string; name: string; name_en: string | null } | null;
  hs_code: string | null;
  manufacturer: string | null;
  detail_blocks: Array<{ type: "image" | "video" | "text"; url?: string; content?: string }>;
  purchase_type: "personal" | "business";
  allow_personal: boolean;
  allow_business: boolean;
  moq: number;
  customs_mfn_rate: number;
  customs_gst_rate: number;
  customs_antidumping_rate: number;
  freight_cny: number;
  compare_price_cad: number | null;
  personal_freight_mode: "follow_route" | "per_unit";
  personal_per_unit_freight_cny: number;
  pack_qty: number;
  pack_weight_kg: number | null;
  pack_length_cm: number | null;
  pack_width_cm: number | null;
  pack_height_cm: number | null;
  pack_volume_m3: number | null;
  available_route_codes: string[] | null;
};

const SELECT_COLS =
  "id,slug,name,name_en,subtitle,subtitle_en,description,description_en,brand,price_cny,compare_price_cny,compare_price_cad,weight_kg,cover_url,images,tags,total_stock,sold_count,hs_code,manufacturer,detail_blocks,purchase_type,allow_personal,allow_business,moq,customs_mfn_rate,customs_gst_rate,customs_antidumping_rate,freight_cny,personal_freight_mode,personal_per_unit_freight_cny,pack_qty,pack_weight_kg,pack_length_cm,pack_width_cm,pack_height_cm,pack_volume_m3,available_route_codes,category:product_categories(slug,name,name_en)";

export const listPublicCategories = createServerFn({ method: "GET" }).handler(async () => {
  const sb = pubClient();
  const { data, error } = await sb
    .from("product_categories")
    .select("id,slug,name,name_en,cover_url,sort_order")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return { items: data ?? [] };
});

export const listPublicProducts = createServerFn({ method: "POST" })
  .inputValidator((d: { category?: string; q?: string; limit?: number } = {}) => d)
  .handler(async ({ data }) => {
    const sb = pubClient();
    let q = sb
      .from("products")
      .select(SELECT_COLS)
      .eq("status", "active" as any)
      .order("created_at", { ascending: false })
      .limit(Math.min(200, data.limit ?? 100));
    if (data.q) q = q.ilike("name", `%${data.q}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    let items = (rows ?? []) as any as PublicProduct[];
    if (data.category && data.category !== "all") {
      items = items.filter((p) => p.category?.slug === data.category);
    }
    return { items };
  });

export const getPublicProduct = createServerFn({ method: "POST" })
  .inputValidator((d: { slug: string }) => d)
  .handler(async ({ data }) => {
    const sb = pubClient();
    const { data: product, error } = await sb
      .from("products")
      .select(SELECT_COLS)
      .eq("slug", data.slug)
      .eq("status", "active" as any)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!product) return { product: null, related: [] as PublicProduct[], variants: [] as any[] };
    const { data: variants } = await sb
      .from("product_variants")
      .select("id,sku,attrs,price_cny,stock,is_active")
      .eq("product_id", (product as any).id)
      .eq("is_active", true);
    const cat = (product as any).category?.slug as string | undefined;
    let related: PublicProduct[] = [];
    if (cat) {
      const { data: rel } = await sb
        .from("products")
        .select(SELECT_COLS)
        .eq("status", "active" as any)
        .neq("slug", data.slug)
        .limit(8);
      related = ((rel ?? []) as any as PublicProduct[]).filter((p) => p.category?.slug === cat).slice(0, 4);
    }
    return { product: product as any as PublicProduct, related, variants: (variants ?? []) as any[] };
  });

export const listPublicRoutes = createServerFn({ method: "GET" }).handler(async () => {
  const sb = pubClient();
  const { data, error } = await sb
    .from("shipping_routes")
    .select(
      "id, code, name_zh, name_en, shipping_method, destination_code, transit_days_min, transit_days_max, note, sort_order, origin_warehouse_id",
    )
    .eq("is_active", true)
    .in("usage_scope", ["shop", "both"])
    .order("sort_order");
  if (error) throw new Error(error.message);
  return { items: data ?? [] };
});

export const listPublicWarehouses = createServerFn({ method: "GET" }).handler(async () => {
  const sb = pubClient();
  const { data, error } = await sb
    .from("warehouses")
    .select("id, code, name_zh, name_en, country, type, address, contact, phone, sort_order")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return { items: data ?? [] };
});
