"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
import { markInvoicePaidAction } from "./actions";
import { Button } from "@/components/ui/button";

interface MarkPaidButtonProps {
  tenantId: string;
  invoiceId: string;
  invoiceNumber: string;
}

export function MarkPaidButton({ tenantId, invoiceId, invoiceNumber }: MarkPaidButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleMarkPaid() {
    if (!confirm(`Confirm full payment received for invoice ${invoiceNumber}?`)) return;
    setLoading(true);
    try {
      const res = await markInvoicePaidAction(tenantId, invoiceId);
      if ("error" in res && res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Invoice ${invoiceNumber} marked as Paid!`);
      }
    } catch {
      toast.error("Failed to update invoice");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 text-[11px] font-medium gap-1 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10 border-emerald-500/20"
      onClick={handleMarkPaid}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <CheckCircle2 className="w-3.5 h-3.5" />
      )}
      Mark Paid
    </Button>
  );
}
