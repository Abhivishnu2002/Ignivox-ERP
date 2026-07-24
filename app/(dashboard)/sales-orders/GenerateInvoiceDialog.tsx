"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, FileText } from "lucide-react";
import { generateInvoiceFromSalesOrderAction } from "./actions";
import { useRouter } from "next/navigation";
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
import type { SalesOrder } from "@prisma/client";

interface GenerateInvoiceDialogProps {
  tenantId: string;
  salesOrder: SalesOrder;
}

export function GenerateInvoiceDialog({
  tenantId,
  salesOrder,
}: GenerateInvoiceDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dueDate, setDueDate] = useState("");

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await generateInvoiceFromSalesOrderAction(
        tenantId,
        salesOrder.id,
        dueDate || undefined
      );

      if ("error" in res && res.error) {
        toast.error(res.error);
      } else {
        toast.success("Invoice generated!");
        setOpen(false);
        if ("invoiceId" in res && res.invoiceId) {
          router.push(`/invoices/${res.invoiceId}`);
        } else {
          router.push("/invoices");
        }
      }
    } catch {
      toast.error("Failed to generate invoice");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center justify-center gap-1 text-[11px] font-medium h-7 px-2.5 rounded-md bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors cursor-pointer">
        <FileText className="w-3.5 h-3.5" />
        Generate Invoice
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Customer Invoice</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <p className="text-xs text-muted-foreground">
            Generating invoice for Sales Order <span className="font-semibold text-foreground">{salesOrder.orderNumber}</span>.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="dueDate">Invoice Due Date (Net 30 Default)</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate & Open Invoice →
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
