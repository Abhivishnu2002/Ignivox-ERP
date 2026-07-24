"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { createSalesOrderAction } from "./actions";
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
import type { Company, Contact, CustomFieldDefinition } from "@/lib/prisma-types";

const schema = z.object({
  companyId: z.string().optional(),
  contactId: z.string().optional(),
  totalAmount: z.number().min(0, "Total must be positive"),
  deliveryDate: z.string().optional(),
  notes: z.string().optional(),
});

type FormInput = z.infer<typeof schema>;

interface SalesOrderFormProps {
  tenantId: string;
  companies: Company[];
  contacts: Contact[];
  customFieldDefinitions: CustomFieldDefinition[];
  defaultOpen?: boolean;
}

export function SalesOrderForm({
  tenantId,
  companies,
  contacts,
  customFieldDefinitions,
  defaultOpen = false,
}: SalesOrderFormProps) {
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
      const res = await createSalesOrderAction(tenantId, {
        ...data,
        customFields: customFieldValues,
      });

      if ("error" in res && res.error) {
        toast.error(res.error);
      } else {
        toast.success("Sales order created");
        setOpen(false);
        reset();
        setCustomFieldValues({});
      }
    } catch {
      toast.error("Failed to create sales order");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center justify-center gap-1.5 text-xs font-medium h-8 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer">
        <Plus className="w-4 h-4" />
        New Sales Order
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Customer Sales Order</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="companyId">Customer Company Account</Label>
              <Select onValueChange={(val) => setValue("companyId", val as string)}>
                <SelectTrigger id="companyId">
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contactId">Contact Person</Label>
              <Select onValueChange={(val) => setValue("contactId", val as string)}>
                <SelectTrigger id="contactId">
                  <SelectValue placeholder="Select contact" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="totalAmount">Total Order Amount ($) *</Label>
              <Input
                id="totalAmount"
                type="number"
                step="any"
                placeholder="18500.00"
                onChange={(e) => setValue("totalAmount", Number(e.target.value))}
              />
              {errors.totalAmount && (
                <p className="text-xs text-destructive">{errors.totalAmount.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="deliveryDate">Promised Delivery Date</Label>
              <Input id="deliveryDate" type="date" {...register("deliveryDate")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Order Terms / Production Instructions</Label>
            <Textarea id="notes" placeholder="e.g. FOB Wichita, 50% deposit received, ship via Freight Quote..." {...register("notes")} />
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
              Create Sales Order
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
