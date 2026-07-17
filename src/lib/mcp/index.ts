import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMyOrders from "./tools/list-my-orders";
import listMyForwardings from "./tools/list-my-forwardings";
import trackWaybill from "./tools/track-waybill";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "sinocargo-mcp",
  title: "SinoCargo",
  version: "0.1.0",
  instructions:
    "Tools for SinoCargo customers to look up their own shop orders, forwarding (集运) orders, and waybill status. All access is scoped to the signed-in user via row-level security.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listMyOrders, listMyForwardings, trackWaybill],
});
