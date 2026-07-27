import { getServerSession } from "@/lib/auth";
import { prisma, tenantTransaction } from "@/lib/db";
import { redirect } from "next/navigation";
import { ProductForm } from "./ProductForm";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { Package, Layers } from "lucide-react";
import Link from "next/link";
import type { Product } from "@/lib/prisma-types";

type ProductWithRelations = Product & {
  inventoryItems: { quantity: unknown }[];
  bomsAsParent: { lines: unknown[] }[];
};

interface ProductsPageProps {
  searchParams: Promise<{ new?: string }>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const { new: showNew } = await searchParams;
  const session = await getServerSession();
  if (!session) redirect("/login");

  const membership = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id },
    include: { tenant: true },
  });

  if (!membership) redirect("/onboarding");

  const tenantId = membership.tenant.id;

  const [products, customFieldDefs] = await tenantTransaction(
    tenantId,
    async (tx) => {
      return Promise.all([
        tx.product.findMany({
          where: { tenantId },
          include: {
            inventoryItems: true,
            bomsAsParent: {
              include: { lines: true },
            },
          },
          orderBy: [{ type: "asc" }, { name: "asc" }],
        }),
        tx.customFieldDefinition.findMany({
          where: { tenantId, entityType: "Product" },
          orderBy: { sortOrder: "asc" },
        }),
      ]);
    }
  );

  const typeBadges: Record<string, { label: string; style: string }> = {
    finished_good: { label: "Finished Good", style: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20" },
    raw_material: { label: "Raw Material", style: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
    subassembly: { label: "Subassembly", style: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
    service: { label: "Service / Time", style: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Products & Bill of Materials</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Product catalog, unit pricing, raw material inventory, and multi-component assembly BOMs.
          </p>
        </div>
        <ProductForm
          tenantId={tenantId}
          customFieldDefinitions={customFieldDefs}
          defaultOpen={showNew === "1"}
        />
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
        {products.length === 0 ? (
          <div className="empty-state py-16">
            <div className="empty-state-icon">
              <Package className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold">No products created yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add raw materials or finished goods to build your ERP catalog.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 border-b border-border text-xs text-muted-foreground uppercase font-semibold">
                <tr>
                  <th className="px-5 py-3">SKU / Item</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Stock on Hand</th>
                  <th className="px-5 py-3">Price</th>
                  <th className="px-5 py-3">BOM Components</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((prod: ProductWithRelations) => {
                  const stockTotal = prod.inventoryItems.reduce(
                    (sum, i) => sum + Number(i.quantity),
                    0
                  );
                  const badgeInfo = typeBadges[prod.type as keyof typeof typeBadges] || typeBadges.finished_good;
                  const totalBomLines = prod.bomsAsParent.reduce(
                    (sum, b) => sum + b.lines.length,
                    0
                  );

                  return (
                    <tr key={prod.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/products/${prod.id}`}
                          className="group block"
                        >
                          <span className="font-mono text-xs font-bold text-muted-foreground group-hover:text-primary transition-colors">
                            {prod.sku}
                          </span>
                          <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                            {prod.name}
                          </p>
                        </Link>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant="outline" className={`text-[10px] ${badgeInfo.style}`}>
                          {badgeInfo.label}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-bold tabular-nums">
                          {stockTotal} {prod.unit}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 tabular-nums text-xs font-semibold">
                        {formatCurrency(Number(prod.unitPrice))}
                      </td>
                      <td className="px-5 py-3.5 text-xs">
                        {totalBomLines > 0 ? (
                          <span className="flex items-center gap-1 text-primary font-medium">
                            <Layers className="w-3.5 h-3.5" />
                            {totalBomLines} component{totalBomLines === 1 ? "" : "s"}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          href={`/products/${prod.id}`}
                          className="text-xs text-primary hover:underline font-medium"
                        >
                          View / Manage BOM →
                        </Link>
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
