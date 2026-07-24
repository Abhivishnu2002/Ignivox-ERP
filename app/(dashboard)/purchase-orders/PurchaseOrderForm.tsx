"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { createPurchaseOrderAction } from "./actions";
import { CustomFieldInput } from "@/components/custom-fields/CustomFieldInput";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Company, CustomFieldDefinition } from "@prisma/client";

const schema = z.object({
  supplierId: z.string().min(1, "Supplier required"),
  totalAmount: z.number().min(0, "Total must be positive"),
  expectedDeliveryDate: z.string().optional(),
  notes: z.string().optional(),
});

type FormInput = z.infer<typeof schema>;

interface PurchaseOrderFormProps {
  tenantId: string;
  suppliers: Company[];
  customFieldDefinitions: CustomFieldDefinition[];
  defaultOpen?: boolean;
}

export function PurchaseOrderForm({
  tenantId,
  suppliers,
  customFieldDefinitions,
  defaultOpen = false,
}: PurchaseOrderFormProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [loading, setLoading] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      totalAmount: 0,
    },
  });

  async function onSubmit(data: FormInput) {
    setLoading(true);
    try {
      const res = await createPurchaseOrderAction(tenantId, {
        ...data,
        customFields: customFieldValues,
      });

      if ("error" in res && res.error) {
        toast.error(res.error);
      } else {
        toast.success("Purchase order created");
        setOpen(false);
        reset();
        setCustomFieldValues({});
      }
    } catch {
      toast.error("Failed to create purchase order");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center justify-center gap-1.5 text-xs font-medium h-8 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer">
        <Plus className="w-4 h-4" />
        New Purchase Order
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Procurement Purchase Order</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="supplierId">Supplier / Vendor *</Label>
            <Select onValueChange={(val) => setValue("supplierId", val as string)}>
              <SelectTrigger id="supplierId">
                <SelectValue placeholder="Select supplier company" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.supplierId && (
              <p className="text-xs text-destructive">{errors.supplierId.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="totalAmount">Total PO Amount ($) *</Label>
              <Input
                id="totalAmount"
                type="number"
                step="any"
                placeholder="4200.00"
                onChange={(e) => setValue("totalAmount", Number(e.target.value))}
              />
              {errors.totalAmount && (
                <p className="text-xs text-destructive">{errors.totalAmount.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="expectedDeliveryDate">Expected Delivery Date</Label>
              <Input
                id="expectedDeliveryDate"
                type="date"
                {...register("expectedDeliveryDate")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes / Raw Material Order Specs</Label>
            <Textarea id="notes" placeholder="e.g. 500 lbs 6061-T6 Aluminum Billet 4-inch round bar..." {...register("notes")} />
          </div>

          {/* Dynamic Custom Fields Section */}
          {customFieldDefinitions.length > 0 && (
            <div className="pt-3 border-t border-border space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Custom Fields
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {customFieldDefinitions.map((def) => (
                  <CustomFieldInput
                    key={def.id}
                    definition={def}
                    value={customFieldValues[def.fieldName]}
                    onChange={(val) =>
                      setCustomFieldValues((prev) => ({
                        ...prev,
                        [def.fieldName]: val,
                      }))
                    }
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Issue Purchase Order
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
