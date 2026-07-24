"use server";
import { prisma, tenantTransaction } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const leadSchema = z.object({
  title: z.string().min(1, "Lead title required"),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  source: z.string().optional(),
  stageId: z.string().min(1, "Stage required"),
  value: z.number().optional(),
  customFields: z.record(z.string(), z.unknown()).default({}),
});

export type LeadInput = z.infer<typeof leadSchema>;

export async function createLeadAction(tenantId: string, input: LeadInput) {
  const { can } = await requireTenantAccess(tenantId);
  if (!can(PERMISSIONS.CRM.LEADS.CREATE)) {
    return { error: "Unauthorized to create leads" };
  }

  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const data = parsed.data;

  try {
    return await tenantTransaction(tenantId, async (tx) => {
      const lead = await tx.lead.create({
        data: {
          tenantId,
          title: data.title,
          contactId: data.contactId || null,
          companyId: data.companyId || null,
          source: data.source || null,
          stageId: data.stageId,
          value: data.value !== undefined ? data.value : null,
          customFields: (data.customFields ?? {}) as unknown as never,
        },
      });

      revalidatePath("/leads");
      return { success: true, leadId: lead.id };
    });
  } catch (e) {
    return { error: (e as Error).message || "Failed to create lead" };
  }
}

export async function updateLeadStageAction(tenantId: string, leadId: string, stageId: string) {
  const { can } = await requireTenantAccess(tenantId);
  if (!can(PERMISSIONS.CRM.LEADS.UPDATE)) {
    return { error: "Unauthorized to update leads" };
  }

  try {
    return await tenantTransaction(tenantId, async (tx) => {
      await tx.lead.update({
        where: { id: leadId },
        data: { stageId },
      });

      revalidatePath("/leads");
      return { success: true };
    });
  } catch (e) {
    return { error: (e as Error).message || "Failed to update lead stage" };
  }
}

// Convert lead to deal directly without any sync layer
export async function convertLeadToDealAction(
  tenantId: string,
  leadId: string,
  dealTitle: string,
  dealValue: number,
  targetStageId: string
) {
  const { can, user } = await requireTenantAccess(tenantId);
  if (!can(PERMISSIONS.CRM.DEALS.CREATE)) {
    return { error: "Unauthorized to create deals" };
  }

  try {
    return await tenantTransaction(tenantId, async (tx) => {
      const lead = await tx.lead.findUnique({ where: { id: leadId } });
      if (!lead) return { error: "Lead not found" };

      // Find converted stage for lead
      const convertedStage = await tx.pipelineStage.findFirst({
        where: { tenantId, pipelineType: "lead", name: "Converted" },
      });

      // 1. Create deal linked to lead, contact, company
      const deal = await tx.deal.create({
        data: {
          tenantId,
          leadId: lead.id,
          title: dealTitle,
          value: dealValue,
          stageId: targetStageId,
          contactId: lead.contactId,
          companyId: lead.companyId,
        },
      });

      // 2. Mark lead as Converted if stage exists
      if (convertedStage) {
        await tx.lead.update({
          where: { id: leadId },
          data: { stageId: convertedStage.id },
        });
      }

      // 3. Log activity on deal
      await tx.activity.create({
        data: {
          tenantId,
          entityType: "Deal",
          entityId: deal.id,
          type: "status_change",
          title: `Converted from Lead: ${lead.title}`,
          description: `Lead "${lead.title}" was converted to Deal "${dealTitle}" with value ${dealValue}`,
          userId: user.id,
        },
      });

      revalidatePath("/leads");
      revalidatePath("/deals");
      return { success: true, dealId: deal.id };
    });
  } catch (e) {
    return { error: (e as Error).message || "Failed to convert lead to deal" };
  }
}
