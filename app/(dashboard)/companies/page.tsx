import { getServerSession } from "@/lib/auth";
import { prisma, tenantTransaction } from "@/lib/db";
import { redirect } from "next/navigation";
import { CompanyForm } from "./CompanyForm";
import { Badge } from "@/components/ui/badge";
import { Building2, Globe, Phone, Users } from "lucide-react";
import Link from "next/link";
import type { Company } from "@/lib/prisma-types";

type CompanyWithCount = Company & {
  _count: { contacts: number; deals: number };
};

export default async function CompaniesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const membership = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id },
    include: { tenant: true },
  });

  if (!membership) redirect("/onboarding");

  const tenantId = membership.tenant.id;

  const [companies, customFieldDefs] = await tenantTransaction(
    tenantId,
    async (tx) => {
      return Promise.all([
        tx.company.findMany({
          where: { tenantId },
          include: {
            _count: {
              select: { contacts: true, deals: true },
            },
          },
          orderBy: { name: "asc" },
        }),
        tx.customFieldDefinition.findMany({
          where: { tenantId, entityType: "Company" },
          orderBy: { sortOrder: "asc" },
        }),
      ]);
    }
  );

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Companies</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Accounts, customers, and supplier profiles.
          </p>
        </div>
        <CompanyForm tenantId={tenantId} customFieldDefinitions={customFieldDefs} />
      </div>

      {/* Companies grid */}
      {companies.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-16 text-center">
          <div className="empty-state-icon">
            <Building2 className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold">No companies yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add customers or suppliers to track your accounts.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((comp: CompanyWithCount) => (
            <Link
              key={comp.id}
              href={`/companies/${comp.id}`}
              className="bg-card border border-border rounded-xl p-5 hover:border-primary/40 interactive group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold group-hover:text-primary transition-colors">
                      {comp.name}
                    </h2>
                    {comp.industry && (
                      <p className="text-xs text-muted-foreground mt-0.5">{comp.industry}</p>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] capitalize ${
                      comp.type === "customer"
                        ? "bg-indigo-500/10 text-indigo-500 border-indigo-500/20"
                        : comp.type === "supplier"
                        ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                        : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    }`}
                  >
                    {comp.type}
                  </Badge>
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                  {comp.phone && (
                    <p className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" />
                      {comp.phone}
                    </p>
                  )}
                  {comp.website && (
                    <p className="flex items-center gap-1.5 truncate">
                      <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{comp.website}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {comp._count.contacts} {comp._count.contacts === 1 ? "contact" : "contacts"}
                </span>
                <span>{comp._count.deals} deals</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
