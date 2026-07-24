import { getServerSession } from "@/lib/auth";
import { prisma, tenantTransaction } from "@/lib/db";
import { redirect } from "next/navigation";
import { WorkOrderForm } from "./WorkOrderForm";
import { WorkOrderKanban } from "./WorkOrderKanban";
import { Factory } from "lucide-react";

interface WorkOrdersPageProps {
  searchParams: Promise<{ new?: string }>;
}

export default async function WorkOrdersPage({ searchParams }: WorkOrdersPageProps) {
  const { new: showNew } = await searchParams;
  const session = await getServerSession();
  if (!session) redirect("/login");

  const membership = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id },
    include: { tenant: true },
  });

  if (!membership) redirect("/onboarding");

  const tenantId = membership.tenant.id;

  const [workOrders, woStages, products, salesOrders, customFieldDefs] =
    await tenantTransaction(tenantId, async (tx) => {
      return Promise.all([
        tx.workOrder.findMany({
          where: { tenantId },
          include: { bom: { include: { product: true } }, salesOrder: true },
          orderBy: { createdAt: "desc" },
        }),
        tx.pipelineStage.findMany({
          where: { tenantId, pipelineType: "work_order" },
          orderBy: { sortOrder: "asc" },
        }),
        tx.product.findMany({
          where: { tenantId },
          orderBy: { name: "asc" },
        }),
        tx.salesOrder.findMany({
          where: { tenantId },
          orderBy: { createdAt: "desc" },
        }),
        tx.customFieldDefinition.findMany({
          where: { tenantId, entityType: "WorkOrder" },
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
            <Factory className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Shop Floor & Work Orders</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Job-shop manufacturing scheduling, shop floor Kanban board, and automated BOM raw material inventory consumption.
          </p>
        </div>
        <WorkOrderForm
          tenantId={tenantId}
          products={products}
          salesOrders={salesOrders}
          stages={woStages}
          customFieldDefinitions={customFieldDefs}
          defaultOpen={showNew === "1"}
        />
      </div>

      {/* Kanban Shop Floor */}
      <WorkOrderKanban
        tenantId={tenantId}
        stages={woStages}
        initialWorkOrders={workOrders}
      />
    </div>
  );
}
