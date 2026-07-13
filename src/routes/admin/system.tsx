import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { getAppSettings, setAppSetting } from "@/lib/system.functions";
import { recomputeWaybillFees } from "@/lib/scan.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Settings as SettingsIcon, Save, Loader2, Upload, X as XIcon, Calculator, Route as RouteIcon } from "lucide-react";

export const Route = createFileRoute("/admin/system")({ component: SystemPage });

const KEYS = ["company_info", "print_template", "fx_rate", "points_rule", "route_type_display", "contact_offices", "contact_email_notify"];
const KEY_LABELS: Record<string, string> = {
  company_info: "公司基本信息",
  fx_rate: "汇率设置",
  points_rule: "积分规则",
  route_type_display: "线路类型设置",
  print_template: "打印模板",
  contact_offices: "办公室信息",
  contact_email_notify: "留言邮件通知",
};
const SIGN_TTL = 60 * 60 * 24 * 365 * 10; // 10y

type RouteTypeKey = "air" | "sea" | "express" | "truck" | "storage";
interface RouteTypeCfg { enabled: boolean; unit_price_cad: number; transit: string; route: string; dim_divisor: number }
const ROUTE_TYPE_LABELS: Record<RouteTypeKey, string> = { air: "空运", sea: "海运", express: "快递", truck: "陆运", storage: "仓储" };
const ROUTE_TYPE_DEFAULT: RouteTypeCfg = { enabled: false, unit_price_cad: 0, transit: "", route: "", dim_divisor: 6000 };
const ROUTE_TYPE_KEYS: RouteTypeKey[] = ["air", "sea", "express", "truck", "storage"];

type OfficeKey = "ca" | "cn";
interface OfficeCfg { label_zh: string; label_en: string; address: string; phone: string; email: string; hours_zh: string; hours_en: string }
const OFFICE_LABELS: Record<OfficeKey, string> = { ca: "加拿大办公室", cn: "中国仓库/办公室" };
const OFFICE_DEFAULT: OfficeCfg = { label_zh: "", label_en: "", address: "", phone: "", email: "", hours_zh: "", hours_en: "" };
const OFFICE_KEYS: OfficeKey[] = ["ca", "cn"];

interface EmailNotifyCfg { enabled: boolean; from_email: string; to_email: string; cc_emails: string[] }
const EMAIL_NOTIFY_DEFAULT: EmailNotifyCfg = { enabled: false, from_email: "", to_email: "", cc_emails: [] };

interface PointsRuleCfg { enabled: boolean; points_per_cad: number }
const POINTS_RULE_DEFAULT: PointsRuleCfg = { enabled: false, points_per_cad: 1 };


