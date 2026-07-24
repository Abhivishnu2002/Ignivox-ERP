import { getServerSession } from "@/lib/auth";
import { prisma, tenantTransaction } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { ActivityTimeline } from "@/components/activity/ActivityTimeline";
import { CustomFieldRenderer } from "@/components/custom-fields/CustomFieldRenderer";
import { ConvertDealDialog } from "../ConvertDealDialog";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, stageColorToStyle } from "@/lib/utils";
import { ArrowLeft, Handshake, Building2, User, Calendar, ShoppingCart } from "lucide-react";
import Link from "next/link";
import type { SalesOrder, CustomFieldDefinition } from "@/lib/prisma-types";

interface DealDetailPageProps {
  params: Promise<{ dealId: string }>;
}

export default async function DealDetailPage({ params }: DealDetailPageProps) {
  const { dealId } = await params;
  const session = await getServerSession();
  if (!session) redirect("/login");

  const membership = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id },
    include: { tenant: true },
  });

  if (!membership) redirect("/onboarding");

  const tenantId = membership.tenant.id;

  const [deal, stages, customDefs, activities] = await tenantTransaction(
    tenantId,
    async (tx) => {
      return Promise.all([
        tx.deal.findFirst({
          where: { id: dealId, tenantId },
          include: {
            contact: true,
            company: true,
            salesOrders: true,
          },
        }),
        tx.pipelineStage.findMany({
          where: { tenantId, pipelineType: "deal" },
        }),
        tx.customFieldDefinition.findMany({
          where: { tenantId, entityType: "Deal" },
          orderBy: { sortOrder: "asc" },
        }),
        tx.activity.findMany({
          where: { tenantId, entityType: "Deal", entityId: dealId },
          orderBy: { createdAt: "desc" },
        }),
      ]);
    }
  );

  if (!deal) notFound();

  const currentStage = stages.find((s) => s.id === deal.stageId);
  const customFieldsData = (deal.customFields ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back button */}
      <Link
        href="/deals"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Deals
      </Link>

      {/* Deal Header Card */}
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 font-bold text-xl">
            <Handshake className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{deal.title}</h1>
              {currentStage && (
                <div
                  className="px-2.5 py-0.5 rounded-full border text-xs font-semibold"
                  style={stageColorToStyle(currentStage.color)}
                >
                  {currentStage.name}
                </div>
              )}
            </div>
            <p className="text-xl font-bold text-primary tabular-nums mt-1">
              {formatCurrency(Number(deal.value))}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {(currentStage?.isWon || deal.wonAt) && (
            <ConvertDealDialog tenantId={tenantId} deal={deal} />
          )}
        </div>
      </div>

      {/* Grid: Left = Info + Linked Sales Orders + Custom Fields, Right = Activity Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="space-y-6 lg:col-span-1">
          {/* Deal Details */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3 text-xs">
            <h2 className="text-sm font-semibold">Deal Information</h2>
            <div className="space-y-2.5">
              <div>
                <p className="text-muted-foreground">Account / Company</p>
                {deal.company ? (
                  <Link
                    href={`/companies/${deal.company.id}`}
                    className="font-medium text-foreground hover:text-primary flex items-center gap-1 mt-0.5"
                  >
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                    {deal.company.name}
                  </Link>
                ) : (
                  <p className="text-muted-foreground/50 mt-0.5">—</p>
                )}
              </div>

              <div>
                <p className="text-muted-foreground">Contact Person</p>
                {deal.contact ? (
                  <Link
                    href={`/contacts/${deal.contact.id}`}
                    className="font-medium text-foreground hover:text-primary flex items-center gap-1 mt-0.5"
                  >
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    {deal.contact.firstName} {deal.contact.lastName}
                  </Link>
                ) : (
                  <p className="text-muted-foreground/50 mt-0.5">—</p>
                )}
              </div>

              <div>
                <p className="text-muted-foreground">Expected Close Date</p>
                <p className="font-medium text-foreground flex items-center gap-1 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  {formatDate(deal.expectedCloseDate)}
                </p>
              </div>
            </div>
          </div>

          {/* Linked Sales Orders */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-indigo-500" />
              Sales Orders ({deal.salesOrders.length})
            </h2>
            {deal.salesOrders.length === 0 ? (
              <p className="text-xs text-muted-foreground">No sales orders generated yet.</p>
            ) : (
              <div className="divide-y divide-border/60 text-xs">
                {deal.salesOrders.map((so: any) => (
                  <Link
                    key={so.id}
                    href={`/sales-orders/${so.id}`}
                    className="py-2 flex items-center justify-between hover:text-primary transition-colors"
                  >
                    <div>
                      <p className="font-semibold">{so.orderNumber}</p>
                      <p className="text-[10px] text-muted-foreground">{formatDate(so.orderDate)}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {so.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Custom Fields Card */}
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
            entityType="Deal"
            entityId={deal.id}
            initialActivities={activities}
          />
        </div>
      </div>
    </div>
  );
}
