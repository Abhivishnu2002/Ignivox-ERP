"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { createWorkOrderAction } from "./actions";
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
import type { Product, SalesOrder, PipelineStage, CustomFieldDefinition } from "@/lib/prisma-types";

const schema = z.object({
  productId: z.string().min(1, "Product required"),
  salesOrderId: z.string().optional(),
  quantity: z.number().min(1, "Quantity required"),
  stageId: z.string().min(1, "Stage required"),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});

type FormInput = z.infer<typeof schema>;

interface WorkOrderFormProps {
  tenantId: string;
  products: Product[];
  salesOrders: SalesOrder[];
  stages: PipelineStage[];
  customFieldDefinitions: CustomFieldDefinition[];
  defaultOpen?: boolean;
}

export function WorkOrderForm({
  tenantId,
  products,
  salesOrders,
  stages,
  customFieldDefinitions,
  defaultOpen = false,
}: WorkOrderFormProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [loading, setLoading] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});

  const defaultStage = stages.find((s) => s.isDefault) || stages[0];

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      stageId: defaultStage?.id || "",
      quantity: 1,
    },
  });

  async function onSubmit(data: FormInput) {
    setLoading(true);
    try {
      const res = await createWorkOrderAction(tenantId, {
        ...data,
        customFields: customFieldValues,
      });

      if ("error" in res && res.error) {
        toast.error(res.error);
      } else {
        toast.success("Work Order dispatched to shop floor");
        setOpen(false);
        reset();
        setCustomFieldValues({});
      }
    } catch {
      toast.error("Failed to create work order");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center justify-center gap-1.5 text-xs font-medium h-8 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer">
        <Plus className="w-4 h-4" />
        New Work Order
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Shop Floor Work Order</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="productId">Assembly / Manufactured Item *</Label>
            <Select onValueChange={(val) => setValue("productId", val as string)}>
              <SelectTrigger id="productId">
                <SelectValue placeholder="Select assembly product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.productId && (
              <p className="text-xs text-destructive">{errors.productId.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="quantity">Production Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                onChange={(e) => setValue("quantity", Number(e.target.value))}
              />
              {errors.quantity && (
                <p className="text-xs text-destructive">{errors.quantity.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="stageId">Initial Shop Stage *</Label>
              <Select
                defaultValue={defaultStage?.id}
                onValueChange={(val) => setValue("stageId", val as string)}
              >
                <SelectTrigger id="stageId">
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="salesOrderId">Linked Sales Order (Optional)</Label>
            <Select onValueChange={(val) => setValue("salesOrderId", val as string)}>
              <SelectTrigger id="salesOrderId">
                <SelectValue placeholder="Select sales order (optional)" />
              </SelectTrigger>
              <SelectContent>
                {salesOrders.map((so) => (
                  <SelectItem key={so.id} value={so.id}>
                    {so.orderNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Start Date</Label>
              <Input id="startDate" type="date" {...register("startDate")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dueDate">Target Due Date</Label>
              <Input id="dueDate" type="date" {...register("dueDate")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Machining Instructions / Shop Notes</Label>
            <Textarea id="notes" placeholder="e.g. Tolerances: ±0.005mm. Run CNC Program #402." {...register("notes")} />
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
              Dispatch Work Order
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
