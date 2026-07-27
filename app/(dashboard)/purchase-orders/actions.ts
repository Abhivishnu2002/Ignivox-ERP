"use server";

import { tenantTransaction } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const poSchema = z.object({
  supplierId: z.string().min(1, "Supplier required"),
  expectedDeliveryDate: z.string().optional(),
  notes: z.string().optional(),
  totalAmount: z.number().min(0).default(0),
  customFields: z.record(z.string(), z.unknown()).default({}),
});

export type PurchaseOrderInput = z.infer<typeof poSchema>;

export async function createPurchaseOrderAction(tenantId: string, input: PurchaseOrderInput) {
  const { can } = await requireTenantAccess(tenantId);
  if (!can(PERMISSIONS.PROCUREMENT.PURCHASE_ORDERS.CREATE)) {
    return { error: "Unauthorized to create purchase orders" };
  }

  const parsed = poSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const data = parsed.data;

  try {
    return await tenantTransaction(tenantId, async (tx) => {
      // Auto-generate PO number PO-0001
      const count = await tx.purchaseOrder.count({ where: { tenantId } });
      const poNumber = `PO-${String(count + 1).padStart(4, "0")}`;

      const po = await tx.purchaseOrder.create({
        data: {
          tenantId,
          poNumber,
          supplierId: data.supplierId,
          status: "pending",
          totalAmount: data.totalAmount,
          expectedDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null,
          notes: data.notes || null,
          customFields: (data.customFields ?? {}) as unknown as never,
        },
      });

      revalidatePath("/purchase-orders");
      return { success: true, poId: po.id };
    });
  } catch (e) {
    return { error: (e as Error).message || "Failed to create purchase order" };
  }
}

// Receive Purchase Order items into warehouse inventory
export async function receivePurchaseOrderAction(
  tenantId: string,
  poId: string,
  rawMaterialProductId?: string,
  receivedQuantity?: number
) {
  const { can, user } = await requireTenantAccess(tenantId);
  if (!can(PERMISSIONS.PROCUREMENT.PURCHASE_ORDERS.UPDATE)) {
    return { error: "Unauthorized to receive purchase orders" };
  }

  try {
    return await tenantTransaction(tenantId, async (tx) => {
      const po = await tx.purchaseOrder.findUnique({
        where: { id: poId },
        include: { supplier: true },
      });

      if (!po) return { error: "Purchase Order not found" };

      // Mark PO status as received
      await tx.purchaseOrder.update({
        where: { id: poId },
        data: {
          status: "received",
        },
      });

      let stockNote = "";

      // If a specific raw material product was received, increment inventory
      if (rawMaterialProductId && receivedQuantity && receivedQuantity > 0) {
        const inventory = await tx.inventoryItem.findFirst({
          where: { tenantId, productId: rawMaterialProductId },
        });

        if (inventory) {
          await tx.inventoryItem.update({
            where: { id: inventory.id },
            data: {
              quantity: Number(inventory.quantity) + receivedQuantity,
            },
          });
        }
        stockNote = ` Added ${receivedQuantity} units to warehouse inventory.`;
      }

      // Log activity
      await tx.activity.create({
        data: {
          tenantId,
          entityType: "PurchaseOrder",
          entityId: po.id,
          type: "status_change",
          title: `Purchase Order ${po.poNumber} Received`,
          description: `Shipment from ${po.supplier?.name || "supplier"} received into warehouse.${stockNote}`,
          userId: user.id,
        },
      });

      revalidatePath("/purchase-orders");
      revalidatePath("/inventory");
      return { success: true };
    });
  } catch (e) {
    return { error: (e as Error).message || "Failed to receive purchase order" };
  }
}
