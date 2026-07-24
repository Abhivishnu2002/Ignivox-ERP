"use server";
import { prisma, tenantTransaction } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const dealSchema = z.object({
  title: z.string().min(1, "Deal title required"),
  value: z.number().default(0),
  stageId: z.string().min(1, "Stage required"),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  expectedCloseDate: z.string().optional(),
  customFields: z.record(z.string(), z.unknown()).default({}),
});

export type DealInput = z.infer<typeof dealSchema>;

export async function createDealAction(tenantId: string, input: DealInput) {
  const { can } = await requireTenantAccess(tenantId);
  if (!can(PERMISSIONS.CRM.DEALS.CREATE)) {
    return { error: "Unauthorized to create deals" };
  }

  const parsed = dealSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const data = parsed.data;

  try {
    return await tenantTransaction(tenantId, async (tx) => {
      const deal = await tx.deal.create({
        data: {
          tenantId,
          title: data.title,
          value: data.value,
          stageId: data.stageId,
          contactId: data.contactId || null,
          companyId: data.companyId || null,
          expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
          customFields: (data.customFields ?? {}) as unknown as never,
        },
      });

      revalidatePath("/deals");
      return { success: true, dealId: deal.id };
    });
  } catch (e) {
    return { error: (e as Error).message || "Failed to create deal" };
  }
}

export async function updateDealStageAction(tenantId: string, dealId: string, stageId: string) {
  const { can } = await requireTenantAccess(tenantId);
  if (!can(PERMISSIONS.CRM.DEALS.UPDATE)) {
    return { error: "Unauthorized to update deals" };
  }

  try {
    return await tenantTransaction(tenantId, async (tx) => {
      const targetStage = await tx.pipelineStage.findUnique({ where: { id: stageId } });

      const updates: { stageId: string; wonAt?: Date | null; lostAt?: Date | null } = {
        stageId,
      };

      if (targetStage?.isWon) {
        updates.wonAt = new Date();
        updates.lostAt = null;
      } else if (targetStage?.isLost) {
        updates.lostAt = new Date();
        updates.wonAt = null;
      }

      await tx.deal.update({
        where: { id: dealId },
        data: updates,
      });

      revalidatePath("/deals");
      return { success: true };
    });
  } catch (e) {
    return { error: (e as Error).message || "Failed to update deal stage" };
  }
}

// Convert won deal to Sales Order directly without any sync layer
export async function convertDealToSalesOrderAction(
  tenantId: string,
  dealId: string,
  deliveryDate?: string,
  notes?: string
) {
  const { can, user } = await requireTenantAccess(tenantId);
  if (!can(PERMISSIONS.SALES.ORDERS.CREATE)) {
    return { error: "Unauthorized to create sales orders" };
  }

  try {
    return await tenantTransaction(tenantId, async (tx) => {
      const deal = await tx.deal.findUnique({
        where: { id: dealId },
        include: { company: true, contact: true },
      });

      if (!deal) return { error: "Deal not found" };

      // Generate sequential order number SO-0001
      const count = await tx.salesOrder.count({ where: { tenantId } });
      const orderNumber = `SO-${String(count + 1).padStart(4, "0")}`;

      // 1. Create SalesOrder linked directly to deal, contact, company
      const salesOrder = await tx.salesOrder.create({
        data: {
          tenantId,
          dealId: deal.id,
          orderNumber,
          contactId: deal.contactId,
          companyId: deal.companyId,
          status: "pending",
          totalAmount: deal.value,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
          notes: notes || `Generated directly from Deal: ${deal.title}`,
        },
      });

      // 2. Log activity on Deal and SalesOrder
      await tx.activity.create({
        data: {
          tenantId,
          entityType: "Deal",
          entityId: deal.id,
          type: "status_change",
          title: `Converted to Sales Order ${orderNumber}`,
          description: `Sales Order ${orderNumber} created for amount ${deal.value}`,
          userId: user.id,
        },
      });

      revalidatePath("/deals");
      revalidatePath("/sales-orders");
      return { success: true, salesOrderId: salesOrder.id };
    });
  } catch (e) {
    return { error: (e as Error).message || "Failed to convert deal to sales order" };
  }
}
