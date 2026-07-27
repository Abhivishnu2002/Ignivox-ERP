"use server";

import { tenantTransaction } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const invoiceSchema = z.object({
  customerCompanyId: z.string().optional(),
  customerContactId: z.string().optional(),
  salesOrderId: z.string().optional(),
  subtotal: z.number().min(0).default(0),
  tax: z.number().min(0).default(0),
  totalAmount: z.number().min(0).default(0),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  customFields: z.record(z.string(), z.unknown()).default({}),
});

export type InvoiceInput = z.infer<typeof invoiceSchema>;

export async function createInvoiceAction(tenantId: string, input: InvoiceInput) {
  const { can } = await requireTenantAccess(tenantId);
  if (!can(PERMISSIONS.INVOICING.INVOICES.CREATE)) {
    return { error: "Unauthorized to create invoices" };
  }

  const parsed = invoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const data = parsed.data;

  try {
    return await tenantTransaction(tenantId, async (tx) => {
      // Auto-generate Invoice number INV-0001
      const count = await tx.invoice.count({ where: { tenantId } });
      const invoiceNumber = `INV-${String(count + 1).padStart(4, "0")}`;

      const invoice = await tx.invoice.create({
        data: {
          tenantId,
          invoiceNumber,
          companyId: data.customerCompanyId || null,
          contactId: data.customerContactId || null,
          salesOrderId: data.salesOrderId || null,
          status: "issued",
          subtotal: data.subtotal,
          tax: data.tax,
          totalAmount: data.totalAmount,
          dueDate: data.dueDate ? new Date(data.dueDate) : new Date(Date.now() + 30 * 86400000),
          notes: data.notes || null,
          customFields: (data.customFields ?? {}) as unknown as never,
        },
      });

      revalidatePath("/invoices");
      return { success: true, invoiceId: invoice.id };
    });
  } catch (e) {
    return { error: (e as Error).message || "Failed to create invoice" };
  }
}

export async function markInvoicePaidAction(tenantId: string, invoiceId: string) {
  const { can, user } = await requireTenantAccess(tenantId);
  if (!can(PERMISSIONS.INVOICING.INVOICES.UPDATE)) {
    return { error: "Unauthorized to update invoices" };
  }

  try {
    return await tenantTransaction(tenantId, async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (!invoice) return { error: "Invoice not found" };

      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: "paid",
          paidAt: new Date(),
        },
      });

      // Log activity
      await tx.activity.create({
        data: {
          tenantId,
          entityType: "Invoice",
          entityId: invoice.id,
          type: "status_change",
          title: `Invoice ${invoice.invoiceNumber} Marked Paid`,
          description: `Payment received in full for invoice ${invoice.invoiceNumber}. Total amount: ${invoice.totalAmount}`,
          userId: user.id,
        },
      });

      revalidatePath("/invoices");
      revalidatePath(`/invoices/${invoiceId}`);
      return { success: true };
    });
  } catch (e) {
    return { error: (e as Error).message || "Failed to mark invoice as paid" };
  }
}
