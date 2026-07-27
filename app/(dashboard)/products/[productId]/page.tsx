import { getServerSession } from "@/lib/auth";
import { prisma, tenantTransaction } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { CustomFieldRenderer } from "@/components/custom-fields/CustomFieldRenderer";
import { BomForm, DeleteBomButton } from "./BomForm";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, Package, Warehouse, Layers3 } from "lucide-react";
import Link from "next/link";

interface ProductDetailPageProps {
  params: Promise<{ productId: string }>;
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { productId } = await params;
  const session = await getServerSession();
  if (!session) redirect("/login");

  const membership = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id },
    include: { tenant: true },
  });

  if (!membership) redirect("/onboarding");

  const tenantId = membership.tenant.id;

  const [product, allProducts, customDefs] = await tenantTransaction(
    tenantId,
    async (tx) => {
      return Promise.all([
        tx.product.findFirst({
          where: { id: productId, tenantId },
          include: {
            inventoryItems: true,
            bomsAsParent: {
              where: { isActive: true },
              include: {
                lines: {
                  include: {
                    product: true,
                  },
                },
              },
            },
          },
        }),
        tx.product.findMany({
          where: { tenantId },
          orderBy: { name: "asc" },
        }),
        tx.customFieldDefinition.findMany({
          where: { tenantId, entityType: "Product" },
          orderBy: { sortOrder: "asc" },
        }),
      ]);
    }
  );

  if (!product) notFound();

  const totalStock = product.inventoryItems.reduce(
    (sum, i) => sum + Number(i.quantity),
    0
  );
  const totalAllocated = 0;

  const activeBom = product.bomsAsParent[0];
  const bomLines = activeBom?.lines ?? [];

  // Calculate estimated total BOM material cost
  const bomMaterialCost = bomLines.reduce((sum, line) => {
    return sum + Number(line.quantity) * Number(line.product.unitPrice);
  }, 0);

  const customFieldsData = (product.customFields ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back button */}
      <Link
        href="/products"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Product Catalog
      </Link>

      {/* Header Card */}
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
            <Package className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-muted-foreground">
                {product.sku}
              </span>
              <Badge variant="outline" className="text-xs capitalize">
                {product.type.replace("_", " ")}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight mt-0.5">{product.name}</h1>
          </div>
        </div>

        <div className="flex items-center gap-6 text-right">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Unit Price</p>
            <p className="text-xl font-bold text-primary tabular-nums">
              {formatCurrency(Number(product.unitPrice))}
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column — Stock & Custom Fields */}
        <div className="space-y-6 lg:col-span-1">
          {/* Stock card */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Warehouse className="w-4 h-4 text-primary" />
              Inventory & Stock Status
            </h2>
            <div className="grid grid-cols-2 gap-3 bg-muted/30 p-3 rounded-lg border border-border/60 text-center">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-medium">On Hand</p>
                <p className="text-lg font-bold tabular-nums mt-0.5">
                  {totalStock} {product.unit}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-medium">Allocated</p>
                <p className="text-lg font-bold tabular-nums mt-0.5 text-amber-500">
                  {totalAllocated} {product.unit}
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

        {/* Right Column — Bill of Materials (BOM) Tree */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Layers3 className="w-4 h-4 text-indigo-500" />
                  Bill of Materials (BOM) — Component Explosion Tree
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Raw materials consumed when producing 1 unit of {product.name}.
                </p>
              </div>
              <BomForm
                tenantId={tenantId}
                productId={product.id}
                availableProducts={allProducts}
              />
            </div>

            {bomLines.length === 0 ? (
              <div className="border border-dashed border-border rounded-xl p-8 text-center">
                <p className="text-xs text-muted-foreground">
                  No BOM components defined yet for this product.
                </p>
                <p className="text-[11px] text-muted-foreground/70 mt-1">
                  Click &quot;Add BOM Component&quot; above to link raw materials required for shop-floor work orders.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 border-b border-border text-[10px] text-muted-foreground uppercase font-semibold">
                      <tr>
                        <th className="px-4 py-2.5">Raw Material / Component</th>
                        <th className="px-4 py-2.5">Qty per Unit</th>
                        <th className="px-4 py-2.5">Unit Price</th>
                        <th className="px-4 py-2.5">Ext. Cost</th>
                        <th className="px-4 py-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {bomLines.map((line) => {
                        const extCost =
                          Number(line.quantity) * Number(line.product.unitPrice);
                        return (
                          <tr key={line.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3">
                              <span className="font-semibold text-foreground">
                                {line.product.name}
                              </span>
                              <span className="font-mono text-[10px] text-muted-foreground ml-2">
                                ({line.product.sku})
                              </span>
                              {line.notes && (
                                <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                                  {line.notes}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 font-semibold tabular-nums">
                              {Number(line.quantity)} {line.product.unit}
                            </td>
                            <td className="px-4 py-3 tabular-nums">
                              {formatCurrency(Number(line.product.unitPrice))}
                            </td>
                            <td className="px-4 py-3 font-semibold tabular-nums text-primary">
                              {formatCurrency(extCost)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <DeleteBomButton
                                tenantId={tenantId}
                                bomLineId={line.id}
                                productId={product.id}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* BOM Roll-up summary */}
                <div className="bg-muted/40 p-4 rounded-lg border border-border flex items-center justify-between text-xs">
                  <span className="font-semibold text-muted-foreground">
                    Total Estimated Direct Material Cost per Unit:
                  </span>
                  <span className="text-base font-bold tabular-nums text-primary">
                    {formatCurrency(bomMaterialCost)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
