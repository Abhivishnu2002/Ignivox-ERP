import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  // Get the user's tenant membership (first tenant they belong to — for MVP)
  const membership = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id },
    include: {
      tenant: true,
      role: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // If no tenant yet, send to onboarding
  if (!membership) {
    redirect("/onboarding");
  }

  const permissions = (membership.role.permissions ?? {}) as Record<string, boolean>;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        tenant={membership.tenant}
        enabledModules={membership.tenant.enabledModules}
        userPermissions={permissions}
        isOwner={membership.isOwner}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          user={session.user}
          tenantName={membership.tenant.name}
        />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
