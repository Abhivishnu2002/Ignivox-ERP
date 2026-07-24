import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Users,
  Target,
  Handshake,
  Factory,
  TrendingUp,
  Package,
  Receipt,
  ShoppingCart,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { Deal, Company, Contact, WorkOrder, Product } from "@/lib/prisma-types";

export default async function DashboardPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const membership = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id },
    include: { tenant: true },
  });

  if (!membership) redirect("/onboarding");

  const tenantId = membership.tenant.id;

  // Fetch summary stats in parallel
  const [
    contactCount,
    leadCount,
    dealCount,
    dealValue,
    openWorkOrders,
    lowStockItems,
    pendingInvoices,
    recentDeals,
    recentWorkOrders,
  ] = await Promise.all([
    prisma.contact.count({ where: { tenantId } }),
    prisma.lead.count({ where: { tenantId } }),
    prisma.deal.count({ where: { tenantId, wonAt: null, lostAt: null } }),
    prisma.deal.aggregate({
      where: { tenantId, wonAt: null, lostAt: null },
      _sum: { value: true },
    }),
    prisma.workOrder.count({
      where: { tenantId, completedAt: null },
    }),
    prisma.inventoryItem.count({
      where: {
        tenantId,
        reorderLevel: { not: null },
      },
    }),
    prisma.invoice.count({
      where: { tenantId, status: { in: ["sent", "overdue"] } },
    }),
    prisma.deal.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { contact: true, company: true },
    }),
    prisma.workOrder.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { bom: { include: { product: true } } },
    }),
  ]);

  const stats = [
    {
      label: "Total Contacts",
      value: contactCount.toLocaleString(),
      icon: Users,
      href: "/contacts",
      color: "#6366f1",
      change: null,
    },
    {
      label: "Active Leads",
      value: leadCount.toLocaleString(),
      icon: Target,
      href: "/leads",
      color: "#0ea5e9",
      change: null,
    },
    {
      label: "Open Deals",
      value: dealCount.toLocaleString(),
      icon: Handshake,
      href: "/deals",
      color: "#f59e0b",
      change: dealValue._sum.value
        ? formatCurrency(Number(dealValue._sum.value))
        : null,
      changeLabel: "pipeline value",
    },
    {
      label: "Active Work Orders",
      value: openWorkOrders.toLocaleString(),
      icon: Factory,
      href: "/work-orders",
      color: "#10b981",
      change: null,
    },
    {
      label: "Pending Invoices",
      value: pendingInvoices.toLocaleString(),
      icon: Receipt,
      href: "/invoices",
      color: "#ec4899",
      change: null,
    },
    {
      label: "Low Stock Items",
      value: lowStockItems.toLocaleString(),
      icon: Package,
      href: "/inventory",
      color: "#ef4444",
      change: null,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Welcome back,{" "}
          <span className="font-medium text-foreground">{session.user.name}</span>
          {" "}— {membership.tenant.name}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map((stat: any) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="stat-card group interactive hover:shadow-lg hover:border-border/80"
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: stat.color + "20" }}
                >
                  <Icon
                    className="w-4.5 h-4.5"
                    style={{ color: stat.color }}
                  />
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                {stat.change && (
                  <p className="text-xs text-primary mt-1 font-medium">
                    {stat.change}{" "}
                    <span className="text-muted-foreground font-normal">{stat.changeLabel}</span>
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Recent activity grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Deals */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Handshake className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold">Recent Deals</h2>
            </div>
            <Link
              href="/deals"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              View all <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {recentDeals.length === 0 ? (
            <div className="empty-state py-10">
              <p className="text-sm text-muted-foreground">No deals yet</p>
              <Link href="/deals" className="text-xs text-primary hover:underline mt-2">
                Create your first deal →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentDeals.map((deal: Deal & { company: Company | null; contact: Contact | null }) => (
                <Link
                  key={deal.id}
                  href={`/deals/${deal.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{deal.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {deal.company?.name || deal.contact?.firstName + " " + deal.contact?.lastName || "—"}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className="text-sm font-semibold tabular-nums">
                      {formatCurrency(Number(deal.value))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(deal.createdAt)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Work Orders */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Factory className="w-4 h-4 text-emerald-500" />
              <h2 className="text-sm font-semibold">Recent Work Orders</h2>
            </div>
            <Link
              href="/work-orders"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              View all <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {recentWorkOrders.length === 0 ? (
            <div className="empty-state py-10">
              <p className="text-sm text-muted-foreground">No work orders yet</p>
              <Link href="/work-orders" className="text-xs text-primary hover:underline mt-2">
                Create your first work order →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentWorkOrders.map((wo: WorkOrder & { bom: { product: Product } }) => (
                <Link
                  key={wo.id}
                  href={`/work-orders/${wo.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{wo.workOrderNumber}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {wo.bom.product.name}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <Badge variant="outline" className="text-[10px]">
                      {Number(wo.quantityProduced)}/{Number(wo.quantityPlanned)} {wo.bom.product.unit}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(wo.createdAt)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Quick actions
        </h2>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "New Contact", href: "/contacts?new=1", icon: Users },
            { label: "New Lead", href: "/leads?new=1", icon: Target },
            { label: "New Deal", href: "/deals?new=1", icon: Handshake },
            { label: "New Sales Order", href: "/sales-orders?new=1", icon: ShoppingCart },
            { label: "New Work Order", href: "/work-orders?new=1", icon: Factory },
            { label: "New Invoice", href: "/invoices?new=1", icon: Receipt },
          ].map((action: any) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                href={action.href}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted border border-border text-xs font-medium interactive"
              >
                <Icon className="w-3.5 h-3.5" />
                {action.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
