"use server";

import { prisma, tenantTransaction } from "@/lib/db";
import { getServerSession } from "@/lib/auth";
import { ADMIN_PERMISSIONS } from "@/lib/permissions";
import type { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { z } from "zod";

const onboardingSchema = z.object({
  tenantName: z.string().min(2, "Organization name must be at least 2 characters"),
  tenantSlug: z
    .string()
    .min(2)
    .max(48)
    .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens"),
});

type OnboardingInput = z.infer<typeof onboardingSchema>;

export async function createTenantAction(input: OnboardingInput): Promise<{ error?: string }> {
  const session = await getServerSession();
  if (!session) return { error: "Not authenticated" };

  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const { tenantName, tenantSlug } = parsed.data;

  // Check slug availability
  const existing = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (existing) return { error: "This URL slug is already taken. Please choose another." };

  // Check if user already belongs to a tenant
  const existingMembership = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id },
  });
  if (existingMembership) {
    redirect(`/dashboard`);
  }

  // Create tenant + admin role + membership in a transaction
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // 1. Create the tenant
    const tenant = await tx.tenant.create({
      data: {
        name: tenantName,
        slug: tenantSlug,
        enabledModules: ["crm", "sales", "manufacturing", "inventory", "procurement", "invoicing"],
        plan: "free",
      },
    });

    // 2. Create the Admin role with full permissions
    const adminRole = await tx.role.create({
      data: {
        tenantId: tenant.id,
        name: "Admin",
        description: "Full access to all modules",
        isSystem: true,
        permissions: ADMIN_PERMISSIONS,
      },
    });

    // 3. Create a read-only Member role
    await tx.role.create({
      data: {
        tenantId: tenant.id,
        name: "Member",
        description: "Read-only access to all modules",
        isSystem: true,
        permissions: Object.fromEntries(
          Object.entries(ADMIN_PERMISSIONS)
            .filter(([key]) => key.endsWith(".read"))
        ),
      },
    });

    // 4. Link the user as an owner with the Admin role
    await tx.tenantUser.create({
      data: {
        tenantId: tenant.id,
        userId: session.user.id,
        roleId: adminRole.id,
        isOwner: true,
      },
    });

    // 5. Seed default pipeline stages
    const defaultStages = [
      // Lead pipeline
      { pipelineType: "lead", name: "New", color: "#6366f1", sortOrder: 0, isDefault: true },
      { pipelineType: "lead", name: "Contacted", color: "#0ea5e9", sortOrder: 1 },
      { pipelineType: "lead", name: "Qualified", color: "#f59e0b", sortOrder: 2 },
      { pipelineType: "lead", name: "Proposal Sent", color: "#8b5cf6", sortOrder: 3 },
      { pipelineType: "lead", name: "Converted", color: "#10b981", sortOrder: 4 },
      { pipelineType: "lead", name: "Disqualified", color: "#ef4444", sortOrder: 5 },
      // Deal pipeline
      { pipelineType: "deal", name: "Discovery", color: "#6366f1", sortOrder: 0, isDefault: true },
      { pipelineType: "deal", name: "Proposal", color: "#0ea5e9", sortOrder: 1 },
      { pipelineType: "deal", name: "Negotiation", color: "#f59e0b", sortOrder: 2 },
      { pipelineType: "deal", name: "Won", color: "#10b981", sortOrder: 3, isWon: true },
      { pipelineType: "deal", name: "Lost", color: "#ef4444", sortOrder: 4, isLost: true },
      // Work order pipeline
      { pipelineType: "work_order", name: "Planned", color: "#6366f1", sortOrder: 0, isDefault: true },
      { pipelineType: "work_order", name: "In Production", color: "#f59e0b", sortOrder: 1 },
      { pipelineType: "work_order", name: "QC", color: "#8b5cf6", sortOrder: 2 },
      { pipelineType: "work_order", name: "Completed", color: "#10b981", sortOrder: 3 },
      { pipelineType: "work_order", name: "On Hold", color: "#6b7280", sortOrder: 4 },
    ];

    await tx.pipelineStage.createMany({
      data: defaultStages.map((s) => ({ ...s, tenantId: tenant.id })),
    });
  });

  redirect("/dashboard");
}
