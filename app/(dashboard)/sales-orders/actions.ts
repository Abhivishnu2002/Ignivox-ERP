"use server";

import type { Prisma } from "@prisma/client";
import { prisma, tenantTransaction } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const soSchema = z.object({
  companyId: z.string().optional(),
  contactId: z.string().optional(),
  totalAmount: z.number().min(0).default(0),
  deliveryDate: z.string().optional(),
  notes: z.string().optional(),
  customFields: z.record(z.string(), z.unknown()).default({}),
});

export type SalesOrderInput = z.infer<typeof soSchema>;

export async function createSalesOrderAction(tenantId: string, input: SalesOrderInput) {
  const { can } = await requireTenantAccess(tenantId);
  if (!can(PERMISSIONS.SALES.ORDERS.CREATE)) {
    return { error: "Unauthorized to create sales orders" };
  }

  const parsed = soSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const data = parsed.data;

  try {
    return await tenantTransaction(tenantId, async (tx) => {
      // Auto-generate SO number SO-0001
      const count = await tx.salesOrder.count({ where: { tenantId } });
      const orderNumber = `SO-${String(count + 1).padStart(4, "0")}`;

      const salesOrder = await tx.salesOrder.create({
        data: {
          tenantId,
          orderNumber,
          companyId: data.companyId || null,
          contactId: data.contactId || null,
          status: "pending",
          totalAmount: data.totalAmount,
          deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
          notes: data.notes || null,
          customFields: (data.customFields ?? {}) as Prisma.InputJsonObject,
        },
      });

      revalidatePath("/sales-orders");
      return { success: true, salesOrderId: salesOrder.id };
    });
  } catch (e) {
    return { error: (e as Error).message || "Failed to create sales order" };
  }
}

// Generate Invoice directly from Sales Order without sync layer
export async function generateInvoiceFromSalesOrderAction(
  tenantId: string,
  salesOrderId: string,
  dueDate?: string
) {
  const { can, user } = await requireTenantAccess(tenantId);
  if (!can(PERMISSIONS.INVOICING.INVOICES.CREATE)) {
    return { error: "Unauthorized to create invoices" };
  }

  try {
    return await tenantTransaction(tenantId, async (tx) => {
      const so = await tx.salesOrder.findUnique({
        where: { id: salesOrderId },
        include: { company: true },
      });

      if (!so) return { error: "Sales Order not found" };

      // Auto-generate Invoice number INV-0001
      const count = await tx.invoice.count({ where: { tenantId } });
      const invoiceNumber = `INV-${String(count + 1).padStart(4, "0")}`;

      const invoice = await tx.invoice.create({
        data: {
          tenantId,
          salesOrderId: so.id,
          invoiceNumber,
          companyId: so.companyId,
          contactId: so.contactId,
          status: "issued",
          subtotal: so.totalAmount,
          tax: 0,
          totalAmount: so.totalAmount,
          dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 86400000), // Net 30 default
        },
      });

      // Update SO status to fulfilled
      await tx.salesOrder.update({
        where: { id: salesOrderId },
        data: { status: "fulfilled" },
      });

      // Log activity on SO and Invoice
      await tx.activity.create({
        data: {
          tenantId,
          entityType: "SalesOrder",
          entityId: so.id,
          type: "status_change",
          title: `Issued Invoice ${invoiceNumber}`,
          description: `Invoice ${invoiceNumber} issued for amount ${so.totalAmount}`,
          userId: user.id,
        },
      });

      revalidatePath("/sales-orders");
      revalidatePath("/invoices");
      return { success: true, invoiceId: invoice.id };
    });
  } catch (e) {
    return { error: (e as Error).message || "Failed to generate invoice" };
  }
}