function SystemPage() {
  const fetchSettings = useServerFn(getAppSettings);
  const setOne = useServerFn(setAppSetting);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["app-settings", KEYS], queryFn: () => fetchSettings({ data: { keys: KEYS } }) });

  const [company, setCompany] = useState<any>({});
  const [tpl, setTpl] = useState<any>({});
  const [fx, setFx] = useState<any>({ cny_per_cad: 5.26 });
  const [routeTypes, setRouteTypes] = useState<Record<RouteTypeKey, RouteTypeCfg>>(
    Object.fromEntries(ROUTE_TYPE_KEYS.map((k) => [k, ROUTE_TYPE_DEFAULT])) as Record<RouteTypeKey, RouteTypeCfg>
  );
  const [offices, setOffices] = useState<Record<OfficeKey, OfficeCfg>>(
    Object.fromEntries(OFFICE_KEYS.map((k) => [k, OFFICE_DEFAULT])) as Record<OfficeKey, OfficeCfg>
  );
  const [emailNotify, setEmailNotify] = useState<EmailNotifyCfg>(EMAIL_NOTIFY_DEFAULT);
  const [ccInput, setCcInput] = useState("");
  const [pointsRule, setPointsRule] = useState<PointsRuleCfg>(POINTS_RULE_DEFAULT);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (q.data) {
      setCompany(q.data.settings.company_info ?? {});
      setTpl(q.data.settings.print_template ?? {});
      setFx(q.data.settings.fx_rate ?? { cny_per_cad: 5.26 });
      setPointsRule({ ...POINTS_RULE_DEFAULT, ...(q.data.settings.points_rule ?? {}) });
      const saved = q.data.settings.route_type_display ?? {};
      setRouteTypes(Object.fromEntries(ROUTE_TYPE_KEYS.map((k) => [k, { ...ROUTE_TYPE_DEFAULT, ...(saved[k] ?? {}) }])) as Record<RouteTypeKey, RouteTypeCfg>);
      const savedOffices = q.data.settings.contact_offices ?? {};
      setOffices(Object.fromEntries(OFFICE_KEYS.map((k) => [k, { ...OFFICE_DEFAULT, ...(savedOffices[k] ?? {}) }])) as Record<OfficeKey, OfficeCfg>);
      const savedNotify = { ...EMAIL_NOTIFY_DEFAULT, ...(q.data.settings.contact_email_notify ?? {}) };
      setEmailNotify(savedNotify);
      setCcInput((savedNotify.cc_emails ?? []).join(", "));
    }
  }, [q.data]);

  const save = async (key: string, value: any) => {
    setSaving(key);
    try {
      await setOne({ data: { key, value } });
      toast.success(`已保存：${KEY_LABELS[key] ?? key}`);
      qc.invalidateQueries({ queryKey: ["app-settings"] });
    } catch (e: any) { toast.error(e.message ?? "保存失败"); }
    finally { setSaving(null); }
  };

  if (q.isLoading) return <div className="grid h-[60vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-slate-500"/></div>;

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold inline-flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-blue-400"/>系统设置
        </h1>
      </div>

      <div className="space-y-5">
        {/* Company */}
        <Card title="公司基本信息">
          <Grid>
            <Field label="公司名称"><Input value={company.name ?? ""} onChange={v => setCompany({ ...company, name: v })}/></Field>
            <Field label="公司 Logo">
              <ImageUpload value={company.logo_url ?? ""} onChange={(url: string) => setCompany({ ...company, logo_url: url })} folder="company-logo"/>
            </Field>
            <Field label="联系电话"><Input value={company.phone ?? ""} onChange={v => setCompany({ ...company, phone: v })}/></Field>
            <Field label="邮箱"><Input value={company.email ?? ""} onChange={v => setCompany({ ...company, email: v })}/></Field>
            <Field label="微信号"><Input value={company.wechat ?? ""} onChange={v => setCompany({ ...company, wechat: v })}/></Field>
            <Field label="微信二维码">
              <ImageUpload value={company.wechat_qr_url ?? ""} onChange={(url: string) => setCompany({ ...company, wechat_qr_url: url })} folder="wechat-qr"/>
            </Field>
            <Field label="WhatsApp 号码"><Input value={company.whatsapp ?? ""} onChange={v => setCompany({ ...company, whatsapp: v })}/></Field>
            <Field label="WhatsApp 二维码">
              <ImageUpload value={company.whatsapp_qr_url ?? ""} onChange={(url: string) => setCompany({ ...company, whatsapp_qr_url: url })} folder="whatsapp-qr"/>
            </Field>
            <Field label="地址" full><Input value={company.address ?? ""} onChange={v => setCompany({ ...company, address: v })}/></Field>
          </Grid>
          <SaveBtn busy={saving === "company_info"} onClick={() => save("company_info", company)}/>
        </Card>

        {/* Exchange rate */}
        <Card title="汇率设置（CAD → CNY）">
          <Grid>
            <Field label="1 CAD = ? CNY">
              <Input type="number" value={String(fx.cny_per_cad ?? 5.26)} onChange={v => setFx({ ...fx, cny_per_cad: Number(v) || 0 })}/>
            </Field>
            <Field label="换算预览">
              <div className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-slate-300">
                CA$1 ≈ ¥{Number(fx.cny_per_cad || 0).toFixed(2)} · ¥1 ≈ CA${(1 / Math.max(Number(fx.cny_per_cad) || 1, 0.0001)).toFixed(4)}
              </div>
            </Field>
          </Grid>
          <SaveBtn busy={saving === "fx_rate"} onClick={() => save("fx_rate", fx)}/>
          <p className="mt-2 text-[11px] text-slate-500">系统以 CAD 为计算基准，所有 CNY 显示由此汇率换算。保存后前端会在下次加载时生效。</p>
        </Card>

        {/* Points rule */}
        <Card title="积分规则">
          <Grid>
            <Field label="启用消费返积分">
              <select value={pointsRule.enabled ? "1" : "0"} onChange={(e) => setPointsRule({ ...pointsRule, enabled: e.target.value === "1" })}
                className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm [&>option]:bg-[#0E1626]">
                <option value="0">关闭</option><option value="1">开启</option>
              </select>
            </Field>
            <Field label="每消费 CA$1 获得几积分">
              <Input type="number" value={String(pointsRule.points_per_cad ?? 1)} onChange={v => setPointsRule({ ...pointsRule, points_per_cad: Number(v) || 0 })}/>
            </Field>
          </Grid>
          <SaveBtn busy={saving === "points_rule"} onClick={() => save("points_rule", pointsRule)}/>
          <p className="mt-2 text-[11px] text-slate-500">电商下单和集运批次付款成功后，按实际扣款的 CAD 金额自动发放积分（向下取整）。</p>
        </Card>

        {/* Route type display (marketing only, not real billing) */}
        <Card title="线路类型设置">
          <p className="mb-3 text-[11px] text-slate-500">
            <RouteIcon className="mr-1 inline h-3 w-3" />
            仅用于官网展示与运费计算器（/shipping 页），不影响实际线路（管理 → 线路管理）与真实包裹收费。
          </p>
          <div className="space-y-3">
            {ROUTE_TYPE_KEYS.map((k) => {
              const cfg = routeTypes[k];
              const set = (patch: Partial<RouteTypeCfg>) => setRouteTypes({ ...routeTypes, [k]: { ...cfg, ...patch } });
              return (
                <div key={k} className={`rounded-xl border p-3 ${cfg.enabled ? "border-brand/30 bg-brand/5" : "border-white/10 bg-white/[0.02]"}`}>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="inline-flex items-center gap-2 text-sm font-semibold">
                      <input type="checkbox" checked={cfg.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
                      {ROUTE_TYPE_LABELS[k]}
                      <span className="font-mono text-[10px] font-normal text-slate-500">{k}</span>
                    </label>
                    {!cfg.enabled && <span className="text-[10px] text-slate-500">不在 /shipping 页展示</span>}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <Field label="单价 (CA$/kg)"><Input type="number" value={String(cfg.unit_price_cad)} onChange={v => set({ unit_price_cad: Number(v) || 0 })}/></Field>
                    <Field label="时效"><Input value={cfg.transit} onChange={v => set({ transit: v })}/></Field>
                    <Field label="线路"><Input value={cfg.route} onChange={v => set({ route: v })}/></Field>
                    <Field label="体积重除数"><Input type="number" value={String(cfg.dim_divisor)} onChange={v => set({ dim_divisor: Number(v) || 6000 })}/></Field>
                  </div>
                </div>
              );
            })}
          </div>
          <SaveBtn busy={saving === "route_type_display"} onClick={() => save("route_type_display", routeTypes)}/>
        </Card>

        {/* Office info (shown on public /contact page) */}
        <Card title="办公室信息">
          <p className="mb-3 text-[11px] text-slate-500">用于官网"联系我们"（/contact）页面展示，与仓库管理里的实际仓库配置无关。</p>
          <div className="space-y-4">
            {OFFICE_KEYS.map((k) => {
              const cfg = offices[k];
              const set = (patch: Partial<OfficeCfg>) => setOffices({ ...offices, [k]: { ...cfg, ...patch } });
              return (
                <div key={k} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <div className="mb-2 text-xs font-semibold text-slate-300">{OFFICE_LABELS[k]}</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="名称（中文）"><Input value={cfg.label_zh} onChange={v => set({ label_zh: v })}/></Field>
                    <Field label="名称（英文）"><Input value={cfg.label_en} onChange={v => set({ label_en: v })}/></Field>
                    <Field label="地址" ><Input value={cfg.address} onChange={v => set({ address: v })}/></Field>
                    <Field label="电话"><Input value={cfg.phone} onChange={v => set({ phone: v })}/></Field>
                    <Field label="邮箱"><Input value={cfg.email} onChange={v => set({ email: v })}/></Field>
                    <Field label="营业时间（中文）"><Input value={cfg.hours_zh} onChange={v => set({ hours_zh: v })}/></Field>
                    <Field label="营业时间（英文）"><Input value={cfg.hours_en} onChange={v => set({ hours_en: v })}/></Field>
                  </div>
                </div>
              );
            })}
          </div>
          <SaveBtn busy={saving === "contact_offices"} onClick={() => save("contact_offices", offices)}/>
        </Card>

        {/* Contact-form email notification */}
        <Card title="留言邮件通知">
          <p className="mb-3 text-[11px] text-slate-500">
            官网 /contact 页面收到新留言时，通过下面配置的 Gmail 邮箱自动发送通知邮件（抄送其他邮箱）。
            <br />
            ⚠️ 出于安全考虑，Gmail 的应用专用密码（App Password）<b>不会</b>存在数据库里，需要在服务器环境变量 <code className="rounded bg-white/10 px-1">GMAIL_APP_PASSWORD</code> 里单独配置——本地开发环境找 Claude 帮你写进 <code className="rounded bg-white/10 px-1">.env.local</code>；Lovable 线上环境去 Cloud 项目设置里加这个环境变量。
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="启用通知">
              <label className="flex h-11 items-center gap-2 px-1 text-sm">
                <input type="checkbox" checked={emailNotify.enabled} onChange={(e) => setEmailNotify({ ...emailNotify, enabled: e.target.checked })} />
                开启后每条新留言都会发邮件通知
              </label>
            </Field>
            <Field label="发件 Gmail 邮箱">
              <Input value={emailNotify.from_email} onChange={v => setEmailNotify({ ...emailNotify, from_email: v })}/>
            </Field>
            <Field label="收件邮箱（留空则发给发件邮箱自己）">
              <Input value={emailNotify.to_email} onChange={v => setEmailNotify({ ...emailNotify, to_email: v })}/>
            </Field>
            <Field label="抄送邮箱（多个用逗号分隔）" full>
              <Input value={ccInput} onChange={setCcInput}/>
            </Field>
          </div>
          <SaveBtn
            busy={saving === "contact_email_notify"}
            onClick={() => save("contact_email_notify", {
              ...emailNotify,
              cc_emails: ccInput.split(",").map((s) => s.trim()).filter(Boolean),
            })}
          />
        </Card>

        {/* Recompute waybill fees */}
        <RecomputeFeesCard/>


        {/* Print template */}
        <Card title="打印模板">
          <Grid>
            <Field label="Logo" full>
              <ImageUpload value={tpl.logo_url ?? ""} onChange={(url: string) => setTpl({ ...tpl, logo_url: url })} folder="print-logo"/>
            </Field>
            <Field label="抬头" full><Input value={tpl.header ?? ""} onChange={v => setTpl({ ...tpl, header: v })}/></Field>
            <Field label="页脚" full><Input value={tpl.footer ?? ""} onChange={v => setTpl({ ...tpl, footer: v })}/></Field>
          </Grid>
          <SaveBtn busy={saving === "print_template"} onClick={() => save("print_template", tpl)}/>
        </Card>
      </div>
    </div>
  );
}

