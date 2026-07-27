"use server";

import { tenantTransaction } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const stageSchema = z.object({
  pipelineType: z.enum(["lead", "deal", "work_order", "purchase_order"]),
  name: z.string().min(2, "Stage name required"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Valid hex color required"),
  sortOrder: z.number().optional(),
  isDefault: z.boolean().optional(),
  isWon: z.boolean().optional(),
  isLost: z.boolean().optional(),
});

export type StageInput = z.infer<typeof stageSchema>;

export async function createPipelineStageAction(tenantId: string, input: StageInput) {
  const { can } = await requireTenantAccess(tenantId);
  if (!can(PERMISSIONS.ADMIN.PIPELINE_STAGES.MANAGE)) {
    return { error: "Unauthorized to manage pipeline stages" };
  }

  const parsed = stageSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const data = parsed.data;

  try {
    return await tenantTransaction(tenantId, async (tx) => {
      await tx.pipelineStage.create({
        data: {
          tenantId,
          ...data,
        },
      });

      revalidatePath("/settings/pipelines");
      return { success: true };
    });
  } catch (e) {
    return { error: (e as Error).message || "Failed to create stage" };
  }
}

export async function deletePipelineStageAction(tenantId: string, stageId: string) {
  const { can } = await requireTenantAccess(tenantId);
  if (!can(PERMISSIONS.ADMIN.PIPELINE_STAGES.MANAGE)) {
    return { error: "Unauthorized to manage pipeline stages" };
  }

  try {
    return await tenantTransaction(tenantId, async (tx) => {
      await tx.pipelineStage.delete({
        where: { id: stageId },
      });

      revalidatePath("/settings/pipelines");
      return { success: true };
    });
  } catch (e) {
    return { error: (e as Error).message || "Failed to delete stage" };
  }
}
