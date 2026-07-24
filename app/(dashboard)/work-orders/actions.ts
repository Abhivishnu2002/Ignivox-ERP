"use server";

import type { Prisma } from "@prisma/client";
import { prisma, tenantTransaction } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const workOrderSchema = z.object({
  productId: z.string().min(1, "Product required"),
  salesOrderId: z.string().optional(),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  stageId: z.string().min(1, "Stage required"),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  customFields: z.record(z.string(), z.unknown()).default({}),
});

export type WorkOrderInput = z.infer<typeof workOrderSchema>;

export async function createWorkOrderAction(tenantId: string, input: WorkOrderInput) {
  const { can } = await requireTenantAccess(tenantId);
  if (!can(PERMISSIONS.MANUFACTURING.WORK_ORDERS.CREATE)) {
    return { error: "Unauthorized to create work orders" };
  }

  const parsed = workOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const data = parsed.data;

  try {
    return await tenantTransaction(tenantId, async (tx) => {
      // Auto-generate WO number WO-0001
      const count = await tx.workOrder.count({ where: { tenantId } });
      const workOrderNumber = `WO-${String(count + 1).padStart(4, "0")}`;

      // Find or create active BOM for productId
      let bom = await tx.billOfMaterials.findFirst({
        where: { tenantId, productId: data.productId, isActive: true },
      });

      if (!bom) {
        const prod = await tx.product.findUnique({ where: { id: data.productId } });
        bom = await tx.billOfMaterials.create({
          data: {
            tenantId,
            productId: data.productId,
            name: `${prod?.name || "Product"} — Standard BOM`,
            version: "1.0",
            isActive: true,
          },
        });
      }

      const workOrder = await tx.workOrder.create({
        data: {
          tenantId,
          workOrderNumber,
          bomId: bom.id,
          salesOrderId: data.salesOrderId || null,
          quantityPlanned: data.quantity,
          stageId: data.stageId,
          startDate: data.startDate ? new Date(data.startDate) : null,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          notes: data.notes || null,
          customFields: (data.customFields ?? {}) as Prisma.InputJsonObject,
        },
      });

      revalidatePath("/work-orders");
      return { success: true, workOrderId: workOrder.id };
    });
  } catch (e) {
    return { error: (e as Error).message || "Failed to create work order" };
  }
}

export async function updateWorkOrderStageAction(
  tenantId: string,
  workOrderId: string,
  stageId: string
) {
  const { can, user } = await requireTenantAccess(tenantId);
  if (!can(PERMISSIONS.MANUFACTURING.WORK_ORDERS.UPDATE)) {
    return { error: "Unauthorized to update work orders" };
  }

  try {
    return await tenantTransaction(tenantId, async (tx) => {
      const workOrder = await tx.workOrder.findUnique({
        where: { id: workOrderId },
        include: {
          bom: {
            include: {
              product: true,
              lines: {
                include: { product: true },
              },
            },
          },
        },
      });

      if (!workOrder) return { error: "Work order not found" };

      const targetStage = await tx.pipelineStage.findUnique({ where: { id: stageId } });
      if (!targetStage) return { error: "Target stage not found" };

      const isCompleted = targetStage.name === "Completed";
      const updates: { stageId: string; completedAt?: Date | null } = {
        stageId,
      };

      let consumedMaterialsSummary = "";

      // Single-level BOM Material Consumption when stage moves to Completed
      if (isCompleted && !workOrder.completedAt) {
        updates.completedAt = new Date();
        const plannedQty = Number(workOrder.quantityPlanned);

        // Explode BOM single-level and deduct raw materials from Inventory
        for (const line of workOrder.bom.lines) {
          const totalQtyNeeded = Number(line.quantity) * plannedQty;

          // Find or create inventory item for component
          const inventory = await tx.inventoryItem.findFirst({
            where: { tenantId, productId: line.productId },
          });

          if (inventory) {
            await tx.inventoryItem.update({
              where: { id: inventory.id },
              data: {
                quantity: Math.max(0, Number(inventory.quantity) - totalQtyNeeded),
              },
            });
          }

          consumedMaterialsSummary += `\n• Deducted ${totalQtyNeeded} ${line.product.unit} of ${line.product.name}`;
        }

        // Add finished good item to inventory stock
        const fgInventory = await tx.inventoryItem.findFirst({
          where: { tenantId, productId: workOrder.bom.productId },
        });

        if (fgInventory) {
          await tx.inventoryItem.update({
            where: { id: fgInventory.id },
            data: {
              quantity: Number(fgInventory.quantity) + plannedQty,
            },
          });
        }
      }

      await tx.workOrder.update({
        where: { id: workOrderId },
        data: updates,
      });

      // Log activity
      await tx.activity.create({
        data: {
          tenantId,
          entityType: "WorkOrder",
          entityId: workOrder.id,
          type: "status_change",
          title: `Moved to ${targetStage.name}`,
          description: `Work order ${workOrder.workOrderNumber} stage updated to ${targetStage.name}.${consumedMaterialsSummary}`,
          userId: user.id,
        },
      });

      revalidatePath("/work-orders");
      revalidatePath("/inventory");
      return { success: true, materialDeducted: consumedMaterialsSummary !== "" };
    });
  } catch (e) {
    return { error: (e as Error).message || "Failed to update work order stage" };
  }
}
