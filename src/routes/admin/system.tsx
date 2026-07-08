import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { getAppSettings, setAppSetting } from "@/lib/system.functions";
import { recomputeWaybillFees } from "@/lib/scan.functions";
import { supabase } from "@/integrations/supabase/client";
import { Settings as SettingsIcon, Save, Loader2, Upload, X as XIcon, Calculator } from "lucide-react";

export const Route = createFileRoute("/admin/system")({ component: SystemPage });

const KEYS = ["company_info", "invoice_auto_rules", "print_template", "fx_rate"];
const SIGN_TTL = 60 * 60 * 24 * 365 * 10; // 10y


function SystemPage() {
  const fetchSettings = useServerFn(getAppSettings);
  const setOne = useServerFn(setAppSetting);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["app-settings", KEYS], queryFn: () => fetchSettings({ data: { keys: KEYS } }) });

  const [company, setCompany] = useState<any>({});
  const [rules, setRules] = useState<any>({});
  const [tpl, setTpl] = useState<any>({});
  const [fx, setFx] = useState<any>({ cny_per_cad: 5.26 });
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (q.data) {
      setCompany(q.data.settings.company_info ?? {});
      setRules(q.data.settings.invoice_auto_rules ?? {});
      setTpl(q.data.settings.print_template ?? {});
      setFx(q.data.settings.fx_rate ?? { cny_per_cad: 5.26 });
    }
  }, [q.data]);

  const save = async (key: string, value: any) => {
    setSaving(key); setMsg(null);
    try {
      await setOne({ data: { key, value } });
      setMsg(`已保存：${key}`);
      qc.invalidateQueries({ queryKey: ["app-settings"] });
    } catch (e: any) { setMsg("✗ " + e.message); }
    finally { setSaving(null); }
  };

  if (q.isLoading) return <div className="grid h-[60vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-slate-500"/></div>;

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold inline-flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-blue-400"/>系统设置
        </h1>
        {msg && <div className="text-xs text-emerald-300">{msg}</div>}
      </div>

      <div className="space-y-5">
        {/* Company */}
        <Card title="公司基本信息">
          <Grid>
            <Field label="公司名称"><Input value={company.name ?? ""} onChange={v => setCompany({ ...company, name: v })}/></Field>
            <Field label="联系电话"><Input value={company.phone ?? ""} onChange={v => setCompany({ ...company, phone: v })}/></Field>
            <Field label="邮箱"><Input value={company.email ?? ""} onChange={v => setCompany({ ...company, email: v })}/></Field>
            <Field label="微信号"><Input value={company.wechat ?? ""} onChange={v => setCompany({ ...company, wechat: v })}/></Field>
            <Field label="微信二维码">
              <ImageUpload value={company.wechat_qr_url ?? ""} onChange={(url: string) => setCompany({ ...company, wechat_qr_url: url })} folder="wechat-qr"/>
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

        {/* Recompute waybill fees */}
        <RecomputeFeesCard/>


        {/* Invoice rules */}
        <Card title="账单自动化规则">
          <Grid>
            <Field label="启用自动开票">
              <select value={rules.enabled ? "1" : "0"} onChange={(e) => setRules({ ...rules, enabled: e.target.value === "1" })}
                className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm [&>option]:bg-[#0E1626]">
                <option value="0">关闭</option><option value="1">开启</option>
              </select>
            </Field>
            <Field label="触发状态">
              <select value={rules.trigger_status ?? "packed"} onChange={(e) => setRules({ ...rules, trigger_status: e.target.value })}
                className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm [&>option]:bg-[#0E1626]">
                <option value="packed">已打包 packed</option>
                <option value="shipped">已发运 shipped</option>
                <option value="in_transit">在途 in_transit</option>
                <option value="delivered">已交付 delivered</option>
              </select>
            </Field>
            <Field label="账期（天）"><Input type="number" value={String(rules.due_days ?? 7)} onChange={v => setRules({ ...rules, due_days: Number(v) || 0 })}/></Field>
            <Field label="逾期阈值（天）"><Input type="number" value={String(rules.overdue_days ?? 14)} onChange={v => setRules({ ...rules, overdue_days: Number(v) || 0 })}/></Field>
          </Grid>
          <SaveBtn busy={saving === "invoice_auto_rules"} onClick={() => save("invoice_auto_rules", rules)}/>
          <p className="mt-2 text-[11px] text-slate-500">逾期标记由定时任务每日执行（POST /api/public/hooks/mark-overdue）。</p>
        </Card>

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
    } catch (e: any) { setErr(e.message || String(e)); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
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
    } catch (e: any) { setErr(e?.message ?? String(e)); }
    finally { setBusy(false); }
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
