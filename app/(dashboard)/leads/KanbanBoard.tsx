"use client";

import { useState } from "react";
import { toast } from "sonner";
import { formatCurrency, stageColorToStyle } from "@/lib/utils";
import { updateLeadStageAction } from "./actions";
import { ConvertLeadDialog } from "./ConvertLeadDialog";
import { Badge } from "@/components/ui/badge";
import { Building2, User } from "lucide-react";
import type { Lead, PipelineStage, Contact, Company } from "@prisma/client";

type LeadWithRelations = Lead & {
  contact?: Contact | null;
  company?: Company | null;
};

interface KanbanBoardProps {
  tenantId: string;
  stages: PipelineStage[];
  initialLeads: LeadWithRelations[];
  dealStages: PipelineStage[];
}

export function KanbanBoard({
  tenantId,
  stages,
  initialLeads,
  dealStages,
}: KanbanBoardProps) {
  const [leads, setLeads] = useState<LeadWithRelations[]>(initialLeads);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  async function handleDrop(targetStageId: string) {
    if (!draggingId) return;

    const leadToMove = leads.find((l) => l.id === draggingId);
    if (!leadToMove || leadToMove.stageId === targetStageId) {
      setDraggingId(null);
      return;
    }

    // Optimistic update
    setLeads((prev) =>
      prev.map((l) => (l.id === draggingId ? { ...l, stageId: targetStageId } : l))
    );
    setDraggingId(null);

    try {
      const res = await updateLeadStageAction(tenantId, draggingId, targetStageId);
      if ("error" in res && res.error) {
        toast.error(res.error);
        // Revert
        setLeads(initialLeads);
      } else {
        toast.success("Stage updated");
      }
    } catch {
      toast.error("Failed to update stage");
      setLeads(initialLeads);
    }
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 items-start min-h-[600px]">
      {stages.map((stage) => {
        const stageLeads = leads.filter((l) => l.stageId === stage.id);
        const stageTotal = stageLeads.reduce(
          (sum, l) => sum + Number(l.value ?? 0),
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
                  {stageLeads.length}
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
              {stageLeads.length === 0 ? (
                <div className="border border-dashed border-border/60 rounded-lg p-4 text-center text-xs text-muted-foreground/50">
                  No leads in stage
                </div>
              ) : (
                stageLeads.map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={() => setDraggingId(lead.id)}
                    className="kanban-card space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-foreground leading-snug">
                        {lead.title}
                      </p>
                      {lead.value && (
                        <span className="text-xs font-bold tabular-nums text-primary">
                          {formatCurrency(Number(lead.value))}
                        </span>
                      )}
                    </div>

                    {/* Contact & Company Info */}
                    <div className="space-y-1 text-[11px] text-muted-foreground">
                      {lead.company && (
                        <div className="flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-muted-foreground/70" />
                          <span className="truncate font-medium">{lead.company.name}</span>
                        </div>
                      )}
                      {lead.contact && (
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3 text-muted-foreground/70" />
                          <span className="truncate">
                            {lead.contact.firstName} {lead.contact.lastName}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Bottom actions */}
                    <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                      {lead.source && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">
                          {lead.source.replace("_", " ")}
                        </span>
                      )}
                      {stage.name !== "Converted" && (
                        <ConvertLeadDialog
                          tenantId={tenantId}
                          lead={lead}
                          dealStages={dealStages}
                        />
                      )}
                    </div>
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
