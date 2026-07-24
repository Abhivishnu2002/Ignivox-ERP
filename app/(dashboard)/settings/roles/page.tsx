import { getServerSession } from "@/lib/auth";
import { prisma, tenantTransaction } from "@/lib/db";
import { redirect } from "next/navigation";
import { RoleForm } from "./RoleForm";
import { Badge } from "@/components/ui/badge";
import { Shield, ChevronRight, Lock } from "lucide-react";
import Link from "next/link";

export default async function RolesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const membership = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id },
    include: { tenant: true },
  });

  if (!membership) redirect("/onboarding");

  const tenantId = membership.tenant.id;

  // Fetch all roles for tenant + member count for each role
  const roles = await tenantTransaction(tenantId, async (tx) => {
    return tx.role.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { tenantUsers: true },
        },
      },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });
  });

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Role-Based Access Control</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Define custom roles and toggle granular permissions per module/action across your organization.
          </p>
        </div>
        <RoleForm tenantId={tenantId} />
      </div>

      {/* Roles grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {roles.map((role) => {
          const perms = (role.permissions ?? {}) as Record<string, boolean>;
          const activePermCount = Object.values(perms).filter(Boolean).length;

          return (
            <Link
              key={role.id}
              href={`/settings/roles/${role.id}`}
              className="bg-card border border-border rounded-xl p-5 hover:border-primary/40 interactive group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold group-hover:text-primary transition-colors">
                    {role.name}
                  </h2>
                  {role.isSystem && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Lock className="w-2.5 h-2.5" /> System
                    </Badge>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
              </div>

              {role.description && (
                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                  {role.description}
                </p>
              )}

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/60 text-xs text-muted-foreground">
                <span>{role._count.tenantUsers} {role._count.tenantUsers === 1 ? "member" : "members"}</span>
                <span className="font-medium text-foreground">{activePermCount} permissions enabled</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
