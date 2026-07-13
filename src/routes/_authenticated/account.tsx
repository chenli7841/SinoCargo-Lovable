import React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useApp } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { rechargeWallet } from "@/lib/wallet.functions";
import { toast } from "sonner";
import { TrackingTimeline } from "@/components/tracking-timeline";
import {
  User, MapPin, Package, Truck, Wallet, LogOut, Plus, Trash2, Loader2,
  ArrowRight, ArrowDownCircle, ArrowUpCircle, LayoutDashboard, ShoppingBag,
  Layers, Plane, Ship, Calendar, CreditCard, CheckCircle2, ShoppingCart, Warehouse, Send, Tags,
} from "lucide-react";


export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ title: "我的账户 / My Account — SinoCargo" }] }),
  validateSearch: (s: Record<string, unknown>) => {
    const raw = typeof s.tab === "string" ? s.tab : "";
    const allowed = ["overview","profile","addresses","batches","myOrders","wallet","inventory","myItems"] as const;
    const tab = (allowed as readonly string[]).includes(raw) ? (raw as (typeof allowed)[number]) : undefined;
    return { tab };
  },
  component: AccountPage,
});

type Tab = "overview" | "profile" | "addresses" | "batches" | "myOrders" | "wallet" | "inventory" | "myItems";


const sb = supabase as any;

interface Profile {
  id: string; email: string | null; full_name: string | null; phone: string | null;
  username: string | null;
  preferred_lang: string; preferred_currency: string;
}
interface Address {
  id: string; recipient: string; phone: string; line1: string; line2: string | null;
  city: string; province: string; postal_code: string; country: string; is_default: boolean;
  destination_code: string | null;
}
interface Destination { code: string; name_zh: string; name_en: string | null; country: string }
interface WalletRow { user_id: string; balance_cad: number }
interface WalletTx {
  id: string; type: string; amount_cad: number; amount_cny: number | null;
  status: string; channel: string | null; note: string | null; created_at: string;
}

function AccountPage() {
  const { user, signOut } = useAuth();
  const { lang } = useApp();
  const search = Route.useSearch();
  const [tab, setTab] = useState<Tab>(search.tab ?? "overview");
  useEffect(() => { if (search.tab) setTab(search.tab as Tab); }, [search.tab]);
  const [ordersFilter, setOrdersFilter] = useState<"all" | "order" | "forwarding" | "unwarehoused">("all");
  const tr = (zh: string, en: string) => (lang === "zh" ? zh : en);

  const nav: { k: Tab; l: string; i: React.ReactNode }[] = [
    { k: "overview", l: tr("概览", "Overview"), i: <LayoutDashboard className="h-4 w-4" /> },
    { k: "myOrders", l: tr("我的订单/运单", "My orders/waybills"), i: <Package className="h-4 w-4" /> },
    { k: "inventory", l: tr("我的库存", "My inventory"), i: <Warehouse className="h-4 w-4" /> },
    { k: "myItems", l: tr("我的物品", "My items"), i: <Tags className="h-4 w-4" /> },
    { k: "batches", l: tr("我的批次", "My batches"), i: <Layers className="h-4 w-4" /> },
    { k: "wallet", l: tr("我的钱包", "Wallet"), i: <Wallet className="h-4 w-4" /> },
    { k: "addresses", l: tr("收货地址", "Addresses"), i: <MapPin className="h-4 w-4" /> },
    { k: "profile", l: tr("个人资料", "Profile"), i: <User className="h-4 w-4" /> },
  ];


  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
      <div className="mb-8 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">{tr("我的账户", "My Account")}</h1>
          <p className="mt-1 text-sm text-ink-soft">{user?.email}</p>
        </div>
        <button onClick={signOut} className="inline-flex items-center gap-2 self-start rounded-full border border-border bg-surface px-4 py-2 text-sm hover:border-destructive hover:text-destructive sm:self-end">
          <LogOut className="h-4 w-4" />{tr("退出登录", "Sign out")}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="flex gap-2 overflow-x-auto lg:flex-col">
          {nav.map((it) => (
            <button
              key={it.k} onClick={() => setTab(it.k)}
              className={`flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${tab === it.k ? "border-brand bg-brand/5 text-brand" : "border-border bg-surface text-ink-soft hover:border-brand/40"}`}
            >{it.i}{it.l}</button>
          ))}
        </nav>

        <section>
          {tab === "overview" && <OverviewTab onJump={setTab} setOrdersFilter={setOrdersFilter} />}
          {tab === "profile" && <ProfileTab />}
          {tab === "addresses" && <AddressTab />}
          {tab === "batches" && <BatchesTab onJump={setTab} />}
          {tab === "myOrders" && <MyOrdersTab initialFilter={ordersFilter} />}
          {tab === "inventory" && <InventoryTab />}
          {tab === "myItems" && <MyItemsTab />}
          {tab === "wallet" && <WalletTab />}
        </section>

      </div>
    </div>
  );
}

// ===================== Overview =====================
interface UnpaidBatch { batch_no: string; total_cny: number; shipping_method: string }