function Card({ title, children }: any) {
  return <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
    <div className="mb-3 font-display font-bold">{title}</div>{children}
  </div>;
}
function Grid({ children }: any) { return <div className="grid gap-3 sm:grid-cols-2">{children}</div>; }
function Field({ label, children, full }: any) {
  return <div className={full ? "sm:col-span-2" : ""}>
    <div className="mb-1 text-[11px] uppercase tracking-wider text-slate-400">{label}</div>{children}
  </div>;
}
function Input({ value, onChange, type = "text" }: { value: string; onChange: (v: string) => void; type?: string }) {
  return <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
    className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm focus:border-brand focus:outline-none"/>;
}
function SaveBtn({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return <button onClick={onClick} disabled={busy}
    className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-50">
    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Save className="h-3.5 w-3.5"/>}保存
  </button>;
}

function ImageUpload({ value, onChange, folder }: { value: string; onChange: (url: string) => void; folder: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const upload = async (file: File) => {
    setErr(null); setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("system-assets").upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data, error: sErr } = await supabase.storage.from("system-assets").createSignedUrl(path, SIGN_TTL);
      if (sErr) throw sErr;
      onChange(data.signedUrl);
      toast.success("图片已上传");
    } catch (e: any) {
      setErr(e.message || String(e));
      toast.error(e.message || "上传失败");
    } finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        {value ? (
          <div className="relative">
            <img src={value} alt="" className="h-24 w-24 rounded-md border border-white/10 bg-white/5 object-contain"/>
            <button type="button" onClick={() => onChange("")} className="absolute -right-1.5 -top-1.5 rounded-full bg-red-500/90 p-0.5 text-white hover:bg-red-500" title="移除">
              <XIcon className="h-3 w-3"/>
            </button>
          </div>
        ) : (
          <div className="grid h-24 w-24 place-items-center rounded-md border border-dashed border-white/10 bg-white/5 text-[11px] text-slate-500">无图片</div>
        )}
        <div className="flex flex-col gap-2">
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10 disabled:opacity-50">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Upload className="h-3.5 w-3.5"/>}
            {value ? "更换图片" : "上传图片"}
          </button>
          <p className="text-[11px] text-slate-500">支持 PNG / JPG / WebP，建议 ≤ 2MB</p>
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}/>
      {err && <p className="text-[11px] text-red-400">✗ {err}</p>}
    </div>
  );
}

