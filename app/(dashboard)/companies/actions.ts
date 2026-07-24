"use server";
import { prisma, tenantTransaction } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const companySchema = z.object({
  name: z.string().min(1, "Company name required"),
  industry: z.string().optional(),
  website: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  type: z.enum(["customer", "supplier", "both"]).default("customer"),
  customFields: z.record(z.string(), z.unknown()).default({}),
});

export type CompanyInput = z.infer<typeof companySchema>;

export async function createCompanyAction(tenantId: string, input: CompanyInput) {
  const { can } = await requireTenantAccess(tenantId);
  if (!can(PERMISSIONS.CRM.COMPANIES.CREATE)) {
    return { error: "Unauthorized to create companies" };
  }

  const parsed = companySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const data = parsed.data;

  try {
    return await tenantTransaction(tenantId, async (tx) => {
      const company = await tx.company.create({
        data: {
          tenantId,
          name: data.name,
          industry: data.industry || null,
          website: data.website || null,
          phone: data.phone || null,
          address: data.address || null,
          type: data.type,
          customFields: (data.customFields ?? {}) as unknown as never,
        },
      });

      revalidatePath("/companies");
      return { success: true, companyId: company.id };
    });
  } catch (e) {
    return { error: (e as Error).message || "Failed to create company" };
  }
}
