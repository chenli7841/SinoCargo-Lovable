import { createFileRoute } from "@tanstack/react-router";

/**
 * Start "sign in with WeChat" (no session required).
 *
 * Mints a stateless `login:<random>` state (no DB row — the callback treats
 * this prefix as login mode) and redirects to the WeChat QR authorization page.
 */
export const Route = createFileRoute("/api/public/wechat/login")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const appid = process.env.WECHAT_APPID;
        if (!appid) {
          return new Response("WeChat sign-in not configured.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }

        const { randomBytes } = await import("node:crypto");
        const state = `login:${randomBytes(16).toString("hex")}`;
        // Must match the 授权回调域 registered on open.weixin.qq.com, otherwise
        // WeChat responds with "redirect_uri 参数错误".
        const authorizedOrigin =
          process.env.WECHAT_REDIRECT_ORIGIN?.replace(/\/$/, "") || "https://shopper.epluscanada.com";
        void url;
        const redirectUri = `${authorizedOrigin}/api/public/wechat/callback`;
        const target =
          `https://open.weixin.qq.com/connect/qrconnect?appid=${encodeURIComponent(appid)}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=snsapi_login` +
          `&state=${state}#wechat_redirect`;
        return Response.redirect(target, 302);
      },
    },
  },
});
