import { getServerSession } from "@/lib/auth";
import { prisma, tenantTransaction } from "@/lib/db";
import { redirect } from "next/navigation";
import { LeadForm } from "./LeadForm";
import { KanbanBoard } from "./KanbanBoard";
import { Target } from "lucide-react";

interface LeadsPageProps {
  searchParams: Promise<{ new?: string }>;
}

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const { new: showNew } = await searchParams;
  const session = await getServerSession();
  if (!session) redirect("/login");

  const membership = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id },
    include: { tenant: true },
  });

  if (!membership) redirect("/onboarding");

  const tenantId = membership.tenant.id;

  const [leads, leadStages, dealStages, contacts, companies, customFieldDefs] =
    await tenantTransaction(tenantId, async (tx) => {
      return Promise.all([
        tx.lead.findMany({
          where: { tenantId },
          include: { contact: true, company: true },
          orderBy: { createdAt: "desc" },
        }),
        tx.pipelineStage.findMany({
          where: { tenantId, pipelineType: "lead" },
          orderBy: { sortOrder: "asc" },
        }),
        tx.pipelineStage.findMany({
          where: { tenantId, pipelineType: "deal" },
          orderBy: { sortOrder: "asc" },
        }),
        tx.contact.findMany({
          where: { tenantId },
          orderBy: { firstName: "asc" },
        }),
        tx.company.findMany({
          where: { tenantId },
          orderBy: { name: "asc" },
        }),
        tx.customFieldDefinition.findMany({
          where: { tenantId, entityType: "Lead" },
          orderBy: { sortOrder: "asc" },
        }),
      ]);
    });

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Leads Pipeline</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Track inquiries, qualify prospects, and convert qualified leads directly to Deals.
          </p>
        </div>
        <LeadForm
          tenantId={tenantId}
          contacts={contacts}
          companies={companies}
          stages={leadStages}
          customFieldDefinitions={customFieldDefs}
          defaultOpen={showNew === "1"}
        />
      </div>

      {/* Kanban view */}
      <KanbanBoard
        tenantId={tenantId}
        stages={leadStages}
        initialLeads={leads}
        dealStages={dealStages}
      />
    </div>
  );
}