function OverviewTab({ onJump, setOrdersFilter }: { onJump: (t: Tab) => void; setOrdersFilter: (f: OrderFilter) => void }) {
  const { lang, cnyToCad } = useApp();
  const tr = (zh: string, en: string) => (lang === "zh" ? zh : en);
  const [wallet, setWallet] = useState<WalletRow | null>(null);
  const [customerCode, setCustomerCode] = useState<string | null>(null);
  const [totalOrders, setTotalOrders] = useState<number | null>(null);
  const [inTransit, setInTransit] = useState<number>(0);
  const [unwarehoused, setUnwarehoused] = useState<number>(0);
  const [batchCount, setBatchCount] = useState<number>(0);
  const [unpaidBatches, setUnpaidBatches] = useState<UnpaidBatch[]>([]);

  useEffect(() => {
    sb.from("wallets").select("*").maybeSingle().then(({ data }: any) => setWallet(data ?? { balance_cad: 0 }));
    sb.from("profiles").select("customer_code").maybeSingle().then(({ data }: any) => setCustomerCode(data?.customer_code ?? null));
    sb.rpc("unpaid_batches_summary").then(({ data }: any) => setUnpaidBatches((data ?? []).map((r: any) => ({ ...r, total_cny: Number(r.total_cny ?? 0) }))));
    Promise.all([
      sb.from("orders").select("id,status,batch_no"),
      sb.from("forwarding_orders").select("id,status,batch_no"),
    ]).then(([o, f]: any) => {
      const oRows = o.data ?? [];
      const fRows = f.data ?? [];
      setTotalOrders(oRows.length + fRows.length);
      const transit =
        oRows.filter((r: any) => r.status === "shipped").length +
        fRows.filter((r: any) => ["shipped", "in_transit"].includes(r.status)).length;
      setInTransit(transit);
      setUnwarehoused(fRows.filter((r: any) => r.status === "pending").length);
      const batches = new Set<string>();
      [...oRows, ...fRows].forEach((r: any) => { if (r.batch_no) batches.add(r.batch_no); });
      setBatchCount(batches.size);
    });
  }, []);

  const unpaidTotalCny = unpaidBatches.reduce((s, b) => s + b.total_cny, 0);
  const unpaidTotalCad = cnyToCad(unpaidTotalCny);

  return (
    <div className="space-y-6">
      {customerCode && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/30 bg-brand/5 p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-brand text-white"><User className="h-5 w-5" /></span>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-ink-soft">{tr("个人账户编号", "Personal account number")}</div>
              <div className="font-display text-xl font-bold tracking-widest text-brand">{customerCode}</div>
            </div>
          </div>
          <button
            onClick={() => { navigator.clipboard?.writeText(customerCode); toast.success(tr("已复制", "Copied")); }}
            className="rounded-full border border-brand/40 px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand hover:text-white"
          >
            {tr("复制编号", "Copy")}
          </button>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={tr("钱包余额", "Wallet balance")}
          value={wallet ? `CA$${Number(wallet.balance_cad ?? 0).toFixed(2)}` : "—"}
          sub={unpaidTotalCad > 0 ? tr(`未付款 CA$${unpaidTotalCad.toFixed(2)} · ${unpaidBatches.length} 个批次`, `Unpaid CA$${unpaidTotalCad.toFixed(2)} · ${unpaidBatches.length} batch(es)`) : tr("无未付款", "Nothing due")}
          icon={<Wallet className="h-5 w-5" />} tone="brand"
          action={
            <div className="flex items-center justify-between gap-2">
              <button onClick={() => onJump("wallet")} className="text-xs font-medium text-brand hover:underline">{tr("充值 →", "Top up →")}</button>
              {unpaidTotalCad > 0 && (
                <button onClick={() => onJump("batches")} className="text-xs font-medium text-cta hover:underline">{tr("去付款 →", "Pay now →")}</button>
              )}
            </div>
          }
        />
        <StatCard
          label={tr("我的订单/运单", "My orders/waybills")}
          value={totalOrders === null ? "—" : String(totalOrders)}
          sub={inTransit > 0 ? tr(`${inTransit} 件运输中`, `${inTransit} in transit`) : ""}
          icon={<Package className="h-5 w-5" />}
          action={<button onClick={() => onJump("myOrders")} className="text-xs font-medium text-brand hover:underline">{tr("查看 →", "View →")}</button>}
        />
        <StatCard
          label={tr("未入库订单", "Awaiting arrival")}
          value={String(unwarehoused)}
          sub={tr("集运待入库", "Forwarding pending")}
          icon={<Truck className="h-5 w-5" />}
          action={<button onClick={() => { setOrdersFilter("unwarehoused"); onJump("myOrders"); }} className="text-xs font-medium text-brand hover:underline">{tr("处理 →", "Manage →")}</button>}
        />
        <StatCard
          label={tr("我的批次", "My batches")}
          value={String(batchCount)}
          sub={tr("发货批次数量", "Shipping batches")}
          icon={<Layers className="h-5 w-5" />}
          action={<button onClick={() => onJump("batches")} className="text-xs font-medium text-brand hover:underline">{tr("查看批次 →", "View batches →")}</button>}
        />
      </div>

      {unpaidBatches.length > 0 && (
        <div className="rounded-2xl border border-warning/30 bg-warning/5 p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 font-display text-sm font-bold">
              <CreditCard className="h-4 w-4 text-warning" />{tr("待付批次明细", "Unpaid batches")}
            </div>
            <button onClick={() => onJump("batches")} className="text-xs font-medium text-brand hover:underline">{tr("前往结算 →", "Settle →")}</button>
          </div>
          <ul className="space-y-2">
            {unpaidBatches.map((b) => (
              <li key={b.batch_no} className="flex flex-wrap items-center gap-3 rounded-xl bg-surface px-3 py-2 text-sm">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-brand/10 text-brand">
                  {b.shipping_method === "air" ? <Plane className="h-3 w-3" /> : <Ship className="h-3 w-3" />}
                </span>
                <span className="font-mono text-xs font-semibold">{b.batch_no}</span>
                <span className="ml-auto font-display text-base font-bold text-foreground">CA${cnyToCad(b.total_cny).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}



      <div className="grid gap-4 sm:grid-cols-3">
        <Link to="/forwarding" className="group flex items-center justify-between rounded-2xl border border-border bg-surface p-5 transition hover:border-brand">
          <div>
            <div className="flex items-center gap-2 font-semibold"><Plus className="h-4 w-4 text-brand" />{tr("发起新集运", "New forwarding request")}</div>
            <p className="mt-1 text-xs text-ink-soft">{tr("提交国内快递单号，到仓后短信通知", "Submit domestic tracking numbers, get SMS updates")}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-ink-soft transition group-hover:translate-x-1 group-hover:text-brand" />
        </Link>
        <Link to="/invoices" className="group flex items-center justify-between rounded-2xl border border-border bg-surface p-5 transition hover:border-brand">
          <div>
            <div className="flex items-center gap-2 font-semibold"><Package className="h-4 w-4 text-brand" />{tr("我的账单", "My invoices")}</div>
            <p className="mt-1 text-xs text-ink-soft">{tr("查看待付/已付账单并在线支付", "View and pay invoices online")}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-ink-soft transition group-hover:translate-x-1 group-hover:text-brand" />
        </Link>
        <Link to="/products" className="group flex items-center justify-between rounded-2xl border border-border bg-surface p-5 transition hover:border-brand">
          <div>
            <div className="flex items-center gap-2 font-semibold"><ShoppingBag className="h-4 w-4 text-brand" />{tr("继续购物", "Continue shopping")}</div>
            <p className="mt-1 text-xs text-ink-soft">{tr("浏览自营商城精选商品", "Browse curated products")}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-ink-soft transition group-hover:translate-x-1 group-hover:text-brand" />
        </Link>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, icon, action, tone }: { label: string; value: string; sub?: string; icon: React.ReactNode; action?: React.ReactNode; tone?: "brand" }) {
  return (
    <div className={`rounded-2xl border p-5 ${tone === "brand" ? "border-brand/30 bg-brand/5" : "border-border bg-surface"}`}>
      <div className="flex items-center justify-between text-ink-soft">
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
        <span className={tone === "brand" ? "text-brand" : ""}>{icon}</span>
      </div>
      <div className="mt-2 font-display text-2xl font-bold">{value}</div>
      {sub && <div className="mt-1 text-xs text-ink-soft">{sub}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

// ===================== Profile =====================
function ProfileTab() {
  const { lang } = useApp();
  const tr = (zh: string, en: string) => (lang === "zh" ? zh : en);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const initialUsername = useRef<string | null>(null);

  useEffect(() => {
    sb.from("profiles").select("*").maybeSingle().then(({ data }: any) => {
      setProfile(data);
      initialUsername.current = data?.username ?? null;
    });
  }, []);
  if (!profile) return <Spinner />;

  const save = async () => {
    const p: any = profile;
    const username = (p.username ?? "").trim();
    if (!username) return toast.error(tr("登录名不能为空", "Login name is required"));

    setBusy(true);
    if (username.toLowerCase() !== (initialUsername.current ?? "").toLowerCase()) {
      const { data: available, error: checkErr } = await sb.rpc("check_username_available", { p_username: username });
      if (checkErr) { toast.error(checkErr.message); setBusy(false); return; }
      if (!available) { toast.error(tr("登录名已被占用", "Login name is already taken")); setBusy(false); return; }
    }

    const { error } = await sb.from("profiles").update({
      full_name: p.full_name, phone: p.phone, username,
      preferred_lang: p.preferred_lang,
      reg_country: p.reg_country ?? null,
      reg_province: p.reg_province ?? null,
      reg_city: p.reg_city ?? null,
      reg_address: p.reg_address ?? null,
      reg_postal_code: p.reg_postal_code ?? null,
      reg_phone: p.reg_phone ?? null,
    }).eq("id", profile.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    initialUsername.current = username;
    toast.success(tr("已保存", "Saved"));
  };

  const p: any = profile;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="mb-4 font-display text-xl font-bold">{tr("个人资料", "Profile")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tr("邮箱", "Email")}><input disabled value={profile.email ?? ""} className={inputCls + " opacity-60"} /></Field>
          <Field label={tr("登录名", "Login name")}>
            <input
              value={profile.username ?? ""}
              onChange={(e) => setProfile({ ...profile, username: e.target.value.replace(/\s+/g, "") })}
              className={inputCls}
            />
          </Field>
          <Field label={tr("姓名", "Full name")}><input value={profile.full_name ?? ""} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} className={inputCls} /></Field>
          <Field label={tr("手机号", "Phone")}><input value={profile.phone ?? ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} className={inputCls} /></Field>
          <Field label={tr("偏好语言", "Preferred language")}>
            <select value={profile.preferred_lang} onChange={(e) => setProfile({ ...profile, preferred_lang: e.target.value })} className={inputCls}>
              <option value="zh">中文</option><option value="en">English</option>
            </select>
          </Field>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="mb-1 font-display text-xl font-bold">{tr("注册地址", "Registered address")}</h2>
        <p className="mb-4 text-xs text-ink-soft">{tr("用于集运单详情展示，可与收件地址不同。", "Shown on forwarding details — can differ from shipping address.")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tr("国家", "Country")}><input value={p.reg_country ?? ""} onChange={(e) => setProfile({ ...profile, reg_country: e.target.value } as any)} className={inputCls} /></Field>
          <Field label={tr("省 / 州", "Province / State")}><input value={p.reg_province ?? ""} onChange={(e) => setProfile({ ...profile, reg_province: e.target.value } as any)} className={inputCls} /></Field>
          <Field label={tr("城市", "City")}><input value={p.reg_city ?? ""} onChange={(e) => setProfile({ ...profile, reg_city: e.target.value } as any)} className={inputCls} /></Field>
          <Field label={tr("邮编", "Postal code")}><input value={p.reg_postal_code ?? ""} onChange={(e) => setProfile({ ...profile, reg_postal_code: e.target.value } as any)} className={inputCls} /></Field>
          <Field label={tr("详细地址", "Address")} full><input value={p.reg_address ?? ""} onChange={(e) => setProfile({ ...profile, reg_address: e.target.value } as any)} className={inputCls} /></Field>
          <Field label={tr("联系电话", "Contact phone")}><input value={p.reg_phone ?? ""} onChange={(e) => setProfile({ ...profile, reg_phone: e.target.value } as any)} className={inputCls} /></Field>
        </div>
      </div>

      <button onClick={save} disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-cta-gradient px-6 py-2.5 text-sm font-semibold text-cta-foreground shadow-elevated transition hover:brightness-110 disabled:opacity-50">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}{tr("保存修改", "Save changes")}
      </button>
    </div>
  );
}

// ===================== Addresses =====================
function AddressTab() {
  const { lang } = useApp();
  const tr = (zh: string, en: string) => (lang === "zh" ? zh : en);
  const [list, setList] = useState<Address[]>([]);
  const [editing, setEditing] = useState<Partial<Address> | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const isNew = editing && !editing.id;

  const load = () => sb.from("addresses").select("*").order("is_default", { ascending: false }).then(({ data }: any) => setList(data ?? []));
  useEffect(() => {
    load();
    sb.from("destinations").select("code,name_zh,name_en,country").eq("active", true).order("sort_order").then(({ data }: any) => setDestinations(data ?? []));
  }, []);

  const save = async () => {
    if (!editing) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (editing.is_default) await sb.from("addresses").update({ is_default: false }).eq("user_id", user.id);
    const payload = { ...editing, user_id: user.id };
    const { error } = editing.id
      ? await sb.from("addresses").update(payload).eq("id", editing.id)
      : await sb.from("addresses").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(tr("地址已保存", "Address saved"));
    setEditing(null); load();
  };
  const del = async (id: string) => {
    if (!confirm(tr("确定删除？", "Delete this address?"))) return;
    await sb.from("addresses").delete().eq("id", id); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">{tr("收货地址", "Shipping addresses")}</h2>
        <button onClick={() => setEditing({ country: "CA" })} className="inline-flex items-center gap-1 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background">
          <Plus className="h-3.5 w-3.5" />{tr("新增地址", "Add address")}
        </button>
      </div>

      {editing && (
        <div className="rounded-2xl border border-border bg-surface p-6">
          <div className="mb-3 text-sm font-semibold">{isNew ? tr("新增地址", "New address") : tr("编辑地址", "Edit address")}</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={tr("收件人", "Recipient")}><input className={inputCls} value={editing.recipient ?? ""} onChange={(e) => setEditing({ ...editing, recipient: e.target.value })} /></Field>
            <Field label={tr("电话", "Phone")}><input className={inputCls} value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></Field>
            <Field label={tr("地址行1", "Address line 1")} full><input className={inputCls} value={editing.line1 ?? ""} onChange={(e) => setEditing({ ...editing, line1: e.target.value })} /></Field>
            <Field label={tr("地址行2 (可选)", "Address line 2")} full><input className={inputCls} value={editing.line2 ?? ""} onChange={(e) => setEditing({ ...editing, line2: e.target.value })} /></Field>
            <Field label={tr("城市", "City")}><input className={inputCls} value={editing.city ?? ""} onChange={(e) => setEditing({ ...editing, city: e.target.value })} /></Field>
            <Field label={tr("省份", "Province")}><input className={inputCls} value={editing.province ?? ""} onChange={(e) => setEditing({ ...editing, province: e.target.value })} placeholder="ON / BC / AB" /></Field>
            <Field label={tr("邮编", "Postal code")}><input className={inputCls} value={editing.postal_code ?? ""} onChange={(e) => setEditing({ ...editing, postal_code: e.target.value })} placeholder="M5V 3L9" /></Field>
            <Field label={tr("目的地", "Destination")}>
              <select className={inputCls} value={editing.destination_code ?? ""} onChange={(e) => setEditing({ ...editing, destination_code: e.target.value || null })}>
                <option value="">{tr("— 选择目的地 —", "— Select destination —")}</option>
                {destinations.map((d) => (
                  <option key={d.code} value={d.code}>{(lang === "zh" ? d.name_zh : (d.name_en ?? d.name_zh))} ({d.code})</option>
                ))}
              </select>
            </Field>
            <Field label={tr("默认地址", "Default")}>
              <label className="flex h-11 items-center gap-2 px-1 text-sm"><input type="checkbox" checked={!!editing.is_default} onChange={(e) => setEditing({ ...editing, is_default: e.target.checked })} />{tr("设为默认", "Set as default")}</label>
            </Field>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={save} className="rounded-full bg-cta-gradient px-5 py-2 text-sm font-semibold text-cta-foreground">{tr("保存", "Save")}</button>
            <button onClick={() => setEditing(null)} className="rounded-full border border-border px-5 py-2 text-sm">{tr("取消", "Cancel")}</button>
          </div>
        </div>
      )}

      {list.length === 0 && !editing ? (
        <Empty icon={<MapPin />} text={tr("还没有地址，点击右上角添加一个", "No addresses yet — add one to get started")} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((a) => (
            <div key={a.id} className="relative rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-center gap-2 font-semibold">
                {a.recipient}
                {a.is_default && <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">{tr("默认", "Default")}</span>}
              </div>
              <p className="mt-1 text-sm text-ink-soft">{a.phone}</p>
              <p className="mt-2 text-sm">{a.line1}{a.line2 ? `, ${a.line2}` : ""}</p>
              <p className="text-sm text-ink-soft">{a.city}, {a.province} {a.postal_code} · {a.country}</p>
              {a.destination_code && (() => {
                const d = destinations.find((x) => x.code === a.destination_code);
                return (
                  <p className="mt-2 text-sm">
                    <span className="text-ink-soft">{tr("目的地", "Destination")}: </span>
                    <span className="font-bold">{d ? `${lang === "zh" ? d.name_zh : (d.name_en ?? d.name_zh)} (${d.code})` : a.destination_code}</span>
                  </p>
                );
              })()}
              <div className="absolute right-3 top-3 flex gap-1">
                <button onClick={() => setEditing(a)} className="rounded-full px-2 py-1 text-xs text-ink-soft hover:bg-accent">{tr("编辑", "Edit")}</button>
                <button onClick={() => del(a.id)} className="grid h-7 w-7 place-items-center rounded-full text-ink-soft hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===================== Batches (merged: orders + forwarding) =====================
interface BatchItem {
  kind: "order" | "forwarding";
  id: string;
  no: string;
  status: string;
  fee_cny: number;
  tracking_no: string | null;
  payment_status: string;
  extra?: string;
  route_id: string | null;
  weight_kg: number;
}
interface LastMileBlock {
  route_id: string;
  route_code: string;
  threshold_kg: number;
  fee_cad: number;
  sum_weight_kg: number;
  triggered: boolean;
  gap_kg: number;
}
interface StorageBlock {
  warehouse_code: string;
  warehouse_name: string;
  cbm_real: number;
  cbm_charged: number;
  fee_per_cbm_day: number;
  free_days: number;
  max_days_charged: number;
  fee_cad: number;
  storage_status_count: number;
}
interface Batch {
  batch_no: string | null;
  shipping_method: string | null;
  eta: string | null;
  items: BatchItem[];
  total_unpaid_cny: number;
  total_cny: number;
  all_paid: boolean;
  intl_tracking_nos: string[];
  batch_status: "shipping" | "awaiting_delivery" | "awaiting_pickup" | "completed";
  last_mile_blocks: LastMileBlock[];
  storage_blocks: StorageBlock[];
  storage_total_cad: number;
  grand_total_cny: number; // 后台锁定后写入的最终结算金额
  batch_locked: boolean;   // 后台是否已锁定（决定是否显示 grand_total_cny）
}

const STATUS_RANK: Record<string, number> = {
  pending: 1, received: 2, packed: 3, shipped: 4, in_transit: 5, ready_pickup: 6, delivered: 7,
};
function computeBatchStatus(statuses: string[]): Batch["batch_status"] {
  const ranks = statuses.filter((s) => s !== "cancelled").map((s) => STATUS_RANK[s] ?? 1);
  if (ranks.length === 0) return "shipping";
  const min = Math.min(...ranks);
  if (min >= 7) return "completed";
  if (min >= 6) return "awaiting_pickup";
  if (min >= 5) return "awaiting_delivery";
  return "shipping";
}

function BatchesTab({ onJump }: { onJump: (t: Tab) => void }) {
  const { lang } = useApp();
  const tr = (zh: string, en: string) => (lang === "zh" ? zh : en);
  const navigate = useNavigate();
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [paying, setPaying] = useState<string | null>(null);

  const load = async () => {
    const [{ data: o }, { data: f }, { data: wb }, { data: routes }, { data: whs }] = await Promise.all([
      sb.from("orders").select("id,order_no,status,total_cny,shipping_method,tracking_no,batch_no,eta,payment_status,created_at,route_id,freight_snapshot").order("created_at", { ascending: false }),
      sb.from("forwarding_orders").select("id,request_no,status,fee_cny,weight_kg,warehouse,shipping_method,tracking_no,batch_no,eta,payment_status,created_at,route_id,intake_at,length_cm,width_cm,height_cm").order("created_at", { ascending: false }),
      sb.from("waybills").select("order_id,forwarding_id,intl_tracking_no,status"),
      sb.from("shipping_routes").select("id,code,last_mile_fee_cad,last_mile_threshold_kg"),
      sb.from("warehouses").select("code,name_zh,storage_fee_cad_per_cbm_day,storage_free_days"),
    ]);

    const routeMap = new Map<string, { code: string; fee_cad: number; threshold_kg: number }>();
    (routes ?? []).forEach((r: any) => routeMap.set(r.id, {
      code: r.code,
      fee_cad: Number(r.last_mile_fee_cad ?? 0),
      threshold_kg: Number(r.last_mile_threshold_kg ?? 0),
    }));
    const whMap = new Map<string, { name: string; fee_per_cbm_day: number; free_days: number }>();
    (whs ?? []).forEach((w: any) => whMap.set(w.code, {
      name: w.name_zh,
      fee_per_cbm_day: Number(w.storage_fee_cad_per_cbm_day ?? 0),
      free_days: Number(w.storage_free_days ?? 0),
    }));

    const orderTracks = new Map<string, string[]>();
    const fwdTracks = new Map<string, string[]>();
    const orderWbStatus = new Map<string, string[]>();
    const fwdWbStatus = new Map<string, string[]>();
    (wb ?? []).forEach((w: any) => {
      if (w.order_id) {
        if (w.intl_tracking_no) {
          const a = orderTracks.get(w.order_id) ?? []; a.push(w.intl_tracking_no); orderTracks.set(w.order_id, a);
        }
        const s = orderWbStatus.get(w.order_id) ?? []; s.push(w.status); orderWbStatus.set(w.order_id, s);
      } else if (w.forwarding_id) {
        if (w.intl_tracking_no) {
          const a = fwdTracks.get(w.forwarding_id) ?? []; a.push(w.intl_tracking_no); fwdTracks.set(w.forwarding_id, a);
        }
        const s = fwdWbStatus.get(w.forwarding_id) ?? []; s.push(w.status); fwdWbStatus.set(w.forwarding_id, s);
      }
    });

    type FwdRow = { warehouse: string; intake_at: string | null; status: string; cbm: number };
    const batchFwd = new Map<string, FwdRow[]>();

    type B = Batch & { _statuses: string[] };
    const map = new Map<string, B>();
    const key = (b: string | null) => b ?? "__unassigned__";
    const addTrack = (b: Batch, t: string | null | undefined) => {
      if (t && !b.intl_tracking_nos.includes(t)) b.intl_tracking_nos.push(t);
    };
    const makeBatch = (r: any): B => ({
      batch_no: r.batch_no, shipping_method: r.shipping_method, eta: r.eta,
      items: [], total_unpaid_cny: 0, total_cny: 0, all_paid: true,
      intl_tracking_nos: [], batch_status: "shipping", last_mile_blocks: [],
      storage_blocks: [], storage_total_cad: 0, grand_total_cny: 0, batch_locked: false, _statuses: [],
    });
    for (const r of (o ?? [])) {
      const k = key(r.batch_no);
      if (!map.has(k)) map.set(k, makeBatch(r));
      const b = map.get(k)!;
      const fee = Number(r.total_cny ?? 0);
      const cw = Number((r.freight_snapshot as any)?.chargeable_weight ?? (r.freight_snapshot as any)?.actual_weight ?? 0);
      b.items.push({ kind: "order", id: r.id, no: r.order_no, status: r.status, fee_cny: fee, tracking_no: r.tracking_no, payment_status: r.payment_status, route_id: r.route_id ?? null, weight_kg: cw });
      b.total_cny += fee;
      if (r.payment_status !== "paid") { b.total_unpaid_cny += fee; b.all_paid = false; }
      if (!b.shipping_method) b.shipping_method = r.shipping_method;
      if (!b.eta) b.eta = r.eta;
      addTrack(b, r.tracking_no);
      (orderTracks.get(r.id) ?? []).forEach((t) => addTrack(b, t));
      (orderWbStatus.get(r.id) ?? []).forEach((s) => b._statuses.push(s));
    }
    for (const r of (f ?? [])) {
      const k = key(r.batch_no);
      if (!map.has(k)) map.set(k, makeBatch(r));
      const b = map.get(k)!;
      const fee = Number(r.fee_cny ?? 0);
      b.items.push({
        kind: "forwarding", id: r.id, no: r.request_no, status: r.status,
        fee_cny: fee, tracking_no: r.tracking_no, payment_status: r.payment_status,
        extra: `${r.warehouse === "guangzhou" ? tr("广州仓", "Guangzhou") : tr("义乌仓", "Yiwu")}${r.weight_kg ? ` · ${Number(r.weight_kg).toFixed(1)}kg` : ""}`,
        route_id: r.route_id ?? null,
        weight_kg: Number(r.weight_kg ?? 0),
      });
      b.total_cny += fee;
      if (r.payment_status !== "paid") { b.total_unpaid_cny += fee; b.all_paid = false; }
      addTrack(b, r.tracking_no);
      (fwdTracks.get(r.id) ?? []).forEach((t) => addTrack(b, t));
      (fwdWbStatus.get(r.id) ?? []).forEach((s) => b._statuses.push(s));
      // collect for storage
      const L = Number(r.length_cm ?? 0), W = Number(r.width_cm ?? 0), H = Number(r.height_cm ?? 0);
      const cbm = (L * W * H) / 1_000_000;
      if (r.warehouse && (r.intake_at || r.status === "storage")) {
        const list = batchFwd.get(k) ?? []; list.push({
          warehouse: r.warehouse, intake_at: r.intake_at, status: r.status, cbm,
        }); batchFwd.set(k, list);
      }
    }
    const now = Date.now();
    const arr: Batch[] = Array.from(map.entries())
      .filter(([, b]) => b.batch_no)
      .map(([k, b]) => {
        b.batch_status = computeBatchStatus(b._statuses);
        // last-mile blocks
        const byRoute = new Map<string, number>();
        for (const it of b.items) {
          if (!it.route_id) continue;
          byRoute.set(it.route_id, (byRoute.get(it.route_id) ?? 0) + (Number(it.weight_kg) || 0));
        }
        const blocks: LastMileBlock[] = [];
        byRoute.forEach((sumW, rid) => {
          const meta = routeMap.get(rid);
          if (!meta || meta.fee_cad <= 0 || meta.threshold_kg <= 0) return;
          const triggered = sumW < meta.threshold_kg;
          blocks.push({
            route_id: rid, route_code: meta.code,
            threshold_kg: meta.threshold_kg, fee_cad: meta.fee_cad,
            sum_weight_kg: sumW, triggered, gap_kg: Math.max(0, meta.threshold_kg - sumW),
          });
        });
        b.last_mile_blocks = blocks;

        // storage blocks: group by warehouse
        const rows = batchFwd.get(k) ?? [];
        const byWh = new Map<string, FwdRow[]>();
        for (const row of rows) {
          const arr2 = byWh.get(row.warehouse) ?? []; arr2.push(row); byWh.set(row.warehouse, arr2);
        }
        const sblocks: StorageBlock[] = [];
        let stotal = 0;
        byWh.forEach((rs, code) => {
          const meta = whMap.get(code);
          if (!meta || meta.fee_per_cbm_day <= 0) return;
          const cbm_real = rs.reduce((s, r) => s + r.cbm, 0);
          const cbm_charged = Math.max(1, Math.ceil(cbm_real));
          let storageStatusCount = 0;
          let maxDays = 0;
          let fee = 0;
          for (const r of rs) {
            if (!r.intake_at && r.status !== "storage") continue;
            const start = r.intake_at ? new Date(r.intake_at).getTime() : now;
            const elapsedDays = Math.max(0, Math.ceil((now - start) / 86400000));
            const ignoresFree = r.status === "storage";
            if (ignoresFree) storageStatusCount++;
            const billable = ignoresFree ? elapsedDays : Math.max(0, elapsedDays - meta.free_days);
            if (billable > maxDays) maxDays = billable;
            // per-row fee uses row cbm but batch charges by ceil cbm; pro-rate fairly: use cbm_charged proportionally
            // Simplification: compute as cbm_charged * sum(billable_days_weighted by row_cbm / cbm_real) when cbm_real>0
            const share = cbm_real > 0 ? r.cbm / cbm_real : 1 / rs.length;
            fee += cbm_charged * billable * meta.fee_per_cbm_day * share;
          }
          fee = +fee.toFixed(2);
          if (fee <= 0) return;
          sblocks.push({
            warehouse_code: code,
            warehouse_name: meta.name,
            cbm_real: +cbm_real.toFixed(3),
            cbm_charged,
            fee_per_cbm_day: meta.fee_per_cbm_day,
            free_days: meta.free_days,
            max_days_charged: maxDays,
            fee_cad: fee,
            storage_status_count: storageStatusCount,
          });
          stotal += fee;
        });
        b.storage_blocks = sblocks;
        b.storage_total_cad = +stotal.toFixed(2);
        return b;
      }).sort((a, b) => (a.eta ?? "").localeCompare(b.eta ?? ""));
    // Read locked batch totals (set by admin when batch status crosses out of "draft")
    const batchNos = arr.map((b) => b.batch_no).filter(Boolean) as string[];
    if (batchNos.length) {
      const { data: bRows } = await sb.from("batches")
        .select("batch_no, status, grand_total_cny").in("batch_no", batchNos);
      const bMap = new Map<string, { status: string; grand_total_cny: number }>();
      for (const r of (bRows ?? []) as any[]) bMap.set(r.batch_no, { status: r.status, grand_total_cny: Number(r.grand_total_cny ?? 0) });
      for (const b of arr) {
        const row = b.batch_no ? bMap.get(b.batch_no) : null;
        if (row) {
          b.grand_total_cny = row.grand_total_cny;
          b.batch_locked = row.status !== "draft";
        }
      }
    }
    setBatches(arr);
  };
  useEffect(() => { load(); }, []);

  const pay = async (batch_no: string, amountCad: number) => {
    if (!confirm(tr(`确认从钱包支付 CA$${amountCad.toFixed(2)} 给批次 ${batch_no}?`, `Pay CA$${amountCad.toFixed(2)} from wallet for batch ${batch_no}?`))) return;
    setPaying(batch_no);
    const { data, error } = await sb.rpc("pay_batch", { _batch_no: batch_no });
    setPaying(null);
    if (error) return toast.error(error.message);
    if (!data?.ok) {
      if (data?.reason === "insufficient") {
        toast.error(tr(
          `余额不足，需要 CA$${data.need_cad}，当前 CA$${data.balance_cad}，请先充值`,
          `Insufficient balance: need CA$${data.need_cad}, have CA$${data.balance_cad} — please top up`,
        ), { action: { label: tr("去充值", "Top up"), onClick: () => onJump("wallet") } });
        return;
      }
      return toast.error(tr("付款失败", "Payment failed"));
    }
    const pointsMsg = data.points_earned > 0 ? tr(`，获得 ${data.points_earned} 积分`, `, earned ${data.points_earned} points`) : "";
    toast.success(tr(
      `付款成功 CA$${data.paid_cad}，账单 ${data.invoice_no}${pointsMsg}`,
      `Paid CA$${data.paid_cad} — invoice ${data.invoice_no}${pointsMsg}`,
    ), { action: { label: tr("查看账单", "View invoice"), onClick: () => navigate({ to: "/invoices" }) } });
    load();
  };

  const [showHistory, setShowHistory] = useState(false);

  if (batches === null) return <Spinner />;
  if (batches.length === 0) return <Empty icon={<Layers />} text={tr("还没有任何订单或集运", "No orders or shipments yet")} />;

  const historyCount = batches.filter((b) => b.batch_status === "completed").length;
  const visible = showHistory ? batches : batches.filter((b) => b.batch_status !== "completed");

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold">{tr("我的批次", "My batches")}</h2>
          <p className="mt-1 text-xs text-ink-soft">{tr("电商订单与集运请求按发货批次合并，可一次性结算（加币计费）", "Shop & forwarding orders merged by batch — settle in one click (CAD)")}</p>
        </div>
        <label className="inline-flex shrink-0 items-center gap-2 text-xs text-ink-soft">
          <input type="checkbox" checked={showHistory} onChange={(e) => setShowHistory(e.target.checked)} />
          {tr(`显示历史批次 (${historyCount})`, `Show history (${historyCount})`)}
        </label>
      </div>

      {visible.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-ink-soft">
          {tr("没有进行中的批次", "No active batches")}
        </div>
      )}
      {visible.map((b) => (
        <BatchCard key={b.batch_no ?? "__unassigned__"} b={b} lang={lang} tr={tr} paying={paying} onPay={pay} />
      ))}
    </div>
  );
}

const BATCH_STATUS_LABELS: Record<Batch["batch_status"], [string, string, string]> = {
  shipping:          ["正在运输", "In transit",        "bg-brand/10 text-brand"],
  awaiting_delivery: ["待派送",   "Awaiting delivery", "bg-cta/10 text-cta"],
  awaiting_pickup:   ["待取货",   "Ready for pickup",  "bg-warning/10 text-warning"],
  completed:         ["已完成",   "Completed",         "bg-success/10 text-success"],
};

function BatchCard({ b, lang, tr, paying, onPay }: {
  b: Batch; lang: "zh" | "en"; tr: (zh: string, en: string) => string;
  paying: string | null; onPay: (batch_no: string, amountCad: number) => void;
}) {
  const { cnyToCad } = useApp();
  const isAir = b.shipping_method === "air";
  const lastMileCad = b.last_mile_blocks.reduce((s, lm) => s + (lm.triggered ? lm.fee_cad : 0), 0);
  const extrasCad = b.storage_total_cad + lastMileCad;
  const headerAmountCad = cnyToCad(b.all_paid ? b.total_cny : b.total_unpaid_cny) + (b.all_paid ? 0 : extrasCad);
  const unpaidCad = cnyToCad(b.total_unpaid_cny) + extrasCad;
  const [trackOpen, setTrackOpen] = useState(false);
  const [events, setEvents] = useState<any[] | null | "err">(null);

  const toggleTrack = async () => {
    const next = !trackOpen;
    setTrackOpen(next);
    if (next && events === null) {
      if (b.intl_tracking_nos.length === 0) return setEvents("err");
      const results = await Promise.all(
        b.intl_tracking_nos.map((t) => sb.rpc("lookup_shipment", { _tracking_no: t }))
      );
      const all: any[] = [];
      results.forEach((r: any, i: number) => {
        const evs = r?.data?.events ?? [];
        const ref = b.intl_tracking_nos[i];
        evs.forEach((e: any) => all.push({ ...e, source_ref: e.source_ref ?? ref }));
      });
      if (all.length === 0) return setEvents("err");
      all.sort((a, b) => +new Date(a.event_time) - +new Date(b.event_time));
      setEvents(all);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <header className={`flex flex-wrap items-center gap-3 border-b border-border px-5 py-4 ${b.all_paid ? "bg-success/5" : "bg-accent/40"}`}>
        <span className="grid h-8 w-8 place-items-center rounded-full bg-brand/10 text-brand">
          {isAir ? <Plane className="h-4 w-4" /> : <Ship className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display text-sm font-bold">{b.batch_no ?? tr("未分配批次", "Unassigned")}</span>
            {(() => {
              const [zh, en, cls] = BATCH_STATUS_LABELS[b.batch_status];
              return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{tr(zh, en)}</span>;
            })()}
            {b.all_paid ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                <CheckCircle2 className="h-3 w-3" />{tr("已结清", "Settled")}
              </span>
            ) : (
              <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">{tr("待付款", "Unpaid")}</span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-ink-soft">
            <span>{isAir ? tr("空运批次", "Air batch") : tr("海运批次", "Sea batch")}</span>
            {b.eta && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{tr("预计到达", "ETA")} {new Date(b.eta).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-CA")}</span>}
            <span>· {b.items.length} {tr("项", "items")}</span>
          </div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-[10px] uppercase tracking-wider text-ink-soft">
            {b.all_paid ? tr("批次合计", "Batch total") : tr("批次待付", "Batch unpaid")}
          </div>
          <div className="font-display text-lg font-bold text-brand-gradient">CA${headerAmountCad.toFixed(2)}</div>
          {b.batch_locked && b.grand_total_cny > 0 && (
            <div className="mt-1 text-[10px] text-ink-soft">
              {tr("结算总额", "Settled total")}：<span className="font-mono font-semibold text-success">¥{b.grand_total_cny.toFixed(2)}</span>
            </div>
          )}
        </div>
      </header>

      <ul className="divide-y divide-border">
        {b.items.map((it) => {
          const itCad = cnyToCad(it.fee_cny);
          return (
            <li key={`${it.kind}-${it.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${it.kind === "order" ? "bg-brand/10 text-brand" : "bg-cta/10 text-cta"}`}>
                {it.kind === "order" ? <><ShoppingCart className="h-3 w-3" />{tr("商城", "Shop")}</> : <><Truck className="h-3 w-3" />{tr("集运", "Forwarding")}</>}
              </span>
              <span className="font-mono text-xs font-semibold">{it.no}</span>
              {it.extra && <span className="text-[11px] text-ink-soft">· {it.extra}</span>}
              {it.tracking_no && <span className="text-[11px] text-ink-soft">· <span className="font-mono">{it.tracking_no}</span></span>}
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${it.payment_status === "paid" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                {it.payment_status === "paid" ? tr("已付款", "Paid") : tr("待付款", "Unpaid")}
              </span>
              <span className={`ml-auto text-sm font-semibold ${it.payment_status === "paid" ? "text-ink-soft line-through" : ""}`}>CA${itCad.toFixed(2)}</span>
              {it.kind === "order" ? (
                <Link to="/orders/$orderId" params={{ orderId: it.id }} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium hover:border-brand hover:text-brand">
                  {tr("详情", "Detail")} <ArrowRight className="h-3 w-3" />
                </Link>
              ) : (
                <Link to="/forwarding/$forwardingId" params={{ forwardingId: it.id }} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium hover:border-brand hover:text-brand">
                  {tr("详情", "Detail")} <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      {/* Batch tracking timeline */}
      <div className="border-t border-border bg-background/40 px-5 py-3">
        <button
          onClick={toggleTrack}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-medium hover:border-brand hover:text-brand"
        >
          <MapPin className="h-3 w-3" />
          {tr("批次物流轨迹", "Batch tracking")}
          {b.intl_tracking_nos.length > 0 && <span className="text-ink-soft">({b.intl_tracking_nos.length})</span>}
          <span className="text-ink-soft">{trackOpen ? "▲" : "▼"}</span>
        </button>
        {trackOpen && (
          <div className="mt-2 overflow-hidden rounded-xl border border-border bg-background">
            {events === null && <div className="grid place-items-center py-4"><Loader2 className="h-4 w-4 animate-spin text-ink-soft" /></div>}
            {events === "err" && <div className="py-4 text-center text-xs text-ink-soft">{tr("暂无轨迹数据", "No tracking data yet")}</div>}
            {Array.isArray(events) && <TrackingTimeline events={events as any} lang={lang} />}
          </div>
        )}
      </div>

      {b.last_mile_blocks.length > 0 && (
        <div className="space-y-2 border-t border-border bg-background/60 px-5 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
            {tr("末端派送费", "Last-mile delivery")}
          </div>
          {b.last_mile_blocks.map((lm) => (
            <div key={lm.route_id} className="rounded-lg border border-border/60 bg-surface px-3 py-2 text-[11px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] text-ink-soft">{lm.route_code}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${lm.triggered ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}`}>
                  {lm.triggered ? tr("已触发", "Triggered") : tr("未触发", "Not triggered")}
                </span>
                <span className="ml-auto font-semibold">
                  {lm.triggered ? `+ CA$${lm.fee_cad.toFixed(2)}` : `CA$0.00`}
                </span>
              </div>
              <div className="mt-1 text-ink-soft">
                {tr("触发条件", "Trigger")}：
                {tr("电商+集运 合计收费重量", "Shop + forwarding chargeable weight")}
                {" "}
                <span className={lm.triggered ? "font-semibold text-warning" : "font-semibold"}>{lm.sum_weight_kg.toFixed(2)} kg</span>
                {" "}
                {lm.triggered ? "<" : "≥"}
                {" "}
                <span className="font-semibold">{lm.threshold_kg.toFixed(2)} kg</span>
                {lm.triggered && (
                  <> · {tr("差额", "Gap")} <span className="font-semibold text-warning">{lm.gap_kg.toFixed(2)} kg</span></>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {b.storage_blocks.length > 0 && (
        <div className="space-y-2 border-t border-border bg-background/60 px-5 py-3">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
            <span>{tr("仓储费", "Storage fee")}</span>
            <span className="font-display text-sm font-bold text-foreground normal-case">+ CA${b.storage_total_cad.toFixed(2)}</span>
          </div>
          {b.storage_blocks.map((s) => (
            <div key={s.warehouse_code} className="rounded-lg border border-border/60 bg-surface px-3 py-2 text-[11px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{s.warehouse_name}</span>
                <span className="font-mono text-[10px] text-ink-soft">{s.warehouse_code}</span>
                <span className="ml-auto font-semibold">+ CA${s.fee_cad.toFixed(2)}</span>
              </div>
              <div className="mt-1 text-ink-soft">
                {tr("实际体积", "Volume")} <span className="font-semibold">{s.cbm_real.toFixed(3)} cbm</span>
                {" · "}
                {tr("计费体积", "Charged")} <span className="font-semibold">{s.cbm_charged} cbm</span>
                {s.cbm_real < 1 && <span className="ml-1 text-warning">({tr("不足1cbm按1cbm", "min 1 cbm")})</span>}
                {" · "}
                {tr("单价", "Rate")} CA${s.fee_per_cbm_day.toFixed(2)}/cbm/{tr("天", "day")}
                {" · "}
                {tr("免费", "Free")} {s.free_days} {tr("天", "d")}
                {" · "}
                {tr("最长计费", "Max billed")} <span className="font-semibold">{s.max_days_charged} {tr("天", "d")}</span>
                {s.storage_status_count > 0 && (
                  <span className="ml-1 text-warning">
                    ({s.storage_status_count} {tr("件「仓储中」忽略免费时效", "in storage — free days ignored")})
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}


      {!b.all_paid && b.batch_no && b.total_unpaid_cny > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border bg-background px-5 py-3">
          <div className="text-xs text-ink-soft">
            {tr("待付", "Unpaid")}: <span className="font-display text-base font-bold text-foreground">CA${unpaidCad.toFixed(2)}</span>
          </div>
          <button
            disabled={paying === b.batch_no}
            onClick={() => onPay(b.batch_no!, unpaidCad)}
            className="ml-auto inline-flex items-center gap-2 rounded-full bg-cta-gradient px-5 py-2 text-xs font-semibold text-cta-foreground shadow-elevated transition hover:brightness-110 disabled:opacity-50"
          >
            {paying === b.batch_no ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
            {tr("钱包付款", "Pay from wallet")}
          </button>
        </div>
      )}
    </div>
  );
}


// ===================== My Inventory (waybills in storage, grouped by SKU + warehouse) =====================
interface InventoryBox { id: string; waybillNo: string; storedAt: string }
interface InventoryWarehouse { id: string; code: string; name: string }
interface InventoryGroup {
  key: string;
  productName: string;
  sku: string;
  qtyPerBox: number;
  warehouse: InventoryWarehouse | null;
  boxes: InventoryBox[];
}

const DAY_MS = 86_400_000;
const storageDays = (isoDate: string) => Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / DAY_MS));

// Shared with src/routes/_authenticated/forwarding.index.tsx — key for handing off
// locked item drafts (and the warehouse they must ship from) when shipping straight from My Inventory.
const FORWARDING_PREFILL_KEY = "sc_forwarding_prefill";

// Demo rows shown when there's no real "storage" waybill yet, so the layout can be reviewed.
// Clearly marked in the UI as sample data — not written to the database. Warehouses are NOT
// hardcoded: they're filled in from the real `warehouses` table (see buildDemoGroups) so that
// shipping a demo group still points "/forwarding" at a warehouse id that actually exists —
// otherwise the warehouse tile there can't match, routes never filter in, and the whole
// downstream form breaks.
const DEMO_GROUPS_TEMPLATE: Array<Omit<InventoryGroup, "warehouse"> & { warehouseSlot: 0 | 1 }> = [
  { key: "demo-1", productName: "无线蓝牙耳机 Pro", sku: "SKU-EB-1029", qtyPerBox: 20, warehouseSlot: 0,
    boxes: [
      { id: "demo-1-a", waybillNo: "SC20260701000123", storedAt: "2026-06-20T00:00:00Z" },
      { id: "demo-1-b", waybillNo: "SC20260701000124", storedAt: "2026-06-20T00:00:00Z" },
      { id: "demo-1-c", waybillNo: "SC20260702000087", storedAt: "2026-06-29T00:00:00Z" },
    ] },
  { key: "demo-2", productName: "儿童保温杯 350ml", sku: "SKU-CUP-3350", qtyPerBox: 48, warehouseSlot: 0,
    boxes: [
      { id: "demo-2-a", waybillNo: "SC20260628000045", storedAt: "2026-06-25T00:00:00Z" },
      { id: "demo-2-b", waybillNo: "SC20260628000046", storedAt: "2026-06-25T00:00:00Z" },
    ] },
  { key: "demo-3", productName: "便携充电宝 10000mAh", sku: "SKU-PB-1000A", qtyPerBox: 12, warehouseSlot: 1,
    boxes: [{ id: "demo-3-a", waybillNo: "SC20260630000201", storedAt: "2026-07-03T00:00:00Z" }] },
];

function buildDemoGroups(realWarehouses: InventoryWarehouse[]): InventoryGroup[] {
  const pick = (slot: 0 | 1): InventoryWarehouse | null => realWarehouses[slot] ?? realWarehouses[0] ?? null;
  return DEMO_GROUPS_TEMPLATE.map(({ warehouseSlot, ...g }) => ({ ...g, warehouse: pick(warehouseSlot) }));
}

function buildInventoryGroups(rows: any[]): InventoryGroup[] {
  const map = new Map<string, InventoryGroup>();
  for (const wb of rows) {
    const summary = Array.isArray(wb.items_summary) ? wb.items_summary : [];
    const entries = summary.length > 0 ? summary : [{ name: null, sku: null, quantity: null }];
    const warehouse: InventoryWarehouse | null = wb.warehouse ?? null;
    for (const it of entries) {
      const productName = it?.name || it?.name_zh || it?.name_en || "—";
      const sku = it?.sku || "—";
      const qtyPerBox = Number(it?.quantity ?? 0);
      const k = `${productName}__${sku}__${qtyPerBox}__${warehouse?.id ?? "unknown"}`;
      if (!map.has(k)) map.set(k, { key: k, productName, sku, qtyPerBox, warehouse, boxes: [] });
      map.get(k)!.boxes.push({ id: wb.id, waybillNo: wb.waybill_no, storedAt: wb.updated_at });
    }
  }
  return Array.from(map.values());
}

function InventoryTab() {
  const { lang } = useApp();
  const navigate = useNavigate();
  const tr = (zh: string, en: string) => (lang === "zh" ? zh : en);
  const [groups, setGroups] = useState<InventoryGroup[] | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [shipBoxes, setShipBoxes] = useState<Record<string, number>>({});
  const [storageFee, setStorageFee] = useState<{ total_cad: number } | null>(null);
  const [payingStorage, setPayingStorage] = useState(false);

  const loadStorageFee = async () => {
    const { data } = await sb.rpc("preview_storage_fees");
    setStorageFee(data ?? { total_cad: 0 });
  };

  const payStorageFee = async () => {
    if (!storageFee || storageFee.total_cad <= 0) return;
    if (!confirm(tr(`确认从钱包支付仓储费 CA$${storageFee.total_cad.toFixed(2)}?`, `Pay CA$${storageFee.total_cad.toFixed(2)} storage fee from wallet?`))) return;
    setPayingStorage(true);
    const { data, error } = await sb.rpc("pay_storage_fees");
    setPayingStorage(false);
    if (error) return toast.error(error.message);
    if (!data?.ok) {
      if (data?.reason === "insufficient") {
        toast.error(tr(
          `余额不足，需要 CA$${data.need_cad}，当前 CA$${data.balance_cad}，请先充值`,
          `Insufficient balance: need CA$${data.need_cad}, have CA$${data.balance_cad} — please top up`,
        ), { action: { label: tr("去充值", "Top up"), onClick: () => navigate({ to: "/account", search: { tab: "wallet" } }) } });
        return;
      }
      return toast.error(tr("付款失败", "Payment failed"));
    }
    const pointsMsg = data.points_earned > 0 ? tr(`，获得 ${data.points_earned} 积分`, `, earned ${data.points_earned} points`) : "";
    toast.success(tr(
      `仓储费付款成功 CA$${data.paid_cad}，账单 ${data.invoice_no}${pointsMsg}`,
      `Storage fee paid CA$${data.paid_cad} — invoice ${data.invoice_no}${pointsMsg}`,
    ), { action: { label: tr("查看账单", "View invoice"), onClick: () => navigate({ to: "/invoices" }) } });
    loadStorageFee();
  };

  useEffect(() => {
    loadStorageFee();
    (async () => {
      const [{ data: wbRows }, { data: whRows }] = await Promise.all([
        sb.from("waybills")
          .select("id,waybill_no,items_summary,updated_at,forwarding_id")
          .eq("status", "storage")
          .order("updated_at", { ascending: false }),
        sb.from("warehouses").select("id,code,name_zh,name_en").eq("is_active", true),
      ]);
      const fwdIds = Array.from(new Set((wbRows ?? []).map((w: any) => w.forwarding_id).filter(Boolean)));
      const { data: fwdRows } = fwdIds.length
        ? await sb.from("forwarding_orders").select("id,warehouse").in("id", fwdIds)
        : { data: [] as any[] };
      const realWarehouses: InventoryWarehouse[] = (whRows ?? []).map((w: any) => ({ id: w.id, code: w.code, name: lang === "zh" ? w.name_zh : (w.name_en ?? w.name_zh) }));
      const whByCode = new Map(realWarehouses.map((w) => [w.code, w]));
      const warehouseByFwdId = new Map((fwdRows ?? []).map((f: any) => [f.id, whByCode.get(f.warehouse) ?? null]));
      const withWarehouse = (wbRows ?? []).map((w: any) => ({ ...w, warehouse: warehouseByFwdId.get(w.forwarding_id) ?? null }));

      const real = buildInventoryGroups(withWarehouse);
      if (real.length > 0) { setGroups(real); setIsDemo(false); }
      else { setGroups(buildDemoGroups(realWarehouses)); setIsDemo(true); }
    })();
  }, [lang]);

  if (groups === null) return <Spinner />;

  const totalBoxes = groups.reduce((s, g) => s + g.boxes.length, 0);
  const toShip = groups.filter((g) => (shipBoxes[g.key] ?? 0) > 0);
  const totalBoxesToShip = toShip.reduce((s, g) => s + (shipBoxes[g.key] ?? 0), 0);
  const shipWarehouseIds = new Set(toShip.map((g) => g.warehouse?.id ?? "unknown"));

  const setBoxesFor = (g: InventoryGroup, raw: number) => {
    const n = Math.max(0, Math.min(g.boxes.length, Math.floor(raw) || 0));
    setShipBoxes((s) => ({ ...s, [g.key]: n }));
  };

  const shipSelected = () => {
    if (toShip.length === 0) return;
    if (shipWarehouseIds.size > 1 || shipWarehouseIds.has("unknown")) {
      toast.error(tr("请选择同一仓库的货物一起发货", "Please ship items from a single warehouse at a time"));
      return;
    }
    const items = toShip.map((g) => {
      const boxCount = shipBoxes[g.key] ?? 0;
      return {
        name: g.productName,
        quantity: boxCount * g.qtyPerBox,
        unit_price_cad: 0,
        box_count: boxCount,
        inner_qty: g.qtyPerBox,
        locked: true,
      };
    });
    sessionStorage.setItem(FORWARDING_PREFILL_KEY, JSON.stringify({ warehouseId: toShip[0].warehouse!.id, items }));
    navigate({ to: "/forwarding" });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">{tr("我的库存", "My inventory")}</h2>
          <p className="mt-1 text-xs text-ink-soft">{tr("按货物名称 + SKU + 内件数分组，当前在仓库中的箱数", "Grouped by product, SKU and units/box — box counts currently in the warehouse")}</p>
        </div>
        {isDemo && (
          <span className="rounded-full bg-accent px-3 py-1 text-[11px] font-medium text-ink-soft">
            {tr("暂无真实库存，以下为示例数据", "No real inventory yet — sample data shown below")}
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard
          label={tr("库存总箱数", "Total boxes in storage")}
          value={String(totalBoxes)}
          sub={tr(`${groups.length} 种货物`, `${groups.length} product(s)`)}
          icon={<Warehouse className="h-5 w-5" />}
        />
        <StatCard
          label={tr("待付仓储费", "Storage fee due")}
          value={`CA$${(storageFee?.total_cad ?? 0).toFixed(2)}`}
          sub={tr("按仓库体积与天数计算，付款后重新计时", "By volume × days — payment resets the billing clock")}
          icon={<Wallet className="h-5 w-5" />}
          tone={storageFee && storageFee.total_cad > 0 ? "brand" : undefined}
          action={storageFee && storageFee.total_cad > 0 ? (
            <button
              onClick={payStorageFee}
              disabled={payingStorage}
              className="inline-flex items-center gap-2 rounded-full bg-cta-gradient px-4 py-1.5 text-xs font-semibold text-cta-foreground shadow-elevated transition hover:brightness-110 disabled:opacity-50"
            >
              {payingStorage && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {tr(`支付仓储费 CA$${storageFee.total_cad.toFixed(2)}`, `Pay storage fee CA$${storageFee.total_cad.toFixed(2)}`)}
            </button>
          ) : undefined}
        />
      </div>

      {groups.length === 0 ? (
        <Empty icon={<Warehouse />} text={tr("目前没有仓储中的运单", "No waybills in storage right now")} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <ul className="divide-y divide-border">
            {groups.map((g) => {
              const maxDays = Math.max(0, ...g.boxes.map((b) => storageDays(b.storedAt)));
              return (
                <li key={g.key} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-warning/10 text-warning">
                    <Warehouse className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold">{g.productName}</div>
                    <div className="flex flex-wrap gap-2 text-[11px] text-ink-soft">
                      <span className="rounded-full bg-brand/10 px-2 py-0.5 font-semibold text-brand">{g.warehouse?.name ?? tr("未知仓库", "Unknown warehouse")}</span>
                      <span className="font-mono">SKU: {g.sku}</span>
                      <span>· {tr("内件数", "Units/box")}: {g.qtyPerBox}</span>
                      <span className={maxDays >= 30 ? "font-semibold text-warning" : ""}>· {tr("最长存储", "Longest stored")}: {maxDays} {tr("天", "d")}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-lg font-bold text-foreground">{g.boxes.length}</div>
                    <div className="text-[10px] uppercase tracking-wider text-ink-soft">{tr("箱", "box(es)")}</div>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <label className="text-[11px] text-ink-soft">{tr("发货箱数", "Ship boxes")}</label>
                    <input
                      type="number" min={0} max={g.boxes.length} step={1}
                      value={shipBoxes[g.key] ?? ""}
                      onChange={(e) => setBoxesFor(g, Number(e.target.value))}
                      placeholder="0"
                      className="h-9 w-20 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {totalBoxesToShip > 0 && (
        <div className="sticky bottom-4 flex flex-wrap items-center gap-3 rounded-2xl border border-brand/30 bg-surface p-4 shadow-elevated">
          <div>
            <div className="text-sm">{tr(`已填 ${totalBoxesToShip} 箱待发货`, `${totalBoxesToShip} box(es) ready to ship`)}</div>
            {shipWarehouseIds.size > 1 && (
              <div className="text-[11px] text-destructive">{tr("所选货物分属不同仓库，请分开发货", "Selected items span multiple warehouses — ship them separately")}</div>
            )}
          </div>
          <button
            onClick={shipSelected}
            disabled={shipWarehouseIds.size > 1}
            className="ml-auto inline-flex items-center gap-2 rounded-full bg-cta-gradient px-5 py-2 text-sm font-semibold text-cta-foreground shadow-elevated transition hover:brightness-110 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />{tr("发货，去申请集运单", "Ship — go to forwarding request")}
          </button>
        </div>
      )}
    </div>
  );
}

// ===================== My Items (personal catalog, synced into the HS code library) =====================
interface MyItem {
  id: string;
  name: string;
  hs_code: string;
  sku: string | null;
  declared_value_cad: number;
  inner_qty: number | null;
  mfn_rate: number;
  gst_rate: number;
  sima_involved: boolean;
  unit: string | null;
}

function newMyItem(): Partial<MyItem> {
  return { name: "", hs_code: "", sku: "", declared_value_cad: 0, inner_qty: undefined, mfn_rate: 0, gst_rate: 0.05, sima_involved: false, unit: "" };
}

function MyItemsTab() {
  const { lang } = useApp();
  const tr = (zh: string, en: string) => (lang === "zh" ? zh : en);
  const [list, setList] = useState<MyItem[] | null>(null);
  const [editing, setEditing] = useState<Partial<MyItem> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => sb.from("my_items").select("*").order("created_at", { ascending: false }).then(({ data }: any) => setList(data ?? []));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    if (!editing.name?.trim()) return toast.error(tr("请填写物品名称", "Enter an item name"));
    if (!editing.hs_code?.trim()) return toast.error(tr("请填写 HS 编码", "Enter an HS code"));
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return; }
    const hsCode = editing.hs_code.trim().replace(/\s+/g, "");

    // If this HS code already exists in the shared library, its (staff-curated) rates win
    // over whatever the customer typed. Brand-new codes get inserted using their input.
    const { data: resolved, error: resolveError } = await sb.rpc("resolve_hs_code_rates", {
      p_hs_code: hsCode, p_name_zh: editing.name.trim(), p_unit: editing.unit?.trim() || null,
      p_mfn_rate: editing.mfn_rate ?? 0, p_gst_rate: editing.gst_rate ?? 0.05, p_sima_involved: editing.sima_involved ?? false,
    });
    if (resolveError) { setBusy(false); return toast.error(resolveError.message); }

    const payload = {
      user_id: user.id,
      name: editing.name.trim(),
      hs_code: hsCode,
      sku: editing.sku?.trim() || null,
      declared_value_cad: editing.declared_value_cad ?? 0,
      inner_qty: editing.inner_qty ?? null,
      unit: resolved?.unit ?? (editing.unit?.trim() || null),
      mfn_rate: resolved?.mfn_rate ?? (editing.mfn_rate ?? 0),
      gst_rate: resolved?.gst_rate ?? (editing.gst_rate ?? 0.05),
      sima_involved: resolved?.sima_involved ?? (editing.sima_involved ?? false),
    };
    const { error } = editing.id
      ? await sb.from("my_items").update(payload).eq("id", editing.id)
      : await sb.from("my_items").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(tr("已保存", "Saved"));
    setEditing(null);
    load();
  };

  const del = async (id: string) => {
    if (!confirm(tr("确定删除这个物品？", "Delete this item?"))) return;
    const { error } = await sb.from("my_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  if (list === null) return <Spinner />;
  const isNew = editing && !editing.id;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold">{tr("我的物品", "My items")}</h2>
          <p className="mt-1 text-xs text-ink-soft">{tr("保存常用物品信息，申请集运时可直接复用；新增的 HS 编码会同步进入报关编码库", "Save reusable item details for forwarding requests — new HS codes are synced into the customs code library")}</p>
        </div>
        <button onClick={() => setEditing(newMyItem())} className="inline-flex items-center gap-1 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background">
          <Plus className="h-3.5 w-3.5" />{tr("新增物品", "Add item")}
        </button>
      </div>

      {editing && (
        <div className="rounded-2xl border border-border bg-surface p-6">
          <div className="mb-3 text-sm font-semibold">{isNew ? tr("新增物品", "New item") : tr("编辑物品", "Edit item")}</div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={tr("物品名称", "Item name")} full><input className={inputCls} value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="HS Code"><input className={inputCls} value={editing.hs_code ?? ""} onChange={(e) => setEditing({ ...editing, hs_code: e.target.value })} /></Field>
            <Field label="SKU"><input className={inputCls} value={editing.sku ?? ""} onChange={(e) => setEditing({ ...editing, sku: e.target.value })} /></Field>
            <Field label={tr("计量单位", "Unit")}><input className={inputCls} placeholder={tr("如：件、个、套", "e.g. pc, set")} value={editing.unit ?? ""} onChange={(e) => setEditing({ ...editing, unit: e.target.value })} /></Field>
            <Field label={tr("申报价值 (CAD)", "Declared value (CAD)")}><input type="number" min={0} step="0.01" className={inputCls} value={editing.declared_value_cad ?? 0} onChange={(e) => setEditing({ ...editing, declared_value_cad: Number(e.target.value) || 0 })} /></Field>
            <Field label={tr("内件数", "Units/box")}><input type="number" min={0} className={inputCls} value={editing.inner_qty ?? ""} onChange={(e) => setEditing({ ...editing, inner_qty: e.target.value === "" ? undefined : Number(e.target.value) })} /></Field>
            <Field label={tr("MFN 税率", "MFN rate")}><input type="number" min={0} step="0.0001" className={inputCls} value={editing.mfn_rate ?? 0} onChange={(e) => setEditing({ ...editing, mfn_rate: Number(e.target.value) || 0 })} /></Field>
            <Field label={tr("GST 税率", "GST rate")}><input type="number" min={0} step="0.0001" className={inputCls} value={editing.gst_rate ?? 0.05} onChange={(e) => setEditing({ ...editing, gst_rate: Number(e.target.value) || 0 })} /></Field>
            <Field label="SIMA">
              <label className="flex h-11 items-center gap-2 px-1 text-sm">
                <input type="checkbox" checked={!!editing.sima_involved} onChange={(e) => setEditing({ ...editing, sima_involved: e.target.checked })} />
                {tr("涉及反倾销/反补贴措施", "Subject to anti-dumping/SIMA")}
              </label>
            </Field>
          </div>
          <p className="mt-3 text-[11px] text-ink-soft">{tr("提示：如果这个 HS 编码在报关库里已经存在，MFN/GST/SIMA/计量单位会以库里已有数据为准，自动覆盖你在这里填的值。", "Note: if this HS code already exists in the customs library, its MFN/GST/SIMA/unit values take precedence and will overwrite what you enter here.")}</p>
          <div className="mt-4 flex gap-2">
            <button onClick={save} disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-cta-gradient px-5 py-2 text-sm font-semibold text-cta-foreground disabled:opacity-50">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}{tr("保存", "Save")}
            </button>
            <button onClick={() => setEditing(null)} className="rounded-full border border-border px-5 py-2 text-sm">{tr("取消", "Cancel")}</button>
          </div>
        </div>
      )}

      {list.length === 0 && !editing ? (
        <Empty icon={<Tags />} text={tr("还没有保存物品，点击右上角添加一个", "No saved items yet — add one to get started")} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <ul className="divide-y divide-border">
            {list.map((it) => (
              <li key={it.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-brand/10 text-brand"><Tags className="h-4 w-4" /></span>
                <div className="min-w-0">
                  <div className="font-semibold">{it.name}</div>
                  <div className="flex flex-wrap gap-2 text-[11px] text-ink-soft">
                    <span className="font-mono">HS: {it.hs_code}</span>
                    {it.sku && <span className="font-mono">· SKU: {it.sku}</span>}
                    {it.unit && <span>· {tr("单位", "Unit")}: {it.unit}</span>}
                    {it.inner_qty != null && <span>· {tr("内件数", "Units/box")}: {it.inner_qty}</span>}
                    <span>· {tr("申报价值", "Declared")}: CA${Number(it.declared_value_cad).toFixed(2)}</span>
                    <span>· MFN {(Number(it.mfn_rate) * 100).toFixed(2)}%</span>
                    <span>· GST {(Number(it.gst_rate) * 100).toFixed(2)}%</span>
                    {it.sima_involved && <span className="font-semibold text-warning">· SIMA</span>}
                  </div>
                </div>
                <div className="ml-auto flex gap-1">
                  <button onClick={() => setEditing(it)} className="rounded-full px-2 py-1 text-xs text-ink-soft hover:bg-accent">{tr("编辑", "Edit")}</button>
                  <button onClick={() => del(it.id)} className="grid h-7 w-7 place-items-center rounded-full text-ink-soft hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ===================== My Orders / Waybills (merged) =====================
type OrderFilter = "all" | "order" | "forwarding" | "unwarehoused";

interface MyWaybill { waybill_no: string; status: string }
interface MyOrderItem {
  kind: "order" | "forwarding";
  id: string;
  no: string;
  status: string;
  created_at: string;
  fee_cny: number;
  payment_status: string;
  tracking_no: string | null;
  shipping_method?: string;
  warehouse?: string;
  weight_kg?: number | null;
  domestic_tracking_no?: string | null;
  note?: string | null;
  waybills?: MyWaybill[];
  total_weight_kg?: number;
  total_volume_m3?: number;
  total_cad?: number | null;
}

const HISTORY_STATUSES = new Set(["delivered", "cancelled"]);

function MyOrdersTab({ initialFilter = "all" }: { initialFilter?: OrderFilter } = {}) {
  const { lang, cnyToCad } = useApp();
  const tr = (zh: string, en: string) => (lang === "zh" ? zh : en);
  const [items, setItems] = useState<MyOrderItem[] | null>(null);
  const [filter, setFilter] = useState<OrderFilter>(initialFilter);
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    Promise.all([
      sb.from("orders").select("id,order_no,status,total_cny,payment_status,created_at,shipping_method,tracking_no,domestic_tracking_no").order("created_at", { ascending: false }),
      sb.from("forwarding_orders").select("id,request_no,status,fee_cny,payment_status,weight_kg,warehouse,shipping_method,tracking_no,domestic_tracking_no,note,created_at,freight_snapshot").order("created_at", { ascending: false }),
      sb.from("waybills").select("order_id,forwarding_id,waybill_no,status,weight_kg,length_cm,width_cm,height_cm,created_at").order("created_at"),
    ]).then(([o, f, w]: any) => {
      const byOrder = new Map<string, MyWaybill[]>();
      const byFwd = new Map<string, MyWaybill[]>();
      const sumOrder = new Map<string, { w: number; v: number }>();
      const sumFwd = new Map<string, { w: number; v: number }>();
      (w.data ?? []).forEach((wb: any) => {
        const m = wb.order_id ? byOrder : byFwd;
        const s = wb.order_id ? sumOrder : sumFwd;
        const key = wb.order_id ?? wb.forwarding_id;
        if (!key) return;
        if (!m.has(key)) m.set(key, []);
        m.get(key)!.push({ waybill_no: wb.waybill_no, status: wb.status });
        const cur = s.get(key) ?? { w: 0, v: 0 };
        cur.w += Number(wb.weight_kg ?? 0);
        const l = Number(wb.length_cm ?? 0), wd = Number(wb.width_cm ?? 0), h = Number(wb.height_cm ?? 0);
        if (l && wd && h) cur.v += (l * wd * h) / 1_000_000;
        s.set(key, cur);
      });
      const combined: MyOrderItem[] = [
        ...(o.data ?? []).map((r: any) => ({
          kind: "order" as const,
          id: r.id,
          no: r.order_no,
          status: r.status,
          created_at: r.created_at,
          fee_cny: Number(r.total_cny ?? 0),
          payment_status: r.payment_status ?? "unpaid",
          tracking_no: r.tracking_no,
          shipping_method: r.shipping_method,
          domestic_tracking_no: r.domestic_tracking_no ?? null,
          waybills: byOrder.get(r.id) ?? [],
          total_weight_kg: sumOrder.get(r.id)?.w ?? 0,
          total_volume_m3: sumOrder.get(r.id)?.v ?? 0,
        })),
        ...(f.data ?? []).map((r: any) => {
          const snap: any = r.freight_snapshot ?? null;
          const totalCad = Number(snap?.total_cad ?? 0);
          return {
            kind: "forwarding" as const,
            id: r.id,
            no: r.request_no,
            status: r.status,
            created_at: r.created_at,
            fee_cny: Number(r.fee_cny ?? 0),
            total_cad: totalCad > 0 ? totalCad : null,
            payment_status: r.payment_status ?? "unpaid",
            tracking_no: r.tracking_no,
            shipping_method: r.shipping_method,
            warehouse: r.warehouse,
            weight_kg: r.weight_kg,
            domestic_tracking_no: r.domestic_tracking_no ?? null,
            note: r.note,
            waybills: byFwd.get(r.id) ?? [],
            total_weight_kg: sumFwd.get(r.id)?.w ?? Number(r.weight_kg ?? 0),
            total_volume_m3: sumFwd.get(r.id)?.v ?? 0,
          };
        }),
      ];
      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setItems(combined);
    });
  }, []);


  if (items === null) return <Spinner />;

  // 电商订单 = 集运状态 + 前置「代采购 procurement」；`pending` 在电商语义下表示「已发货等待入库」
  const orderStatus = (s: string) => ({
    paid: tr("已支付", "Paid"),
    procurement: tr("代采购", "Procurement"),
    pending: tr("已发货等待入库", "Shipped — awaiting intake"),
    received: tr("已到达集运仓", "Arrived at warehouse"),
    processing: tr("封箱打包", "Packed"),
    packed: tr("封箱打包", "Packed"),
    shipped: tr("运输中", "In transit"),
    in_transit: tr("正在派送", "Out for delivery"),
    ready_pickup: tr("待取货", "Ready for pickup"),
    delivered: tr("已完成", "Completed"),
    cancelled: tr("已取消", "Cancelled"),
  } as Record<string, string>)[s] ?? s;

  const fwdStatus = (s: string) => ({
    pending: tr("未入库", "Pending arrival"), received: tr("已到达集运仓", "Arrived at warehouse"),
    packed: tr("封箱打包", "Packed"), shipped: tr("运输中", "In transit"),
    in_transit: tr("正在派送", "Out for delivery"), ready_pickup: tr("待取货", "Ready for pickup"),
    delivered: tr("已完成", "Completed"), cancelled: tr("已取消", "Cancelled"),
  } as Record<string, string>)[s] ?? s;

  const statusLabel = (it: MyOrderItem) => it.kind === "order" ? orderStatus(it.status) : fwdStatus(it.status);

  const byFilter = items.filter((it) => {
    if (filter === "all") return true;
    if (filter === "order") return it.kind === "order";
    if (filter === "forwarding") return it.kind === "forwarding";
    if (filter === "unwarehoused") return it.kind === "forwarding" && it.status === "pending";
    return true;
  });
  const byHistory = showHistory ? byFilter : byFilter.filter((it) => !HISTORY_STATUSES.has(it.status));
  const q = query.trim().toLowerCase();
  const filtered = !q ? byHistory : byHistory.filter((it) => {
    const dateStr = new Date(it.created_at).toLocaleString(lang === "zh" ? "zh-CN" : "en-CA").toLowerCase();
    return (
      it.no.toLowerCase().includes(q) ||
      (it.tracking_no ?? "").toLowerCase().includes(q) ||
      statusLabel(it).toLowerCase().includes(q) ||
      it.status.toLowerCase().includes(q) ||
      dateStr.includes(q)
    );
  });

  const counts = {
    all: items.length,
    order: items.filter((it) => it.kind === "order").length,
    forwarding: items.filter((it) => it.kind === "forwarding").length,
    unwarehoused: items.filter((it) => it.kind === "forwarding" && it.status === "pending").length,
  };
  const historyCount = items.filter((it) => HISTORY_STATUSES.has(it.status)).length;

  const filterBtn = (k: OrderFilter, zh: string, en: string) => (
    <button
      key={k}
      onClick={() => setFilter(k)}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${filter === k ? "bg-brand text-white" : "border border-border bg-surface text-ink-soft hover:border-brand/40"}`}
    >
      {tr(zh, en)} ({counts[k]})
    </button>
  );

  if (items.length === 0) return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">{tr("我的订单/运单", "My orders / waybills")}</h2>
      </div>
      <Empty icon={<Package />} text={tr("还没有订单或运单", "No orders or waybills yet")}
        cta={
          <div className="mt-4 flex justify-center gap-4">
            <Link to="/products" className="text-sm font-medium text-brand hover:underline">{tr("去逛逛 →", "Start shopping →")}</Link>
            <Link to="/forwarding" className="text-sm font-medium text-brand hover:underline">{tr("发起集运 →", "New forwarding →")}</Link>
          </div>
        }
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-xl font-bold">{tr("我的订单/运单", "My orders / waybills")}</h2>
        <Link to="/forwarding" className="inline-flex items-center gap-1 self-start rounded-full bg-cta-gradient px-4 py-2 text-xs font-semibold text-cta-foreground shadow-elevated">
          <Plus className="h-3.5 w-3.5" />{tr("发起新集运", "New request")}
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {filterBtn("all", "全部", "All")}
        {filterBtn("order", "商城", "Shop")}
        {filterBtn("forwarding", "集运", "Forwarding")}
        {filterBtn("unwarehoused", "未入库", "Awaiting arrival")}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tr("搜索单号 / 日期 / 包裹状态", "Search no. / date / status")}
          className={inputCls + " sm:max-w-md"}
        />
        <label className="inline-flex shrink-0 items-center gap-2 px-1 text-xs text-ink-soft">
          <input type="checkbox" checked={showHistory} onChange={(e) => setShowHistory(e.target.checked)} />
          {tr(`显示历史订单 (${historyCount})`, `Show history (${historyCount})`)}
        </label>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-ink-soft">
            {tr("没有符合条件的订单", "No matching orders")}
          </div>
        )}
        {filtered.map((o) => (
          <div key={`${o.kind}-${o.id}`} className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${o.kind === "order" ? "bg-brand/10 text-brand" : "bg-cta/10 text-cta"}`}>
                {o.kind === "order" ? <><ShoppingCart className="h-3 w-3" />{tr("商城", "Shop")}</> : <><Truck className="h-3 w-3" />{tr("集运", "Forwarding")}</>}
              </span>
              <span className="font-mono text-sm font-semibold">{o.no}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${HISTORY_STATUSES.has(o.status) ? "bg-accent text-ink-soft" : "bg-brand/10 text-brand"}`}>
                {statusLabel(o)}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${o.payment_status === "paid" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                {o.payment_status === "paid" ? tr("已付款", "Paid") : tr("待付款", "Unpaid")}
              </span>
              {o.kind === "forwarding" && o.warehouse && (
                <span className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] text-ink-soft">
                  {o.warehouse === "guangzhou" ? tr("广州仓", "Guangzhou") : tr("义乌仓", "Yiwu")} · {o.shipping_method === "air" ? tr("空运", "Air") : tr("海运", "Sea")}
                </span>
              )}
              <span className="text-xs text-ink-soft">{new Date(o.created_at).toLocaleString(lang === "zh" ? "zh-CN" : "en-CA")}</span>
              {(() => {
                const amountCad = o.kind === "forwarding" && (o.total_cad ?? 0) > 0
                  ? Number(o.total_cad)
                  : cnyToCad(o.fee_cny);
                return amountCad > 0 ? (
                  <div className="ml-auto text-right">
                    <div className="font-display text-base font-bold text-brand-gradient">CA${amountCad.toFixed(2)}</div>
                    <div className="text-[11px] text-ink-soft">
                      {(o.total_weight_kg ?? 0) > 0 && <span>{(o.total_weight_kg ?? 0).toFixed(2)} kg</span>}
                      {(o.total_weight_kg ?? 0) > 0 && (o.total_volume_m3 ?? 0) > 0 && <span> · </span>}
                      {(o.total_volume_m3 ?? 0) > 0 && <span>{(o.total_volume_m3 ?? 0).toFixed(3)} m³</span>}
                    </div>
                  </div>
                ) : null;
              })()}

            </div>

            {o.domestic_tracking_no && (
              <div className="mt-2 text-xs text-ink-soft">
                {tr("国内单号", "Domestic")}: <span className="font-mono">{o.domestic_tracking_no}</span>
              </div>
            )}
            {o.kind === "forwarding" && o.note && <div className="mt-1 text-xs text-ink-soft">{tr("备注", "Note")}: {o.note}</div>}

            {(o.waybills?.length ?? 0) > 0 && (
              <WaybillsDropdown waybills={o.waybills!} lang={lang} />
            )}

            <div className="mt-3 flex flex-wrap items-center gap-3">
              {o.tracking_no && (o.waybills?.length ?? 0) === 0 && (
                <button onClick={() => setOpenId(openId === `${o.kind}-${o.id}` ? null : `${o.kind}-${o.id}`)} className="inline-flex items-center gap-2 text-xs text-brand hover:underline">
                  {o.kind === "order" ? <Package className="h-3 w-3" /> : <Truck className="h-3 w-3" />}
                  {tr("追踪", "Track")}: {o.tracking_no}
                  <span className="text-ink-soft">{openId === `${o.kind}-${o.id}` ? "▲" : "▼"}</span>
                </button>
              )}
              {o.kind === "order" ? (
                <Link
                  to="/orders/$orderId"
                  params={{ orderId: o.id }}
                  className="ml-auto inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:border-brand hover:text-brand"
                >
                  {tr("查看详情", "View detail")} <ArrowRight className="h-3 w-3" />
                </Link>
              ) : (
                <Link
                  to="/forwarding/$forwardingId"
                  params={{ forwardingId: o.id }}
                  className="ml-auto inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:border-brand hover:text-brand"
                >
                  {tr("查看详情", "View detail")} <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
            {openId === `${o.kind}-${o.id}` && o.tracking_no && <InlineTrack trackingNo={o.tracking_no} />}
          </div>
        ))}
      </div>
    </div>
  );
}

const WAYBILL_STATUS_LABELS: Record<string, [string, string]> = {
  pending: ["未入库", "Pending arrival"], received: ["已入库", "Received"], packed: ["封箱打包", "Packed"],
  shipped: ["运输中", "In transit"], in_transit: ["正在派送", "Out for delivery"],
  ready_pickup: ["待取货", "Ready for pickup"], delivered: ["已完成", "Completed"],
  cancelled: ["已取消", "Cancelled"],
};
function WaybillsDropdown({ waybills, lang }: { waybills: MyWaybill[]; lang: "zh" | "en" }) {
  const [open, setOpen] = useState(false);
  const tr = (zh: string, en: string) => (lang === "zh" ? zh : en);
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-background/40 px-3 py-1.5 text-xs font-medium hover:border-brand hover:text-brand"
      >
        <Package className="h-3 w-3" />
        {tr("运单", "Waybills")} ({waybills.length})
        <span className="text-ink-soft">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5 rounded-xl border border-border bg-background/40 p-3">
          {waybills.map((w, i) => {
            const label = WAYBILL_STATUS_LABELS[w.status] ?? [w.status, w.status];
            return (
              <li key={w.waybill_no + i} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono">{w.waybill_no}</span>
                <span className="ml-auto rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">
                  {lang === "zh" ? label[0] : label[1]}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}


// ===================== Wallet =====================
function WalletTab() {
  const { lang, cadToCny } = useApp();
  const tr = (zh: string, en: string) => (lang === "zh" ? zh : en);
  const doRecharge = useServerFn(rechargeWallet);
  const [wallet, setWallet] = useState<WalletRow | null>(null);
  const [txs, setTxs] = useState<WalletTx[] | null>(null);
  const [amount, setAmount] = useState<number>(20);
  const [channel, setChannel] = useState<"alipay" | "wechat" | "card" | "paypal">("card");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data: w }, { data: t }] = await Promise.all([
      sb.from("wallets").select("*").maybeSingle(),
      sb.from("wallet_transactions").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setWallet(w ?? { balance_cad: 0, user_id: "" });
    setTxs(t ?? []);
  };
  useEffect(() => { load(); }, []);

  const presets = [10, 20, 40, 100, 200, 500];

  const recharge = async () => {
    if (!amount || amount < 2) return toast.error(tr("最低充值 CA$2", "Min top-up CA$2"));
    setBusy(true);
    try {
      const r = await doRecharge({ data: { amountCad: amount, channel } });
      toast.success(tr(
        `充值成功：CA$${r.amount_cad.toFixed(2)}（≈¥${r.amount_cny.toFixed(2)}）已到账`,
        `Top-up successful: CA$${r.amount_cad.toFixed(2)} (≈¥${r.amount_cny.toFixed(2)}) credited`,
      ));
      await load();
    } catch (e: any) {
      toast.error(e.message ?? tr("充值失败", "Top-up failed"));
    } finally {
      setBusy(false);
    }
  };

  if (!wallet || !txs) return <Spinner />;

  const typeLabel = (t: WalletTx) => {
    if (t.type === "spend" && t.channel === "shop") return tr("电商扣款", "Shop deduction");
    if (t.type === "spend" && t.channel === "batch") return tr("集运扣款", "Forwarding deduction");
    if (t.type === "spend" && t.channel === "storage") return tr("仓库扣费", "Storage fee deduction");
    return ({
      recharge: tr("充值", "Top-up"), spend: tr("消费", "Spend"),
      refund: tr("退款", "Refund"), adjust: tr("调整", "Adjust"),
    } as Record<string, string>)[t.type] ?? t.type;
  };
  const channelLabel = (c: string) => ({
    card: tr("信用卡", "Card"), wechat: tr("微信支付", "WeChat Pay"),
    alipay: tr("支付宝", "Alipay"), paypal: "PayPal", admin: tr("管理员", "Admin"),
    wallet: tr("钱包", "Wallet"), shop: tr("电商", "Shop"), batch: tr("集运", "Forwarding"),
    storage: tr("仓库", "Storage"),
  } as Record<string, string>)[c] ?? c;
  const statusLabel = (s: string) => ({
    pending: tr("待支付", "Pending"), completed: tr("已完成", "Completed"),
    failed: tr("失败", "Failed"), cancelled: tr("已取消", "Cancelled"),
  } as Record<string, string>)[s] ?? s;

  const balanceCad = Number(wallet.balance_cad ?? 0);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-brand/30 bg-brand-gradient p-6 text-white shadow-elevated">
        <div className="text-xs uppercase tracking-wide opacity-80">{tr("当前余额", "Current balance")}</div>
        <div className="mt-2 font-display text-4xl font-bold">CA${balanceCad.toFixed(2)}</div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6">
        <div className="mb-4">
          <h3 className="font-display text-lg font-bold">{tr("充值 (加币结算)", "Top up (CAD settlement)")}</h3>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          {presets.map((v) => (
            <button key={v} onClick={() => setAmount(v)}
              className={`rounded-xl border px-4 py-2 text-sm transition ${amount === v ? "border-brand bg-brand/5 text-brand font-semibold" : "border-border text-ink-soft"}`}>
              CA${v}
            </button>
          ))}
        </div>
        <Field label={tr("自定义金额 (CAD)", "Custom amount (CAD)")}>
          <input
            type="number"
            min={2}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className={inputCls}
          />
        </Field>
        <p className="mt-2 text-xs text-ink-soft">{tr("账户以加币记账", "Account is kept in CAD")}</p>
        <div className="mt-4">
          <div className="mb-2 text-xs font-medium text-ink-soft">{tr("支付方式", "Payment method")}</div>
          <div className="grid grid-cols-4 gap-2 rounded-full bg-accent p-1">
            {(["card", "wechat", "alipay", "paypal"] as const).map((c) => (
              <button key={c} onClick={() => setChannel(c)}
                className={`rounded-full py-2 text-xs font-medium transition sm:text-sm ${channel === c ? "bg-background text-foreground shadow-sm" : "text-ink-soft"}`}>
                {c === "alipay" ? tr("支付宝", "Alipay") : c === "wechat" ? tr("微信支付", "WeChat Pay") : c === "paypal" ? "PayPal" : tr("信用卡", "Card")}
              </button>
            ))}
          </div>
        </div>
        <button onClick={recharge} disabled={busy} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-cta-gradient text-sm font-semibold text-cta-foreground shadow-elevated transition hover:brightness-110 disabled:opacity-50">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {tr(`充值 CA$${amount}`, `Top up CA$${amount}`)}
        </button>
        <p className="mt-2 text-center text-[11px] text-ink-soft">
          {tr("⚠️ 暂未接入真实支付网关，充值将直接到账用于测试", "⚠️ No live payment gateway yet — top-ups are credited immediately for testing")}
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6">
        <h3 className="mb-4 font-display text-lg font-bold">{tr("账单流水", "Transactions")}</h3>
        {txs.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-soft">{tr("暂无流水", "No transactions yet")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {txs.map((t) => {
              const positive = ["recharge", "refund", "adjust"].includes(t.type);
              const cad = Number(t.amount_cad ?? 0);
              const cny = t.amount_cny != null ? Number(t.amount_cny) : cadToCny(cad);
              return (
                <li key={t.id} className="flex items-center gap-3 py-3">
                  <span className={`grid h-9 w-9 place-items-center rounded-full ${positive ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                    {positive ? <ArrowDownCircle className="h-4 w-4" /> : <ArrowUpCircle className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{typeLabel(t)}</span>
                      <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] text-ink-soft">{statusLabel(t.status)}</span>
                      {t.channel && !["shop", "wallet", "batch", "storage"].includes(t.channel) && (
                        <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] text-ink-soft">{channelLabel(t.channel)}</span>
                      )}
                    </div>
                    <div className="text-[11px] text-ink-soft">
                      {new Date(t.created_at).toLocaleString(lang === "zh" ? "zh-CN" : "en-CA")}
                    </div>
                    {t.note && <div className="mt-0.5 truncate text-[11px] text-ink-soft">{t.note}</div>}
                  </div>
                  <div className={`text-right font-display text-sm font-bold ${positive ? "text-success" : "text-foreground"}`}>
                    <div>{positive ? "+" : "-"}CA${cad.toFixed(2)}</div>
                    <div className="text-[11px] font-normal text-ink-soft">≈¥{cny.toFixed(2)}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ===================== Helpers =====================
function InlineTrack({ trackingNo }: { trackingNo: string }) {
  const { lang } = useApp();
  const [data, setData] = useState<any | null | "err">(null);
  useEffect(() => {
    sb.rpc("lookup_shipment", { _tracking_no: trackingNo }).then(({ data, error }: any) => {
      if (error || !data) return setData("err"); setData(data);
    });
  }, [trackingNo]);
  if (data === null) return <div className="mt-3 grid h-20 place-items-center"><Loader2 className="h-4 w-4 animate-spin text-ink-soft" /></div>;
  if (data === "err") return <div className="mt-3 text-xs text-ink-soft">{lang === "zh" ? "暂无轨迹数据" : "No tracking data yet"}</div>;
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-border bg-background">
      <TrackingTimeline events={(data as any).events ?? []} lang={lang} />
    </div>
  );
}

const inputCls = "h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30";
function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`flex flex-col gap-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-xs font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
function Spinner() { return <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-ink-soft" /></div>; }
function Empty({ icon, text, cta }: { icon: React.ReactNode; text: string; cta?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface py-16 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent text-ink-soft">{icon}</div>
      <p className="mt-3 text-ink-soft">{text}</p>
      {cta}
    </div>
  );
}
