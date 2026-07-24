import { getServerSession } from "@/lib/auth";
import { prisma, tenantTransaction } from "@/lib/db";
import { redirect } from "next/navigation";
import { CustomFieldForm } from "./CustomFieldForm";
import { DeleteFieldButton } from "./DeleteFieldButton";
import { Badge } from "@/components/ui/badge";
import { SlidersHorizontal } from "lucide-react";

export default async function CustomFieldsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const membership = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id },
    include: { tenant: true },
  });

  if (!membership) redirect("/onboarding");

  const tenantId = membership.tenant.id;

  // Fetch all custom fields for tenant via tenantTransaction
  const customFields = await tenantTransaction(tenantId, async (tx) => {
    return tx.customFieldDefinition.findMany({
      where: { tenantId },
      orderBy: [{ entityType: "asc" }, { sortOrder: "asc" }],
    });
  });

  // Group by entityType
  const groupedFields = customFields.reduce((acc, field) => {
    if (!acc[field.entityType]) acc[field.entityType] = [];
    acc[field.entityType].push(field);
    return acc;
  }, {} as Record<string, typeof customFields>);

  const entityNames: Record<string, string> = {
    Contact: "Contacts",
    Company: "Companies",
    Lead: "Leads",
    Deal: "Deals",
    Product: "Products",
    SalesOrder: "Sales Orders",
    WorkOrder: "Work Orders",
    Invoice: "Invoices",
    PurchaseOrder: "Purchase Orders",
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Custom Fields Engine</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Extend any entity in Fabrix with tenant-specific custom fields. Fields validate automatically in forms.
          </p>
        </div>
        <CustomFieldForm tenantId={tenantId} />
      </div>

      {/* Grouped field list */}
      {Object.keys(groupedFields).length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <p className="text-muted-foreground text-sm">No custom fields defined yet.</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Click &quot;Add Custom Field&quot; above to create your first field.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedFields).map(([entityType, fields]) => (
            <div key={entityType} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 bg-muted/30 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">{entityNames[entityType] || entityType}</h2>
                  <Badge variant="outline" className="text-[10px]">
                    {fields.length} {fields.length === 1 ? "field" : "fields"}
                  </Badge>
                </div>
              </div>
              <div className="divide-y divide-border">
                {fields.map((field) => {
                  const options = Array.isArray(field.options) ? (field.options as string[]) : [];
                  return (
                    <div
                      key={field.id}
                      className="px-5 py-3.5 flex items-center justify-between hover:bg-muted/20 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{field.fieldLabel}</span>
                          <span className="text-xs font-mono text-muted-foreground">
                            ({field.fieldName})
                          </span>
                          {field.isRequired && (
                            <Badge variant="destructive" className="text-[10px] py-0">
                              Required
                            </Badge>
                          )}
                        </div>
                        {options.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {options.map((opt) => (
                              <span
                                key={opt}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium"
                              >
                                {opt}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="text-xs capitalize">
                          {field.fieldType}
                        </Badge>
                        <DeleteFieldButton tenantId={tenantId} fieldId={field.id} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
