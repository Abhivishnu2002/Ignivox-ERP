import { getServerSession } from "@/lib/auth";
import { prisma, tenantTransaction } from "@/lib/db";
import { redirect } from "next/navigation";
import { StockAdjustForm } from "./StockAdjustForm";
import { Badge } from "@/components/ui/badge";
import { Warehouse, AlertTriangle, PackageCheck } from "lucide-react";
import Link from "next/link";

export default async function InventoryPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const membership = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id },
    include: { tenant: true },
  });

  if (!membership) redirect("/onboarding");

  const tenantId = membership.tenant.id;

  const inventoryItems = await tenantTransaction(tenantId, async (tx) => {
    return tx.inventoryItem.findMany({
      where: { tenantId },
      include: { product: true },
      orderBy: { product: { name: "asc" } },
    });
  });

  const lowStockCount = inventoryItems.filter(
    (i) => Number(i.quantity) <= (Number(i.reorderLevel) ?? 0)
  ).length;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Warehouse className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Warehouse Inventory</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time raw material and finished goods stock levels, allocations, and reorder alerts.
          </p>
        </div>

        {lowStockCount > 0 && (
          <Badge variant="destructive" className="gap-1.5 px-3 py-1 text-xs">
            <AlertTriangle className="w-3.5 h-3.5" />
            {lowStockCount} Low Stock Alert{lowStockCount === 1 ? "" : "s"}
          </Badge>
        )}
      </div>

      {/* Inventory Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
        {inventoryItems.length === 0 ? (
          <div className="empty-state py-16">
            <div className="empty-state-icon">
              <Warehouse className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold">No inventory records</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add products to the catalog to begin tracking stock.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 border-b border-border text-xs text-muted-foreground uppercase font-semibold">
                <tr>
                  <th className="px-5 py-3">Item / SKU</th>
                  <th className="px-5 py-3">Classification</th>
                  <th className="px-5 py-3">Warehouse Location</th>
                  <th className="px-5 py-3">On Hand</th>
                  <th className="px-5 py-3">Allocated</th>
                  <th className="px-5 py-3">Available</th>
                  <th className="px-5 py-3">Reorder Point</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {inventoryItems.map((item) => {
                  const qtyNum = Number(item.quantity);
                  const reorderNum = item.reorderLevel !== null ? Number(item.reorderLevel) : null;
                  const isLow = reorderNum !== null && qtyNum <= reorderNum;

                  return (
                    <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/products/${item.productId}`}
                          className="group block"
                        >
                          <span className="font-mono text-xs font-bold text-muted-foreground group-hover:text-primary transition-colors">
                            {item.product.sku}
                          </span>
                          <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                            {item.product.name}
                          </p>
                        </Link>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {item.product.type.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">
                        {item.location}
                      </td>
                      <td className="px-5 py-3.5 font-bold tabular-nums">
                        {qtyNum} {item.product.unit}
                      </td>
                      <td className="px-5 py-3.5 tabular-nums text-xs text-amber-500 font-semibold">
                        0 {item.product.unit}
                      </td>
                      <td className="px-5 py-3.5 font-bold tabular-nums text-emerald-500">
                        {qtyNum} {item.product.unit}
                      </td>
                      <td className="px-5 py-3.5 tabular-nums text-xs">
                        {reorderNum !== null ? (
                          <span className="flex items-center gap-1">
                            {reorderNum} {item.product.unit}
                            {isLow && (
                              <Badge variant="destructive" className="text-[9px] py-0 px-1">
                                LOW
                              </Badge>
                            )}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <StockAdjustForm
                          tenantId={tenantId}
                          inventoryId={item.id}
                          productName={item.product.name}
                          currentQty={qtyNum}
                          currentLocation={item.location}
                          unitOfMeasure={item.product.unit}
                        />
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
