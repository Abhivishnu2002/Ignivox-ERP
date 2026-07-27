"use client";

import { useState } from "react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { updateWorkOrderStageAction } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Calendar, ShoppingCart, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import type { WorkOrder, PipelineStage, Product, BillOfMaterials, SalesOrder } from "@/lib/prisma-types";

type WorkOrderWithRelations = WorkOrder & {
  bom: BillOfMaterials & { product: Product };
  salesOrder?: SalesOrder | null;
};

interface WorkOrderKanbanProps {
  tenantId: string;
  stages: PipelineStage[];
  initialWorkOrders: WorkOrderWithRelations[];
}

export function WorkOrderKanban({
  tenantId,
  stages,
  initialWorkOrders,
}: WorkOrderKanbanProps) {
  const [workOrders, setWorkOrders] = useState<WorkOrderWithRelations[]>(initialWorkOrders);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  async function handleDrop(targetStageId: string) {
    if (!draggingId) return;

    const woToMove = workOrders.find((w) => w.id === draggingId);
    if (!woToMove || woToMove.stageId === targetStageId) {
      setDraggingId(null);
      return;
    }

    const targetStage = stages.find((s) => s.id === targetStageId);

    // Optimistic update
    setWorkOrders((prev) =>
      prev.map((w) =>
        w.id === draggingId
          ? {
              ...w,
              stageId: targetStageId,
            }
          : w
      )
    );
    setDraggingId(null);

    try {
      const res = await updateWorkOrderStageAction(tenantId, draggingId, targetStageId);
      if ("error" in res && res.error) {
        toast.error(res.error);
        setWorkOrders(initialWorkOrders);
      } else {
        if ("materialDeducted" in res && res.materialDeducted) {
          toast.success("⚡ Work Order Completed! Single-level BOM raw materials deducted from inventory.");
        } else {
          toast.success(`Work Order moved to ${targetStage?.name}`);
        }
      }
    } catch {
      toast.error("Failed to update work order stage");
      setWorkOrders(initialWorkOrders);
    }
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 items-start min-h-[600px]">
      {stages.map((stage) => {
        const stageWos = workOrders.filter((w) => w.stageId === stage.id);

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
                  {stageWos.length}
                </Badge>
              </div>
            </div>

            {/* Cards List */}
            <div className="flex flex-col gap-2 min-h-[150px]">
              {stageWos.length === 0 ? (
                <div className="border border-dashed border-border/60 rounded-lg p-4 text-center text-xs text-muted-foreground/50">
                  No work orders in stage
                </div>
              ) : (
                stageWos.map((wo) => (
                  <div
                    key={wo.id}
                    draggable
                    onDragStart={() => setDraggingId(wo.id)}
                    className="kanban-card space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-[11px] font-bold text-primary">
                          {wo.workOrderNumber}
                        </span>
                        <Link
                          href={`/work-orders/${wo.id}`}
                          className="block text-xs font-semibold text-foreground hover:text-primary transition-colors leading-snug mt-0.5"
                        >
                          {wo.bom.product.name}
                        </Link>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-bold">
                        {Number(wo.quantityPlanned)} {wo.bom.product.unit}
                      </Badge>
                    </div>

                    {/* Sales Order / Due Date Info */}
                    <div className="space-y-1 text-[11px] text-muted-foreground">
                      {wo.salesOrder && (
                        <div className="flex items-center gap-1">
                          <ShoppingCart className="w-3 h-3 text-indigo-400" />
                          <span>SO: {wo.salesOrder.orderNumber}</span>
                        </div>
                      )}
                      {wo.dueDate && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-muted-foreground/70" />
                          <span>Due: {formatDate(wo.dueDate)}</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom status badge */}
                    <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="font-mono">{wo.bom.product.sku}</span>
                      {stage.name === "Completed" && (
                        <span className="flex items-center gap-1 text-emerald-500 font-semibold">
                          <CheckCircle2 className="w-3 h-3" /> Materials Deducted
                        </span>
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
