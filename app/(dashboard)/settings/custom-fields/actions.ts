"use server";

import { prisma, tenantTransaction } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const customFieldSchema = z.object({
  entityType: z.enum([
    "Contact",
    "Company",
    "Lead",
    "Deal",
    "Product",
    "SalesOrder",
    "WorkOrder",
    "Invoice",
    "PurchaseOrder",
  ]),
  fieldName: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[a-z0-9_]+$/, "Machine name must be lowercase letters, numbers, and underscores"),
  fieldLabel: z.string().min(2, "Label required"),
  fieldType: z.enum(["text", "number", "date", "select", "boolean"]),
  options: z.array(z.string()).optional(),
  isRequired: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

export type CustomFieldInput = z.infer<typeof customFieldSchema>;

export async function createCustomFieldAction(tenantId: string, input: CustomFieldInput) {
  const { can } = await requireTenantAccess(tenantId);
  if (!can(PERMISSIONS.ADMIN.CUSTOM_FIELDS.MANAGE)) {
    return { error: "Unauthorized to manage custom fields" };
  }

  const parsed = customFieldSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const data = parsed.data;

  try {
    return await tenantTransaction(tenantId, async (tx) => {
      // Check for duplicate fieldName for this entityType
      const existing = await tx.customFieldDefinition.findFirst({
        where: {
          tenantId,
          entityType: data.entityType,
          fieldName: data.fieldName,
        },
      });

      if (existing) {
        return { error: `Field key '${data.fieldName}' already exists for ${data.entityType}` };
      }

      await tx.customFieldDefinition.create({
        data: {
          tenantId,
          entityType: data.entityType,
          fieldName: data.fieldName,
          fieldLabel: data.fieldLabel,
          fieldType: data.fieldType,
          options: data.options ? data.options : undefined,
          isRequired: data.isRequired ?? false,
          sortOrder: data.sortOrder ?? 0,
        },
      });

      revalidatePath("/settings/custom-fields");
      return { success: true };
    });
  } catch (e) {
    return { error: (e as Error).message || "Failed to create custom field" };
  }
}

export async function deleteCustomFieldAction(tenantId: string, fieldId: string) {
  const { can } = await requireTenantAccess(tenantId);
  if (!can(PERMISSIONS.ADMIN.CUSTOM_FIELDS.MANAGE)) {
    return { error: "Unauthorized to manage custom fields" };
  }

  try {
    return await tenantTransaction(tenantId, async (tx) => {
      await tx.customFieldDefinition.delete({
        where: { id: fieldId },
      });

      revalidatePath("/settings/custom-fields");
      return { success: true };
    });
  } catch (e) {
    return { error: (e as Error).message || "Failed to delete custom field" };
  }
}
