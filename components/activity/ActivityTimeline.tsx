"use client";

import { useState } from "react";
import { toast } from "sonner";
import { formatRelativeTime } from "@/lib/utils";
import { createActivityAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Phone,
  Mail,
  FileText,
  Calendar,
  GitCommitHorizontal,
  Plus,
  Loader2,
} from "lucide-react";
import type { Activity } from "@prisma/client";

interface ActivityTimelineProps {
  tenantId: string;
  entityType: string;
  entityId: string;
  initialActivities: Activity[];
}

export function ActivityTimeline({
  tenantId,
  entityType,
  entityId,
  initialActivities,
}: ActivityTimelineProps) {
  const [activities, setActivities] = useState<Activity[]>(initialActivities);
  const [isAdding, setIsAdding] = useState(false);
  const [type, setType] = useState<"call" | "email" | "note" | "meeting">("note");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAdd() {
    if (!title.trim()) {
      toast.error("Please enter a title for the activity");
      return;
    }

    setLoading(true);
    try {
      const res = await createActivityAction(tenantId, {
        entityType,
        entityId,
        type,
        title,
        description,
      });

      if ("error" in res && res.error) {
        toast.error(res.error);
      } else {
        toast.success("Activity logged");
        // Optimistically prepend to timeline
        const newAct: Activity = {
          id: String(Date.now()),
          tenantId,
          entityType,
          entityId,
          type,
          title,
          description: description || null,
          userId: "current",
          createdAt: new Date(),
        };
        setActivities([newAct, ...activities]);
        setTitle("");
        setDescription("");
        setIsAdding(false);
      }
    } catch {
      toast.error("Failed to log activity");
    } finally {
      setLoading(false);
    }
  }

  const icons = {
    call: Phone,
    email: Mail,
    note: FileText,
    meeting: Calendar,
    status_change: GitCommitHorizontal,
  };

  const colors = {
    call: "#6366f1",
    email: "#0ea5e9",
    note: "#f59e0b",
    meeting: "#8b5cf6",
    status_change: "#10b981",
  };

  return (
    <div className="space-y-4">
      {/* Header + Add button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Activity Feed ({activities.length})</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsAdding(!isAdding)}
          className="text-xs h-7 gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Log Activity
        </Button>
      </div>

      {/* Add activity form */}
      {isAdding && (
        <div className="bg-muted/40 border border-border rounded-xl p-3.5 space-y-3">
          <div className="flex items-center gap-1.5">
            {(["note", "call", "email", "meeting"] as const).map((t) => {
              const Icon = icons[t];
              const active = type === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border transition-colors capitalize ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {t}
                </button>
              );
            })}
          </div>

          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (e.g. Discussed alloy pricing)"
            className="text-xs h-8"
          />

          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Details or meeting notes..."
            className="text-xs min-h-[60px]"
          />

          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsAdding(false)}
              className="text-xs h-7"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={loading}
              className="text-xs h-7"
            >
              {loading && <Loader2 className="w-3 h-3 animate-spin mr-1" />} Save
            </Button>
          </div>
        </div>
      )}

      {/* Activity Timeline List */}
      {activities.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          No activities logged yet. Click &quot;Log Activity&quot; above.
        </p>
      ) : (
        <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
          {activities.map((act) => {
            const actType = (act.type as keyof typeof icons) || "note";
            const Icon = icons[actType] || FileText;
            const color = colors[actType] || "#6b7280";

            return (
              <div key={act.id} className="relative group">
                {/* Timeline dot */}
                <div
                  className="absolute -left-6 top-0.5 w-5 h-5 rounded-full border-2 border-background flex items-center justify-center shadow-xs"
                  style={{ backgroundColor: color }}
                >
                  <Icon className="w-2.5 h-2.5 text-white" />
                </div>

                <div className="bg-card border border-border rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold leading-tight">{act.title}</p>
                    <span className="text-[10px] text-muted-foreground">
                      {formatRelativeTime(act.createdAt)}
                    </span>
                  </div>
                  {act.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {act.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
