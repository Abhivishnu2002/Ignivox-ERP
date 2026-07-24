import { getServerSession } from "@/lib/auth";
import { prisma, tenantTransaction } from "@/lib/db";
import { redirect } from "next/navigation";
import { InvoiceForm } from "./InvoiceForm";
import { MarkPaidButton } from "./MarkPaidButton";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { FileText, Receipt, Calendar, Building2, User, DollarSign } from "lucide-react";
import Link from "next/link";
import type { Invoice, Company, Contact } from "@/lib/prisma-types";

interface InvoicesPageProps {
  searchParams: Promise<{ new?: string }>;
}

export default async function InvoicesPage({ searchParams }: InvoicesPageProps) {
  const { new: showNew } = await searchParams;
  const session = await getServerSession();
  if (!session) redirect("/login");

  const membership = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id },
    include: { tenant: true },
  });

  if (!membership) redirect("/onboarding");

  const tenantId = membership.tenant.id;

  const [invoices, companies, contacts, customFieldDefs] =
    await tenantTransaction(tenantId, async (tx) => {
      return Promise.all([
        tx.invoice.findMany({
          where: { tenantId },
          include: {
            company: true,
            contact: true,
            salesOrder: true,
          },
          orderBy: { createdAt: "desc" },
        }),
        tx.company.findMany({
          where: { tenantId },
          orderBy: { name: "asc" },
        }),
        tx.contact.findMany({
          where: { tenantId },
          orderBy: { firstName: "asc" },
        }),
        tx.customFieldDefinition.findMany({
          where: { tenantId, entityType: "Invoice" },
          orderBy: { sortOrder: "asc" },
        }),
      ]);
    });

  const totalInvoiced = invoices.reduce((sum, i) => sum + Number(i.totalAmount), 0);
  const totalPaid = invoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + Number(i.totalAmount), 0);
  const totalOutstanding = totalInvoiced - totalPaid;

  const statusBadges: Record<string, { label: string; className: string }> = {
    draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
    sent: { label: "Sent", className: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
    issued: { label: "Issued", className: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20" },
    paid: { label: "Paid", className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
    overdue: { label: "Overdue", className: "bg-rose-500/10 text-rose-500 border-rose-500/20" },
    cancelled: { label: "Cancelled", className: "bg-gray-500/10 text-gray-500 border-gray-500/20" },
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-500" />
            <h1 className="text-2xl font-bold tracking-tight">Invoicing & Billing</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Accounts receivable, zero-sync sales order invoicing, remittance tracking, and aging.
          </p>
        </div>
        <InvoiceForm
          tenantId={tenantId}
          companies={companies}
          contacts={contacts}
          customFieldDefinitions={customFieldDefs}
          defaultOpen={showNew === "1"}
        />
      </div>

      {/* Financial Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-xs text-muted-foreground font-medium uppercase">Total Revenue Invoiced</p>
          <p className="text-2xl font-bold mt-1 text-foreground tabular-nums">
            {formatCurrency(totalInvoiced)}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-emerald-500 font-medium uppercase">Collected Payments (Paid)</p>
          <p className="text-2xl font-bold mt-1 text-emerald-500 tabular-nums">
            {formatCurrency(totalPaid)}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-amber-500 font-medium uppercase">Outstanding Receivables</p>
          <p className="text-2xl font-bold mt-1 text-amber-500 tabular-nums">
            {formatCurrency(totalOutstanding)}
          </p>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
        {invoices.length === 0 ? (
          <div className="empty-state py-16">
            <div className="empty-state-icon">
              <Receipt className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold">No invoices generated yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Issue an invoice manually or convert a Sales Order to start billing.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 border-b border-border text-xs text-muted-foreground uppercase font-semibold">
                <tr>
                  <th className="px-5 py-3">Invoice #</th>
                  <th className="px-5 py-3">Customer / Billed To</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Due Date</th>
                  <th className="px-5 py-3">Total Amount</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map((inv: any) => {
                  const badgeInfo = statusBadges[inv.status] || statusBadges.draft;
                  return (
                    <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="font-mono text-xs font-bold text-primary hover:underline"
                        >
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5">
                        {inv.company ? (
                          <Link
                            href={`/companies/${inv.company.id}`}
                            className="font-medium text-foreground hover:text-primary flex items-center gap-1.5"
                          >
                            <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                            {inv.company.name}
                          </Link>
                        ) : inv.contact ? (
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <User className="w-3.5 h-3.5" />
                            {inv.contact.firstName} {inv.contact.lastName}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant="outline" className={`text-[10px] capitalize ${badgeInfo.className}`}>
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(inv.dueDate)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-bold tabular-nums">
                        {formatCurrency(Number(inv.totalAmount))}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {inv.status !== "paid" ? (
                          <MarkPaidButton
                            tenantId={tenantId}
                            invoiceId={inv.id}
                            invoiceNumber={inv.invoiceNumber}
                          />
                        ) : (
                          <span className="text-xs text-emerald-500 font-medium">✓ Paid</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
