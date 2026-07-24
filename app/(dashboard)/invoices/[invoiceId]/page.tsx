import { getServerSession } from "@/lib/auth";
import { prisma, tenantTransaction } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { ActivityTimeline } from "@/components/activity/ActivityTimeline";
import { CustomFieldRenderer } from "@/components/custom-fields/CustomFieldRenderer";
import { MarkPaidButton } from "../MarkPaidButton";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, FileText, Receipt, Calendar, Building2, User, CheckCircle2, ShoppingCart } from "lucide-react";
import Link from "next/link";

interface InvoiceDetailPageProps {
  params: Promise<{ invoiceId: string }>;
}

export default async function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  const { invoiceId } = await params;
  const session = await getServerSession();
  if (!session) redirect("/login");

  const membership = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id },
    include: { tenant: true },
  });

  if (!membership) redirect("/onboarding");

  const tenantId = membership.tenant.id;

  const [invoice, customDefs, activities] = await tenantTransaction(
    tenantId,
    async (tx) => {
      return Promise.all([
        tx.invoice.findFirst({
          where: { id: invoiceId, tenantId },
          include: {
            company: true,
            contact: true,
            salesOrder: true,
          },
        }),
        tx.customFieldDefinition.findMany({
          where: { tenantId, entityType: "Invoice" },
          orderBy: { sortOrder: "asc" },
        }),
        tx.activity.findMany({
          where: { tenantId, entityType: "Invoice", entityId: invoiceId },
          orderBy: { createdAt: "desc" },
        }),
      ]);
    }
  );

  if (!invoice) notFound();

  const customFieldsData = (invoice.customFields ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back button */}
      <Link
        href="/invoices"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Invoices
      </Link>

      {/* Header Card */}
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 font-bold text-xl">
            <Receipt className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-primary">
                {invoice.invoiceNumber}
              </span>
              <Badge
                variant="outline"
                className={`text-xs capitalize ${
                  invoice.status === "paid"
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                }`}
              >
                {invoice.status}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight mt-0.5">
              {invoice.company?.name || (invoice.contact ? `${invoice.contact.firstName} ${invoice.contact.lastName}` : "Customer Invoice")}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total Amount Due</p>
            <p className="text-2xl font-bold tabular-nums text-emerald-500">
              {formatCurrency(Number(invoice.totalAmount))}
            </p>
          </div>
          {invoice.status !== "paid" && (
            <MarkPaidButton
              tenantId={tenantId}
              invoiceId={invoice.id}
              invoiceNumber={invoice.invoiceNumber}
            />
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="space-y-6 lg:col-span-1">
          {/* Details */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3 text-xs">
            <h2 className="text-sm font-semibold">Invoice Information</h2>
            <div className="space-y-2.5">
              <div>
                <p className="text-muted-foreground">Issue Date</p>
                <p className="font-medium text-foreground flex items-center gap-1 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  {formatDate(invoice.createdAt)}
                </p>
              </div>

              <div>
                <p className="text-muted-foreground">Payment Due Date</p>
                <p className="font-medium text-foreground flex items-center gap-1 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  {formatDate(invoice.dueDate)}
                </p>
              </div>

              {invoice.salesOrder && (
                <div>
                  <p className="text-muted-foreground">Originating Sales Order</p>
                  <Link
                    href={`/sales-orders/${invoice.salesOrder.id}`}
                    className="font-medium text-primary hover:underline flex items-center gap-1 mt-0.5"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    {invoice.salesOrder.orderNumber}
                  </Link>
                </div>
              )}

              {invoice.notes && (
                <div>
                  <p className="text-muted-foreground">Remittance / Wire Notes</p>
                  <p className="font-medium text-foreground mt-0.5 whitespace-pre-wrap">{invoice.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Custom Fields */}
          {customDefs.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h2 className="text-sm font-semibold">Custom Fields</h2>
              <div className="space-y-3 text-xs">
                {customDefs.map((def) => (
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

        {/* Right Column — Statement Breakdown & Activity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Statement card */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold border-b border-border pb-3">Billing Summary</h2>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold tabular-nums">{formatCurrency(Number(invoice.subtotal))}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Tax</span>
                <span className="font-semibold tabular-nums">{formatCurrency(Number(invoice.tax))}</span>
              </div>
              <div className="flex justify-between py-2 border-t border-border font-bold text-sm">
                <span>Total Amount Due</span>
                <span className="text-emerald-500 tabular-nums">{formatCurrency(Number(invoice.totalAmount))}</span>
              </div>
            </div>

            {invoice.status === "paid" && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg flex items-center justify-between text-xs text-emerald-500 font-semibold">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Paid in full on {formatDate(invoice.paidAt)}
                </span>
              </div>
            )}
          </div>

          {/* Activity Feed */}
          <div className="bg-card border border-border rounded-xl p-5">
            <ActivityTimeline
              tenantId={tenantId}
              entityType="Invoice"
              entityId={invoice.id}
              initialActivities={activities}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
