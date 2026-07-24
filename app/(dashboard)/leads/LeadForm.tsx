"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { createLeadAction } from "./actions";
import { CustomFieldInput } from "@/components/custom-fields/CustomFieldInput";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Contact, Company, PipelineStage, CustomFieldDefinition } from "@/lib/prisma-types";

const schema = z.object({
  title: z.string().min(1, "Lead title required"),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  source: z.string().optional(),
  stageId: z.string().min(1, "Stage required"),
  value: z.number().optional(),
});

type FormInput = z.infer<typeof schema>;

interface LeadFormProps {
  tenantId: string;
  contacts: Contact[];
  companies: Company[];
  stages: PipelineStage[];
  customFieldDefinitions: CustomFieldDefinition[];
  defaultOpen?: boolean;
}

export function LeadForm({
  tenantId,
  contacts,
  companies,
  stages,
  customFieldDefinitions,
  defaultOpen = false,
}: LeadFormProps) {
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
    },
  });

  async function onSubmit(data: FormInput) {
    setLoading(true);
    try {
      const res = await createLeadAction(tenantId, {
        ...data,
        customFields: customFieldValues,
      });

      if ("error" in res && res.error) {
        toast.error(res.error);
      } else {
        toast.success("Lead created successfully");
        setOpen(false);
        reset();
        setCustomFieldValues({});
      }
    } catch {
      toast.error("Failed to create lead");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center justify-center gap-1.5 text-xs font-medium h-8 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer">
        <Plus className="w-4 h-4" />
        New Lead
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Lead</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="title">Lead Title / Inquiry *</Label>
            <Input id="title" placeholder="Hydraulic Fitting RFQ — 500 pcs" {...register("title")} />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contactId">Contact</Label>
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

            <div className="space-y-1.5">
              <Label htmlFor="companyId">Company</Label>
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="stageId">Pipeline Stage *</Label>
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

            <div className="space-y-1.5">
              <Label htmlFor="source">Lead Source</Label>
              <Select onValueChange={(val) => setValue("source", val as string)}>
                <SelectTrigger id="source">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="website">Website Inquiry</SelectItem>
                  <SelectItem value="referral">Customer Referral</SelectItem>
                  <SelectItem value="cold_call">Outbound / Cold Call</SelectItem>
                  <SelectItem value="trade_show">Trade Show</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="value">Estimated Value ($)</Label>
            <Input
              id="value"
              type="number"
              step="any"
              placeholder="5000"
              onChange={(e) =>
                setValue("value", e.target.value === "" ? undefined : Number(e.target.value))
              }
            />
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
              Create Lead
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
