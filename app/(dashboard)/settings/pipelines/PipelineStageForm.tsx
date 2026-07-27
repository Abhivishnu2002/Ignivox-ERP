"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { createPipelineStageAction } from "./actions";
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

const schema = z.object({
  pipelineType: z.enum(["lead", "deal", "work_order", "purchase_order"]),
  name: z.string().min(2, "Name required"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Hex color"),
  isWon: z.boolean(),
  isLost: z.boolean(),
});

type FormInput = z.infer<typeof schema>;

interface PipelineStageFormProps {
  tenantId: string;
  defaultPipelineType?: "lead" | "deal" | "work_order" | "purchase_order";
}

const PRESET_COLORS = [
  "#6366f1", // Indigo
  "#0ea5e9", // Sky
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#6b7280", // Gray
];

export function PipelineStageForm({
  tenantId,
  defaultPipelineType = "lead",
}: PipelineStageFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [color, setColor] = useState(PRESET_COLORS[0]);

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
      pipelineType: defaultPipelineType,
      color: PRESET_COLORS[0],
      isWon: false,
      isLost: false,
    },
  });

  const pipelineType = useWatch({ control, name: "pipelineType" });

  async function onSubmit(data: FormInput) {
    setLoading(true);
    try {
      const res = await createPipelineStageAction(tenantId, {
        ...data,
        color,
      });

      if ("error" in res && res.error) {
        toast.error(res.error);
      } else {
        toast.success("Pipeline stage created");
        setOpen(false);
        reset();
      }
    } catch {
      toast.error("Failed to create stage");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center justify-center gap-1.5 text-xs font-medium h-8 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer">
        <Plus className="w-4 h-4" />
        Add Stage
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Pipeline Stage</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="pipelineType">Pipeline Type</Label>
            <Select
              defaultValue={defaultPipelineType}
              onValueChange={(val) => setValue("pipelineType", val as FormInput["pipelineType"])}
            >
              <SelectTrigger id="pipelineType">
                <SelectValue placeholder="Select pipeline" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lead">Lead Pipeline</SelectItem>
                <SelectItem value="deal">Deal Pipeline</SelectItem>
                <SelectItem value="work_order">Work Order Pipeline</SelectItem>
                <SelectItem value="purchase_order">Purchase Order Pipeline</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name">Stage Name</Label>
            <Input id="name" placeholder="e.g. Qualification" {...register("name")} />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Color picker presets */}
          <div className="space-y-1.5">
            <Label>Stage Badge Color</Label>
            <div className="flex items-center gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setColor(c);
                    setValue("color", c);
                  }}
                  className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? "white" : "transparent",
                  }}
                />
              ))}
              <Input
                type="color"
                value={color}
                onChange={(e) => {
                  setColor(e.target.value);
                  setValue("color", e.target.value);
                }}
                className="w-8 h-8 p-0 border-0 cursor-pointer rounded-full overflow-hidden"
              />
            </div>
          </div>

          {/* Deal pipeline flags */}
          {pipelineType === "deal" && (
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isWon"
                  onCheckedChange={(checked) => setValue("isWon", Boolean(checked))}
                />
                <label htmlFor="isWon" className="text-xs text-muted-foreground cursor-pointer select-none">
                  Marks deal as <span className="font-semibold text-emerald-500">Won</span>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isLost"
                  onCheckedChange={(checked) => setValue("isLost", Boolean(checked))}
                />
                <label htmlFor="isLost" className="text-xs text-muted-foreground cursor-pointer select-none">
                  Marks deal as <span className="font-semibold text-rose-500">Lost</span>
                </label>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Stage
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
