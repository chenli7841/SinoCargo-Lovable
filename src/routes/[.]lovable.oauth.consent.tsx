import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// The @supabase/supabase-js client exposes an `auth.oauth` beta namespace that
// isn't in the shipped types yet. Wrap the three methods we use with a local
// typed alias so TypeScript is happy without touching the generated client.
type AuthorizationDetails = {
  client?: { name?: string; redirect_uri?: string } | null;
  requested_scopes?: string[] | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};
type OAuthApi = {
  getAuthorizationDetails: (
    id: string,
  ) => Promise<{ data: AuthorizationDetails | null; error: Error | null }>;
  approveAuthorization: (
    id: string,
  ) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: Error | null }>;
  denyAuthorization: (
    id: string,
  ) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: Error | null }>;
};
const oauth = (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { redirect: next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-md p-8 text-center">
      <h1 className="font-display text-xl font-bold text-foreground">授权请求无法加载</h1>
      <p className="mt-2 text-sm text-ink-soft">{String((error as Error)?.message ?? error)}</p>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientName = details?.client?.name ?? "外部应用";
  const scopes = details?.requested_scopes ?? [];

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorization_id)
      : await oauth.denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("授权服务器未返回跳转地址。");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="min-h-[70vh] bg-gradient-to-br from-background via-accent/30 to-background px-4 py-12">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-elevated sm:p-8">
        <h1 className="font-display text-xl font-bold text-foreground">
          将 <span className="text-brand-gradient">{clientName}</span> 连接到您的 SinoCargo 账号
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          {clientName} 将可以作为您本人调用本应用启用的工具（例如查询您的订单和集运单）。此授权不会绕过 SinoCargo 的权限和后端策略。
        </p>

        {scopes.length > 0 && (
          <div className="mt-4 rounded-xl border border-border bg-background p-3 text-xs text-ink-soft">
            <div className="mb-1 font-semibold text-foreground">请求的权限</div>
            <ul className="list-disc pl-4">
              {scopes.map((s: string) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-2">
          <button
            disabled={busy}
            onClick={() => decide(true)}
            className="flex-1 rounded-xl bg-cta-gradient px-4 py-2.5 text-sm font-semibold text-cta-foreground shadow-elevated transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "处理中…" : "批准 Approve"}
          </button>
          <button
            disabled={busy}
            onClick={() => decide(false)}
            className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-accent disabled:opacity-50"
          >
            拒绝 Deny
          </button>
        </div>
      </div>
    </main>
  );
}
