"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Building2, CheckCircle2 } from "lucide-react";
import { createTenantAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  tenantName: z.string().min(2, "At least 2 characters"),
  tenantSlug: z
    .string()
    .min(2)
    .max(48)
    .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens"),
});

type Form = z.infer<typeof schema>;

export default function OnboardingPage() {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const tenantName = useWatch({ control, name: "tenantName", defaultValue: "" });

  // Auto-generate slug from name
  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 48);
    setValue("tenantSlug", slug);
  }

  async function onSubmit(data: Form) {
    setLoading(true);
    try {
      const result = await createTenantAction(data);
      if (result?.error) {
        toast.error(result.error);
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const modules = [
    { id: "crm", name: "CRM", desc: "Contacts, leads & deals" },
    { id: "sales", name: "Sales", desc: "Quotes & orders" },
    { id: "manufacturing", name: "Manufacturing", desc: "Work orders & BOMs" },
    { id: "inventory", name: "Inventory", desc: "Stock tracking" },
    { id: "procurement", name: "Procurement", desc: "Purchase orders" },
    { id: "invoicing", name: "Invoicing", desc: "Billing & invoices" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="w-5 h-5 text-primary" />
          <span className="text-sm font-medium text-primary">Setup your workspace</span>
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Create your organization</h2>
        <p className="text-sm text-muted-foreground mt-1">
          This takes 30 seconds. All modules are enabled by default — customize later.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="tenantName">Organization name</Label>
          <Input
            id="tenantName"
            placeholder="Precision Parts Mfg"
            {...register("tenantName", {
              onChange: handleNameChange,
            })}
          />
          {errors.tenantName && (
            <p className="text-xs text-destructive">{errors.tenantName.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tenantSlug">Workspace URL</Label>
          <div className="flex items-center gap-0">
            <span className="text-xs text-muted-foreground bg-muted border border-r-0 border-border rounded-l-md px-3 h-9 flex items-center">
              fabrix.app/
            </span>
            <Input
              id="tenantSlug"
              className="rounded-l-none"
              placeholder="precision-parts"
              {...register("tenantSlug")}
            />
          </div>
          {errors.tenantSlug && (
            <p className="text-xs text-destructive">{errors.tenantSlug.message}</p>
          )}
        </div>

        {/* Modules preview */}
        <div className="space-y-2">
          <Label>Modules included (all enabled)</Label>
          <div className="grid grid-cols-2 gap-2">
            {modules.map((mod) => (
              <div
                key={mod.id}
                className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 border border-border"
              >
                <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium">{mod.name}</p>
                  <p className="text-[10px] text-muted-foreground">{mod.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={loading || !tenantName}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Launch my workspace →
        </Button>
      </form>
    </div>
  );
}
