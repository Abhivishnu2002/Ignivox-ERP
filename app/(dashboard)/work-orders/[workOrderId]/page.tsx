import { getServerSession } from "@/lib/auth";
import { prisma, tenantTransaction } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { ActivityTimeline } from "@/components/activity/ActivityTimeline";
import { CustomFieldRenderer } from "@/components/custom-fields/CustomFieldRenderer";
import { Badge } from "@/components/ui/badge";
import { formatDate, stageColorToStyle } from "@/lib/utils";
import { ArrowLeft, Factory, Calendar, Layers, CheckCircle2, ShoppingCart } from "lucide-react";
import Link from "next/link";

interface WorkOrderDetailPageProps {
  params: Promise<{ workOrderId: string }>;
}

export default async function WorkOrderDetailPage({ params }: WorkOrderDetailPageProps) {
  const { workOrderId } = await params;
  const session = await getServerSession();
  if (!session) redirect("/login");

  const membership = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id },
    include: { tenant: true },
  });

  if (!membership) redirect("/onboarding");

  const tenantId = membership.tenant.id;

  const [workOrder, stages, customDefs, activities] = await tenantTransaction(
    tenantId,
    async (tx) => {
      return Promise.all([
        tx.workOrder.findFirst({
          where: { id: workOrderId, tenantId },
          include: {
            bom: {
              include: {
                product: true,
                lines: {
                  include: { product: true },
                },
              },
            },
            salesOrder: {
              include: { company: true },
            },
          },
        }),
        tx.pipelineStage.findMany({
          where: { tenantId, pipelineType: "work_order" },
        }),
        tx.customFieldDefinition.findMany({
          where: { tenantId, entityType: "WorkOrder" },
          orderBy: { sortOrder: "asc" },
        }),
        tx.activity.findMany({
          where: { tenantId, entityType: "WorkOrder", entityId: workOrderId },
          orderBy: { createdAt: "desc" },
        }),
      ]);
    }
  );

  if (!workOrder) notFound();

  const currentStage = stages.find((s) => s.id === workOrder.stageId);
  const customFieldsData = (workOrder.customFields ?? {}) as Record<string, unknown>;
  const plannedQty = Number(workOrder.quantityPlanned);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back button */}
      <Link
        href="/work-orders"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Work Orders
      </Link>

      {/* Header Card */}
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
            <Factory className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-primary">
                {workOrder.workOrderNumber}
              </span>
              {currentStage && (
                <div
                  className="px-2.5 py-0.5 rounded-full border text-xs font-semibold"
                  style={stageColorToStyle(currentStage.color)}
                >
                  {currentStage.name}
                </div>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight mt-0.5">{workOrder.bom.product.name}</h1>
          </div>
        </div>

        <div className="text-right">
          <p className="text-[10px] text-muted-foreground uppercase font-semibold">Production Quantity</p>
          <p className="text-2xl font-bold tabular-nums text-foreground">
            {plannedQty} {workOrder.bom.product.unit}
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="space-y-6 lg:col-span-1">
          {/* Details */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3 text-xs">
            <h2 className="text-sm font-semibold">Job Details</h2>
            <div className="space-y-2.5">
              <div>
                <p className="text-muted-foreground">Assembly Item SKU</p>
                <p className="font-mono font-medium text-foreground mt-0.5">{workOrder.bom.product.sku}</p>
              </div>

              {workOrder.salesOrder && (
                <div>
                  <p className="text-muted-foreground">Linked Sales Order</p>
                  <Link
                    href={`/sales-orders/${workOrder.salesOrder.id}`}
                    className="font-medium text-primary hover:underline flex items-center gap-1 mt-0.5"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    {workOrder.salesOrder.orderNumber} ({workOrder.salesOrder.company?.name || "Customer"})
                  </Link>
                </div>
              )}

              <div>
                <p className="text-muted-foreground">Target Due Date</p>
                <p className="font-medium text-foreground flex items-center gap-1 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  {formatDate(workOrder.dueDate)}
                </p>
              </div>

              {workOrder.notes && (
                <div>
                  <p className="text-muted-foreground">Machining Notes</p>
                  <p className="font-medium text-foreground mt-0.5 whitespace-pre-wrap">{workOrder.notes}</p>
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

        {/* Right Column — BOM Material Consumption Breakdown & Activity */}
        <div className="lg:col-span-2 space-y-6">
          {/* BOM Material Explosion */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-500" />
              Bill of Materials — Required Raw Material Consumption
            </h2>
            <p className="text-xs text-muted-foreground">
              Single-level BOM explosion required to produce {plannedQty} units of {workOrder.bom.product.name}:
            </p>

            {workOrder.bom.lines.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                No BOM components registered for this product.
              </p>
            ) : (
              <div className="divide-y divide-border/60 text-xs pt-1">
                {workOrder.bom.lines.map((line) => {
                  const lineQty = Number(line.quantity);
                  const totalNeeded = lineQty * plannedQty;
                  return (
                    <div key={line.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-foreground">{line.product.name}</span>
                        <span className="font-mono text-[10px] text-muted-foreground ml-2">
                          ({line.product.sku})
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold tabular-nums text-primary text-sm">
                          {totalNeeded} {line.product.unit}
                        </span>
                        <p className="text-[10px] text-muted-foreground">
                          ({lineQty} per unit × {plannedQty})
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {(currentStage?.name === "Completed" || workOrder.completedAt) && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg flex items-center gap-2 text-emerald-500 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                Raw materials have been automatically deducted from warehouse inventory.
              </div>
            )}
          </div>

          {/* Activity Feed */}
          <div className="bg-card border border-border rounded-xl p-5">
            <ActivityTimeline
              tenantId={tenantId}
              entityType="WorkOrder"
              entityId={workOrder.id}
              initialActivities={activities}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
