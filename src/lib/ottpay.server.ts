// OTT Pay integration helpers (server-only).
// Docs: https://apidocs.ottpay.com/api/
import crypto from "crypto";

export type OttChannel = "wechat" | "alipay" | "card";

export function ottConfig() {
  const appId = process.env["OTTPAY_APP_ID"];
  const appKey = process.env["OTTPAY_APP_KEY"];
  if (!appId || !appKey) throw new Error("OTT Pay 未配置（缺少 OTTPAY_APP_ID / OTTPAY_APP_KEY）");
  return {
    appId,
    appKey,
    signKey: process.env["OTTPAY_SIGN_KEY"] ?? "",
    baseUrl: (process.env["OTTPAY_BASE_URL"] ?? "https://ecom-api.ottpay.com").replace(/\/+$/, ""),
    // Public origin used for callback / return URLs (must be reachable by OTT Pay)
    origin: (process.env["OTTPAY_PUBLIC_ORIGIN"] ?? "https://shopper.epluscanada.com").replace(/\/+$/, ""),
  };
}

let _token: { value: string; expired: number } | null = null;

export async function ottToken(): Promise<string> {
  const cfg = ottConfig();
  if (_token && _token.expired - 60_000 > Date.now()) return _token.value;
  const res = await fetch(`${cfg.baseUrl}/api/v1/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appId: cfg.appId, appKey: cfg.appKey }),
  });
  const json: any = await res.json().catch(() => null);
  if (!res.ok || json?.status !== "SUCCESS" || !json?.result?.token) {
    throw new Error(`OTT Pay 授权失败: ${json?.message ?? json?.msg ?? res.status}`);
  }
  _token = { value: json.result.token as string, expired: Number(json.result.expired ?? Date.now() + 600_000) };
  return _token.value;
}

export async function ottPost<T = any>(path: string, body: unknown): Promise<T> {
  const cfg = ottConfig();
  const token = await ottToken();
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json: any = await res.json().catch(() => null);
  if (!res.ok || json?.status !== "SUCCESS") {
    throw new Error(`OTT Pay 请求失败 (${path}): ${json?.message ?? json?.msg ?? json?.code ?? res.status}`);
  }
  return json.result as T;
}

/** CAD dollars -> cents string, per OTT Pay ("100" = $1.00) */
export function toCents(amountCad: number): string {
  return String(Math.round(amountCad * 100));
}

/**
 * Decrypt an OTT Pay webhook payload.
 * key = uppercase 16-char md5(md5String + signKey); data = base64 -> AES-128-ECB.
 */
export function decryptOttCallback(payload: { data: string; md5: string }): Record<string, any> {
  const cfg = ottConfig();
  if (!cfg.signKey) throw new Error("缺少 OTTPAY_SIGN_KEY，无法校验回调");
  const full = crypto
    .createHash("md5")
    .update(payload.md5 + cfg.signKey, "utf8")
    .digest("hex")
    .toUpperCase();
  const key = full.slice(8, 24); // 16-bit md5 == middle 16 chars of the 32-char digest
  const decipher = crypto.createDecipheriv("aes-128-ecb", Buffer.from(key, "utf8"), null);
  decipher.setAutoPadding(true);
  const out = Buffer.concat([decipher.update(Buffer.from(payload.data, "base64")), decipher.final()]).toString("utf8");
  return JSON.parse(out);
}

export const OTT_SUCCESS_STATES = new Set(["success", "captured", "authorised", "authorized"]);
