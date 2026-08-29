import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getCurrentCustomer from "./tools/get-current-customer";
import listMyOrders from "./tools/list-my-orders";
import listMyForwardings from "./tools/list-my-forwardings";
import trackWaybill from "./tools/track-waybill";
import listForwardingRoutes from "./tools/list-forwarding-routes";
import quoteForwarding from "./tools/quote-forwarding";
import saveForwardingDraft from "./tools/save-forwarding-draft";
import confirmForwardingDraft from "./tools/confirm-forwarding-draft";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "sinocargo-mcp",
  title: "SinoCargo",
  version: "0.1.0",
  instructions:
    "EPLUS customer tools for account-scoped logistics queries, CAD forwarding quotes, and confirmed forwarding orders. All money shown to customers is Canadian dollars (CAD). Saving a draft must never create an order; create an order only after explicit customer confirmation. All access is scoped to the signed-in user via row-level security.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    getCurrentCustomer,
    listMyOrders,
    listMyForwardings,
    trackWaybill,
    listForwardingRoutes,
    quoteForwarding,
    saveForwardingDraft,
    confirmForwardingDraft,
  ],
});
