import { getServerSession } from "@/lib/auth";
import { prisma, tenantTransaction } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { ActivityTimeline } from "@/components/activity/ActivityTimeline";
import { CustomFieldRenderer } from "@/components/custom-fields/CustomFieldRenderer";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  User,
  Building2,
  Calendar,
  Sparkles,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { ConvertLeadDialog } from "../ConvertLeadDialog";

interface LeadDetailPageProps {
  params: Promise<{ leadId: string }>;
}

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const { leadId } = await params;
  const session = await getServerSession();
  if (!session) redirect("/login");

  const membership = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id },
    include: { tenant: true },
  });

  if (!membership) redirect("/onboarding");

  const tenantId = membership.tenant.id;

  const [lead, pipelineStages, dealStages, customDefs, activities] = await tenantTransaction(
    tenantId,
    async (tx) => {
      return Promise.all([
        tx.lead.findFirst({
          where: { id: leadId, tenantId },
          include: {
            contact: true,
            company: true,
            deal: true,
          },
        }),
        tx.pipelineStage.findMany({
          where: { tenantId, pipelineType: "lead" },
          orderBy: { sortOrder: "asc" },
        }),
        tx.pipelineStage.findMany({
          where: { tenantId, pipelineType: "deal" },
          orderBy: { sortOrder: "asc" },
        }),
        tx.customFieldDefinition.findMany({
          where: { tenantId, entityType: "Lead" },
          orderBy: { sortOrder: "asc" },
        }),
        tx.activity.findMany({
          where: { tenantId, entityType: "Lead", entityId: leadId },
          orderBy: { createdAt: "desc" },
        }),
      ]);
    }
  );

  if (!lead) notFound();

  const currentStage = pipelineStages.find((s) => s.id === lead.stageId);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Top bar */}
      <div>
        <Link
          href="/leads"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Leads
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight">{lead.title}</h1>
              {currentStage && (
                <Badge
                  variant="outline"
                  style={{
                    backgroundColor: currentStage.color + "15",
                    color: currentStage.color,
                    borderColor: currentStage.color + "30",
                  }}
                  className="text-xs font-semibold"
                >
                  {currentStage.name}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Lead Source: <span className="font-medium text-foreground capitalize">{lead.source || "Direct"}</span>
            </p>
          </div>

          <div className="flex items-center gap-4">
            {lead.value !== null && (
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Estimated Value</p>
                <p className="text-2xl font-bold tabular-nums text-primary">
                  {formatCurrency(Number(lead.value))}
                </p>
              </div>
            )}
            {!lead.deal && (
              <ConvertLeadDialog
                tenantId={tenantId}
                lead={lead}
                dealStages={dealStages}
              />
            )}
          </div>
        </div>
      </div>

      {/* Grid: Left Details, Right Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="space-y-6 lg:col-span-1">
          {/* Information Card */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4 text-xs">
            <h2 className="text-sm font-semibold">Lead Details</h2>

            <div className="space-y-3">
              {lead.company && (
                <div>
                  <p className="text-muted-foreground">Company</p>
                  <Link
                    href={`/companies/${lead.company.id}`}
                    className="font-medium text-foreground hover:text-primary flex items-center gap-1.5 mt-0.5"
                  >
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                    {lead.company.name}
                  </Link>
                </div>
              )}

              {lead.contact && (
                <div>
                  <p className="text-muted-foreground font-medium">Contact Person</p>
                  <Link
                    href={`/contacts/${lead.contact.id}`}
                    className="font-medium text-foreground hover:text-primary flex items-center gap-1.5 mt-0.5"
                  >
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    {lead.contact.firstName} {lead.contact.lastName}
                  </Link>
                </div>
              )}

              {lead.deal && (
                <div>
                  <p className="text-muted-foreground font-medium">Converted Deal</p>
                  <Link
                    href={`/deals/${lead.deal.id}`}
                    className="font-medium text-emerald-600 hover:underline flex items-center gap-1.5 mt-0.5"
                  >
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                    {lead.deal.title}
                  </Link>
                </div>
              )}

              <div>
                <p className="text-muted-foreground">Created Date</p>
                <p className="font-medium text-foreground flex items-center gap-1 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  {formatDate(lead.createdAt)}
                </p>
              </div>
            </div>
          </div>

          {/* Custom Fields Card */}
          {customDefs.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h2 className="text-sm font-semibold">Custom Attributes</h2>
              <div className="space-y-3 text-xs">
                {customDefs.map((def) => {
                  const customFieldsData = (lead.customFields ?? {}) as Record<string, unknown>;
                  return (
                    <div key={def.id} className="flex justify-between items-center py-1 border-b border-border/40 last:border-0">
                      <span className="text-muted-foreground font-medium">{def.fieldLabel}</span>
                      <CustomFieldRenderer
                        definition={def}
                        value={customFieldsData[def.fieldName]}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Activity Timeline */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold mb-4">Activity & Interaction Log</h2>
            <ActivityTimeline
              tenantId={tenantId}
              entityType="Lead"
              entityId={lead.id}
              initialActivities={activities}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
