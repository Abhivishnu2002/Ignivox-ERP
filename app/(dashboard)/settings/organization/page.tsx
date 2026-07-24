import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import {
  Building2,
  CheckCircle2,
  ShieldCheck,
  Layers,
  ArrowLeft,
  Users,
} from "lucide-react";
import Link from "next/link";

export default async function OrganizationSettingsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const membership = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id },
    include: { tenant: true, role: true },
  });

  if (!membership) redirect("/onboarding");

  const tenant = membership.tenant;
  const userCount = await prisma.tenantUser.count({
    where: { tenantId: tenant.id },
  });

  const enabledModules: string[] = Array.isArray(tenant.enabledModules)
    ? (tenant.enabledModules as string[])
    : ["crm", "sales", "inventory", "manufacturing", "invoicing", "procurement"];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link
          href="/settings"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Settings
        </Link>
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Organization Profile</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Manage workspace identity, subscription plan, active modules, and tenant metadata.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="bg-card border border-border rounded-xl p-6 md:col-span-2 space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-5">
            <div>
              <h2 className="text-xl font-bold">{tenant.name}</h2>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">tenant-slug: {tenant.slug}</p>
            </div>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs px-3 py-1">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Enterprise Workspace
            </Badge>
          </div>

          {/* Enabled Modules */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" /> Active ERP & CRM Modules
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { id: "crm", label: "CRM & Leads" },
                { id: "sales", label: "Sales & Quotes" },
                { id: "inventory", label: "Stock & Inventory" },
                { id: "manufacturing", label: "BOM & Work Orders" },
                { id: "procurement", label: "PO & Procurement" },
                { id: "invoicing", label: "Invoicing & Billing" },
              ].map((mod) => {
                const active = enabledModules.includes(mod.id);
                return (
                  <div
                    key={mod.id}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-colors ${
                      active
                        ? "bg-primary/5 border-primary/20 text-foreground"
                        : "bg-muted/30 border-border text-muted-foreground opacity-60"
                    }`}
                  >
                    <CheckCircle2 className={`w-3.5 h-3.5 ${active ? "text-primary" : "text-muted-foreground/40"}`} />
                    {mod.label}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5 space-y-4 text-xs">
            <h3 className="text-sm font-semibold">Tenant Summary</h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between py-1.5 border-b border-border/60">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-muted-foreground" /> Total Users
                </span>
                <span className="font-semibold">{userCount} Active Member(s)</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-border/60">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" /> Subscription Plan
                </span>
                <span className="font-semibold uppercase text-primary">{tenant.plan || "Free"}</span>
              </div>

              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">Created On</span>
                <span className="font-medium">{formatDate(tenant.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
