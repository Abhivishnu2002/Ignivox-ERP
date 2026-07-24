import { getServerSession } from "@/lib/auth";
import { prisma, tenantTransaction } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { ActivityTimeline } from "@/components/activity/ActivityTimeline";
import { CustomFieldRenderer } from "@/components/custom-fields/CustomFieldRenderer";
import { GenerateInvoiceDialog } from "../GenerateInvoiceDialog";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, ShoppingCart, Calendar, Building2, User, Factory, FileText } from "lucide-react";
import Link from "next/link";
import type { WorkOrder, Invoice, CustomFieldDefinition } from "@/lib/prisma-types";

interface SalesOrderDetailPageProps {
  params: Promise<{ soId: string }>;
}

export default async function SalesOrderDetailPage({ params }: SalesOrderDetailPageProps) {
  const { soId } = await params;
  const session = await getServerSession();
  if (!session) redirect("/login");

  const membership = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id },
    include: { tenant: true },
  });

  if (!membership) redirect("/onboarding");

  const tenantId = membership.tenant.id;

  const [so, customDefs, activities] = await tenantTransaction(
    tenantId,
    async (tx) => {
      return Promise.all([
        tx.salesOrder.findFirst({
          where: { id: soId, tenantId },
          include: {
            company: true,
            contact: true,
            deal: true,
            workOrders: { include: { bom: { include: { product: true } } } },
            invoices: true,
          },
        }),
        tx.customFieldDefinition.findMany({
          where: { tenantId, entityType: "SalesOrder" },
          orderBy: { sortOrder: "asc" },
        }),
        tx.activity.findMany({
          where: { tenantId, entityType: "SalesOrder", entityId: soId },
          orderBy: { createdAt: "desc" },
        }),
      ]);
    }
  );

  if (!so) notFound();

  const customFieldsData = (so.customFields ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back button */}
      <Link
        href="/sales-orders"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Sales Orders
      </Link>

      {/* Header Card */}
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-bold text-xl">
            <ShoppingCart className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-primary">
                {so.orderNumber}
              </span>
              <Badge variant="outline" className="text-xs capitalize">
                {so.status}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight mt-0.5">
              {so.company?.name || (so.contact ? `${so.contact.firstName} ${so.contact.lastName}` : "Sales Order")}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total Order Amount</p>
            <p className="text-2xl font-bold tabular-nums text-primary">
              {formatCurrency(Number(so.totalAmount))}
            </p>
          </div>
          {so.invoices.length === 0 && (
            <GenerateInvoiceDialog tenantId={tenantId} salesOrder={so} />
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="space-y-6 lg:col-span-1">
          {/* Details */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3 text-xs">
            <h2 className="text-sm font-semibold">Order Details</h2>
            <div className="space-y-2.5">
              {so.company && (
                <div>
                  <p className="text-muted-foreground">Company</p>
                  <Link
                    href={`/companies/${so.company.id}`}
                    className="font-medium text-foreground hover:text-primary flex items-center gap-1 mt-0.5"
                  >
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                    {so.company.name}
                  </Link>
                </div>
              )}

              {so.contact && (
                <div>
                  <p className="text-muted-foreground">Contact Person</p>
                  <Link
                    href={`/contacts/${so.contact.id}`}
                    className="font-medium text-foreground hover:text-primary flex items-center gap-1 mt-0.5"
                  >
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    {so.contact.firstName} {so.contact.lastName}
                  </Link>
                </div>
              )}

              <div>
                <p className="text-muted-foreground">Promised Delivery Date</p>
                <p className="font-medium text-foreground flex items-center gap-1 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  {formatDate(so.deliveryDate)}
                </p>
              </div>

              {so.notes && (
                <div>
                  <p className="text-muted-foreground">Production / Delivery Notes</p>
                  <p className="font-medium text-foreground mt-0.5 whitespace-pre-wrap">{so.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Linked Work Orders */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Factory className="w-4 h-4 text-primary" />
              Shop Floor Work Orders ({so.workOrders.length})
            </h2>
            {so.workOrders.length === 0 ? (
              <p className="text-xs text-muted-foreground">No work orders dispatched for this SO.</p>
            ) : (
              <div className="divide-y divide-border/60 text-xs">
                {so.workOrders.map((wo: any) => (
                  <Link
                    key={wo.id}
                    href={`/work-orders/${wo.id}`}
                    className="py-2 flex items-center justify-between hover:text-primary transition-colors"
                  >
                    <div>
                      <p className="font-mono font-semibold">{wo.workOrderNumber}</p>
                      <p className="text-[10px] text-muted-foreground">{wo.bom.product.name}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {wo.completedAt ? "Completed" : "In Progress"}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Linked Invoices */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-500" />
              Customer Invoices ({so.invoices.length})
            </h2>
            {so.invoices.length === 0 ? (
              <p className="text-xs text-muted-foreground">No invoices generated yet.</p>
            ) : (
              <div className="divide-y divide-border/60 text-xs">
                {so.invoices.map((inv: any) => (
                  <Link
                    key={inv.id}
                    href={`/invoices/${inv.id}`}
                    className="py-2 flex items-center justify-between hover:text-primary transition-colors"
                  >
                    <div>
                      <p className="font-mono font-semibold">{inv.invoiceNumber}</p>
                      <p className="text-[10px] text-muted-foreground">{formatDate(inv.createdAt)}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {inv.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Custom Fields */}
          {customDefs.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h2 className="text-sm font-semibold">Custom Fields</h2>
              <div className="space-y-3 text-xs">
                {customDefs.map((def: any) => (
                  <div key={def.id} className="flex justify-between items-center py-1 border-b border-border/40 last:border-0">
                    <span className="text-muted-foreground font-medium">{def.fieldLabel}</span>
                    <CustomFieldRenderer
                      definition={def}
                      value={customFieldsData[def.fieldName]}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column — Activity Feed */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <ActivityTimeline
            tenantId={tenantId}
            entityType="SalesOrder"
            entityId={so.id}
            initialActivities={activities}
          />
        </div>
      </div>
    </div>
  );
}
