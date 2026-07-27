import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, isValid } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format currency in Indian Rupees (INR)
export function formatCurrency(
  value: number | string | null | undefined,
  currency = "INR"
): string {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatDate(
  date: Date | string | null | undefined,
  fmt = "MMM d, yyyy"
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (!isValid(d)) return "—";
  return format(d, fmt);
}

export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (!isValid(d)) return "—";
  return formatDistanceToNow(d, { addSuffix: true });
}

// Generate sequential number strings: QT-0001, SO-0042, WO-0100, etc.
export function generateNumber(prefix: string, seq: number): string {
  return `${prefix}-${String(seq).padStart(4, "0")}`;
}

// Convert Prisma Decimal/BigInt to plain numbers for JSON serialization
export function serializeDecimal(value: unknown): number {
  if (value === null || value === undefined) return 0;
  return parseFloat(String(value));
}

// Serialize a Prisma result that may contain Decimal/BigInt fields
export function serializePrismaResult<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) => {
      if (typeof value === "bigint") return value.toString();
      // Prisma Decimal objects have a toFixed method
      if (value && typeof value === "object" && typeof (value as { toFixed?: unknown }).toFixed === "function") {
        return parseFloat((value as { toFixed: (n: number) => string }).toFixed(10));
      }
      return value;
    })
  );
}

// Truncate long text
export function truncate(str: string | null | undefined, maxLength: number): string {
  if (!str) return "";
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "…";
}

// Get initials from a name
export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// Stage color to inline style — used for pipeline badges
export function stageColorToStyle(hex: string) {
  return {
    backgroundColor: hex + "20", // ~12% opacity background
    color: hex,
    borderColor: hex + "40",     // ~25% opacity border
  };
}
