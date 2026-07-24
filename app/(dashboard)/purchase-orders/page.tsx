import { getServerSession } from "@/lib/auth";
import { prisma, tenantTransaction } from "@/lib/db";
import { redirect } from "next/navigation";
import { PurchaseOrderForm } from "./PurchaseOrderForm";
import { ReceiveInventoryDialog } from "./ReceiveInventoryDialog";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Truck, Calendar, Building2 } from "lucide-react";
import Link from "next/link";
import type { PurchaseOrder, Company, Product } from "@/lib/prisma-types";

interface PurchaseOrdersPageProps {
  searchParams: Promise<{ new?: string }>;
}

export default async function PurchaseOrdersPage({ searchParams }: PurchaseOrdersPageProps) {
  const { new: showNew } = await searchParams;
  const session = await getServerSession();
  if (!session) redirect("/login");

  const membership = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id },
    include: { tenant: true },
  });

  if (!membership) redirect("/onboarding");

  const tenantId = membership.tenant.id;

  const [purchaseOrders, suppliers, rawMaterials, customFieldDefs] =
    await tenantTransaction(tenantId, async (tx) => {
      return Promise.all([
        tx.purchaseOrder.findMany({
          where: { tenantId },
          include: { supplier: true },
          orderBy: { createdAt: "desc" },
        }),
        tx.company.findMany({
          where: { tenantId, type: { in: ["supplier", "both"] } },
          orderBy: { name: "asc" },
        }),
        tx.product.findMany({
          where: { tenantId, type: "raw_material" },
          orderBy: { name: "asc" },
        }),
        tx.customFieldDefinition.findMany({
          where: { tenantId, entityType: "PurchaseOrder" },
          orderBy: { sortOrder: "asc" },
        }),
      ]);
    });

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Purchase Orders & Procurement</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Supplier raw material procurement, expected delivery dates, and receiving warehouse shipments.
          </p>
        </div>
        <PurchaseOrderForm
          tenantId={tenantId}
          suppliers={suppliers}
          customFieldDefinitions={customFieldDefs}
          defaultOpen={showNew === "1"}
        />
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
        {purchaseOrders.length === 0 ? (
          <div className="empty-state py-16">
            <div className="empty-state-icon">
              <Truck className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold">No purchase orders issued yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Issue a purchase order to your suppliers to replenish raw materials.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 border-b border-border text-xs text-muted-foreground uppercase font-semibold">
                <tr>
                  <th className="px-5 py-3">PO #</th>
                  <th className="px-5 py-3">Supplier</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Expected Delivery</th>
                  <th className="px-5 py-3">Total Amount</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {purchaseOrders.map((po: any) => (
                  <tr key={po.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/purchase-orders/${po.id}`}
                        className="font-mono text-xs font-bold text-primary hover:underline"
                      >
                        {po.poNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">
                      {po.supplier ? (
                        <Link
                          href={`/companies/${po.supplier.id}`}
                          className="font-medium text-foreground hover:text-primary flex items-center gap-1.5"
                        >
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                          {po.supplier.name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge
                        variant="outline"
                        className={`text-[10px] capitalize ${
                          po.status === "received"
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                        }`}
                      >
                        {po.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(po.expectedDate)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-bold tabular-nums">
                      {formatCurrency(Number(po.totalAmount))}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {po.status !== "received" ? (
                        <ReceiveInventoryDialog
                          tenantId={tenantId}
                          po={po}
                          rawMaterialProducts={rawMaterials}
                        />
                      ) : (
                        <span className="text-xs text-emerald-500 font-medium">✓ Received</span>
                      )}
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
