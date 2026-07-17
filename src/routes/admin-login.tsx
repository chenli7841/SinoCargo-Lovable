import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { getMyRoles } from "@/lib/admin.functions";
import { ROLE_LABEL, ADMIN_CONSOLE_ROLES } from "@/lib/admin-roles";
import { Loader2, Mail, Lock, ArrowRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/admin-login")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "后台登录 — SinoCargo Admin" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: AdminLoginPage,
});

// Standalone login for the staff console (/admin/*). Deliberately not nested
// under src/routes/admin/ — that directory's route.tsx already gates on auth
// and would redirect back to a login page placed inside it, looping forever.
// Sign-in itself is role-agnostic (same auth.users pool as customers); which
// nav sections/content a role sees is decided inside /admin after login.
function AdminLoginPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const fetchRoles = useServerFn(getMyRoles);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const { roles } = await fetchRoles();
      const staffRoles = roles.filter((r) => ADMIN_CONSOLE_ROLES.includes(r));
      if (staffRoles.length === 0) {
        await supabase.auth.signOut();
        throw new Error("该账号没有管理后台权限，无法登录");
      }

      const levelLabel = staffRoles.map((r) => ROLE_LABEL[r]?.zh ?? r).join(" · ");
      toast.success(`登录成功（${levelLabel}）`);
      navigate({ to: search.redirect || "/admin" });
    } catch (err: any) {
      toast.error(err.message ?? "登录失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-[#0B1220] px-4 text-slate-100">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand to-cta font-display text-sm font-bold text-white shadow-glow">
            SC
          </span>
          <div className="font-display text-lg font-bold">SinoCargo Admin</div>
          <div className="text-xs uppercase tracking-wider text-slate-500">管理后台登录</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              required
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="邮箱"
              className="h-11 w-full rounded-lg border border-white/10 bg-white/5 pl-10 pr-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码"
              className="h-11 w-full rounded-lg border border-white/10 bg-white/5 pl-10 pr-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-brand to-cta text-sm font-semibold text-white shadow-glow transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            登录
          </button>
        </form>

        <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <ArrowRight className="h-3 w-3 rotate-180" />
          <Link to="/" className="hover:text-slate-300">
            返回官网首页
          </Link>
        </div>
      </div>
    </div>
  );
}