function RecomputeFeesCard() {
  const run = useServerFn(recomputeWaybillFees);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const onRun = async (onlyMissing: boolean) => {
    setBusy(true); setMsg(null); setErr(null);
    try {
      const r = await run({ data: { onlyMissing } });
      setMsg(`✓ 共 ${r.total} 条 · 更新 ${r.updated} · 跳过(未绑定线路) ${r.skipped} · 未变 ${r.unchanged}`);
      toast.success(`重算完成，更新 ${r.updated} 条`);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      toast.error(e?.message ?? "重算失败");
    } finally { setBusy(false); }
  };
  return (
    <Card title="运单费用重算">
      <p className="text-[11px] text-slate-400">对所有已完成量尺称重的运单，按当前线路规则重新计算运费 / 关税 / 保险 / 清关费（CAD）。之前因数据字段缺失导致的自动计算失败，可在此一键补齐。</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => onRun(true)} disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md border border-brand/30 bg-brand/10 px-3 py-2 text-xs font-semibold text-brand hover:bg-brand/20 disabled:opacity-50">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Calculator className="h-3.5 w-3.5"/>}只补零费用
        </button>
        <button onClick={() => onRun(false)} disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 hover:bg-white/10 disabled:opacity-50">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Calculator className="h-3.5 w-3.5"/>}全部重算
        </button>
      </div>
      {msg && <div className="mt-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">{msg}</div>}
      {err && <div className="mt-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300">✗ {err}</div>}
    </Card>
  );
}
