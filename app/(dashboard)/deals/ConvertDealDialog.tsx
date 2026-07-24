"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, ShoppingCart } from "lucide-react";
import { convertDealToSalesOrderAction } from "./actions";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Deal } from "@/lib/prisma-types";

interface ConvertDealDialogProps {
  tenantId: string;
  deal: Deal;
}

export function ConvertDealDialog({ tenantId, deal }: ConvertDealDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");

  async function handleConvert() {
    setLoading(true);
    try {
      const res = await convertDealToSalesOrderAction(
        tenantId,
        deal.id,
        deliveryDate || undefined,
        notes || undefined
      );

      if ("error" in res && res.error) {
        toast.error(res.error);
      } else {
        toast.success("Sales Order generated!");
        setOpen(false);
        if ("salesOrderId" in res && res.salesOrderId) {
          router.push(`/sales-orders/${res.salesOrderId}`);
        } else {
          router.push("/sales-orders");
        }
      }
    } catch {
      toast.error("Failed to convert deal to sales order");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center justify-center gap-1 text-[11px] font-medium h-7 px-2.5 rounded-md bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 border border-indigo-500/20 transition-colors cursor-pointer">
        <ShoppingCart className="w-3 h-3" />
        Convert to Sales Order
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Convert Deal to Sales Order</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <p className="text-xs text-muted-foreground">
            Converting Won Deal <span className="font-semibold text-foreground">{deal.title}</span> into a confirmed Sales Order.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="deliveryDate">Target Delivery Date</Label>
            <Input
              id="deliveryDate"
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Order Notes / Production Instructions</Label>
            <Textarea
              id="notes"
              placeholder="e.g. Priority order — machine program AL-BRACKET-v12 approved..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConvert} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate Sales Order →
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
