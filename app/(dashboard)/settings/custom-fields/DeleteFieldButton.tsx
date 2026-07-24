"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";
import { deleteCustomFieldAction } from "./actions";
import { Button } from "@/components/ui/button";

interface DeleteFieldButtonProps {
  tenantId: string;
  fieldId: string;
}

export function DeleteFieldButton({ tenantId, fieldId }: DeleteFieldButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this custom field? Existing values on records will be preserved in JSONB but no longer shown in forms.")) {
      return;
    }

    setLoading(true);
    try {
      const res = await deleteCustomFieldAction(tenantId, fieldId);
      if ("error" in res && res.error) {
        toast.error(res.error);
      } else {
        toast.success("Custom field deleted");
      }
    } catch {
      toast.error("Failed to delete field");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-muted-foreground hover:text-destructive"
      onClick={handleDelete}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Trash2 className="w-3.5 h-3.5" />
      )}
    </Button>
  );
}
