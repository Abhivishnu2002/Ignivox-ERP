/**
 * Prisma v7 model type re-exports.
 *
 * Prisma v7 no longer re-exports model types from "@prisma/client" at runtime.
 * Instead we derive them from the PrismaClient instance so they stay in sync
 * with the generated schema automatically.
 *
 * Usage:
 *   import type { Contact, Company, Lead } from "@/lib/prisma-types";
 */
import type { prisma } from "@/lib/db";

type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;
type Result<T extends (...args: never[]) => unknown> = NonNullable<
  UnwrapPromise<ReturnType<T>>
>;

// ── Auth ────────────────────────────────────────────────────────────────────
export type User = Result<typeof prisma.user.findFirst>;

// ── Tenant ───────────────────────────────────────────────────────────────────
export type Tenant = Result<typeof prisma.tenant.findFirst>;
export type TenantUser = Result<typeof prisma.tenantUser.findFirst>;
export type Role = Result<typeof prisma.role.findFirst>;

// ── Pipeline ─────────────────────────────────────────────────────────────────
export type PipelineStage = Result<typeof prisma.pipelineStage.findFirst>;

// ── Custom Fields ─────────────────────────────────────────────────────────────
export type CustomFieldDefinition = Result<
  typeof prisma.customFieldDefinition.findFirst
>;

// ── CRM ───────────────────────────────────────────────────────────────────────
export type Company = Result<typeof prisma.company.findFirst>;
export type Contact = Result<typeof prisma.contact.findFirst>;
export type Lead = Result<typeof prisma.lead.findFirst>;
export type Deal = Result<typeof prisma.deal.findFirst>;
export type Activity = Result<typeof prisma.activity.findFirst>;

// ── Manufacturing ─────────────────────────────────────────────────────────────
export type Product = Result<typeof prisma.product.findFirst>;
export type BillOfMaterials = Result<typeof prisma.billOfMaterials.findFirst>;
export type BomLine = Result<typeof prisma.bomLine.findFirst>;
export type WorkOrder = Result<typeof prisma.workOrder.findFirst>;
export type MaterialConsumption = Result<typeof prisma.materialConsumption.findFirst>;

// ── Inventory ─────────────────────────────────────────────────────────────────
export type InventoryItem = Result<typeof prisma.inventoryItem.findFirst>;
export type StockMovement = Result<typeof prisma.stockMovement.findFirst>;

// ── Sales & Invoicing ─────────────────────────────────────────────────────────
export type SalesOrder = Result<typeof prisma.salesOrder.findFirst>;
export type SalesOrderLine = Result<typeof prisma.salesOrderLine.findFirst>;
export type Invoice = Result<typeof prisma.invoice.findFirst>;
export type InvoiceLine = Result<typeof prisma.invoiceLine.findFirst>;

// ── Procurement ───────────────────────────────────────────────────────────────
export type PurchaseOrder = Result<typeof prisma.purchaseOrder.findFirst>;
export type PurchaseOrderLine = Result<
  typeof prisma.purchaseOrderLine.findFirst
>;
