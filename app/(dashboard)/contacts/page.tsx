import { getServerSession } from "@/lib/auth";
import { prisma, tenantTransaction } from "@/lib/db";
import { redirect } from "next/navigation";
import { ContactForm } from "./ContactForm";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getInitials } from "@/lib/utils";
import { Users, Mail, Phone, Building2 } from "lucide-react";
import Link from "next/link";
import type { Contact, Company } from "@/lib/prisma-types";

type ContactWithCompany = Contact & { company?: Company | null };

interface ContactsPageProps {
  searchParams: Promise<{ new?: string }>;
}

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  const { new: showNew } = await searchParams;
  const session = await getServerSession();
  if (!session) redirect("/login");

  const membership = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id },
    include: { tenant: true },
  });

  if (!membership) redirect("/onboarding");

  const tenantId = membership.tenant.id;

  // Fetch contacts, companies, custom field definitions via tenantTransaction
  const [contacts, companies, customFieldDefs] = await tenantTransaction(
    tenantId,
    async (tx) => {
      return Promise.all([
        tx.contact.findMany({
          where: { tenantId },
          include: { company: true },
          orderBy: { createdAt: "desc" },
        }),
        tx.company.findMany({
          where: { tenantId },
          orderBy: { name: "asc" },
        }),
        tx.customFieldDefinition.findMany({
          where: { tenantId, entityType: "Contact" },
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
            <Users className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your business contacts, leads, and customer relationships.
          </p>
        </div>
        <ContactForm
          tenantId={tenantId}
          companies={companies}
          customFieldDefinitions={customFieldDefs}
          defaultOpen={showNew === "1"}
        />
      </div>

      {/* Contacts table card */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
        {contacts.length === 0 ? (
          <div className="empty-state py-16">
            <div className="empty-state-icon">
              <Users className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold">No contacts yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Create your first contact to start building your CRM network.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 border-b border-border text-xs text-muted-foreground uppercase font-semibold">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Company</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Phone</th>
                  <th className="px-5 py-3">Title</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contacts.map((contact: ContactWithCompany) => (
                  <tr key={contact.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/contacts/${contact.id}`}
                        className="flex items-center gap-3 group"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                            {getInitials(`${contact.firstName} ${contact.lastName}`)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                            {contact.firstName} {contact.lastName}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">
                      {contact.company ? (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Building2 className="w-3.5 h-3.5" />
                          {contact.company.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {contact.email ? (
                        <a
                          href={`mailto:${contact.email}`}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          {contact.email}
                        </a>
                      ) : (
                        <span className="text-muted-foreground/50 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {contact.phone ? (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Phone className="w-3.5 h-3.5" />
                          {contact.phone}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {contact.title ? (
                        <Badge variant="secondary" className="font-normal text-[11px]">
                          {contact.title}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground/50 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/contacts/${contact.id}`}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        View Details →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
