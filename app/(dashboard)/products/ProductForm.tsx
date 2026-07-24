"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { createProductAction } from "./actions";
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
import type { CustomFieldDefinition } from "@/lib/prisma-types";

const schema = z.object({
  sku: z.string().min(1, "SKU required"),
  name: z.string().min(1, "Product name required"),
  description: z.string().optional(),
  type: z.enum(["finished_good", "raw_material", "subassembly", "service"]),
  unitOfMeasure: z.string().min(1, "UOM required"),
  unitCost: z.number().min(0, "Cost must be positive"),
  unitPrice: z.number().min(0, "Price must be positive"),
});

type FormInput = z.infer<typeof schema>;

interface ProductFormProps {
  tenantId: string;
  customFieldDefinitions: CustomFieldDefinition[];
  defaultOpen?: boolean;
}

export function ProductForm({
  tenantId,
  customFieldDefinitions,
  defaultOpen = false,
}: ProductFormProps) {
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
      type: "finished_good",
      unitOfMeasure: "pcs",
      unitCost: 0,
      unitPrice: 0,
    },
  });

  async function onSubmit(data: FormInput) {
    setLoading(true);
    try {
      const res = await createProductAction(tenantId, {
        ...data,
        customFields: customFieldValues,
      });

      if ("error" in res && res.error) {
        toast.error(res.error);
      } else {
        toast.success("Product catalog item created");
        setOpen(false);
        reset();
        setCustomFieldValues({});
      }
    } catch {
      toast.error("Failed to create product");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center justify-center gap-1.5 text-xs font-medium h-8 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer">
        <Plus className="w-4 h-4" />
        New Product
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Product Catalog Item</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sku">SKU / Item # *</Label>
              <Input id="sku" placeholder="FG-FLANGE-001" {...register("sku")} />
              {errors.sku && (
                <p className="text-xs text-destructive">{errors.sku.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="type">Item Classification *</Label>
              <Select
                defaultValue="finished_good"
                onValueChange={(val) => setValue("type", val as FormInput["type"])}
              >
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="finished_good">Finished Good</SelectItem>
                  <SelectItem value="raw_material">Raw Material / Component</SelectItem>
                  <SelectItem value="subassembly">Subassembly</SelectItem>
                  <SelectItem value="service">Service / Milling Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name">Item Name *</Label>
            <Input id="name" placeholder="CNC Machined Aluminum Flange 6061-T6" {...register("name")} />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Technical Specification / Notes</Label>
            <Textarea id="description" placeholder="Anodized finish per MIL-A-8625, Type II..." {...register("description")} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="unitOfMeasure">Unit of Measure *</Label>
              <Input id="unitOfMeasure" placeholder="pcs, kg, meters..." {...register("unitOfMeasure")} />
              {errors.unitOfMeasure && (
                <p className="text-xs text-destructive">{errors.unitOfMeasure.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="unitCost">Unit Cost ($)</Label>
              <Input
                id="unitCost"
                type="number"
                step="any"
                placeholder="45.00"
                onChange={(e) => setValue("unitCost", Number(e.target.value))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="unitPrice">Selling Price ($)</Label>
              <Input
                id="unitPrice"
                type="number"
                step="any"
                placeholder="120.00"
                onChange={(e) => setValue("unitPrice", Number(e.target.value))}
              />
            </div>
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
              Create Product
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
