import { getServerSession } from "@/lib/auth";
import { prisma, tenantTransaction } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { ActivityTimeline } from "@/components/activity/ActivityTimeline";
import { CustomFieldRenderer } from "@/components/custom-fields/CustomFieldRenderer";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getInitials } from "@/lib/utils";
import { ArrowLeft, Mail, Phone, Building2, User } from "lucide-react";
import Link from "next/link";

interface ContactDetailPageProps {
  params: Promise<{ contactId: string }>;
}

export default async function ContactDetailPage({ params }: ContactDetailPageProps) {
  const { contactId } = await params;
  const session = await getServerSession();
  if (!session) redirect("/login");

  const membership = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id },
    include: { tenant: true },
  });

  if (!membership) redirect("/onboarding");

  const tenantId = membership.tenant.id;

  const [contact, customDefs, activities] = await tenantTransaction(
    tenantId,
    async (tx) => {
      return Promise.all([
        tx.contact.findFirst({
          where: { id: contactId, tenantId },
          include: { company: true },
        }),
        tx.customFieldDefinition.findMany({
          where: { tenantId, entityType: "Contact" },
          orderBy: { sortOrder: "asc" },
        }),
        tx.activity.findMany({
          where: { tenantId, entityType: "Contact", entityId: contactId },
          orderBy: { createdAt: "desc" },
        }),
      ]);
    }
  );

  if (!contact) notFound();

  const customFieldsData = (contact.customFields ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back button */}
      <Link
        href="/contacts"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Contacts
      </Link>

      {/* Profile Header Card */}
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="text-lg font-bold bg-primary/15 text-primary">
              {getInitials(`${contact.firstName} ${contact.lastName}`)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {contact.firstName} {contact.lastName}
              </h1>
              {contact.title && (
                <Badge variant="secondary" className="font-normal text-xs">
                  {contact.title}
                </Badge>
              )}
            </div>
            {contact.company && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <Building2 className="w-3.5 h-3.5" />
                {contact.company.name}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted border border-border interactive"
            >
              <Mail className="w-3.5 h-3.5 text-primary" />
              {contact.email}
            </a>
          )}
          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted border border-border interactive"
            >
              <Phone className="w-3.5 h-3.5 text-primary" />
              {contact.phone}
            </a>
          )}
        </div>
      </div>

      {/* Content grid: Left = Details + Custom Fields, Right = Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="space-y-6 lg:col-span-1">
          {/* Overview */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              Contact Information
            </h2>
            <div className="space-y-3 text-xs">
              <div>
                <p className="text-muted-foreground">Full Name</p>
                <p className="font-medium text-foreground mt-0.5">
                  {contact.firstName} {contact.lastName}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Email</p>
                <p className="font-medium text-foreground mt-0.5">{contact.email || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Phone</p>
                <p className="font-medium text-foreground mt-0.5">{contact.phone || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Title</p>
                <p className="font-medium text-foreground mt-0.5">{contact.title || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Company</p>
                <p className="font-medium text-foreground mt-0.5">
                  {contact.company?.name || "—"}
                </p>
              </div>
            </div>
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
            entityType="Contact"
            entityId={contact.id}
            initialActivities={activities}
          />
        </div>
      </div>
    </div>
  );
}
