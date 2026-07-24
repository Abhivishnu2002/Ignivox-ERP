"use client";

import { useState } from "react";
import { toast } from "sonner";
import { formatCurrency, stageColorToStyle } from "@/lib/utils";
import { updateDealStageAction } from "./actions";
import { ConvertDealDialog } from "./ConvertDealDialog";
import { Badge } from "@/components/ui/badge";
import { Building2, User, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { Deal, PipelineStage, Contact, Company } from "@prisma/client";

type DealWithRelations = Deal & {
  contact?: Contact | null;
  company?: Company | null;
};

interface DealsKanbanProps {
  tenantId: string;
  stages: PipelineStage[];
  initialDeals: DealWithRelations[];
}

export function DealsKanban({
  tenantId,
  stages,
  initialDeals,
}: DealsKanbanProps) {
  const [deals, setDeals] = useState<DealWithRelations[]>(initialDeals);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  async function handleDrop(targetStageId: string) {
    if (!draggingId) return;

    const dealToMove = deals.find((d) => d.id === draggingId);
    if (!dealToMove || dealToMove.stageId === targetStageId) {
      setDraggingId(null);
      return;
    }

    const targetStage = stages.find((s) => s.id === targetStageId);

    // Optimistic update
    setDeals((prev) =>
      prev.map((d) =>
        d.id === draggingId
          ? {
              ...d,
              stageId: targetStageId,
              wonAt: targetStage?.isWon ? new Date() : d.wonAt,
              lostAt: targetStage?.isLost ? new Date() : d.lostAt,
            }
          : d
      )
    );
    setDraggingId(null);

    try {
      const res = await updateDealStageAction(tenantId, draggingId, targetStageId);
      if ("error" in res && res.error) {
        toast.error(res.error);
        setDeals(initialDeals);
      } else {
        if (targetStage?.isWon) {
          toast.success("🎉 Deal Won!");
        } else if (targetStage?.isLost) {
          toast.info("Deal marked as Lost");
        } else {
          toast.success("Deal stage updated");
        }
      }
    } catch {
      toast.error("Failed to update deal stage");
      setDeals(initialDeals);
    }
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 items-start min-h-[600px]">
      {stages.map((stage) => {
        const stageDeals = deals.filter((d) => d.stageId === stage.id);
        const stageTotal = stageDeals.reduce(
          (sum, d) => sum + Number(d.value ?? 0),
          0
        );

        return (
          <div
            key={stage.id}
            className="kanban-column"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(stage.id)}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between px-1 py-1">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: stage.color }}
                />
                <h3 className="text-xs font-bold uppercase tracking-wider">{stage.name}</h3>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                  {stageDeals.length}
                </Badge>
              </div>
              {stageTotal > 0 && (
                <span className="text-[10px] text-muted-foreground font-semibold tabular-nums">
                  {formatCurrency(stageTotal)}
                </span>
              )}
            </div>

            {/* Cards List */}
            <div className="flex flex-col gap-2 min-h-[150px]">
              {stageDeals.length === 0 ? (
                <div className="border border-dashed border-border/60 rounded-lg p-4 text-center text-xs text-muted-foreground/50">
                  No deals in stage
                </div>
              ) : (
                stageDeals.map((deal) => (
                  <div
                    key={deal.id}
                    draggable
                    onDragStart={() => setDraggingId(deal.id)}
                    className="kanban-card space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/deals/${deal.id}`}
                        className="text-xs font-semibold text-foreground hover:text-primary transition-colors leading-snug group flex items-center gap-1"
                      >
                        <span>{deal.title}</span>
                        <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </Link>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold tabular-nums text-primary">
                        {formatCurrency(Number(deal.value))}
                      </span>
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

                    {/* Contact & Company Info */}
                    <div className="space-y-1 text-[11px] text-muted-foreground">
                      {deal.company && (
                        <div className="flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-muted-foreground/70" />
                          <span className="truncate font-medium">{deal.company.name}</span>
                        </div>
                      )}
                      {deal.contact && (
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3 text-muted-foreground/70" />
                          <span className="truncate">
                            {deal.contact.firstName} {deal.contact.lastName}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Bottom actions */}
                    {(stage.isWon || deal.wonAt) && (
                      <div className="pt-2 border-t border-border/60 flex justify-end">
                        <ConvertDealDialog tenantId={tenantId} deal={deal} />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
