import { getServerSession } from "@/lib/auth";
import { prisma, tenantTransaction } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { PermissionMatrix } from "./PermissionMatrix";
import { Shield, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface RoleDetailPageProps {
  params: Promise<{ roleId: string }>;
}

export default async function RoleDetailPage({ params }: RoleDetailPageProps) {
  const { roleId } = await params;
  const session = await getServerSession();
  if (!session) redirect("/login");

  const membership = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id },
    include: { tenant: true },
  });

  if (!membership) redirect("/onboarding");

  const tenantId = membership.tenant.id;

  const role = await tenantTransaction(tenantId, async (tx) => {
    return tx.role.findFirst({
      where: { id: roleId, tenantId },
    });
  });

  if (!role) notFound();

  const permissions = (role.permissions ?? {}) as Record<string, boolean>;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back button + Header */}
      <div>
        <Link
          href="/settings/roles"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Roles
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{role.name}</h1>
              {role.isSystem && (
                <Badge variant="outline" className="text-[10px]">
                  System Role
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {role.description || "Manage permissions for this role."}
            </p>
          </div>
        </div>
      </div>

      {/* Permission Matrix */}
      <PermissionMatrix
        tenantId={tenantId}
        roleId={role.id}
        roleName={role.name}
        isSystem={role.isSystem}
        initialPermissions={permissions}
      />
    </div>
  );
}
