"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sliders } from "lucide-react";
import { adjustInventoryStockAction } from "./actions";
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

interface StockAdjustFormProps {
  tenantId: string;
  inventoryId: string;
  productName: string;
  currentQty: number;
  currentLocation: string;
  unitOfMeasure: string;
}

export function StockAdjustForm({
  tenantId,
  inventoryId,
  productName,
  currentQty,
  currentLocation,
  unitOfMeasure,
}: StockAdjustFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newQty, setNewQty] = useState(currentQty);
  const [location, setLocation] = useState(currentLocation);
  const [reason, setReason] = useState("");

  async function handleAdjust() {
    setLoading(true);
    try {
      const res = await adjustInventoryStockAction(
        tenantId,
        inventoryId,
        newQty,
        location,
        reason
      );

      if ("error" in res && res.error) {
        toast.error(res.error);
      } else {
        toast.success("Stock level updated");
        setOpen(false);
      }
    } catch {
      toast.error("Failed to adjust stock");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center justify-center gap-1 text-[11px] font-medium h-7 px-2 rounded-md bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer">
        <Sliders className="w-3 h-3" />
        Adjust Stock
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Inventory Stock</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <p className="text-xs text-muted-foreground">
            Adjusting stock for <span className="font-semibold text-foreground">{productName}</span>.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qty">New Quantity on Hand ({unitOfMeasure})</Label>
              <Input
                id="qty"
                type="number"
                value={newQty}
                onChange={(e) => setNewQty(Number(e.target.value))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="location">Warehouse Location</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reason">Adjustment Reason / Audit Note</Label>
            <Input
              id="reason"
              placeholder="e.g. Physical count discrepancy, scrapped part"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdjust} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Adjustment
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
