"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { addBomComponentAction, deleteBomComponentAction } from "../actions";
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
import type { Product } from "@/lib/prisma-types";

interface BomFormProps {
  tenantId: string;
  productId: string;
  availableProducts: Product[];
}

export function BomForm({
  tenantId,
  productId,
  availableProducts,
}: BomFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [componentProductId, setComponentProductId] = useState("");
  const [quantityRequired, setQuantityRequired] = useState(1);
  const [notes, setNotes] = useState("");

  const validComponents = availableProducts.filter((p) => p.id !== productId);

  async function handleAdd() {
    if (!componentProductId) {
      toast.error("Please select a raw material or component");
      return;
    }
    if (quantityRequired <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }

    setLoading(true);
    try {
      const res = await addBomComponentAction(
        tenantId,
        productId,
        componentProductId,
        quantityRequired,
        notes
      );

      if ("error" in res && res.error) {
        toast.error(res.error);
      } else {
        toast.success("BOM component added");
        setOpen(false);
        setComponentProductId("");
        setQuantityRequired(1);
        setNotes("");
      }
    } catch {
      toast.error("Failed to add component");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center justify-center gap-1.5 text-xs font-medium h-8 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer">
        <Plus className="w-4 h-4" />
        Add BOM Component
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Raw Material to Assembly</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="component">Component / Raw Material</Label>
            <Select onValueChange={(val) => setComponentProductId(val as string)}>
              <SelectTrigger id="component">
                <SelectValue placeholder="Select raw material or component" />
              </SelectTrigger>
              <SelectContent>
                {validComponents.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.sku}) — {p.unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qty">Quantity Required per Assembly Unit</Label>
            <Input
              id="qty"
              type="number"
              step="any"
              value={quantityRequired}
              onChange={(e) => setQuantityRequired(Number(e.target.value))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes / Cutting Specs</Label>
            <Input
              id="notes"
              placeholder="e.g. Cut length: 120mm, deburr edges"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add to BOM
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteBomButtonProps {
  tenantId: string;
  bomLineId: string;
  productId: string;
}

export function DeleteBomButton({ tenantId, bomLineId, productId }: DeleteBomButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Remove this raw material from the Bill of Materials?")) return;
    setLoading(true);
    try {
      const res = await deleteBomComponentAction(tenantId, bomLineId, productId);
      if ("error" in res && res.error) {
        toast.error(res.error);
      } else {
        toast.success("Component removed from BOM");
      }
    } catch {
      toast.error("Failed to remove component");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 text-muted-foreground hover:text-destructive"
      onClick={handleDelete}
      disabled={loading}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
    </Button>
  );
}
