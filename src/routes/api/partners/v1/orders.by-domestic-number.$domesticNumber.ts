import { createFileRoute } from "@tanstack/react-router";
import { authenticateShipApi, shipApiJson, shipApiOptions, withShipApiHandler } from "@/lib/ship-api/auth.server";
import { assembleOrderResponse, resolvePartnerOrder } from "@/lib/ship-api/order-query.server";

/**
 * GET /api/partners/v1/orders/by-domestic-number/{domesticNumber}
 *
 * 精确按国内单号查询整单信息。见 docs/ship-api/shipper-api-v3.md 第 6 节。
 */
export const Route = createFileRoute("/api/partners/v1/orders/by-domestic-number/$domesticNumber")({
  server: {
    handlers: {
      OPTIONS: async () => shipApiOptions(),
      GET: async ({ request, params }) =>
        withShipApiHandler(async () => {
          const auth = await authenticateShipApi(request, ["orders:read"]);
          const domesticNumber = decodeURIComponent(params.domesticNumber ?? "").trim();

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const admin = supabaseAdmin as any;

          const order = await resolvePartnerOrder(admin, auth.partnerKey, domesticNumber);
          const includeFees = auth.scopes.includes("orders:fees:read");
          const data = await assembleOrderResponse(admin, order, { includeFees });
          if (!includeFees) delete data.fees; // 普通凭证完全省略 fees 字段，不是 amount=null
          return shipApiJson(data);
        }),
    },
  },
});
