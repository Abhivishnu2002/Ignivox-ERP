"use server";

import { tenantTransaction } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth";
import { z } from "zod";

const activitySchema = z.object({
  entityType: z.string(),
  entityId: z.string(),
  type: z.enum(["call", "email", "note", "meeting", "status_change"]),
  title: z.string().min(1, "Title required"),
  description: z.string().optional(),
});

export type ActivityInput = z.infer<typeof activitySchema>;

export async function createActivityAction(tenantId: string, input: ActivityInput) {
  const { user } = await requireTenantAccess(tenantId);

  const parsed = activitySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const data = parsed.data;

  try {
    return await tenantTransaction(tenantId, async (tx) => {
      await tx.activity.create({
        data: {
          tenantId,
          entityType: data.entityType,
          entityId: data.entityId,
          type: data.type,
          title: data.title,
          description: data.description,
          userId: user.id,
        },
      });

      return { success: true };
    });
  } catch (e) {
    return { error: (e as Error).message || "Failed to log activity" };
  }
}
