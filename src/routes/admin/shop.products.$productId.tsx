import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getProduct, saveProduct, listCategories } from "@/lib/shop.functions";
import { MediaUpload } from "@/components/admin/MediaUpload";
import { Loader2, Save, ArrowLeft, Plus, Trash2, PackageOpen, Image as ImageIcon, Video, FileText } from "lucide-react";

export const Route = createFileRoute("/admin/shop/products/$productId")({ component: ProductEdit });

function ProductEdit() {
  const { productId } = Route.useParams();
  const isNew = productId === "new";
  const fetchOne = useServerFn(getProduct);
  const save = useServerFn(saveProduct);
  const fetchCats = useServerFn(listCategories);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const catsQ = useQuery({ queryKey: ["shop-cats"], queryFn: () => fetchCats() });
  const q = useQuery({
    queryKey: ["shop-product", productId],
    queryFn: () => fetchOne({ data: { id: productId } }),
    enabled: !isNew,
  });

  const [form, setForm] = useState<any>({
    sku: "",
    name: "",
    name_en: "",
    slug: "",
    description: "",
    description_en: "",
    brand: "",
    status: "draft",
    price_cny: 0,
    compare_price_cad: null,
    category_id: null,
    cover_url: "",
    weight_kg: null,
    length_cm: null,
    width_cm: null,
    height_cm: null,
    tags: [],
    images: [],
    hs_code: "",
    manufacturer: "",
    detail_blocks: [],
    purchase_type: "personal",
    allow_personal: true,
    allow_business: false,
    cargo_type: "general",
    moq: 1,
    customs_mfn_rate: 0,
    customs_gst_rate: 0,
    customs_antidumping_rate: 0,
    personal_freight_mode: "follow_route",
    personal_per_unit_freight_cny: 0,
    personal_per_unit_freight_air_cny: 0,
    personal_per_unit_freight_sea_cny: 0,
    personal_air_route_code: null,
    personal_sea_route_code: null,
    business_air_route_code: null,
    business_sea_route_code: null,
    pack_qty: 1,
    pack_weight_kg: null,
    pack_length_cm: null,
    pack_width_cm: null,
    pack_height_cm: null,
    pack_volume_m3: null,
    available_route_codes: [],
  });

  const [routes, setRoutes] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (q.data) {
      const p: any = q.data.product;
      setForm({
        ...p,
        images: Array.isArray(p.images) ? p.images : [],
        detail_blocks: Array.isArray(p.detail_blocks) ? p.detail_blocks : [],
        available_route_codes: Array.isArray(p.available_route_codes) ? p.available_route_codes : [],
      });
      setVariants(q.data.variants);
    }
  }, [q.data]);

  useEffect(() => {
    import("@/integrations/supabase/client").then(({ supabase }) =>
      (supabase as any)
        .from("shipping_routes")
        .select("code,name_zh,shipping_method,destination_code,cargo_type,usage_scope")
        .eq("is_active", true)
        .in("usage_scope", ["shop", "both"])
        .order("sort_order")
        .then(({ data }: any) => setRoutes(data ?? [])),
    );
  }, []);

  const onSave = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await save({ data: { ...form, id: isNew ? undefined : productId, variants } });
      setMsg("✓ 已保存");
      qc.invalidateQueries({ queryKey: ["shop-products"] });
      qc.invalidateQueries({ queryKey: ["shop-product", productId] });
      if (isNew && r.id) navigate({ to: "/admin/shop/products/$productId", params: { productId: r.id } });
    } catch (e: any) {
      setMsg("✗ " + e.message);
    } finally {
      setBusy(false);
    }
  };

  // Variants
  const addVariant = () =>
    setVariants([
      ...variants,
      {
        id: "new_" + Date.now(),
        sku: form.sku + "-V" + (variants.length + 1),
        attrs: { color: "", size: "" },
        price_cny: form.price_cny ?? 0,
        stock: 0,
        is_active: true,
      },
    ]);
  const updateVariant = (idx: number, patch: any) => {
    const n = [...variants];
    n[idx] = { ...n[idx], ...patch };
    setVariants(n);
  };
  const removeVariant = (idx: number) => setVariants(variants.filter((_, i) => i !== idx));

  // Images
  const addImage = () => setForm({ ...form, images: [...form.images, ""] });
  const updateImage = (i: number, v: string) => {
    const n = [...form.images];
    n[i] = v;
    setForm({ ...form, images: n });
  };
  const removeImage = (i: number) =>
    setForm({ ...form, images: form.images.filter((_: any, idx: number) => idx !== i) });

  // Detail blocks
  const addBlock = (type: "image" | "video" | "text") =>
    setForm({ ...form, detail_blocks: [...form.detail_blocks, { type, url: "", content: "" }] });
  const updateBlock = (i: number, patch: any) => {
    const n = [...form.detail_blocks];
    n[i] = { ...n[i], ...patch };
    setForm({ ...form, detail_blocks: n });
  };
  const removeBlock = (i: number) =>
    setForm({ ...form, detail_blocks: form.detail_blocks.filter((_: any, idx: number) => idx !== i) });

  if (!isNew && q.isLoading)
    return (
      <div className="grid h-[60vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );

  return (
    <div className="mx-auto max-w-5xl p-6">
      <button
        onClick={() => navigate({ to: "/admin/shop/products" })}
        className="mb-3 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white"
      >
        <ArrowLeft className="h-3 w-3" />
        返回商品列表
      </button>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold inline-flex items-center gap-2">
          <PackageOpen className="h-5 w-5 text-blue-400" />
          {isNew ? "新增商品" : "编辑商品"}
        </h1>
        <button
          onClick={onSave}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}保存
        </button>
      </div>
      {msg && <div className="mb-3 text-xs text-emerald-300">{msg}</div>}

      {/* 基本信息 */}
      <Section title="基本信息">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="SKU">
            <Input value={form.sku} onChange={(v) => setForm({ ...form, sku: v })} />
          </Field>
          <Field label="商品名">
            <Input value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          </Field>
          <Field label="商品名（英文）">
            <Input value={form.name_en ?? ""} onChange={(v) => setForm({ ...form, name_en: v })} />
          </Field>
          <Field label="Slug">
            <Input value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} />
          </Field>
          <Field label="品牌">
            <Input value={form.brand ?? ""} onChange={(v) => setForm({ ...form, brand: v })} />
          </Field>
          <Field label="分类">
            <select
              value={form.category_id ?? ""}
              onChange={(e) => setForm({ ...form, category_id: e.target.value || null })}
              className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm [&>option]:bg-[#0E1626]"
            >
              <option value="">未分类</option>
              {(catsQ.data?.items ?? []).map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="状态">
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm [&>option]:bg-[#0E1626]"
            >
              <option value="draft">草稿</option>
              <option value="active">在售</option>
              <option value="archived">下架</option>
            </select>
          </Field>
          <Field label="价格 CNY">
            <Input
              type="number"
              value={String(form.price_cny ?? "")}
              onChange={(v) => setForm({ ...form, price_cny: Number(v) || 0 })}
            />
          </Field>
          <Field label="对比价 CAD（原价划线）">
            <Input
              type="number"
              value={String(form.compare_price_cad ?? "")}
              onChange={(v) => setForm({ ...form, compare_price_cad: v === "" ? null : Number(v) })}
            />
          </Field>
          <Field label="描述" full>
            <textarea
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm focus:border-brand focus:outline-none"
            />
          </Field>
          <Field label="描述（英文）" full>
            <textarea
              value={form.description_en ?? ""}
              onChange={(e) => setForm({ ...form, description_en: e.target.value })}
              rows={3}
              className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm focus:border-brand focus:outline-none"
            />
          </Field>
        </div>
      </Section>

      {/* 媒体 */}
      <Section title="媒体 / 图片库（上传到 shop-media 桶）">
        <Field label="封面图">
          <MediaUpload value={form.cover_url ?? ""} onChange={(v) => setForm({ ...form, cover_url: v })} />
        </Field>
        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wider text-slate-400">商品图片库</div>
            <button
              onClick={addImage}
              className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10"
            >
              <Plus className="h-3 w-3" />
              添加图片
            </button>
          </div>
          {form.images.length === 0 && <div className="text-xs text-slate-500">暂无图片</div>}
          <div className="space-y-2">
            {form.images.map((url: string, i: number) => (
              <div key={i} className="rounded border border-white/5 bg-white/[0.03] p-2">
                <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-400">
                  <span>#{i + 1}</span>
                  <button onClick={() => removeImage(i)} className="text-rose-400 hover:text-rose-300">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <MediaUpload value={url} onChange={(v) => updateImage(i, v)} />
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* 详情图文视频 */}
      <Section title="详情页内容（图文 / 视频）">
        <div className="mb-2 flex gap-2">
          <button
            onClick={() => addBlock("image")}
            className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10"
          >
            <ImageIcon className="h-3 w-3" />
            图片块
          </button>
          <button
            onClick={() => addBlock("video")}
            className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10"
          >
            <Video className="h-3 w-3" />
            视频块
          </button>
          <button
            onClick={() => addBlock("text")}
            className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10"
          >
            <FileText className="h-3 w-3" />
            文本块
          </button>
        </div>
        {form.detail_blocks.length === 0 && <div className="text-xs text-slate-500">暂无详情内容</div>}
        <div className="space-y-2">
          {form.detail_blocks.map((b: any, i: number) => (
            <div key={i} className="rounded border border-white/5 bg-white/[0.03] p-2">
              <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-400">
                <span>
                  #{i + 1} · {b.type}
                </span>
                <button onClick={() => removeBlock(i)} className="text-rose-400 hover:text-rose-300">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              {b.type === "text" ? (
                <textarea
                  value={b.content ?? ""}
                  onChange={(e) => updateBlock(i, { content: e.target.value })}
                  rows={3}
                  className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm focus:border-brand focus:outline-none"
                />
              ) : (
                <MediaUpload
                  value={b.url ?? ""}
                  onChange={(v) => updateBlock(i, { url: v })}
                  accept={b.type === "video" ? "video/*" : "image/*"}
                />
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* 商务设置 */}
      <Section title="商务设置（HS Code / 厂家 / 采购模式 / 关税 / 末端派送费）">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="HS Code">
            <Input value={form.hs_code ?? ""} onChange={(v) => setForm({ ...form, hs_code: v })} />
          </Field>
          <Field label="生产厂家（仅后台可见）">
            <Input value={form.manufacturer ?? ""} onChange={(v) => setForm({ ...form, manufacturer: v })} />
          </Field>
          <Field label="货物类型">
            <select
              value={form.cargo_type ?? "general"}
              onChange={(e) => setForm({ ...form, cargo_type: e.target.value })}
              className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm [&>option]:bg-[#0E1626]"
            >
              <option value="general">普货</option>
              <option value="sensitive">敏感货</option>
            </select>
          </Field>
          <Field label="允许的采购模式" full>
            <div className="flex flex-wrap gap-3 text-sm">
              <label
                className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 cursor-pointer ${form.allow_personal ? "border-brand bg-brand/10" : "border-white/10 bg-white/5"}`}
              >
                <input
                  type="checkbox"
                  checked={!!form.allow_personal}
                  onChange={(e) => setForm({ ...form, allow_personal: e.target.checked })}
                />
                个人采购
              </label>
              <label
                className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 cursor-pointer ${form.allow_business ? "border-brand bg-brand/10" : "border-white/10 bg-white/5"}`}
              >
                <input
                  type="checkbox"
                  checked={!!form.allow_business}
                  onChange={(e) => setForm({ ...form, allow_business: e.target.checked })}
                />
                商业采购
              </label>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              至少勾选一项；MOQ 仅用于校验是否达到商业采购门槛，不参与运费 / 箱数计算
            </p>
          </Field>
          {form.allow_business && (
            <Field label="最小起订量 MOQ（仅商业门槛校验）">
              <Input
                type="number"
                value={String(form.moq ?? 1)}
                onChange={(v) => setForm({ ...form, moq: Number(v) || 1 })}
              />
            </Field>
          )}
          <Field label="MFN 关税率（0~1）">
            <Input
              type="number"
              value={String(form.customs_mfn_rate ?? 0)}
              onChange={(v) => setForm({ ...form, customs_mfn_rate: Number(v) || 0 })}
            />
          </Field>
          <Field label="GST 税率（0~1）">
            <Input
              type="number"
              value={String(form.customs_gst_rate ?? 0)}
              onChange={(v) => setForm({ ...form, customs_gst_rate: Number(v) || 0 })}
            />
          </Field>
          <Field label="反倾销税率（0~1）">
            <Input
              type="number"
              value={String(form.customs_antidumping_rate ?? 0)}
              onChange={(v) => setForm({ ...form, customs_antidumping_rate: Number(v) || 0 })}
            />
          </Field>
          <Field label="合计关税率" full>
            <p className="text-sm text-slate-300">
              {(
                (Number(form.customs_mfn_rate ?? 0) +
                  Number(form.customs_gst_rate ?? 0) +
                  Number(form.customs_antidumping_rate ?? 0)) *
                100
              ).toFixed(1)}
              %
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              关税 = 商品小计（单价×数量）× 合计关税率，个人和商业采购均适用
            </p>
          </Field>
        </div>
      </Section>

      {/* 个人采购运费公式 */}
      {form.allow_personal && (
        <Section title="个人采购运费公式">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="计费方式">
              <select
                value={form.personal_freight_mode}
                onChange={(e) => setForm({ ...form, personal_freight_mode: e.target.value })}
                className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm [&>option]:bg-[#0E1626]"
              >
                <option value="follow_route">沿用线路（数量 × 单件计费重 × 线路单价）</option>
                <option value="per_unit">按数量（数量 × 预设单件运费）</option>
              </select>
            </Field>
            {form.personal_freight_mode === "per_unit" && (
              <>
                <Field label="单件预设运费 · 空运 CNY">
                  <Input
                    type="number"
                    value={String(form.personal_per_unit_freight_air_cny ?? 0)}
                    onChange={(v) => setForm({ ...form, personal_per_unit_freight_air_cny: Number(v) || 0 })}
                  />
                </Field>
                <Field label="单件预设运费 · 海运 CNY">
                  <Input
                    type="number"
                    value={String(form.personal_per_unit_freight_sea_cny ?? 0)}
                    onChange={(v) => setForm({ ...form, personal_per_unit_freight_sea_cny: Number(v) || 0 })}
                  />
                </Field>
              </>
            )}
          </div>
          {form.personal_freight_mode !== "per_unit" && (
            <p className="mt-2 text-[11px] text-slate-500">
              单件计费重量取自下方「个人采购包装规格」的单件重量 / 尺寸，按所选线路的计重规则计算。
            </p>
          )}
        </Section>
      )}

      {/* 个人采购包装规格：单件重量/尺寸，直接用于个人采购计费重量（不按箱） */}
      {form.allow_personal && (
        <Section title="个人采购包装规格（单件重量 / 尺寸，按件计费，不按箱折算）">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="单件重量 kg">
              <Input
                type="number"
                value={String(form.weight_kg ?? "")}
                onChange={(v) => setForm({ ...form, weight_kg: v === "" ? null : Number(v) })}
              />
            </Field>
            <Field label="单件长 cm">
              <Input
                type="number"
                value={String(form.length_cm ?? "")}
                onChange={(v) => setForm({ ...form, length_cm: v === "" ? null : Number(v) })}
              />
            </Field>
            <Field label="单件宽 cm">
              <Input
                type="number"
                value={String(form.width_cm ?? "")}
                onChange={(v) => setForm({ ...form, width_cm: v === "" ? null : Number(v) })}
              />
            </Field>
            <Field label="单件高 cm">
              <Input
                type="number"
                value={String(form.height_cm ?? "")}
                onChange={(v) => setForm({ ...form, height_cm: v === "" ? null : Number(v) })}
              />
            </Field>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            个人采购计费重量 = 单件计费重量（按线路规则取实重/体积重）× 数量，不受下方"商业采购包装规格"影响。
          </p>
        </Section>
      )}

      {/* 商业采购包装规格：整箱重量/尺寸，按箱数折算计费 */}
      {form.allow_business && (
        <Section title="商业采购包装规格（整箱重量 / 尺寸，按包装尺寸 × 箱数计费；箱数 = 数量 ÷ 内件数）">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="内件数（每箱件数，用于计算箱数与运费）">
              <Input
                type="number"
                value={String(form.pack_qty ?? 1)}
                onChange={(v) => setForm({ ...form, pack_qty: Number(v) || 1 })}
              />
            </Field>
            <Field label="包装重量 kg">
              <Input
                type="number"
                value={String(form.pack_weight_kg ?? "")}
                onChange={(v) => setForm({ ...form, pack_weight_kg: Number(v) || null })}
              />
            </Field>
            <Field label="包装体积 m³">
              <Input
                type="number"
                value={String(form.pack_volume_m3 ?? "")}
                onChange={(v) => setForm({ ...form, pack_volume_m3: Number(v) || null })}
              />
            </Field>
            <Field label="长 cm">
              <Input
                type="number"
                value={String(form.pack_length_cm ?? "")}
                onChange={(v) => setForm({ ...form, pack_length_cm: Number(v) || null })}
              />
            </Field>
            <Field label="宽 cm">
              <Input
                type="number"
                value={String(form.pack_width_cm ?? "")}
                onChange={(v) => setForm({ ...form, pack_width_cm: Number(v) || null })}
              />
            </Field>
            <Field label="高 cm">
              <Input
                type="number"
                value={String(form.pack_height_cm ?? "")}
                onChange={(v) => setForm({ ...form, pack_height_cm: Number(v) || null })}
              />
            </Field>
          </div>
        </Section>
      )}

      {/* 线路匹配：个人/商业 × 空运/海运 */}
      <Section title="线路匹配（按 采购模式 × 运输方式 各选一条线路）">
        {routes.length === 0 ? (
          <div className="text-xs text-slate-500">暂无启用中的线路，请先到「线路 / 运费 / 关税」配置</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["personal", "air", "personal_air_route_code", "个人采购 · 空运"],
                ["personal", "sea", "personal_sea_route_code", "个人采购 · 海运"],
                ["business", "air", "business_air_route_code", "商业采购 · 空运"],
                ["business", "sea", "business_sea_route_code", "商业采购 · 海运"],
              ] as const
            ).map(([mode, method, field, label]) => {
              const enabled = mode === "personal" ? form.allow_personal : form.allow_business;
              const candidates = routes.filter(
                (r) => r.shipping_method === method && (r.cargo_type ?? "general") === (form.cargo_type ?? "general"),
              );
              return (
                <Field key={field} label={label + (enabled ? "" : "（未启用该采购模式）")}>
                  <select
                    value={form[field] ?? ""}
                    disabled={!enabled}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value || null })}
                    className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm disabled:opacity-50 [&>option]:bg-[#0E1626]"
                  >
                    <option value="">— 未选择 —</option>
                    {candidates.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.code} · {r.name_zh}
                        {r.destination_code ? ` → ${r.destination_code}` : ""}
                      </option>
                    ))}
                  </select>
                </Field>
              );
            })}
          </div>
        )}
        <p className="mt-2 text-[11px] text-slate-500">
          线路仅显示与当前商品「货物类型」匹配的线路。未选择则该 采购模式 × 运输方式 组合不可下单。
        </p>
      </Section>

      {/* 变体 */}
      <Section title="规格变体 / SKU">
        <div className="mb-3 flex items-center justify-end">
          <button
            onClick={addVariant}
            className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10"
          >
            <Plus className="h-3 w-3" />
            新增变体
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-2 pr-2">SKU</th>
                <th className="py-2 pr-2">颜色</th>
                <th className="py-2 pr-2">尺寸</th>
                <th className="py-2 pr-2">价格</th>
                <th className="py-2 pr-2">库存</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {variants.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-slate-500">
                    尚无变体
                  </td>
                </tr>
              )}
              {variants.map((v, i) => (
                <tr key={v.id ?? i}>
                  <td className="py-1.5 pr-2">
                    <MiniInput value={v.sku} onChange={(x) => updateVariant(i, { sku: x })} />
                  </td>
                  <td className="py-1.5 pr-2">
                    <MiniInput
                      value={v.attrs?.color ?? ""}
                      onChange={(x) => updateVariant(i, { attrs: { ...v.attrs, color: x } })}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <MiniInput
                      value={v.attrs?.size ?? ""}
                      onChange={(x) => updateVariant(i, { attrs: { ...v.attrs, size: x } })}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <MiniInput
                      type="number"
                      value={String(v.price_cny ?? "")}
                      onChange={(x) => updateVariant(i, { price_cny: Number(x) || 0 })}
                    />
                  </td>
                  <td className="py-1.5 pr-2 text-right text-slate-400">{v.stock}</td>
                  <td className="py-1.5 text-right">
                    <button onClick={() => removeVariant(i)} className="text-rose-400 hover:text-rose-300">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!isNew && variants.length > 0 && (
          <p className="mt-3 text-[11px] text-slate-500">
            ⚠️ 库存请通过「库存流水」页面入库/调整，编辑变体的 stock 字段不会触发库存流水。
          </p>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: any) {
  return (
    <div className="mt-4 rounded-2xl border border-white/5 bg-white/[0.02] p-5">
      <div className="mb-3 font-display font-bold">{title}</div>
      {children}
    </div>
  );
}
function Field({ label, children, full }: any) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <div className="mb-1 text-[11px] uppercase tracking-wider text-slate-400">{label}</div>
      {children}
    </div>
  );
}
function Input({ value, onChange, type = "text" }: { value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm focus:border-brand focus:outline-none"
    />
  );
}
function MiniInput({
  value,
  onChange,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-xs focus:border-brand focus:outline-none"
    />
  );
}
