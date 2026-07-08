import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { getUserDetail, setUserRoles, setUserVipAndPoints, setUserBlacklist, setUserFeeScheme, getMyRoles, adjustUserWallet, type AppRole } from "@/lib/admin.functions";
import { ROLE_LABEL, ROLE_COLOR, ASSIGNABLE_ROLES } from "@/lib/admin-roles";
import { VIP_LEVELS, VIP_LABEL, VIP_COLOR, type VipLevel } from "@/lib/vip-levels";
import {
  ArrowLeft, Loader2, Save, ShieldCheck, Mail, Phone, Calendar,
  Wallet, Package, User as UserIcon, Hash, Lock, CheckCircle2, AlertCircle,
  Crown, Sparkles, Receipt, ExternalLink, Ban,
} from "lucide-react";


export const Route = createFileRoute("/admin/users/$userId")({
  component: UserDetailPage,
});

function UserDetailPage() {
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchDetail = useServerFn(getUserDetail);
  const fetchMyRoles = useServerFn(getMyRoles);
  const saveRoles = useServerFn(setUserRoles);

  const detailQ = useQuery({
    queryKey: ["admin-user-detail", userId],
    queryFn: () => fetchDetail({ data: { userId } }),
  });
  const meQ = useQuery({ queryKey: ["my-roles"], queryFn: () => fetchMyRoles(), staleTime: 60_000 });

  const myRoles = meQ.data?.roles ?? [];
  const isOwner = myRoles.includes("owner");
  const isManager = myRoles.includes("manager");
  const canEdit = isOwner || isManager;

  const [selected, setSelected] = useState<Set<AppRole>>(new Set());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  useEffect(() => {
    if (detailQ.data) {
      setSelected(new Set(detailQ.data.roles.filter((r) => r !== "customer")));
      setErr(null);
      setOkMsg(null);
    }
  }, [detailQ.data]);

  const targetIsOwner = useMemo(
    () => (detailQ.data?.roles ?? []).includes("owner"),
    [detailQ.data],
  );

  if (detailQ.isLoading) {
    return <div className="grid h-[60vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>;
  }
  if (detailQ.isError || !detailQ.data) {
    return <div className="p-6 text-rose-400">{(detailQ.error as Error)?.message ?? "未找到用户"}</div>;
  }

  const d = detailQ.data;

  // Per-role lock rules (mirrors server-side enforcement)
  const isRoleLocked = (r: AppRole): { locked: boolean; reason?: string } => {
    if (!canEdit) return { locked: true, reason: "无权限" };
    if (isOwner) return { locked: false };
    // manager rules:
    if (targetIsOwner) return { locked: true, reason: "无法修改总负责人" };
    if (r === "owner") return { locked: true, reason: "仅总负责人可分配" };
    if (r === "manager") return { locked: true, reason: "仅总负责人可分配" };
    return { locked: false };
  };

  const toggle = (r: AppRole) => {
    const { locked } = isRoleLocked(r);
    if (locked) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r); else next.add(r);
      return next;
    });
  };

  const initialSet = new Set<AppRole>((d.roles ?? []).filter((r) => r !== "customer"));
  const hasChanges =
    selected.size !== initialSet.size ||
    Array.from(selected).some((r) => !initialSet.has(r));

  const onSave = async () => {
    setSaving(true); setErr(null); setOkMsg(null);
    try {
      await saveRoles({ data: { userId, roles: Array.from(selected) } });
      await qc.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
      await qc.invalidateQueries({ queryKey: ["admin-users"] });
      setOkMsg("角色已更新");
    } catch (e: any) {
      setErr(e?.message ?? "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const initials = (d.profile.full_name ?? d.profile.email ?? "?").trim().slice(0, 1).toUpperCase();

  return (
    <div className="mx-auto max-w-6xl p-6">
      {/* Top bar */}
      <div className="mb-5 flex items-center justify-between">
        <button onClick={() => navigate({ to: "/admin/users" })}
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" />返回用户列表
        </button>
        <div className="text-xs text-slate-500">
          您的身份：
          {isOwner ? <span className="text-rose-400 font-semibold">总负责人</span>
            : isManager ? <span className="text-amber-400 font-semibold">主管</span>
            : <span>员工</span>}
        </div>
      </div>

      {/* Header card */}
      <section className="mb-5 rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.04] to-white/[0.02] p-6">
        <div className="flex flex-wrap items-center gap-5">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-brand/15 text-2xl font-bold text-brand">
            {initials}
          </div>
          <div className="flex-1 min-w-[200px]">
            <h1 className="font-display text-2xl font-bold">{d.profile.full_name ?? "未命名用户"}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
              <span className="inline-flex items-center gap-1"><Hash className="h-3.5 w-3.5" />
                <span className="font-mono">{d.profile.customer_code ?? "—"}</span>
              </span>
              <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{d.profile.email ?? "—"}</span>
              <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{d.profile.phone ?? "—"}</span>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1">
              {d.profile.is_blacklisted && (
                <span title={d.profile.blacklist_reason ?? "已拉黑"} className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-300">
                  <Ban className="h-3 w-3" />已加入黑名单
                </span>
              )}
              {d.roles.length === 0 && <span className="text-xs text-slate-500">无角色</span>}
              {d.roles.map((r) => (
                <span key={r} className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${ROLE_COLOR[r]}`}>
                  {ROLE_LABEL[r].zh}
                </span>
              ))}
            </div>
          </div>
          <Link to="/admin/invoices" search={{ userId }} className="inline-flex items-center gap-1.5 rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm font-semibold text-blue-200 hover:bg-blue-500/20">
            <Receipt className="h-4 w-4" />查看全部账单
          </Link>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_400px]">
        {/* Left: info & stats */}
        <div className="space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={<Package className="h-4 w-4" />} label="历史订单" value={String(d.ordersCount)} accent="text-blue-400" />
            <StatCard icon={<Wallet className="h-4 w-4" />} label="钱包余额 (CAD)" value={`CA$${Number(d.wallet?.balance_cad ?? 0).toFixed(2)}`} accent="text-emerald-400" />
            <StatCard icon={<Wallet className="h-4 w-4" />} label="钱包余额 (CNY)" value={`¥${Number(d.wallet?.balance_cny ?? 0).toFixed(2)}`} accent="text-amber-400" />
          </div>

          {/* Profile details */}
          <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
            <h2 className="font-display text-base font-bold inline-flex items-center gap-2">
              <UserIcon className="h-4 w-4 text-slate-400" />基本资料
            </h2>
            <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
              <Field label="客户号" value={<span className="font-mono">{d.profile.customer_code ?? "—"}</span>} />
              <Field label="姓名" value={d.profile.full_name ?? "—"} />
              <Field label="邮箱" value={d.profile.email ?? "—"} />
              <Field label="电话" value={d.profile.phone ?? "—"} />
              <Field
                label="注册时间"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-500" />
                    {d.profile.created_at ? new Date(d.profile.created_at).toLocaleString() : "—"}
                  </span>
                }
              />
              <Field label="用户 ID" value={<span className="font-mono text-xs text-slate-400">{d.profile.id}</span>} />
            </dl>
          </section>

          {/* VIP & Points editor */}
          <VipPointsCard
            userId={userId}
            currentVip={(d.profile.vip_level ?? "normal") as VipLevel}
            currentPoints={Number(d.profile.points ?? 0)}
            canEdit={canEdit}
          />

          {/* Fee scheme preference */}
          <FeeSchemeCard
            userId={userId}
            current={(((d.profile as any).fee_scheme_preference) ?? "split") as "merged" | "split"}
            canEdit={canEdit}
          />

          {/* Wallet balance editor */}
          <WalletCard
            userId={userId}
            currentCny={Number(d.wallet?.balance_cny ?? 0)}
            currentCad={Number(d.wallet?.balance_cad ?? 0)}
            canEdit={canEdit}
          />


          {/* Blacklist */}
          <BlacklistCard
            userId={userId}
            currentBlacklisted={!!d.profile.is_blacklisted}
            currentReason={d.profile.blacklist_reason ?? ""}
            canEdit={canEdit}
            isSelf={d.profile.id === userId && false /* server enforces self-block */}
          />



          {/* Unpaid invoices / orders */}
          <UnpaidPanel
            invoices={d.unpaidInvoices ?? []}
            orders={d.unpaidOrders ?? []}
            forwardings={d.unpaidForwardings ?? []}
            unpaidAmountCny={Number(d.unpaidAmountCny ?? 0)}
          />
        </div>



        {/* Right: role panel */}
        <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />角色分配
            </h2>
            {!canEdit && <span className="text-[10px] text-slate-500">无权限</span>}
            {canEdit && !isOwner && <span className="text-[10px] text-amber-400">主管模式（受限）</span>}
          </div>

          <p className="mt-1.5 text-xs text-slate-400">
            "客人" 角色对所有注册用户默认开启，不可移除。
            {isManager && !isOwner && (
              <span className="block mt-1 text-amber-400/80">
                主管不可分配 / 撤销 总负责人 与 主管 角色，也无法修改总负责人。
              </span>
            )}
          </p>

          <div className="mt-4 space-y-1">
            {ASSIGNABLE_ROLES.map((r) => {
              const checked = selected.has(r);
              const { locked, reason } = isRoleLocked(r);
              return (
                <label
                  key={r}
                  className={`flex items-center gap-2.5 rounded-md border border-transparent px-2.5 py-2 text-sm transition ${
                    locked ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-white/10 hover:bg-white/[0.03]"
                  }`}
                  title={reason}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(r)}
                    disabled={locked}
                    className="h-4 w-4 accent-brand"
                  />
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${ROLE_COLOR[r]}`}>
                    {ROLE_LABEL[r].zh}
                  </span>
                  <span className="text-xs text-slate-500 flex-1">{ROLE_LABEL[r].en}</span>
                  {locked && <Lock className="h-3 w-3 text-slate-600" />}
                </label>
              );
            })}
          </div>

          {err && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {err}
            </div>
          )}
          {okMsg && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {okMsg}
            </div>
          )}

          {canEdit && (
            <div className="mt-4 flex gap-2">
              <button
                onClick={onSave}
                disabled={saving || !hasChanges}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                保存角色
              </button>
              <button
                onClick={() => setSelected(new Set(initialSet))}
                disabled={saving || !hasChanges}
                className="rounded-md border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-40"
              >
                重置
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="mt-0.5 font-semibold text-slate-100 break-all">{value}</dd>
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
      <div className={`inline-flex items-center gap-1.5 text-xs ${accent}`}>{icon}{label}</div>
      <div className="mt-1.5 font-display text-xl font-bold text-slate-100">{value}</div>
    </div>
  );
}

