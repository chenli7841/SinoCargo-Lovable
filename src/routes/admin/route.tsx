import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyRoles } from "@/lib/admin.functions";
import { ROLE_LABEL, ROLE_COLOR } from "@/lib/admin-roles";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard, Users, Boxes, Truck, Route as RouteIcon, Warehouse,
  Settings as SettingsIcon, LogOut, ExternalLink, ShieldAlert, Loader2,
  Package, Layers, Tag, MapPin, ScanLine, AlertTriangle, FileText, History, Ruler,
  ShoppingBag, Image as ImageIcon, BookText, PackageCheck,
} from "lucide-react";


export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({ meta: [{ title: "管理后台 / Admin — SinoCargo" }, { name: "robots", content: "noindex,nofollow" }] }),
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
  },
  component: AdminLayout,
});

type NavItem = { to: string; label: string; icon: any; soon?: boolean };
type NavGroup = { title: string; items: NavItem[] };
const NAV_GROUPS: NavGroup[] = [
  { title: "", items: [
    { to: "/admin", label: "运营概览", icon: LayoutDashboard },
  ]},
  { title: "发货仓库操作", items: [
    { to: "/admin/intake-scan", label: "入库扫描", icon: ScanLine },
    { to: "/admin/measure", label: "量尺称重", icon: Ruler },
    { to: "/admin/detained", label: "滞留单号", icon: AlertTriangle },
    { to: "/admin/cartons", label: "箱号管理", icon: Package },
    { to: "/admin/pallets", label: "托盘管理", icon: Layers },
    { to: "/admin/batches", label: "批次管理", icon: Truck },
  ]},
  { title: "收货仓库操作", items: [
    { to: "/admin/receivings", label: "收货管理", icon: PackageCheck },
    { to: "/admin/delivery-queue", label: "待派送列表", icon: Truck },
    { to: "/admin/waybills", label: "集运单到货 / 派送", icon: Truck },
  ]},
  { title: "订单 / 集运单查询", items: [
    { to: "/admin/orders", label: "电商订单", icon: ShoppingBag },
    { to: "/admin/forwardings", label: "集运订单", icon: Boxes },
    { to: "/admin/waybills", label: "运单列表", icon: Truck },
    { to: "/admin/history", label: "历史记录", icon: History },
    { to: "/admin/invoices", label: "账单管理", icon: FileText },
  ]},
  { title: "电商管理", items: [
    { to: "/admin/shop", label: "电商概览", icon: ShoppingBag },
    { to: "/admin/shop/orders", label: "电商订单", icon: ShoppingBag },
    { to: "/admin/shop/orders/procurement", label: "代采购列表", icon: Truck },
    { to: "/admin/shop/products", label: "商品管理", icon: Package },
    { to: "/admin/shop/categories", label: "商品分类", icon: Tag },
    { to: "/admin/shop/inventory", label: "库存流水", icon: Boxes },
    { to: "/admin/shop/coupons", label: "优惠券", icon: Tag },
    { to: "/admin/shop/banners", label: "Banner 装修", icon: ImageIcon },
    { to: "/admin/shop/articles", label: "文章管理", icon: FileText },
  ]},
  { title: "系统管理", items: [
    { to: "/admin/users", label: "用户管理", icon: Users },
    { to: "/admin/logs", label: "操作日志", icon: History },
    { to: "/admin/system", label: "系统设置", icon: SettingsIcon },
    { to: "/admin/warehouses", label: "仓库管理", icon: Warehouse },
    { to: "/admin/routes", label: "线路 / 运费", icon: RouteIcon },
    { to: "/admin/cargo-types", label: "货物类型", icon: Tag },
    { to: "/admin/destinations", label: "目的地", icon: MapPin },
    { to: "/admin/tracking-presets", label: "轨迹预设", icon: SettingsIcon },
    { to: "/admin/oversize-rules", label: "超大件规则", icon: Ruler },
    { to: "/admin/hs-codes", label: "HS 编码库", icon: BookText },
  ]},
];



function AdminLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const fetchRoles = useServerFn(getMyRoles);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const rolesQ = useQuery({
    queryKey: ["my-roles"],
    queryFn: () => fetchRoles(),
    enabled: !!user,
    staleTime: 60_000,
  });

  const roles = rolesQ.data?.roles ?? [];
  const isStaff = roles.some((r) => r !== "customer");
  const isForbidden = !rolesQ.isLoading && rolesQ.isSuccess && !isStaff;

  useEffect(() => {
    if (isForbidden && pathname !== "/admin/forbidden") {
      navigate({ to: "/admin/forbidden" });
    }
  }, [isForbidden, pathname, navigate]);

  if (rolesQ.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-ink-soft" />
      </div>
    );
  }
  if (rolesQ.isError) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6 text-center">
        <div>
          <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-destructive" />
          <div className="font-display text-lg font-bold">无法加载权限</div>
          <div className="mt-1 text-sm text-ink-soft">{(rolesQ.error as Error).message}</div>
        </div>
      </div>
    );
  }
  if (!isStaff) return <Outlet />;

  return (
    <div className="flex min-h-screen w-full bg-[#0B1220] text-slate-100">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-white/5 bg-[#0A0F1A] md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-white/5 px-4">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-brand to-cta font-display text-xs font-bold text-white">SC</div>
          <div>
            <div className="text-sm font-bold leading-tight">SinoCargo</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Admin Console</div>
          </div>
        </div>
        <nav className="flex-1 space-y-2 overflow-y-auto p-2">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi}>
              {group.title && (
                <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {group.title}
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map((item: NavItem) => {
                  const active = item.to === "/admin"
                    ? pathname === "/admin"
                    : pathname === item.to || pathname.startsWith(item.to + "/");
                  const cls = [
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition",
                    active ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white",
                    item.soon ? "cursor-not-allowed opacity-50 hover:bg-transparent hover:text-slate-300" : "",
                  ].join(" ");
                  const inner = (
                    <>
                      <item.icon className="h-4 w-4" />
                      <span className="flex-1">{item.label}</span>
                      {item.soon && <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] uppercase">Soon</span>}
                    </>
                  );
                  if (item.soon) return <div key={`${gi}-${item.to}-${item.label}`} className={cls} title="即将上线">{inner}</div>;
                  return <Link key={`${gi}-${item.to}-${item.label}`} to={item.to as any} className={cls}>{inner}</Link>;
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/5 p-3 text-[11px] text-slate-500">
          v1 · Stage A
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex h-14 items-center gap-3 border-b border-white/5 bg-[#0A0F1A] px-4">
          <div className="md:hidden font-display text-sm font-bold">SinoCargo Admin</div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden flex-wrap items-center gap-1 sm:flex">
              {roles.filter((r) => r !== "customer").slice(0, 3).map((r) => (
                <span key={r} className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${ROLE_COLOR[r]}`}>
                  {ROLE_LABEL[r].zh}
                </span>
              ))}
            </div>
            <div className="text-xs text-slate-400">{user?.email}</div>
            <Link to="/account" className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/5">
              <ExternalLink className="h-3 w-3" />前台
            </Link>
            <button
              onClick={async () => { await signOut(); navigate({ to: "/auth" }); }}
              className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/5"
            >
              <LogOut className="h-3 w-3" />退出
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 bg-[#0B1220] text-slate-100">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
