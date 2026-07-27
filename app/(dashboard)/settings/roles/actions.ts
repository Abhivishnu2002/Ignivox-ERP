"use server";

import { tenantTransaction } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const roleSchema = z.object({
  name: z.string().min(2, "Role name required"),
  description: z.string().optional(),
  permissions: z.record(z.string(), z.boolean()),
});

export type RoleInput = z.infer<typeof roleSchema>;

export async function createRoleAction(tenantId: string, input: RoleInput) {
  const { can } = await requireTenantAccess(tenantId);
  if (!can(PERMISSIONS.ADMIN.ROLES.MANAGE)) {
    return { error: "Unauthorized to manage roles" };
  }

  const parsed = roleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const data = parsed.data;

  try {
    return await tenantTransaction(tenantId, async (tx) => {
      const existing = await tx.role.findFirst({
        where: { tenantId, name: data.name },
      });

      if (existing) {
        return { error: `Role name '${data.name}' already exists` };
      }

      await tx.role.create({
        data: {
          tenantId,
          name: data.name,
          description: data.description,
          permissions: data.permissions,
        },
      });

      revalidatePath("/settings/roles");
      return { success: true };
    });
  } catch (e) {
    return { error: (e as Error).message || "Failed to create role" };
  }
}

export async function updateRolePermissionsAction(
  tenantId: string,
  roleId: string,
  permissions: Record<string, boolean>
) {
  const { can } = await requireTenantAccess(tenantId);
  if (!can(PERMISSIONS.ADMIN.ROLES.MANAGE)) {
    return { error: "Unauthorized to manage roles" };
  }

  try {
    return await tenantTransaction(tenantId, async (tx) => {
      const role = await tx.role.findUnique({ where: { id: roleId } });
      if (!role) return { error: "Role not found" };

      await tx.role.update({
        where: { id: roleId },
        data: { permissions },
      });

      revalidatePath(`/settings/roles/${roleId}`);
      revalidatePath("/settings/roles");
      return { success: true };
    });
  } catch (e) {
    return { error: (e as Error).message || "Failed to update permissions" };
  }
}

export async function deleteRoleAction(tenantId: string, roleId: string) {
  const { can } = await requireTenantAccess(tenantId);
  if (!can(PERMISSIONS.ADMIN.ROLES.MANAGE)) {
    return { error: "Unauthorized to manage roles" };
  }

  try {
    return await tenantTransaction(tenantId, async (tx) => {
      const role = await tx.role.findUnique({ where: { id: roleId } });
      if (!role) return { error: "Role not found" };

      if (role.isSystem) {
        return { error: "System roles cannot be deleted" };
      }

      // Check if any users currently have this role
      const usersWithRole = await tx.tenantUser.count({
        where: { roleId },
      });

      if (usersWithRole > 0) {
        return { error: `Cannot delete role: ${usersWithRole} member(s) assigned to this role` };
      }

      await tx.role.delete({ where: { id: roleId } });

      revalidatePath("/settings/roles");
      return { success: true };
    });
  } catch (e) {
    return { error: (e as Error).message || "Failed to delete role" };
  }
}
