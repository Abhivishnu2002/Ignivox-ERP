import { getServerSession } from "@/lib/auth";
import { prisma, tenantTransaction } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { ActivityTimeline } from "@/components/activity/ActivityTimeline";
import { CustomFieldRenderer } from "@/components/custom-fields/CustomFieldRenderer";
import { ReceiveInventoryDialog } from "../ReceiveInventoryDialog";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, Truck, Calendar, Building2, CheckCircle2 } from "lucide-react";
import Link from "next/link";

interface PurchaseOrderDetailPageProps {
  params: Promise<{ poId: string }>;
}

export default async function PurchaseOrderDetailPage({ params }: PurchaseOrderDetailPageProps) {
  const { poId } = await params;
  const session = await getServerSession();
  if (!session) redirect("/login");

  const membership = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id },
    include: { tenant: true },
  });

  if (!membership) redirect("/onboarding");

  const tenantId = membership.tenant.id;

  const [po, rawMaterials, customDefs, activities] = await tenantTransaction(
    tenantId,
    async (tx) => {
      return Promise.all([
        tx.purchaseOrder.findFirst({
          where: { id: poId, tenantId },
          include: { supplier: true },
        }),
        tx.product.findMany({
          where: { tenantId, type: "raw_material" },
        }),
        tx.customFieldDefinition.findMany({
          where: { tenantId, entityType: "PurchaseOrder" },
          orderBy: { sortOrder: "asc" },
        }),
        tx.activity.findMany({
          where: { tenantId, entityType: "PurchaseOrder", entityId: poId },
          orderBy: { createdAt: "desc" },
        }),
      ]);
    }
  );

  if (!po) notFound();

  const customFieldsData = (po.customFields ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back button */}
      <Link
        href="/purchase-orders"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Purchase Orders
      </Link>

      {/* Header Card */}
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
            <Truck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-primary">
                {po.poNumber}
              </span>
              <Badge variant="outline" className="text-xs capitalize">
                {po.status}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight mt-0.5">{po.supplier?.name || "Purchase Order"}</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total PO Value</p>
            <p className="text-2xl font-bold tabular-nums text-primary">
              {formatCurrency(Number(po.totalAmount))}
            </p>
          </div>
          {po.status !== "received" && (
            <ReceiveInventoryDialog
              tenantId={tenantId}
              po={po}
              rawMaterialProducts={rawMaterials}
            />
          )}
        </div>
      </div>

      {/* Grid: Left = Details + Custom Fields, Right = Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="space-y-6 lg:col-span-1">
          {/* Details */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3 text-xs">
            <h2 className="text-sm font-semibold">PO Information</h2>
            <div className="space-y-2.5">
              {po.supplier && (
                <div>
                  <p className="text-muted-foreground">Supplier Company</p>
                  <Link
                    href={`/companies/${po.supplier.id}`}
                    className="font-medium text-foreground hover:text-primary flex items-center gap-1 mt-0.5"
                  >
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                    {po.supplier.name}
                  </Link>
                </div>
              )}

              <div>
                <p className="text-muted-foreground">Expected Delivery Date</p>
                <p className="font-medium text-foreground flex items-center gap-1 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  {formatDate(po.expectedDate)}
                </p>
              </div>

              {po.notes && (
                <div>
                  <p className="text-muted-foreground">PO Order Notes</p>
                  <p className="font-medium text-foreground mt-0.5 whitespace-pre-wrap">{po.notes}</p>
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

        {/* Right Column — Activity Feed */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <ActivityTimeline
            tenantId={tenantId}
            entityType="PurchaseOrder"
            entityId={po.id}
            initialActivities={activities}
          />
        </div>
      </div>
    </div>
  );
}
