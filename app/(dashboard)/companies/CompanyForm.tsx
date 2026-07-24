"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { createCompanyAction } from "./actions";
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
  name: z.string().min(1, "Company name required"),
  industry: z.string().optional(),
  website: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  type: z.enum(["customer", "supplier", "both"]),
});

type FormInput = z.infer<typeof schema>;

interface CompanyFormProps {
  tenantId: string;
  customFieldDefinitions: CustomFieldDefinition[];
}

export function CompanyForm({ tenantId, customFieldDefinitions }: CompanyFormProps) {
  const [open, setOpen] = useState(false);
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
      type: "customer",
    },
  });

  async function onSubmit(data: FormInput) {
    setLoading(true);
    try {
      const res = await createCompanyAction(tenantId, {
        ...data,
        customFields: customFieldValues,
      });

      if ("error" in res && res.error) {
        toast.error(res.error);
      } else {
        toast.success("Company created successfully");
        setOpen(false);
        reset();
        setCustomFieldValues({});
      }
    } catch {
      toast.error("Failed to create company");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center justify-center gap-1.5 text-xs font-medium h-8 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer">
        <Plus className="w-4 h-4" />
        New Company
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Company</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Company Name *</Label>
            <Input id="name" placeholder="AeroTech Industries" {...register("name")} />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="type">Company Type</Label>
              <Select
                defaultValue="customer"
                onValueChange={(val) => setValue("type", val as FormInput["type"])}
              >
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="supplier">Supplier</SelectItem>
                  <SelectItem value="both">Both (Customer & Supplier)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="industry">Industry</Label>
              <Input id="industry" placeholder="Aerospace" {...register("industry")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="website">Website</Label>
              <Input id="website" placeholder="https://aerotech.example.com" {...register("website")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" placeholder="+1-555-0100" {...register("phone")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" placeholder="1200 Aviation Blvd, Wichita, KS 67209" {...register("address")} />
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
              Create Company
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
