import { getServerSession } from "@/lib/auth";
import { prisma, tenantTransaction } from "@/lib/db";
import { redirect } from "next/navigation";
import { PipelineStageForm } from "./PipelineStageForm";
import { Badge } from "@/components/ui/badge";
import { stageColorToStyle } from "@/lib/utils";
import { GitCommitHorizontal } from "lucide-react";

export default async function PipelineStagesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const membership = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id },
    include: { tenant: true },
  });

  if (!membership) redirect("/onboarding");

  const tenantId = membership.tenant.id;

  // Fetch all stages for tenant via tenantTransaction
  const stages = await tenantTransaction(tenantId, async (tx) => {
    return tx.pipelineStage.findMany({
      where: { tenantId },
      orderBy: [{ pipelineType: "asc" }, { sortOrder: "asc" }],
    });
  });

  const pipelines = [
    { id: "lead", name: "Lead Pipeline", desc: "Stages for incoming inquiries & qualified leads" },
    { id: "deal", name: "Deal Pipeline", desc: "Stages for sales opportunities & closing deals" },
    { id: "work_order", name: "Work Order Pipeline", desc: "Production stages on the shop floor" },
    { id: "purchase_order", name: "Purchase Order Pipeline", desc: "Procurement fulfillment stages" },
  ] as const;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <GitCommitHorizontal className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Pipeline Stage Management</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Configure custom workflow pipelines for leads, deals, and work orders with custom names, colors, and order.
          </p>
        </div>
        <PipelineStageForm tenantId={tenantId} />
      </div>

      {/* Pipelines grid */}
      <div className="space-y-6">
        {pipelines.map((p) => {
          const pStages = stages.filter((s) => s.pipelineType === p.id);
          return (
            <div key={p.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 bg-muted/30 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">{p.name}</h2>
                  <p className="text-xs text-muted-foreground">{p.desc}</p>
                </div>
                <PipelineStageForm tenantId={tenantId} defaultPipelineType={p.id} />
              </div>

              <div className="p-5">
                {pStages.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No stages configured for this pipeline yet.
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    {pStages.map((stage, idx) => (
                      <div key={stage.id} className="flex items-center gap-3">
                        <div
                          className="px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-2"
                          style={stageColorToStyle(stage.color)}
                        >
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: stage.color }}
                          />
                          <span>{stage.name}</span>
                          {stage.isDefault && (
                            <Badge variant="outline" className="text-[9px] py-0 px-1">
                              Default
                            </Badge>
                          )}
                          {stage.isWon && (
                            <Badge className="text-[9px] py-0 px-1 bg-emerald-500 text-white">
                              Won
                            </Badge>
                          )}
                          {stage.isLost && (
                            <Badge className="text-[9px] py-0 px-1 bg-rose-500 text-white">
                              Lost
                            </Badge>
                          )}
                        </div>
                        {idx < pStages.length - 1 && (
                          <span className="text-muted-foreground/30 text-xs">→</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
