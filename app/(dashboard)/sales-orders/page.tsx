import { getServerSession } from "@/lib/auth";
import { prisma, tenantTransaction } from "@/lib/db";
import { redirect } from "next/navigation";
import { SalesOrderForm } from "./SalesOrderForm";
import { GenerateInvoiceDialog } from "./GenerateInvoiceDialog";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ShoppingCart, Calendar, Building2, User } from "lucide-react";
import Link from "next/link";

interface SalesOrdersPageProps {
  searchParams: Promise<{ new?: string }>;
}

export default async function SalesOrdersPage({ searchParams }: SalesOrdersPageProps) {
  const { new: showNew } = await searchParams;
  const session = await getServerSession();
  if (!session) redirect("/login");

  const membership = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id },
    include: { tenant: true },
  });

  if (!membership) redirect("/onboarding");

  const tenantId = membership.tenant.id;

  const [salesOrders, companies, contacts, customFieldDefs] =
    await tenantTransaction(tenantId, async (tx) => {
      return Promise.all([
        tx.salesOrder.findMany({
          where: { tenantId },
          include: {
            company: true,
            contact: true,
            invoices: true,
            workOrders: true,
          },
          orderBy: { createdAt: "desc" },
        }),
        tx.company.findMany({
          where: { tenantId },
          orderBy: { name: "asc" },
        }),
        tx.contact.findMany({
          where: { tenantId },
          orderBy: { firstName: "asc" },
        }),
        tx.customFieldDefinition.findMany({
          where: { tenantId, entityType: "SalesOrder" },
          orderBy: { sortOrder: "asc" },
        }),
      ]);
    });

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-indigo-500" />
            <h1 className="text-2xl font-bold tracking-tight">Sales Orders</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Confirmed customer orders, shop floor work order links, and zero-sync invoice generation.
          </p>
        </div>
        <SalesOrderForm
          tenantId={tenantId}
          companies={companies}
          contacts={contacts}
          customFieldDefinitions={customFieldDefs}
          defaultOpen={showNew === "1"}
        />
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
        {salesOrders.length === 0 ? (
          <div className="empty-state py-16">
            <div className="empty-state-icon">
              <ShoppingCart className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold">No sales orders created yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create a sales order or convert a Won Deal directly.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 border-b border-border text-xs text-muted-foreground uppercase font-semibold">
                <tr>
                  <th className="px-5 py-3">Order #</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Promised Delivery</th>
                  <th className="px-5 py-3">Total Amount</th>
                  <th className="px-5 py-3">Work Orders</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {salesOrders.map((so) => (
                  <tr key={so.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/sales-orders/${so.id}`}
                        className="font-mono text-xs font-bold text-primary hover:underline"
                      >
                        {so.orderNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">
                      {so.company ? (
                        <Link
                          href={`/companies/${so.company.id}`}
                          className="font-medium text-foreground hover:text-primary flex items-center gap-1.5"
                        >
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                          {so.company.name}
                        </Link>
                      ) : so.contact ? (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <User className="w-3.5 h-3.5" />
                          {so.contact.firstName} {so.contact.lastName}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge
                        variant="outline"
                        className={`text-[10px] capitalize ${
                          so.status === "fulfilled"
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : "bg-indigo-500/10 text-indigo-500 border-indigo-500/20"
                        }`}
                      >
                        {so.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(so.deliveryDate)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-bold tabular-nums">
                      {formatCurrency(Number(so.totalAmount))}
                    </td>
                    <td className="px-5 py-3.5 text-xs">
                      {so.workOrders.length > 0 ? (
                        <span className="font-semibold text-foreground">
                          {so.workOrders.length} WO{so.workOrders.length === 1 ? "" : "s"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {so.invoices.length === 0 ? (
                        <GenerateInvoiceDialog tenantId={tenantId} salesOrder={so} />
                      ) : (
                        <span className="text-xs text-emerald-500 font-medium">✓ Invoiced</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
