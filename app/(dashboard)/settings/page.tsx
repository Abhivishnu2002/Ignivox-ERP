import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  User,
  SlidersHorizontal,
  GitCommitHorizontal,
  Shield,
  ChevronRight,
  Settings,
} from "lucide-react";

export default async function SettingsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const membership = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id },
    include: { tenant: true, role: true },
  });

  if (!membership) redirect("/onboarding");

  const sections = [

    {
      title: "User Account & Profile",
      description: `View account details, permissions, and active session for ${session.user.name}`,
      href: "/settings/profile",
      icon: User,
      color: "#ec4899",
    },
    {
      title: "Custom Fields Engine",
      description: "Define custom fields for Contacts, Deals, Products, Orders, and Invoices",
      href: "/settings/custom-fields",
      icon: SlidersHorizontal,
      color: "#6366f1",
    },
    {
      title: "Pipeline Stage Workflows",
      description: "Configure custom stage names, colors, and order for Lead, Deal, and Work Order pipelines",
      href: "/settings/pipelines",
      icon: GitCommitHorizontal,
      color: "#0ea5e9",
    },
    {
      title: "Role-Based Access Control (RBAC)",
      description: "Manage tenant roles and assign granular module/action permissions",
      href: "/settings/roles",
      icon: Shield,
      color: "#f59e0b",
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Organization Settings</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Customize your Ignivox ERP workspace, custom fields, pipeline workflows, and role permissions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map((sec) => {
          const Icon = sec.icon;
          return (
            <Link
              key={sec.title}
              href={sec.href}
              className="bg-card border border-border rounded-xl p-5 hover:border-primary/40 interactive group flex items-start gap-4"
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ backgroundColor: sec.color + "15" }}
              >
                <Icon className="w-5 h-5" style={{ color: sec.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold group-hover:text-primary transition-colors">
                    {sec.title}
                  </h2>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {sec.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
