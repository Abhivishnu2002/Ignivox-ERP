import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { CustomFieldDefinition } from "@prisma/client";

interface CustomFieldRendererProps {
  definition: CustomFieldDefinition;
  value: unknown;
}

export function CustomFieldRenderer({
  definition,
  value,
}: CustomFieldRendererProps) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground/50 text-xs">—</span>;
  }

  const { fieldType } = definition;

  if (fieldType === "boolean") {
    return (
      <Badge
        variant="outline"
        className={value ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-muted text-muted-foreground"}
      >
        {value ? "Yes" : "No"}
      </Badge>
    );
  }

  if (fieldType === "date") {
    return <span className="text-xs">{formatDate(value as string)}</span>;
  }

  if (fieldType === "select") {
    return (
      <Badge variant="secondary" className="font-normal text-xs">
        {String(value)}
      </Badge>
    );
  }

  if (fieldType === "number") {
    return <span className="tabular-nums text-xs">{Number(value).toLocaleString()}</span>;
  }

  return <span className="text-xs">{String(value)}</span>;
}
