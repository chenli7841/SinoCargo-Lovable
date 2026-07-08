import { createFileRoute } from "@tanstack/react-router";

/**
 * WeChat OAuth callback (网页授权).
 *
 * Flow (to enable once AppID/AppSecret are provided):
 *  1. Frontend redirects user to:
 *       https://open.weixin.qq.com/connect/qrconnect
 *         ?appid=WECHAT_APPID
 *         &redirect_uri={origin}/api/public/wechat/callback
 *         &response_type=code&scope=snsapi_login&state=...
 *  2. WeChat redirects back here with ?code=...&state=...
 *  3. We exchange code -> access_token + openid via:
 *       https://api.weixin.qq.com/sns/oauth2/access_token
 *  4. Fetch userinfo, then upsert into profiles + create/sign-in the user
 *     via supabaseAdmin (auth.admin.createUser + a one-time magic link).
 *
 * STATUS: scaffold only — secrets not configured yet.
 */
export const Route = createFileRoute("/api/public/wechat/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const appid = process.env.WECHAT_APPID;
        const secret = process.env.WECHAT_APPSECRET;

        if (!appid || !secret) {
          return new Response(
            "WeChat sign-in not configured. Admin must set WECHAT_APPID and WECHAT_APPSECRET.",
            { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
          );
        }
        if (!code) {
          return new Response("Missing ?code", { status: 400 });
        }

        // TODO: exchange code -> openid, upsert user, redirect to /account
        return new Response("WeChat callback received. Implementation pending.", {
          status: 200,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      },
    },
  },
});
