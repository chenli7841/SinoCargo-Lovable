import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Product } from "./mock-data";

export interface CartLine {
  slug: string;
  nameZh: string;
  nameEn: string;
  image: string;
  priceCNY: number;
  weightKg: number;
  purchaseType: "personal" | "business";
  moq?: number;
  packQty?: number;
  packWeightKg?: number;
  /** Shipping routes this product is restricted to; empty = all routes allowed */
  availableRouteCodes?: string[];
  quantity: number;
}

// Personal: per-unit chargeable weight × quantity.
// Business: package/carton weight × number of packs (quantity ÷ units-per-pack) — falls
// back to the personal formula if no pack weight has been configured for the product yet.
export function lineWeightKg(i: CartLine): number {
  if (i.purchaseType === "business" && i.packWeightKg && i.packQty) {
    return i.packWeightKg * (i.quantity / i.packQty);
  }
  return i.weightKg * i.quantity;
}

interface CartCtx {
  items: CartLine[];
  count: number;
  subtotalCNY: number;
  totalWeightKg: number;
  selected: Record<string, boolean>;
  selectedItems: CartLine[];
  selectedCount: number;
  selectedSubtotalCNY: number;
  selectedWeightKg: number;
  toggleSelect: (slug: string) => void;
  setAllSelected: (v: boolean) => void;
  isSelected: (slug: string) => boolean;
  add: (p: Product, qty?: number) => void;
  update: (slug: string, qty: number) => void;
  remove: (slug: string) => void;
  clear: () => void;
  clearSlugs: (slugs: string[]) => void;
}

const Ctx = createContext<CartCtx | null>(null);
const KEY = "sinocargo.cart.v1";
const SEL_KEY = "sinocargo.cart.sel.v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw) as CartLine[]);
      const sraw = localStorage.getItem(SEL_KEY);
      if (sraw) setSelected(JSON.parse(sraw));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      localStorage.setItem(KEY, JSON.stringify(items));
      localStorage.setItem(SEL_KEY, JSON.stringify(selected));
    }
  }, [items, selected, hydrated]);

  const add = (p: Product, qty = 1) => {
    const minQty = p.purchaseType === "business" ? Math.max(qty, p.moq ?? 1) : qty;
    setItems((prev) => {
      const ex = prev.find((i) => i.slug === p.slug);
      if (ex) return prev.map((i) => (i.slug === p.slug ? { ...i, quantity: i.quantity + qty } : i));
      return [
        ...prev,
        {
          slug: p.slug,
          nameZh: p.name.zh,
          nameEn: p.name.en,
          image: p.image,
          priceCNY: p.priceCNY,
          weightKg: p.weightKg,
          purchaseType: p.purchaseType,
          moq: p.moq,
          packQty: p.packQty,
          packWeightKg: p.packWeightKg,
          availableRouteCodes: p.availableRouteCodes ?? [],
          quantity: minQty,
        },
      ];
    });
    setSelected((s) => ({ ...s, [p.slug]: true }));
  };

  const update = (slug: string, qty: number) => {
    const line = items.find((i) => i.slug === slug);
    if (line?.purchaseType === "business") {
      // Wholesale items can never drop below their minimum order quantity — clamp
      // instead of removing, even if the user keeps pressing "-" at the floor.
      const floor = Math.max(line.moq ?? 1, 1);
      setItems((prev) => prev.map((i) => (i.slug === slug ? { ...i, quantity: Math.max(qty, floor) } : i)));
      return;
    }
    if (qty <= 0) return remove(slug);
    setItems((prev) => prev.map((i) => (i.slug === slug ? { ...i, quantity: qty } : i)));
  };
  const remove = (slug: string) => {
    setItems((prev) => prev.filter((i) => i.slug !== slug));
    setSelected((s) => {
      const n = { ...s };
      delete n[slug];
      return n;
    });
  };
  const clear = () => {
    setItems([]);
    setSelected({});
  };
  const clearSlugs = (slugs: string[]) => {
    const set = new Set(slugs);
    setItems((prev) => prev.filter((i) => !set.has(i.slug)));
    setSelected((s) => {
      const n = { ...s };
      for (const x of slugs) delete n[x];
      return n;
    });
  };

  const isSelected = (slug: string) => selected[slug] !== false; // default selected
  const toggleSelect = (slug: string) => setSelected((s) => ({ ...s, [slug]: !isSelected(slug) }));
  const setAllSelected = (v: boolean) => setSelected(Object.fromEntries(items.map((i) => [i.slug, v])));

  const count = items.reduce((n, i) => n + i.quantity, 0);
  const subtotalCNY = items.reduce((s, i) => s + i.priceCNY * i.quantity, 0);
  const totalWeightKg = items.reduce((w, i) => w + lineWeightKg(i), 0);

  const selectedItems = useMemo(() => items.filter((i) => isSelected(i.slug)), [items, selected]);
  const selectedCount = selectedItems.reduce((n, i) => n + i.quantity, 0);
  const selectedSubtotalCNY = selectedItems.reduce((s, i) => s + i.priceCNY * i.quantity, 0);
  const selectedWeightKg = selectedItems.reduce((w, i) => w + lineWeightKg(i), 0);

  return (
    <Ctx.Provider
      value={{
        items,
        count,
        subtotalCNY,
        totalWeightKg,
        selected,
        selectedItems,
        selectedCount,
        selectedSubtotalCNY,
        selectedWeightKg,
        toggleSelect,
        setAllSelected,
        isSelected,
        add,
        update,
        remove,
        clear,
        clearSlugs,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be used inside CartProvider");
  return c;
}
