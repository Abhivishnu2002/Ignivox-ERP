import { getServerSession } from "@/lib/auth";
import { prisma, tenantTransaction } from "@/lib/db";
import { redirect } from "next/navigation";
import { DealForm } from "./DealForm";
import { DealsKanban } from "./DealsKanban";
import { Handshake } from "lucide-react";

interface DealsPageProps {
  searchParams: Promise<{ new?: string }>;
}

export default async function DealsPage({ searchParams }: DealsPageProps) {
  const { new: showNew } = await searchParams;
  const session = await getServerSession();
  if (!session) redirect("/login");

  const membership = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id },
    include: { tenant: true },
  });

  if (!membership) redirect("/onboarding");

  const tenantId = membership.tenant.id;

  const [deals, dealStages, contacts, companies, customFieldDefs] =
    await tenantTransaction(tenantId, async (tx) => {
      return Promise.all([
        tx.deal.findMany({
          where: { tenantId },
          include: { contact: true, company: true },
          orderBy: { createdAt: "desc" },
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
          where: { tenantId, entityType: "Deal" },
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
            <Handshake className="w-5 h-5 text-amber-500" />
            <h1 className="text-2xl font-bold tracking-tight">Deals & Opportunities</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manage sales pipeline, negotiate quotes, and convert Won deals directly into Sales Orders.
          </p>
        </div>
        <DealForm
          tenantId={tenantId}
          contacts={contacts}
          companies={companies}
          stages={dealStages}
          customFieldDefinitions={customFieldDefs}
          defaultOpen={showNew === "1"}
        />
      </div>

      {/* Kanban view */}
      <DealsKanban
        tenantId={tenantId}
        stages={dealStages}
        initialDeals={deals}
      />
    </div>
  );
}
