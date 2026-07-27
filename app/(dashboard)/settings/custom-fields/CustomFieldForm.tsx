"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Plus, X } from "lucide-react";
import { createCustomFieldAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Badge } from "@/components/ui/badge";

const schema = z.object({
  entityType: z.enum([
    "Contact",
    "Company",
    "Lead",
    "Deal",
    "Product",
    "SalesOrder",
    "WorkOrder",
    "Invoice",
    "PurchaseOrder",
  ]),
  fieldName: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[a-z0-9_]+$/, "Machine name: lowercase, numbers, underscores only"),
  fieldLabel: z.string().min(2, "Label required"),
  fieldType: z.enum(["text", "number", "date", "select", "boolean"]),
  isRequired: z.boolean(),
});

type FormInput = z.infer<typeof schema>;

interface CustomFieldFormProps {
  tenantId: string;
}

export function CustomFieldForm({ tenantId }: CustomFieldFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<string[]>([]);
  const [optionInput, setOptionInput] = useState("");

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      entityType: "Contact",
      fieldType: "text",
      isRequired: false,
    },
  });

  const fieldType = useWatch({ control, name: "fieldType" });

  function handleLabelChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    const key = val
      .toLowerCase()
      .replace(/[^a-z0-9\s_]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 32);
    setValue("fieldName", key);
  }

  function addOption() {
    if (!optionInput.trim()) return;
    if (options.includes(optionInput.trim())) return;
    setOptions([...options, optionInput.trim()]);
    setOptionInput("");
  }

  function removeOption(opt: string) {
    setOptions(options.filter((o) => o !== opt));
  }

  async function onSubmit(data: FormInput) {
    if (data.fieldType === "select" && options.length === 0) {
      toast.error("Please add at least one option for select field");
      return;
    }

    setLoading(true);
    try {
      const res = await createCustomFieldAction(tenantId, {
        ...data,
        options: data.fieldType === "select" ? options : undefined,
      });

      if ("error" in res && res.error) {
        toast.error(res.error);
      } else {
        toast.success("Custom field created");
        setOpen(false);
        reset();
        setOptions([]);
      }
    } catch {
      toast.error("Failed to create field");
    } finally {
      setLoading(false);
    }
  }

  const entities = [
    { id: "Contact", name: "Contact" },
    { id: "Company", name: "Company" },
    { id: "Lead", name: "Lead" },
    { id: "Deal", name: "Deal" },
    { id: "Product", name: "Product" },
    { id: "SalesOrder", name: "Sales Order" },
    { id: "WorkOrder", name: "Work Order" },
    { id: "Invoice", name: "Invoice" },
    { id: "PurchaseOrder", name: "Purchase Order" },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center justify-center gap-1.5 text-xs font-medium h-8 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer">
        <Plus className="w-4 h-4" />
        Add Custom Field
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Custom Field</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="entityType">Target Entity</Label>
            <Select
              defaultValue="Contact"
              onValueChange={(val) => setValue("entityType", val as FormInput["entityType"])}
            >
              <SelectTrigger id="entityType">
                <SelectValue placeholder="Select entity" />
              </SelectTrigger>
              <SelectContent>
                {entities.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fieldLabel">Field Label</Label>
            <Input
              id="fieldLabel"
              placeholder="e.g. Preferred Material"
              {...register("fieldLabel", { onChange: handleLabelChange })}
            />
            {errors.fieldLabel && (
              <p className="text-xs text-destructive">{errors.fieldLabel.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fieldName">Field Machine Key</Label>
            <Input
              id="fieldName"
              placeholder="e.g. preferred_material"
              className="font-mono text-xs"
              {...register("fieldName")}
            />
            {errors.fieldName && (
              <p className="text-xs text-destructive">{errors.fieldName.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fieldType">Field Type</Label>
            <Select
              defaultValue="text"
              onValueChange={(val) => setValue("fieldType", val as FormInput["fieldType"])}
            >
              <SelectTrigger id="fieldType">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="select">Dropdown Select</SelectItem>
                <SelectItem value="boolean">Checkbox / Boolean</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Select options builder */}
          {fieldType === "select" && (
            <div className="space-y-2 rounded-lg bg-muted/50 p-3 border border-border">
              <Label className="text-xs font-medium">Dropdown Options</Label>
              <div className="flex gap-2">
                <Input
                  value={optionInput}
                  onChange={(e) => setOptionInput(e.target.value)}
                  placeholder="Option name..."
                  className="h-8 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addOption();
                    }
                  }}
                />
                <Button type="button" size="sm" onClick={addOption} className="h-8 text-xs">
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {options.map((opt) => (
                  <Badge key={opt} variant="secondary" className="gap-1 text-xs">
                    {opt}
                    <X
                      className="w-3 h-3 cursor-pointer hover:text-destructive"
                      onClick={() => removeOption(opt)}
                    />
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="isRequired"
              onCheckedChange={(checked) => setValue("isRequired", Boolean(checked))}
            />
            <label htmlFor="isRequired" className="text-xs text-muted-foreground cursor-pointer select-none">
              Make this field required
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Custom Field
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
