"use server";
import { tenantTransaction } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const contactSchema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  title: z.string().optional(),
  companyId: z.string().optional(),
  customFields: z.record(z.string(), z.unknown()).default({}),
});

export type ContactInput = z.infer<typeof contactSchema>;

export async function createContactAction(tenantId: string, input: ContactInput) {
  const { can } = await requireTenantAccess(tenantId);
  if (!can(PERMISSIONS.CRM.CONTACTS.CREATE)) {
    return { error: "Unauthorized to create contacts" };
  }

  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const data = parsed.data;

  try {
    return await tenantTransaction(tenantId, async (tx) => {
      const contact = await tx.contact.create({
        data: {
          tenantId,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email || null,
          phone: data.phone || null,
          title: data.title || null,
          companyId: data.companyId || null,
          customFields: (data.customFields ?? {}) as unknown as never,
        },
      });

      revalidatePath("/contacts");
      return { success: true, contactId: contact.id };
    });
  } catch (e) {
    return { error: (e as Error).message || "Failed to create contact" };
  }
}

export async function deleteContactAction(tenantId: string, contactId: string) {
  const { can } = await requireTenantAccess(tenantId);
  if (!can(PERMISSIONS.CRM.CONTACTS.DELETE)) {
    return { error: "Unauthorized to delete contacts" };
  }

  try {
    return await tenantTransaction(tenantId, async (tx) => {
      await tx.contact.delete({ where: { id: contactId } });
      revalidatePath("/contacts");
      return { success: true };
    });
  } catch (e) {
    return { error: (e as Error).message || "Failed to delete contact" };
  }
}
