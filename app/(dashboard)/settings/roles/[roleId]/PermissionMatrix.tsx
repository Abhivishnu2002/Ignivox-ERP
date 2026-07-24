"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, CheckSquare, Square, Trash2 } from "lucide-react";
import { PERMISSION_GROUPS, ADMIN_PERMISSIONS } from "@/lib/permissions";
import { updateRolePermissionsAction, deleteRoleAction } from "../actions";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

interface PermissionMatrixProps {
  tenantId: string;
  roleId: string;
  roleName: string;
  isSystem: boolean;
  initialPermissions: Record<string, boolean>;
}

export function PermissionMatrix({
  tenantId,
  roleId,
  roleName,
  isSystem,
  initialPermissions,
}: PermissionMatrixProps) {
  const router = useRouter();
  const [permissions, setPermissions] = useState<Record<string, boolean>>(initialPermissions);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function togglePermission(permKey: string) {
    setPermissions((prev) => ({
      ...prev,
      [permKey]: !prev[permKey],
    }));
  }

  function selectAll() {
    setPermissions(ADMIN_PERMISSIONS);
  }

  function clearAll() {
    setPermissions({});
  }

  async function handleSave() {
    setLoading(true);
    try {
      const res = await updateRolePermissionsAction(tenantId, roleId, permissions);
      if ("error" in res && res.error) {
        toast.error(res.error);
      } else {
        toast.success("Permissions updated successfully");
      }
    } catch {
      toast.error("Failed to save permissions");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Are you sure you want to delete the role "${roleName}"?`)) return;

    setDeleting(true);
    try {
      const res = await deleteRoleAction(tenantId, roleId);
      if ("error" in res && res.error) {
        toast.error(res.error);
      } else {
        toast.success("Role deleted");
        router.push("/settings/roles");
      }
    } catch {
      toast.error("Failed to delete role");
    } finally {
      setDeleting(false);
    }
  }

  const enabledCount = Object.values(permissions).filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Top action toolbar */}
      <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-xs font-semibold">
            {enabledCount} active permissions
          </Badge>
          <div className="h-4 w-px bg-border" />
          <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs h-7">
            <CheckSquare className="w-3.5 h-3.5 mr-1" /> Select All
          </Button>
          <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs h-7">
            <Square className="w-3.5 h-3.5 mr-1" /> Clear All
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {!isSystem && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />}
              Delete Role
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Permissions
          </Button>
        </div>
      </div>

      {/* Permission groups table matrix */}
      <div className="space-y-6">
        {PERMISSION_GROUPS.map((group) => (
          <div key={group.id} className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 bg-muted/40 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">{group.label} Module</h2>
            </div>
            <div className="divide-y divide-border">
              {group.entities.map((entity) => (
                <div key={entity.id} className="px-5 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-muted/20 transition-colors">
                  <div className="w-44 flex-shrink-0">
                    <p className="text-sm font-medium">{entity.label}</p>
                  </div>
                  <div className="flex flex-wrap gap-4 flex-1">
                    {Object.entries(entity.permissions).map(([action, permKey]) => {
                      const key = permKey as string;
                      const isChecked = permissions[key] === true;
                      return (
                        <label
                          key={key}
                          className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none py-1 px-2.5 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => togglePermission(key)}
                          />
                          <span className={isChecked ? "text-foreground font-semibold" : "text-muted-foreground"}>
                            {action}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
