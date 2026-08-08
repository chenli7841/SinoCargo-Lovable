import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  findCustomerByCode,
  getCustomerOverview,
  listCustomerAddresses,
  saveCustomerAddress,
  deleteCustomerAddress,
  listCustomerItems,
  saveCustomerItem,
  deleteCustomerItem,
  listCustomerOrders,
  listCustomerInventory,
  listForwardingOptions,
  createCustomerForwarding,
  searchCustomerItemLibrary,
  getCustomerAccountInfo,
  resetCustomerPassword,
} from "@/lib/admin-customer-view.functions";
import { ROLE_LABEL, ROLE_COLOR } from "@/lib/admin-roles";
import { VIP_LABEL, VIP_COLOR } from "@/lib/vip-levels";
import {
  Search,
  Loader2,
  Hash,
  Mail,
  Phone,
  Ban,
  Wallet,
  Package,
  Truck,
  Receipt,
  User as UserIcon,
  MapPin,
  Tags,
  Plus,
  Trash2,
  Save,
  Send,
  Warehouse,
  Lock,
  KeyRound,
  MessageCircle,
} from "lucide-react";

export const Route = createFileRoute("/admin/customer-view")({
  head: () => ({
    meta: [{ title: "客户视图 — SinoCargo Admin" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: CustomerViewPage,
});

type Tab = "overview" | "orders" | "inventory" | "addresses" | "items" | "profile";

// This page never switches the acting session — every read/write goes
// through admin-customer-view.functions.ts (service role, explicit
// target user_id, logged to admin_action_logs). The staff member's own
// identity is preserved end-to-end; see the "只读+代客操作面板" decision.
function CustomerViewPage() {
  const fetchCustomer = useServerFn(findCustomerByCode);
  const [codeInput, setCodeInput] = useState("");
  const [code, setCode] = useState("");
  const [tab, setTab] = useState<Tab>("overview");

  const q = useQuery({
    queryKey: ["admin-customer-view", code],
    queryFn: () => fetchCustomer({ data: { code } }),
    enabled: !!code,
  });

  const profile = q.data?.profile ?? null;
  const roles = (q.data?.roles ?? []) as string[];

  const nav: { k: Tab; l: string; i: React.ReactNode }[] = [
    { k: "overview", l: "概览", i: <LayoutIcon /> },
    { k: "orders", l: "我的订单/发起集运", i: <Truck className="h-4 w-4" /> },
    { k: "inventory", l: "我的库存", i: <Warehouse className="h-4 w-4" /> },
    { k: "addresses", l: "收货地址", i: <MapPin className="h-4 w-4" /> },
    { k: "items", l: "我的物品", i: <Tags className="h-4 w-4" /> },
    { k: "profile", l: "个人资料", i: <UserIcon className="h-4 w-4" /> },
  ];

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-bold">客户视图</h1>
        <p className="mt-1 text-sm text-slate-400">
          按客户号查找客户，代客查看订单 / 发起集运、库存、地址与「我的物品」库 — 以你自己的员工身份操作，不会切换登录状态。
        </p>
      </div>

      <form
        className="mb-5 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setCode(codeInput.trim());
          setTab("overview");
        }}
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="输入客户号，如 SC000123"
            className="w-72 rounded-md border border-white/10 bg-white/5 py-2 pl-8 pr-3 text-sm placeholder:text-slate-500 focus:border-brand focus:outline-none"
          />
        </div>
        <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90">
          查找
        </button>
      </form>

      {q.isFetching && (
        <div className="grid h-32 place-items-center">
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
        </div>
      )}
      {code && !q.isFetching && !profile && (
        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-6 text-sm text-slate-400">
          未找到客户号「{code}」对应的账户。
        </div>
      )}

      {profile && (
        <>
          <section className="mb-5 rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.04] to-white/[0.02] p-6">
            <div className="flex flex-wrap items-center gap-5">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand/15 text-xl font-bold text-brand">
                {(profile.full_name ?? profile.email ?? "?").trim().slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-[200px] flex-1">
                <h2 className="font-display text-xl font-bold">{profile.full_name ?? "未命名用户"}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <Hash className="h-3.5 w-3.5" />
                    <span className="font-mono">{profile.customer_code ?? "—"}</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" />
                    {profile.email ?? "—"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    {profile.phone ?? "—"}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${VIP_COLOR[(profile.vip_level ?? "normal") as keyof typeof VIP_COLOR]}`}
                  >
                    {VIP_LABEL[(profile.vip_level ?? "normal") as keyof typeof VIP_LABEL]}
                  </span>
                  {profile.is_blacklisted && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-300">
                      <Ban className="h-3 w-3" />
                      已加入黑名单
                    </span>
                  )}
                  {roles
                    .filter((r) => r !== "customer")
                    .map((r) => (
                      <span
                        key={r}
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${ROLE_COLOR[r as keyof typeof ROLE_COLOR]}`}
                      >
                        {ROLE_LABEL[r as keyof typeof ROLE_LABEL]?.zh ?? r}
                      </span>
                    ))}
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link
                  to="/admin/users/$userId"
                  params={{ userId: profile.id }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
                >
                  <UserIcon className="h-4 w-4" />
                  角色 / 钱包 / 黑名单
                </Link>
                <Link
                  to="/admin/invoices"
                  search={{ userId: profile.id }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm font-semibold text-blue-200 hover:bg-blue-500/20"
                >
                  <Receipt className="h-4 w-4" />
                  全部账单
                </Link>
              </div>
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-[160px_1fr]">
            <nav className="flex gap-2 overflow-x-auto lg:flex-col">
              {nav.map((it) => (
                <button
                  key={it.k}
                  onClick={() => setTab(it.k)}
                  className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${tab === it.k ? "border-brand/40 bg-brand/10 text-white" : "border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20"}`}
                >
                  {it.i}
                  {it.l}
                </button>
              ))}
            </nav>

            <section>
              {tab === "overview" && <OverviewTab userId={profile.id} />}
              {tab === "orders" && <OrdersTab userId={profile.id} />}
              {tab === "inventory" && <InventoryTab userId={profile.id} />}
              {tab === "addresses" && <AddressesTab userId={profile.id} />}
              {tab === "items" && <ItemsTab userId={profile.id} />}
              {tab === "profile" && <ProfileTab userId={profile.id} />}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function LayoutIcon() {
  return <Package className="h-4 w-4" />;
}

// ===================== Overview =====================
function OverviewTab({ userId }: { userId: string }) {
  const fetchOverview = useServerFn(getCustomerOverview);
  const q = useQuery({
    queryKey: ["admin-customer-overview", userId],
    queryFn: () => fetchOverview({ data: { userId } }),
  });

  if (q.isLoading) return <Spinner />;
  const d = q.data;
  if (!d) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={<Wallet className="h-4 w-4" />}
          label="钱包余额"
          value={`CA$${d.wallet_balance_cad.toFixed(2)}`}
          accent="text-emerald-400"
        />
        <StatCard
          icon={<Package className="h-4 w-4" />}
          label="订单/运单总数"
          value={String(d.total_orders)}
          accent="text-blue-400"
        />
        <StatCard
          icon={<Truck className="h-4 w-4" />}
          label="运输中 / 未入库"
          value={`${d.in_transit} / ${d.unwarehoused}`}
          accent="text-amber-400"
        />
      </div>

      <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-bold inline-flex items-center gap-2">
            <Receipt className="h-4 w-4 text-rose-400" />
            未付账单
          </h3>
          <div className="text-xs">
            <span className="text-slate-400">合计 </span>
            <span className="font-bold text-rose-300">¥{d.unpaid_total_cny.toFixed(2)}</span>
          </div>
        </div>
        {d.unpaid_invoices.length === 0 ? (
          <div className="rounded-md border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-slate-500">
            无未付账单
          </div>
        ) : (
          <ul className="divide-y divide-white/5 rounded-md border border-white/5 bg-white/[0.02]">
            {d.unpaid_invoices.map((inv: any) => (
              <li key={inv.invoice_no} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                <span className="font-mono text-slate-300">{inv.invoice_no}</span>
                <span className="text-slate-500">{inv.status === "overdue" ? "已逾期" : "未付"}</span>
                <span className="font-bold text-rose-300">¥{inv.due_cny.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11px] text-slate-500">
          批次结算 / 代客付款请前往{" "}
          <Link to="/admin/batches" className="text-brand hover:underline">
            批次管理
          </Link>
          ；运单与订单状态请前往{" "}
          <Link to="/admin/waybills" className="text-brand hover:underline">
            运单列表
          </Link>
          。
        </p>
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
      <div className={`inline-flex items-center gap-1.5 text-xs ${accent}`}>
        {icon}
        {label}
      </div>
      <div className="mt-1.5 font-display text-lg font-bold text-slate-100">{value}</div>
    </div>
  );
}

// ===================== Item requirements by route =====================
type ItemRow = {
  name: string;
  quantity: number;
  unit_price_cny: number;
  hs_code: string;
  material: string;
  weight_kg: number | "";
  volume_m3: number | "";
};
const emptyItem: ItemRow = {
  name: "",
  quantity: 1,
  unit_price_cny: 0,
  hs_code: "",
  material: "",
  weight_kg: "",
  volume_m3: "",
};

/** 依线路推导需要填写的物品字段 */
function routeRequirements(route: any | null) {
  if (!route) {
    return { fields: ["name", "quantity", "price"], hint: "请先选择线路，系统将提示该线路所需填写的物品信息。" };
  }
  const mode = route.weight_mode as string | null;
  const isSea = String(route.shipping_method ?? "").toLowerCase().includes("sea") || /海/.test(route.name_zh ?? "");
  const sensitive = /敏|特/.test(route.name_zh ?? "") || /M$/.test(route.code ?? "");
  const fields = ["name", "quantity", "price"];
  const notes: string[] = [];
  if (mode === "volumetric" || (isSea && mode !== "actual")) {
    fields.push("volume");
    notes.push(`按体积计费${route.volumetric_divisor ? `（除数 ${route.volumetric_divisor}）` : ""}，需填写预估体积 m³`);
  }
  if (mode === "actual" || mode === "max" || mode === "greater" || !mode) {
    fields.push("weight");
    notes.push("按实重/取大计费，需填写预估重量 kg");
  }
  if (sensitive) {
    fields.push("hs", "material");
    notes.push("敏感货线路：需填写 HS 编码与材质/成分说明");
  } else {
    fields.push("hs");
    notes.push("建议填写 HS 编码，用于关税测算");
  }
  return { fields, hint: notes.join("；") };
}

// ===================== Orders + place forwarding on behalf =====================
function OrdersTab({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const fetchList = useServerFn(listCustomerOrders);
  const fetchOpts = useServerFn(listForwardingOptions);
  const create = useServerFn(createCustomerForwarding);
  const q = useQuery({
    queryKey: ["admin-customer-orders", userId],
    queryFn: () => fetchList({ data: { userId } }),
  });
  const optsQ = useQuery({
    queryKey: ["admin-customer-fwd-options", userId],
    queryFn: () => fetchOpts({ data: { userId } }),
  });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [form, setForm] = useState<any>({
    warehouse: "",
    route_code: "",
    address_id: "",
    domestic_tracking_no: "",
    note: "",
    insured: false,
  });
  const [items, setItems] = useState<ItemRow[]>([{ ...emptyItem }]);

  // Same fuzzy SKU/名称/HS lookup the customer gets on the public forwarding
  // form: type part of anything saved in their item library and pick a hit to
  // auto-fill 品名 / HS 编码 / 单价.
  const searchLib = useServerFn(searchCustomerItemLibrary);
  const [skuTerms, setSkuTerms] = useState<Record<number, string>>({});
  const [skuActive, setSkuActive] = useState<number | null>(null);
  const [skuLoading, setSkuLoading] = useState(false);
  const [skuResults, setSkuResults] = useState<any[]>([]);
  const skuTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSkuSearch = (idx: number, term: string) => {
    setSkuTerms((s) => ({ ...s, [idx]: term }));
    setSkuActive(idx);
    if (skuTimer.current) clearTimeout(skuTimer.current);
    if (!term.trim()) {
      setSkuResults([]);
      return;
    }
    skuTimer.current = setTimeout(async () => {
      setSkuLoading(true);
      try {
        const r: any = await searchLib({ data: { userId, term } });
        setSkuResults(r?.items ?? []);
      } catch {
        setSkuResults([]);
      } finally {
        setSkuLoading(false);
      }
    }, 300);
  };

  const pickSku = (idx: number, row: any) => {
    setItems((prev) =>
      prev.map((x, xi) =>
        xi === idx
          ? {
              ...x,
              name: row.name ?? x.name,
              hs_code: row.hs_code ?? x.hs_code,
              unit_price_cny: row.unit_price_cny || x.unit_price_cny,
            }
          : x,
      ),
    );
    setSkuTerms((s) => ({ ...s, [idx]: row.sku ?? row.name ?? "" }));
    setSkuActive(null);
    setSkuResults([]);
  };




  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const payload = items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unit_price_cny: i.unit_price_cny,
        hs_code: i.hs_code || null,
        material: i.material || null,
        weight_kg: i.weight_kg === "" ? null : Number(i.weight_kg),
        volume_m3: i.volume_m3 === "" ? null : Number(i.volume_m3),
      }));
      const r: any = await create({ data: { userId, ...form, address_id: form.address_id || null, items: payload } });
      setMsg({ kind: "ok", text: `已代客提交集运单 ${r.request_no}` });
      setItems([{ ...emptyItem }]);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-customer-orders", userId] });
    } catch (e: any) {
      setMsg({ kind: "err", text: e?.message ?? "提交失败" });
    } finally {
      setBusy(false);
    }
  };

  if (q.isLoading) return <Spinner />;
  const orders = q.data?.orders ?? [];
  const fwds = q.data?.forwardings ?? [];
  const selectedRoute = (optsQ.data?.routes ?? []).find((r: any) => r.code === form.route_code) ?? null;
  const req = routeRequirements(selectedRoute);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-bold">
          我的订单 / 运单（{orders.length + fwds.length}）
        </h3>
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand/90"
        >
          <Send className="h-3.5 w-3.5" /> {open ? "收起" : "代客发起集运"}
        </button>
      </div>

      {msg && (
        <div
          className={`rounded-md border px-3 py-1.5 text-xs ${msg.kind === "ok" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300"}`}
        >
          {msg.text}
        </div>
      )}

      {open && (
        <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
          <h4 className="mb-3 font-display text-sm font-bold">发起集运（以客户名义创建，操作记录归属你）</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <AField label="仓库 *">
              <select
                className={inputCls}
                value={form.warehouse}
                onChange={(e) => setForm({ ...form, warehouse: e.target.value })}
              >
                <option className={optionCls} value="">请选择</option>
                {(optsQ.data?.warehouses ?? []).map((w: any) => (
                  <option className={optionCls} key={w.id} value={w.code}>
                    {w.code} · {w.name_zh}
                  </option>
                ))}
              </select>
            </AField>
            <AField label="线路 *">
              <select
                className={inputCls}
                value={form.route_code}
                onChange={(e) => setForm({ ...form, route_code: e.target.value })}
              >
                <option className={optionCls} value="">请选择</option>
                {(optsQ.data?.routes ?? []).map((r: any) => (
                  <option className={optionCls} key={r.id} value={r.code}>
                    {r.code} · {r.name_zh}
                  </option>
                ))}
              </select>
            </AField>
            <AField label="收货地址">
              <select
                className={inputCls}
                value={form.address_id}
                onChange={(e) => setForm({ ...form, address_id: e.target.value })}
              >
                <option className={optionCls} value="">未指定</option>
                {(optsQ.data?.addresses ?? []).map((a: any) => (
                  <option className={optionCls} key={a.id} value={a.id}>
                    {a.recipient} · {a.city} · {a.line1}
                  </option>
                ))}
              </select>
            </AField>
            <AField label="国内快递单号">
              <input
                className={inputCls}
                value={form.domestic_tracking_no}
                onChange={(e) => setForm({ ...form, domestic_tracking_no: e.target.value })}
              />
            </AField>
            <AField label="备注">
              <input
                className={inputCls}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </AField>
            <AField label="购买保险">
              <select
                className={inputCls}
                value={form.insured ? "1" : "0"}
                onChange={(e) => setForm({ ...form, insured: e.target.value === "1" })}
              >
                <option className={optionCls} value="0">否</option>
                <option className={optionCls} value="1">是</option>
              </select>
            </AField>
          </div>

          <div className="mt-4 space-y-3">
            <div className="rounded-md border border-brand/25 bg-brand/5 px-3 py-2 text-xs text-slate-300">
              <span className="font-semibold text-brand">物品信息要求</span>
              <span className="ml-2">{req.hint}</span>
            </div>
            {items.map((it, i) => {
              const upd = (patch: Partial<ItemRow>) =>
                setItems(items.map((x, xi) => (xi === i ? { ...x, ...patch } : x)));
              return (
                <div key={i} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                  <div className="relative mb-2">
                    <div className="flex items-center gap-2">
                      <input
                        className={inputCls}
                        placeholder="SKU / 品名 / HS 编码（模糊搜索客户物品库，自动带出资料）"
                        value={skuTerms[i] ?? ""}
                        onChange={(e) => runSkuSearch(i, e.target.value)}
                        onFocus={() => {
                          if ((skuTerms[i] ?? "").trim()) runSkuSearch(i, skuTerms[i] ?? "");
                        }}
                        onBlur={() => setTimeout(() => setSkuActive((k) => (k === i ? null : k)), 150)}
                      />
                      {skuActive === i && skuLoading && (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />
                      )}
                    </div>
                    {skuActive === i && !skuLoading && skuResults.length > 0 && (
                      <div className="absolute left-0 top-full z-30 mt-1 max-h-56 w-full overflow-auto rounded-md border border-white/10 bg-[#0b1220] shadow-xl">
                        {skuResults.map((row: any) => (
                          <button
                            key={`${row.source}-${row.id}`}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => pickSku(i, row)}
                            className="block w-full truncate px-3 py-2 text-left text-xs text-slate-200 hover:bg-white/10"
                          >
                            {row.sku && <span className="font-mono font-semibold text-cyan-300">{row.sku}</span>}
                            <span className="text-slate-400">
                              {row.sku ? " · " : ""}
                              {row.name}
                              {row.hs_code ? ` · ${row.hs_code}` : ""}
                              {row.unit_price_cny ? ` · ¥${row.unit_price_cny}` : ""}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {skuActive === i && !skuLoading && (skuTerms[i] ?? "").trim() && skuResults.length === 0 && (
                      <div className="absolute left-0 top-full z-30 mt-1 w-full rounded-md border border-white/10 bg-[#0b1220] px-3 py-2 text-xs text-slate-400 shadow-xl">
                        未找到匹配的物品资料，请手动填写
                      </div>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">

                    <input className={inputCls} placeholder="品名 *" value={it.name} onChange={(e) => upd({ name: e.target.value })} />
                    <input
                      className={inputCls}
                      type="number"
                      placeholder="数量 *"
                      value={it.quantity}
                      onChange={(e) => upd({ quantity: Number(e.target.value) })}
                    />
                    <input
                      className={inputCls}
                      type="number"
                      placeholder="单价 CNY *"
                      value={it.unit_price_cny}
                      onChange={(e) => upd({ unit_price_cny: Number(e.target.value) })}
                    />
                    <button
                      onClick={() => setItems(items.filter((_, xi) => xi !== i))}
                      className="rounded-md border border-white/10 px-2 text-slate-400 hover:text-rose-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {(req.fields.includes("weight") ||
                    req.fields.includes("volume") ||
                    req.fields.includes("hs") ||
                    req.fields.includes("material")) && (
                    <div className="mt-2 grid gap-2 sm:grid-cols-4">
                      {req.fields.includes("weight") && (
                        <input
                          className={inputCls}
                          type="number"
                          step="0.01"
                          placeholder="预估重量 kg"
                          value={it.weight_kg}
                          onChange={(e) => upd({ weight_kg: e.target.value === "" ? "" : Number(e.target.value) })}
                        />
                      )}
                      {req.fields.includes("volume") && (
                        <input
                          className={inputCls}
                          type="number"
                          step="0.001"
                          placeholder="预估体积 m³"
                          value={it.volume_m3}
                          onChange={(e) => upd({ volume_m3: e.target.value === "" ? "" : Number(e.target.value) })}
                        />
                      )}
                      {req.fields.includes("hs") && (
                        <input className={inputCls} placeholder="HS 编码" value={it.hs_code} onChange={(e) => upd({ hs_code: e.target.value })} />
                      )}
                      {req.fields.includes("material") && (
                        <input
                          className={inputCls}
                          placeholder="材质/成分 *"
                          value={it.material}
                          onChange={(e) => upd({ material: e.target.value })}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <button
              onClick={() => setItems([...items, { ...emptyItem }])}
              className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10"
            >
              <Plus className="h-3.5 w-3.5" /> 添加物品
            </button>
          </div>


          <button
            onClick={submit}
            disabled={busy}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            提交集运单
          </button>
        </section>
      )}

      <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
        <h4 className="mb-3 font-display text-sm font-bold">集运单（{fwds.length}）</h4>
        {fwds.length === 0 ? (
          <div className="text-xs text-slate-500">暂无集运单</div>
        ) : (
          <ul className="divide-y divide-white/5">
            {fwds.map((f: any) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                <Link
                  to="/admin/forwardings/$forwardingId"
                  params={{ forwardingId: f.id }}
                  className="font-mono text-brand hover:underline"
                >
                  {f.request_no}
                </Link>
                <span className="text-slate-400">{f.route_code ?? f.shipping_method ?? "—"}</span>
                <span className="text-slate-400">{f.status}</span>
                <span className="flex flex-wrap gap-2 text-slate-500">
                  {(f.waybills ?? []).length === 0
                    ? "无运单"
                    : (f.waybills ?? []).map((w: any) => (
                        <Link
                          key={w.id}
                          to="/admin/waybills/$waybillId"
                          params={{ waybillId: w.id }}
                          className="font-mono text-brand hover:underline"
                        >
                          {w.waybill_no}
                        </Link>
                      ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
        <h4 className="mb-3 font-display text-sm font-bold">商城订单（{orders.length}）</h4>
        {orders.length === 0 ? (
          <div className="text-xs text-slate-500">暂无订单</div>
        ) : (
          <ul className="divide-y divide-white/5">
            {orders.map((o: any) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                <Link
                  to="/admin/orders/$orderId"
                  params={{ orderId: o.id }}
                  className="font-mono text-brand hover:underline"
                >
                  {o.order_no}
                </Link>
                <span className="text-slate-400">{o.status}</span>
                <span className="text-slate-400">¥{Number(o.total_cny ?? 0).toFixed(2)}</span>
                <span className="flex flex-wrap gap-2 text-slate-500">
                  {(o.waybills ?? []).length === 0
                    ? "无运单"
                    : (o.waybills ?? []).map((w: any) => (
                        <Link
                          key={w.id}
                          to="/admin/waybills/$waybillId"
                          params={{ waybillId: w.id }}
                          className="font-mono text-brand hover:underline"
                        >
                          {w.waybill_no}
                        </Link>
                      ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

    </div>
  );
}

// ===================== Inventory =====================
function InventoryTab({ userId }: { userId: string }) {
  const fetchList = useServerFn(listCustomerInventory);
  const q = useQuery({
    queryKey: ["admin-customer-inventory", userId],
    queryFn: () => fetchList({ data: { userId } }),
  });
  if (q.isLoading) return <Spinner />;
  const list = q.data?.items ?? [];
  return (
    <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
      <h3 className="font-display text-base font-bold">我的库存（{list.length} 箱在仓储）</h3>
      <p className="mt-1 text-xs text-slate-400">来源：状态为「仓储」的运单，可在运单管理中调整状态或安排发货。</p>
      {list.length === 0 ? (
        <div className="mt-3 text-xs text-slate-500">该客户暂无仓储中的货物</div>
      ) : (
        <ul className="mt-3 divide-y divide-white/5">
          {list.map((w: any) => (
            <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
              <Link
                to="/admin/waybills/$waybillId"
                params={{ waybillId: w.id }}
                className="font-mono text-brand hover:underline"
              >
                {w.waybill_no}
              </Link>
              <span className="text-slate-400">{w.items_summary ?? "—"}</span>
              <span className="text-slate-500">{w.warehouse ?? "—"}</span>
              <span className="text-slate-500">{Number(w.weight_kg ?? 0).toFixed(2)} kg</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ===================== Addresses =====================
function AddressesTab({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const fetchList = useServerFn(listCustomerAddresses);
  const save = useServerFn(saveCustomerAddress);
  const doDelete = useServerFn(deleteCustomerAddress);
  const q = useQuery({
    queryKey: ["admin-customer-addresses", userId],
    queryFn: () => fetchList({ data: { userId } }),
  });
  const [editing, setEditing] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-customer-addresses", userId] });

  const onSave = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await save({ data: { userId, address: editing } });
      setEditing(null);
      refresh();
    } catch (e: any) {
      alert(e?.message ?? "保存失败");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("确定删除该地址？")) return;
    await doDelete({ data: { userId, addressId: id } });
    refresh();
  };

  if (q.isLoading) return <Spinner />;
  const list = q.data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-bold">收货地址（{list.length}）</h3>
        <button
          onClick={() => setEditing({ country: "CA" })}
          className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand/90"
        >
          <Plus className="h-3.5 w-3.5" /> 新增地址
        </button>
      </div>

      {editing && (
        <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <AField label="收件人">
              <input
                className={inputCls}
                value={editing.recipient ?? ""}
                onChange={(e) => setEditing({ ...editing, recipient: e.target.value })}
              />
            </AField>
            <AField label="电话">
              <input
                className={inputCls}
                value={editing.phone ?? ""}
                onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
              />
            </AField>
            <AField label="地址行1">
              <input
                className={inputCls}
                value={editing.line1 ?? ""}
                onChange={(e) => setEditing({ ...editing, line1: e.target.value })}
              />
            </AField>
            <AField label="地址行2">
              <input
                className={inputCls}
                value={editing.line2 ?? ""}
                onChange={(e) => setEditing({ ...editing, line2: e.target.value })}
              />
            </AField>
            <AField label="城市">
              <input
                className={inputCls}
                value={editing.city ?? ""}
                onChange={(e) => setEditing({ ...editing, city: e.target.value })}
              />
            </AField>
            <AField label="省份">
              <input
                className={inputCls}
                value={editing.province ?? ""}
                onChange={(e) => setEditing({ ...editing, province: e.target.value })}
              />
            </AField>
            <AField label="邮编">
              <input
                className={inputCls}
                value={editing.postal_code ?? ""}
                onChange={(e) => setEditing({ ...editing, postal_code: e.target.value })}
              />
            </AField>
            <AField label="默认地址">
              <label className="flex h-9 items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={!!editing.is_default}
                  onChange={(e) => setEditing({ ...editing, is_default: e.target.checked })}
                />
                设为默认
              </label>
            </AField>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={onSave}
              disabled={busy}
              className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "保存"}
            </button>
            <button
              onClick={() => setEditing(null)}
              className="rounded-md border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
            >
              取消
            </button>
          </div>
        </section>
      )}

      {list.length === 0 && !editing ? (
        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-6 text-center text-sm text-slate-500">
          还没有地址
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((a: any) => (
            <div key={a.id} className="relative rounded-2xl border border-white/5 bg-white/[0.03] p-4 text-sm">
              <div className="flex items-center gap-2 font-semibold text-slate-100">
                {a.recipient}
                {a.is_default && (
                  <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-semibold text-brand">
                    默认
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-400">{a.phone}</p>
              <p className="mt-2 text-slate-300">
                {a.line1}
                {a.line2 ? `, ${a.line2}` : ""}
              </p>
              <p className="text-xs text-slate-400">
                {a.city}, {a.province} {a.postal_code} · {a.country}
              </p>
              <div className="absolute right-3 top-3 flex gap-1">
                <button
                  onClick={() => setEditing(a)}
                  className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-white/10"
                >
                  编辑
                </button>
                <button
                  onClick={() => onDelete(a.id)}
                  className="grid h-7 w-7 place-items-center rounded-full text-slate-400 hover:bg-rose-500/10 hover:text-rose-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===================== My Items (SKU library) =====================
function ItemsTab({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const fetchList = useServerFn(listCustomerItems);
  const save = useServerFn(saveCustomerItem);
  const doDelete = useServerFn(deleteCustomerItem);
  const q = useQuery({
    queryKey: ["admin-customer-items", userId],
    queryFn: () => fetchList({ data: { userId } }),
  });
  const [editing, setEditing] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-customer-items", userId] });

  const onSave = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await save({ data: { userId, ...editing } });
      setEditing(null);
      refresh();
    } catch (e: any) {
      alert(e?.message ?? "保存失败");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("确定删除该物品？")) return;
    await doDelete({ data: { userId, itemId: id } });
    refresh();
  };

  if (q.isLoading) return <Spinner />;
  const list = q.data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-bold">我的物品 / SKU 库（{list.length}）</h3>
        <button
          onClick={() => setEditing({ name: "", hs_code: "", sku: "", declared_value_cad: 0, inner_qty: null })}
          className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand/90"
        >
          <Plus className="h-3.5 w-3.5" /> 新增物品
        </button>
      </div>
      <p className="text-xs text-slate-500">
        这里维护的是集运申请「内件清单」里 SKU 模糊搜索会匹配到的资料（品名 / HSCODE / 单价 / 内件数）。
      </p>

      {editing && (
        <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <AField label="SKU">
              <input
                className={inputCls}
                value={editing.sku ?? ""}
                onChange={(e) => setEditing({ ...editing, sku: e.target.value })}
              />
            </AField>
            <AField label="品名 *">
              <input
                className={inputCls}
                value={editing.name ?? ""}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </AField>
            <AField label="HS 编码 *">
              <input
                className={inputCls}
                value={editing.hs_code ?? ""}
                onChange={(e) => setEditing({ ...editing, hs_code: e.target.value })}
              />
            </AField>
            <AField label="单价 CAD">
              <input
                type="number"
                className={inputCls}
                value={editing.declared_value_cad ?? 0}
                onChange={(e) => setEditing({ ...editing, declared_value_cad: Number(e.target.value) || 0 })}
              />
            </AField>
            <AField label="内件数">
              <input
                type="number"
                className={inputCls}
                value={editing.inner_qty ?? ""}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    inner_qty: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </AField>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={onSave}
              disabled={busy}
              className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "保存"}
            </button>
            <button
              onClick={() => setEditing(null)}
              className="rounded-md border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
            >
              取消
            </button>
          </div>
        </section>
      )}

      {list.length === 0 && !editing ? (
        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-6 text-center text-sm text-slate-500">
          还没有物品资料
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/5 bg-white/[0.02]">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">品名</th>
                <th className="px-3 py-2">HS 编码</th>
                <th className="px-3 py-2 text-right">单价 CAD</th>
                <th className="px-3 py-2 text-right">内件数</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((r: any) => (
                <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                  <td className="px-3 py-2 font-mono text-slate-300">{r.sku ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-100">{r.name}</td>
                  <td className="px-3 py-2 font-mono text-cyan-300">{r.hs_code}</td>
                  <td className="px-3 py-2 text-right text-slate-300">
                    ${Number(r.declared_value_cad ?? 0).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-300">{r.inner_qty ?? "—"}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => setEditing(r)}
                      className="rounded px-2 py-1 text-slate-300 hover:bg-white/10"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => onDelete(r.id)}
                      className="ml-1 rounded px-2 py-1 text-rose-300 hover:bg-rose-500/10"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ===================== Shared bits =====================
const optionCls = "bg-[#0b1220] text-slate-100";
const inputCls =
  "h-9 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-slate-100 outline-none focus:border-brand";

function AField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      {children}
    </label>
  );
}

function Spinner() {
  return (
    <div className="grid h-40 place-items-center">
      <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
    </div>
  );
}

// 个人资料：全部字段只读（锁定），仅允许一键重置登录密码为 123456
function ProfileTab({ userId }: { userId: string }) {
  const load = useServerFn(getCustomerAccountInfo);
  const reset = useServerFn(resetCustomerPassword);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin-cv-account", userId],
    queryFn: () => load({ data: { userId } }),
  });

  if (q.isLoading) {
    return (
      <div className="grid h-32 place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      </div>
    );
  }
  const d: any = q.data ?? {};
  const wechatBound = !!d.wechat_openid;

  const Row = ({ icon, label, value, extra }: { icon: React.ReactNode; label: string; value: React.ReactNode; extra?: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-4 border-b border-white/5 px-4 py-3 last:border-0">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        {icon}
        {label}
      </div>
      <div className="flex items-center gap-3">
        <div className="text-sm font-medium text-slate-200">{value}</div>
        {extra ?? <Lock className="h-3.5 w-3.5 text-slate-600" />}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/5 bg-white/[0.03]">
        <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3 text-sm font-semibold">
          <UserIcon className="h-4 w-4 text-brand" />
          个人资料（只读）
        </div>
        <Row icon={<Hash className="h-4 w-4" />} label="客户号" value={d.customer_code || "—"} />
        <Row icon={<UserIcon className="h-4 w-4" />} label="登录名" value={d.username || "—"} />
        <Row icon={<Mail className="h-4 w-4" />} label="登录邮箱" value={d.email || "—"} />
        <Row
          icon={<MessageCircle className="h-4 w-4" />}
          label="微信绑定"
          value={
            wechatBound ? (
              <span className="text-emerald-400">已绑定{d.wechat_nickname ? `（${d.wechat_nickname}）` : ""}</span>
            ) : (
              <span className="text-slate-500">未绑定</span>
            )
          }
        />
        <Row icon={<Phone className="h-4 w-4" />} label="手机号" value={d.phone || "—"} />
      </div>

      <div className="rounded-2xl border border-white/5 bg-white/[0.03]">
        <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3 text-sm font-semibold">
          <KeyRound className="h-4 w-4 text-brand" />
          登录密码
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <div className="font-mono text-lg tracking-widest text-slate-300">••••••••</div>
            <p className="mt-1 text-xs text-slate-500">密码已加密存储，无法查看。可一键重置为默认密码 123456。</p>
          </div>
          <button
            disabled={busy}
            onClick={async () => {
              if (!confirm("确认将该客户的登录密码重置为 123456？")) return;
              setBusy(true);
              setMsg(null);
              try {
                await reset({ data: { userId } });
                setMsg("已重置为 123456");
              } catch (e: any) {
                setMsg(e?.message ?? "重置失败");
              } finally {
                setBusy(false);
              }
            }}
            className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            重置为 123456
          </button>
        </div>
        {msg && <div className="border-t border-white/5 px-4 py-2 text-xs text-slate-300">{msg}</div>}
      </div>
    </div>
  );
}
