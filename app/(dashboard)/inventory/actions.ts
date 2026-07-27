"use server";

import { tenantTransaction } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

export async function adjustInventoryStockAction(
  tenantId: string,
  inventoryId: string,
  newQuantityOnHand: number,
  location?: string,
  reason?: string
) {
  const { can, user } = await requireTenantAccess(tenantId);
  if (!can(PERMISSIONS.INVENTORY.ITEMS.UPDATE)) {
    return { error: "Unauthorized to adjust inventory" };
  }

  if (newQuantityOnHand < 0) {
    return { error: "Quantity on hand cannot be negative" };
  }

  try {
    return await tenantTransaction(tenantId, async (tx) => {
      const item = await tx.inventoryItem.findUnique({
        where: { id: inventoryId },
        include: { product: true },
      });

      if (!item) return { error: "Inventory item not found" };

      const diff = newQuantityOnHand - Number(item.quantity);

      await tx.inventoryItem.update({
        where: { id: inventoryId },
        data: {
          quantity: newQuantityOnHand,
          location: location || item.location,
        },
      });

      // Log activity
      await tx.activity.create({
        data: {
          tenantId,
          entityType: "Product",
          entityId: item.productId,
          type: "status_change",
          title: `Stock Adjustment for ${item.product.name}`,
          description: `Stock adjusted from ${item.quantity} to ${newQuantityOnHand} (${diff >= 0 ? "+" : ""}${diff}). Reason: ${reason || "Manual audit adjustment"}`,
          userId: user.id,
        },
      });

      revalidatePath("/inventory");
      revalidatePath(`/products/${item.productId}`);
      return { success: true };
    });
  } catch (e) {
    return { error: (e as Error).message || "Failed to adjust stock" };
  }
}
