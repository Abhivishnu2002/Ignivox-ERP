"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Handshake } from "lucide-react";
import { convertLeadToDealAction } from "./actions";
import { useRouter } from "next/navigation";
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
import type { Lead, PipelineStage } from "@/lib/prisma-types";

interface ConvertLeadDialogProps {
  tenantId: string;
  lead: Lead;
  dealStages: PipelineStage[];
}

export function ConvertLeadDialog({
  tenantId,
  lead,
  dealStages,
}: ConvertLeadDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dealTitle, setDealTitle] = useState(lead.title);
  const [dealValue, setDealValue] = useState(Number(lead.value ?? 0));
  const [targetStageId, setTargetStageId] = useState(
    dealStages.find((s) => s.isDefault)?.id || dealStages[0]?.id || ""
  );

  async function handleConvert() {
    if (!dealTitle.trim()) {
      toast.error("Deal title required");
      return;
    }

    setLoading(true);
    try {
      const res = await convertLeadToDealAction(
        tenantId,
        lead.id,
        dealTitle,
        dealValue,
        targetStageId
      );

      if ("error" in res && res.error) {
        toast.error(res.error);
      } else {
        toast.success("Lead converted to Deal!");
        setOpen(false);
        if ("dealId" in res && res.dealId) {
          router.push(`/deals/${res.dealId}`);
        } else {
          router.push("/deals");
        }
      }
    } catch {
      toast.error("Failed to convert lead");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center justify-center gap-1 text-[11px] font-medium h-7 px-2.5 rounded-md bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors cursor-pointer">
        <Handshake className="w-3 h-3" />
        Convert to Deal
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Convert Lead to Deal</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <p className="text-xs text-muted-foreground">
            Converting <span className="font-semibold text-foreground">{lead.title}</span> into an active deal opportunity.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="dealTitle">Deal Title</Label>
            <Input
              id="dealTitle"
              value={dealTitle}
              onChange={(e) => setDealTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dealValue">Deal Value ($)</Label>
            <Input
              id="dealValue"
              type="number"
              value={dealValue}
              onChange={(e) => setDealValue(Number(e.target.value))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="targetStage">Deal Pipeline Stage</Label>
            <Select
              defaultValue={targetStageId}
              onValueChange={(val) => setTargetStageId(val as string)}
            >
              <SelectTrigger id="targetStage">
                <SelectValue placeholder="Select stage" />
              </SelectTrigger>
              <SelectContent>
                {dealStages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConvert} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Convert & Open Deal →
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
