"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CustomFieldDefinition } from "@prisma/client";

interface CustomFieldInputProps {
  definition: CustomFieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
}

export function CustomFieldInput({
  definition,
  value,
  onChange,
  error,
}: CustomFieldInputProps) {
  const { fieldName, fieldLabel, fieldType, options, isRequired } = definition;
  const parsedOptions = Array.isArray(options) ? (options as string[]) : [];

  return (
    <div className="space-y-1.5">
      <Label htmlFor={`custom-${fieldName}`} className="flex items-center gap-1">
        {fieldLabel}
        {isRequired && <span className="text-destructive">*</span>}
      </Label>

      {fieldType === "text" && (
        <Input
          id={`custom-${fieldName}`}
          type="text"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${fieldLabel.toLowerCase()}`}
        />
      )}

      {fieldType === "number" && (
        <Input
          id={`custom-${fieldName}`}
          type="number"
          step="any"
          value={(value as number | string) ?? ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
          placeholder="0.00"
        />
      )}

      {fieldType === "date" && (
        <Input
          id={`custom-${fieldName}`}
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {fieldType === "boolean" && (
        <div className="flex items-center gap-2 pt-1">
          <Checkbox
            id={`custom-${fieldName}`}
            checked={Boolean(value)}
            onCheckedChange={(checked) => onChange(Boolean(checked))}
          />
          <label
            htmlFor={`custom-${fieldName}`}
            className="text-xs text-muted-foreground cursor-pointer select-none"
          >
            Yes / Enabled
          </label>
        </div>
      )}

      {fieldType === "select" && (
        <Select
          value={(value as string) ?? ""}
          onValueChange={(val) => onChange(val)}
        >
          <SelectTrigger id={`custom-${fieldName}`}>
            <SelectValue placeholder={`Select ${fieldLabel.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {parsedOptions.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
