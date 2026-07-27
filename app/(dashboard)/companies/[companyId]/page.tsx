import { getServerSession } from "@/lib/auth";
import { prisma, tenantTransaction } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { ActivityTimeline } from "@/components/activity/ActivityTimeline";
import { CustomFieldRenderer } from "@/components/custom-fields/CustomFieldRenderer";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, Building2, Phone, Globe, MapPin, Users, Handshake } from "lucide-react";
import Link from "next/link";

interface CompanyDetailPageProps {
  params: Promise<{ companyId: string }>;
}

export default async function CompanyDetailPage({ params }: CompanyDetailPageProps) {
  const { companyId } = await params;
  const session = await getServerSession();
  if (!session) redirect("/login");

  const membership = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id },
    include: { tenant: true },
  });

  if (!membership) redirect("/onboarding");

  const tenantId = membership.tenant.id;

  const [company, customDefs, activities] = await tenantTransaction(
    tenantId,
    async (tx) => {
      return Promise.all([
        tx.company.findFirst({
          where: { id: companyId, tenantId },
          include: {
            contacts: true,
            deals: {
              orderBy: { createdAt: "desc" },
            },
          },
        }),
        tx.customFieldDefinition.findMany({
          where: { tenantId, entityType: "Company" },
          orderBy: { sortOrder: "asc" },
        }),
        tx.activity.findMany({
          where: { tenantId, entityType: "Company", entityId: companyId },
          orderBy: { createdAt: "desc" },
        }),
      ]);
    }
  );

  if (!company) notFound();

  const customFieldsData = (company.customFields ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back button */}
      <Link
        href="/companies"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Companies
      </Link>

      {/* Company Header Card */}
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{company.name}</h1>
              <Badge variant="outline" className="text-xs capitalize">
                {company.type}
              </Badge>
            </div>
            {company.industry && (
              <p className="text-xs text-muted-foreground mt-0.5">{company.industry}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {company.website && (
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted border border-border interactive"
            >
              <Globe className="w-3.5 h-3.5 text-primary" />
              Website
            </a>
          )}
          {company.phone && (
            <a
              href={`tel:${company.phone}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted border border-border interactive"
            >
              <Phone className="w-3.5 h-3.5 text-primary" />
              {company.phone}
            </a>
          )}
        </div>
      </div>

      {/* Grid: Left = Details + Associated Contacts + Deals, Right = Activity Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="space-y-6 lg:col-span-1">
          {/* Info */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3 text-xs">
            <h2 className="text-sm font-semibold">Account Details</h2>
            {company.address && (
              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
                <span>{company.address}</span>
              </div>
            )}
          </div>

          {/* Associated Contacts */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Contacts ({company.contacts.length})
              </h2>
            </div>
            {company.contacts.length === 0 ? (
              <p className="text-xs text-muted-foreground">No contacts linked to this account.</p>
            ) : (
              <div className="divide-y divide-border/60">
                {company.contacts.map((contact) => (
                  <Link
                    key={contact.id}
                    href={`/contacts/${contact.id}`}
                    className="py-2 flex items-center justify-between hover:text-primary transition-colors text-xs"
                  >
                    <div>
                      <p className="font-medium">{contact.firstName} {contact.lastName}</p>
                      {contact.title && <p className="text-[10px] text-muted-foreground">{contact.title}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Associated Deals */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Handshake className="w-4 h-4 text-amber-500" />
                Deals ({company.deals.length})
              </h2>
            </div>
            {company.deals.length === 0 ? (
              <p className="text-xs text-muted-foreground">No deals linked to this account.</p>
            ) : (
              <div className="divide-y divide-border/60">
                {company.deals.map((deal) => (
                  <Link
                    key={deal.id}
                    href={`/deals/${deal.id}`}
                    className="py-2 flex items-center justify-between hover:text-primary transition-colors text-xs"
                  >
                    <div>
                      <p className="font-medium">{deal.title}</p>
                      <p className="text-[10px] text-muted-foreground">{formatDate(deal.createdAt)}</p>
                    </div>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(Number(deal.value))}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Custom Fields Card */}
          {customDefs.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h2 className="text-sm font-semibold">Custom Fields</h2>
              <div className="space-y-3 text-xs">
                {customDefs.map((def) => (
                  <div key={def.id} className="flex justify-between items-center py-1 border-b border-border/40 last:border-0">
                    <span className="text-muted-foreground font-medium">{def.fieldLabel}</span>
                    <CustomFieldRenderer
                      definition={def}
                      value={customFieldsData[def.fieldName]}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column — Activity Feed */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <ActivityTimeline
            tenantId={tenantId}
            entityType="Company"
            entityId={company.id}
            initialActivities={activities}
          />
        </div>
      </div>
    </div>
  );
}
