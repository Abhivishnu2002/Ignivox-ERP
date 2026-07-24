"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { createRoleAction } from "./actions";
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

const schema = z.object({
  name: z.string().min(2, "Role name required"),
  description: z.string().optional(),
});

type FormInput = z.infer<typeof schema>;

interface RoleFormProps {
  tenantId: string;
}

export function RoleForm({ tenantId }: RoleFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormInput) {
    setLoading(true);
    try {
      const res = await createRoleAction(tenantId, {
        ...data,
        permissions: {},
      });

      if ("error" in res && res.error) {
        toast.error(res.error);
      } else {
        toast.success("Role created — now set its permissions");
        setOpen(false);
        reset();
      }
    } catch {
      toast.error("Failed to create role");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center justify-center gap-1.5 text-xs font-medium h-8 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer">
        <Plus className="w-4 h-4" />
        Add Custom Role
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Custom Role</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Role Name</Label>
            <Input id="name" placeholder="e.g. Quality Inspector" {...register("name")} />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe what members with this role can access..."
              {...register("description")}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Role
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
