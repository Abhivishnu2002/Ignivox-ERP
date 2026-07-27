"use server";

import { tenantTransaction } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const productSchema = z.object({
  sku: z.string().min(1, "SKU required"),
  name: z.string().min(1, "Product name required"),
  description: z.string().optional(),
  type: z.enum(["finished_good", "raw_material", "subassembly", "service"]).default("finished_good"),
  unitOfMeasure: z.string().default("pcs"),
  unitCost: z.number().min(0).default(0),
  unitPrice: z.number().min(0).default(0),
  customFields: z.record(z.string(), z.unknown()).default({}),
});

export type ProductInput = z.infer<typeof productSchema>;

export async function createProductAction(tenantId: string, input: ProductInput) {
  const { can } = await requireTenantAccess(tenantId);
  if (!can(PERMISSIONS.MANUFACTURING.PRODUCTS.CREATE)) {
    return { error: "Unauthorized to create products" };
  }

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const data = parsed.data;

  try {
    return await tenantTransaction(tenantId, async (tx) => {
      const existing = await tx.product.findFirst({
        where: { tenantId, sku: data.sku },
      });

      if (existing) {
        return { error: `Product SKU '${data.sku}' already exists` };
      }

      const product = await tx.product.create({
        data: {
          tenantId,
          sku: data.sku,
          name: data.name,
          description: data.description || null,
          type: data.type,
          unit: data.unitOfMeasure,
          unitPrice: data.unitPrice,
          customFields: (data.customFields ?? {}) as unknown as never,
        },
      });

      // Also create an initial inventory record with 0 quantity
      await tx.inventoryItem.create({
        data: {
          tenantId,
          productId: product.id,
          location: "Main Warehouse",
          quantity: 0,
          reorderLevel: 10,
        },
      });

      revalidatePath("/products");
      revalidatePath("/inventory");
      return { success: true, productId: product.id };
    });
  } catch (e) {
    return { error: (e as Error).message || "Failed to create product" };
  }
}

// Action to add BOM component to a product (Assembly -> Raw Material)
export async function addBomComponentAction(
  tenantId: string,
  productId: string,
  componentProductId: string,
  quantityRequired: number,
  notes?: string
) {
  const { can } = await requireTenantAccess(tenantId);
  if (!can(PERMISSIONS.MANUFACTURING.BOMS.CREATE)) {
    return { error: "Unauthorized to manage BOMs" };
  }

  if (productId === componentProductId) {
    return { error: "Product cannot be a component of itself" };
  }

  try {
    return await tenantTransaction(tenantId, async (tx) => {
      // Find or create active BOM for productId
      let bom = await tx.billOfMaterials.findFirst({
        where: { tenantId, productId, isActive: true },
      });

      if (!bom) {
        const parentProd = await tx.product.findUnique({ where: { id: productId } });
        bom = await tx.billOfMaterials.create({
          data: {
            tenantId,
            productId,
            name: `${parentProd?.name || "Product"} — Standard BOM`,
            version: "1.0",
            isActive: true,
          },
        });
      }

      // Check for duplicate BOM line
      const existingLine = await tx.bomLine.findFirst({
        where: { bomId: bom.id, productId: componentProductId },
      });

      if (existingLine) {
        await tx.bomLine.update({
          where: { id: existingLine.id },
          data: { quantity: quantityRequired, notes: notes || existingLine.notes },
        });
      } else {
        await tx.bomLine.create({
          data: {
            bomId: bom.id,
            productId: componentProductId,
            quantity: quantityRequired,
            notes: notes || null,
          },
        });
      }

      revalidatePath(`/products/${productId}`);
      return { success: true };
    });
  } catch (e) {
    return { error: (e as Error).message || "Failed to add BOM component" };
  }
}

export async function deleteBomComponentAction(tenantId: string, bomLineId: string, productId: string) {
  const { can } = await requireTenantAccess(tenantId);
  if (!can(PERMISSIONS.MANUFACTURING.BOMS.CREATE)) {
    return { error: "Unauthorized to manage BOMs" };
  }

  try {
    return await tenantTransaction(tenantId, async (tx) => {
      await tx.bomLine.delete({ where: { id: bomLineId } });
      revalidatePath(`/products/${productId}`);
      return { success: true };
    });
  } catch (e) {
    return { error: (e as Error).message || "Failed to remove component" };
  }
}
