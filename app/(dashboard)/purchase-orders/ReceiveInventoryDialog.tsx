"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, PackageCheck } from "lucide-react";
import { receivePurchaseOrderAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PurchaseOrder, Product } from "@prisma/client";

interface ReceiveInventoryDialogProps {
  tenantId: string;
  po: PurchaseOrder;
  rawMaterialProducts: Product[];
}

export function ReceiveInventoryDialog({
  tenantId,
  po,
  rawMaterialProducts,
}: ReceiveInventoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(100);

  async function handleReceive() {
    setLoading(true);
    try {
      const res = await receivePurchaseOrderAction(
        tenantId,
        po.id,
        productId || undefined,
        quantity || undefined
      );

      if ("error" in res && res.error) {
        toast.error(res.error);
      } else {
        toast.success("Shipment received & inventory updated!");
        setOpen(false);
      }
    } catch {
      toast.error("Failed to receive purchase order");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center justify-center gap-1 text-[11px] font-medium h-7 px-2.5 rounded-md bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors cursor-pointer">
        <PackageCheck className="w-3.5 h-3.5" />
        Receive Shipment
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Receive Purchase Order Shipment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <p className="text-xs text-muted-foreground">
            Receiving raw materials for <span className="font-semibold text-foreground">{po.poNumber}</span>.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="product">Received Raw Material (Optional)</Label>
            <Select onValueChange={(val) => setProductId(val as string)}>
              <SelectTrigger id="product">
                <SelectValue placeholder="Select raw material item" />
              </SelectTrigger>
              <SelectContent>
                {rawMaterialProducts.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qty">Quantity Received into Stock</Label>
            <Input
              id="qty"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReceive} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Receive into Warehouse →
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