function VipPointsCard({ userId, currentVip, currentPoints, canEdit }: {
  userId: string; currentVip: VipLevel; currentPoints: number; canEdit: boolean;
}) {
  const qc = useQueryClient();
  const save = useServerFn(setUserVipAndPoints);
  const [vip, setVip] = useState<VipLevel>(currentVip);
  const [points, setPoints] = useState<number>(currentPoints);
  const [delta, setDelta] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => { setVip(currentVip); setPoints(currentPoints); }, [currentVip, currentPoints]);

  const dirty = vip !== currentVip || points !== currentPoints || delta !== 0;

  const onSave = async () => {
    setBusy(true); setMsg(null);
    try {
      await save({ data: {
        userId,
        vipLevel: vip !== currentVip ? vip : undefined,
        points: points !== currentPoints ? points : undefined,
        pointsDelta: delta !== 0 ? delta : undefined,
      } });
      await qc.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
      await qc.invalidateQueries({ queryKey: ["admin-users"] });
      setDelta(0);
      setMsg({ kind: "ok", text: "已更新" });
    } catch (e: any) {
      setMsg({ kind: "err", text: e?.message ?? "保存失败" });
    } finally { setBusy(false); }
  };

  return (
    <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
      <h2 className="font-display text-base font-bold inline-flex items-center gap-2">
        <Crown className="h-4 w-4 text-amber-400" />客户等级 & 积分
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1.5 text-[10px] uppercase tracking-wider text-slate-400">VIP 等级</div>
          <div className="flex flex-wrap gap-1.5">
            {VIP_LEVELS.map((lv) => (
              <button
                key={lv}
                type="button"
                disabled={!canEdit}
                onClick={() => setVip(lv)}
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${vip === lv ? VIP_COLOR[lv] + " ring-1 ring-white/40" : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20"} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {VIP_LABEL[lv]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-[10px] uppercase tracking-wider text-slate-400">积分余额</div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-300" />
            <input
              type="number"
              value={points}
              disabled={!canEdit}
              onChange={(e) => setPoints(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
              className="w-28 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm font-mono text-violet-200 focus:border-brand focus:outline-none"
            />
            <span className="text-xs text-slate-500">分</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">快速调整</span>
            <input
              type="number"
              value={delta}
              disabled={!canEdit}
              onChange={(e) => setDelta(Math.floor(Number(e.target.value) || 0))}
              placeholder="±0"
              className="w-20 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs font-mono focus:border-brand focus:outline-none"
            />
            <button type="button" disabled={!canEdit} onClick={() => setDelta((d) => d + 100)}
              className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-white/5 disabled:opacity-40">+100</button>
            <button type="button" disabled={!canEdit} onClick={() => setDelta((d) => d - 100)}
              className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-white/5 disabled:opacity-40">-100</button>
          </div>
          <p className="mt-1 text-[10px] text-slate-500">设置积分值会直接覆盖；快速调整以现有积分为基础叠加。</p>
        </div>
      </div>
      {msg && (
        <div className={`mt-3 rounded-md border px-3 py-1.5 text-xs ${msg.kind === "ok" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300"}`}>
          {msg.text}
        </div>
      )}
      {canEdit && (
        <button
          onClick={onSave}
          disabled={busy || !dirty}
          className="mt-3 inline-flex items-center gap-2 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          保存等级 & 积分
        </button>
      )}
    </section>
  );
}

function FeeSchemeCard({ userId, current, canEdit }: { userId: string; current: "merged" | "split"; canEdit: boolean }) {
  const qc = useQueryClient();
  const save = useServerFn(setUserFeeScheme);
  const [scheme, setScheme] = useState<"merged" | "split">(current);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  useEffect(() => { setScheme(current); }, [current]);
  const dirty = scheme !== current;

  const onSave = async () => {
    setBusy(true); setMsg(null);
    try {
      await save({ data: { userId, scheme } });
      await qc.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
      setMsg({ kind: "ok", text: "费用方案已更新" });
    } catch (e: any) {
      setMsg({ kind: "err", text: e?.message ?? "保存失败" });
    } finally { setBusy(false); }
  };

  const opt = (v: "merged" | "split", label: string, desc: string) => (
    <button
      key={v}
      type="button"
      disabled={!canEdit}
      onClick={() => setScheme(v)}
      className={`flex-1 rounded-lg border p-3 text-left transition ${scheme === v ? "border-brand/50 bg-brand/10" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <div className="text-sm font-semibold text-slate-100">{label}</div>
      <div className="mt-1 text-[11px] text-slate-400">{desc}</div>
    </button>
  );

  return (
    <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
      <h2 className="font-display text-base font-bold inline-flex items-center gap-2">
        <Receipt className="h-4 w-4 text-emerald-400" />费用方案偏好
      </h2>
      <p className="mt-1 text-xs text-slate-400">决定该客户的箱号 / 托盘在有客户号时采用哪种计费方案。</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {opt("merged", "A. 合并收费", "按整箱 / 整托计算自身运费 + 下属关税/保险/清关")}
        {opt("split", "B. 不合并", "按下属运单逐条汇总，不计箱子/托盘自身运费与清关")}
      </div>
      {msg && (
        <div className={`mt-3 rounded-md border px-3 py-1.5 text-xs ${msg.kind === "ok" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300"}`}>{msg.text}</div>
      )}
      {canEdit && (
        <button onClick={onSave} disabled={busy || !dirty}
          className="mt-3 inline-flex items-center gap-2 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-50">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}保存偏好
        </button>
      )}
    </section>
  );
}

function UnpaidPanel({ invoices, orders, forwardings, unpaidAmountCny }: {
  invoices: any[]; orders: any[]; forwardings: any[]; unpaidAmountCny: number;
}) {
  return (
    <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-base font-bold inline-flex items-center gap-2">
          <Receipt className="h-4 w-4 text-rose-400" />未付款详情
        </h2>
        <div className="text-xs">
          <span className="text-slate-400">未付总额 </span>
          <span className="font-bold text-rose-300">¥{unpaidAmountCny.toFixed(2)}</span>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="mb-1.5 text-[10px] uppercase tracking-wider text-slate-400">未付账单 ({invoices.length})</div>
          {invoices.length === 0 ? (
            <div className="rounded-md border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-slate-500">无未付账单</div>
          ) : (
            <ul className="divide-y divide-white/5 rounded-md border border-white/5 bg-white/[0.02]">
              {invoices.map((inv: any) => {
                const due = Math.max(0, Number(inv.total_cny ?? 0) - Number(inv.paid_cny ?? 0));
                return (
                  <li key={inv.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                    <div className="min-w-0">
                      <Link to="/admin/invoices/$invoiceId" params={{ invoiceId: inv.id }} className="inline-flex items-center gap-1 font-mono text-brand hover:underline">
                        {inv.invoice_no} <ExternalLink className="h-3 w-3" />
                      </Link>
                      <div className="text-[10px] text-slate-500">
                        {inv.status === "overdue" ? <span className="text-rose-400">已逾期</span> : "未付"}
                        {inv.due_date && <> · 到期 {inv.due_date}</>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-rose-300">¥{due.toFixed(2)}</div>
                      <div className="text-[10px] text-slate-500">/ ¥{Number(inv.total_cny ?? 0).toFixed(2)}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          <div className="mb-1.5 text-[10px] uppercase tracking-wider text-slate-400">未付订单 ({orders.length})</div>
          {orders.length === 0 ? (
            <div className="rounded-md border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-slate-500">无未付订单</div>
          ) : (
            <ul className="divide-y divide-white/5 rounded-md border border-white/5 bg-white/[0.02]">
              {orders.slice(0, 10).map((o: any) => (
                <li key={o.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                  <Link to="/admin/orders/$orderId" params={{ orderId: o.id }} className="inline-flex items-center gap-1 font-mono text-brand hover:underline">
                    {o.order_no} <ExternalLink className="h-3 w-3" />
                  </Link>
                  <div className="text-right">
                    <div className="text-rose-200">¥{Number(o.total_cny ?? 0).toFixed(2)}</div>
                    <div className="text-[10px] text-slate-500">{o.status} · {o.payment_status ?? "—"}</div>
                  </div>
                </li>
              ))}
              {orders.length > 10 && <li className="px-3 py-2 text-[10px] text-slate-500">…还有 {orders.length - 10} 笔</li>}
            </ul>
          )}
        </div>

        {forwardings.length > 0 && (
          <div>
            <div className="mb-1.5 text-[10px] uppercase tracking-wider text-slate-400">集运订单 ({forwardings.length})</div>
            <ul className="divide-y divide-white/5 rounded-md border border-white/5 bg-white/[0.02]">
              {forwardings.slice(0, 5).map((f: any) => (
                <li key={f.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                  <Link to="/admin/forwardings/$forwardingId" params={{ forwardingId: f.id }} className="inline-flex items-center gap-1 font-mono text-brand hover:underline">
                    {String(f.id).slice(0, 8)} <ExternalLink className="h-3 w-3" />
                  </Link>
                  <span className="text-[10px] text-slate-500">{f.status}</span>
                </li>
              ))}
              {forwardings.length > 5 && <li className="px-3 py-2 text-[10px] text-slate-500">…还有 {forwardings.length - 5} 笔</li>}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function BlacklistCard({ userId, currentBlacklisted, currentReason, canEdit }: {
  userId: string; currentBlacklisted: boolean; currentReason: string; canEdit: boolean; isSelf?: boolean;
}) {
  const qc = useQueryClient();
  const save = useServerFn(setUserBlacklist);
  const [blacklisted, setBlacklisted] = useState(currentBlacklisted);
  const [reason, setReason] = useState(currentReason);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => { setBlacklisted(currentBlacklisted); setReason(currentReason); }, [currentBlacklisted, currentReason]);
  const dirty = blacklisted !== currentBlacklisted || (blacklisted && reason !== currentReason);

  const onSave = async () => {
    if (blacklisted && !currentBlacklisted && !confirm("确认将该客户加入黑名单？将禁止其下单和创建集运订单。")) return;
    setBusy(true); setMsg(null);
    try {
      await save({ data: { userId, blacklisted, reason: blacklisted ? reason : null } });
      await qc.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
      await qc.invalidateQueries({ queryKey: ["admin-users"] });
      setMsg({ kind: "ok", text: blacklisted ? "已加入黑名单" : "已移出黑名单" });
    } catch (e: any) {
      setMsg({ kind: "err", text: e?.message ?? "保存失败" });
    } finally { setBusy(false); }
  };

  return (
    <section className={`rounded-2xl border p-5 ${currentBlacklisted ? "border-rose-500/30 bg-rose-500/[0.06]" : "border-white/5 bg-white/[0.03]"}`}>
      <h2 className="font-display text-base font-bold inline-flex items-center gap-2">
        <Ban className={`h-4 w-4 ${currentBlacklisted ? "text-rose-400" : "text-slate-400"}`} />客户黑名单
      </h2>
      <p className="mt-1 text-xs text-slate-400">加入黑名单后，该客户将无法创建新的电商订单和集运订单。</p>
      <div className="mt-3 space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" disabled={!canEdit} checked={blacklisted} onChange={(e) => setBlacklisted(e.target.checked)} className="h-4 w-4 accent-rose-500" />
          <span className={blacklisted ? "font-semibold text-rose-300" : "text-slate-200"}>加入黑名单（禁止下单 / 集运）</span>
        </label>
        {blacklisted && (
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={!canEdit}
            placeholder="拉黑原因（可选，将作为提示信息）"
            rows={2}
            className="w-full rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm focus:border-rose-400 focus:outline-none"
          />
        )}
      </div>
      {msg && (
        <div className={`mt-3 rounded-md border px-3 py-1.5 text-xs ${msg.kind === "ok" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300"}`}>
          {msg.text}
        </div>
      )}
      {canEdit && (
        <button
          onClick={onSave}
          disabled={busy || !dirty}
          className={`mt-3 inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50 ${blacklisted ? "bg-rose-500 hover:bg-rose-500/90" : "bg-brand hover:bg-brand/90"}`}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {blacklisted ? (currentBlacklisted ? "更新黑名单" : "加入黑名单") : "移出黑名单"}
        </button>
      )}
    </section>
  );
}


function WalletCard({ userId, currentCny, currentCad, canEdit }: {
  userId: string; currentCny: number; currentCad: number; canEdit: boolean;
}) {
  const qc = useQueryClient();
  const save = useServerFn(adjustUserWallet);
  const [currency, setCurrency] = useState<"CNY" | "CAD">("CNY");
  const [mode, setMode] = useState<"delta" | "set">("delta");
  const [amount, setAmount] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const cur = currency === "CNY" ? currentCny : currentCad;
  const parsed = Number(amount);
  const valid = amount !== "" && Number.isFinite(parsed);
  const preview = valid ? (mode === "set" ? parsed : cur + parsed) : cur;
  const delta = valid ? preview - cur : 0;
  const symbol = currency === "CNY" ? "¥" : "CA$";

  const onSave = async () => {
    if (!valid) return;
    const confirmMsg = mode === "set"
      ? `确认将 ${currency} 余额设置为 ${symbol}${parsed.toFixed(2)}？`
      : `确认${delta >= 0 ? "增加" : "扣除"} ${symbol}${Math.abs(delta).toFixed(2)} ${currency}？`;
    if (!confirm(confirmMsg)) return;
    setBusy(true); setMsg(null);
    try {
      await save({ data: { userId, currency, mode, amount: parsed, note: note.trim() || null } });
      await qc.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
      setAmount(""); setNote("");
      setMsg({ kind: "ok", text: "余额已更新" });
    } catch (e: any) {
      setMsg({ kind: "err", text: e?.message ?? "保存失败" });
    } finally { setBusy(false); }
  };

  return (
    <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
      <h2 className="font-display text-base font-bold inline-flex items-center gap-2">
        <Wallet className="h-4 w-4 text-emerald-400" />钱包余额调整
      </h2>
      <p className="mt-1 text-xs text-slate-400">
        手动增加 / 扣除 或 直接设定客户钱包余额。每次操作会写入钱包流水与操作日志。
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1.5 text-[10px] uppercase tracking-wider text-slate-400">币种</div>
          <div className="flex gap-1.5">
            {(["CNY", "CAD"] as const).map((c) => (
              <button key={c} type="button" disabled={!canEdit}
                onClick={() => setCurrency(c)}
                className={`rounded-md border px-3 py-1 text-xs font-semibold ${currency === c ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200" : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20"} disabled:opacity-50`}>
                {c === "CNY" ? "人民币 CNY" : "加元 CAD"}
              </button>
            ))}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            当前余额：<span className="font-mono font-bold text-slate-100">{symbol}{cur.toFixed(2)}</span>
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-[10px] uppercase tracking-wider text-slate-400">操作方式</div>
          <div className="flex gap-1.5">
            <button type="button" disabled={!canEdit} onClick={() => setMode("delta")}
              className={`rounded-md border px-3 py-1 text-xs font-semibold ${mode === "delta" ? "border-brand/40 bg-brand/15 text-white" : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20"} disabled:opacity-50`}>
              增减（±）
            </button>
            <button type="button" disabled={!canEdit} onClick={() => setMode("set")}
              className={`rounded-md border px-3 py-1 text-xs font-semibold ${mode === "set" ? "border-brand/40 bg-brand/15 text-white" : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20"} disabled:opacity-50`}>
              直接设定
            </button>
          </div>
          <p className="mt-2 text-[10px] text-slate-500">
            {mode === "delta" ? "正数为充值，负数为扣款。" : "会将余额直接覆盖为指定值。"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <div className="mb-1.5 text-[10px] uppercase tracking-wider text-slate-400">
            金额 ({symbol}) {mode === "delta" ? "· 支持负数" : ""}
          </div>
          <input
            type="number"
            step="0.01"
            value={amount}
            disabled={!canEdit}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={mode === "delta" ? "如 100 或 -50" : "如 1000.00"}
            className="w-full rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 font-mono text-sm focus:border-brand focus:outline-none"
          />
        </div>
        <div className="sm:pt-6">
          {valid && (
            <div className="rounded-md border border-white/5 bg-white/[0.02] px-3 py-2 text-xs">
              <div className="text-slate-500">调整后余额</div>
              <div className="font-mono text-sm font-bold text-emerald-300">{symbol}{preview.toFixed(2)}</div>
              <div className={`text-[10px] ${delta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {delta >= 0 ? "+" : ""}{delta.toFixed(2)}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1.5 text-[10px] uppercase tracking-wider text-slate-400">备注（记入流水与日志）</div>
        <input
          value={note}
          disabled={!canEdit}
          onChange={(e) => setNote(e.target.value)}
          placeholder="例如：客服补偿 / 退款 / 手动扣款"
          className="w-full rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none"
        />
      </div>

      {msg && (
        <div className={`mt-3 rounded-md border px-3 py-1.5 text-xs ${msg.kind === "ok" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300"}`}>
          {msg.text}
        </div>
      )}

      {canEdit ? (
        <button
          onClick={onSave}
          disabled={busy || !valid || (mode === "delta" && parsed === 0)}
          className="mt-3 inline-flex items-center gap-2 rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500/90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          确认{mode === "set" ? "设定余额" : (parsed < 0 ? "扣款" : "充值")}
        </button>
      ) : (
        <p className="mt-3 text-[10px] text-slate-500">仅总负责人 / 主管可修改余额。</p>
      )}
    </section>
  );
}
