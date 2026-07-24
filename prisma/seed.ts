/**
 * Fabrix Demo Seed Script
 *
 * Creates two demo tenants to validate Fabrix's customization engine generality:
 *
 *   1. "Precision Parts Mfg"  — make-to-order job-shop (metal fabrication & machined components)
 *   2. "Oakridge Furniture Co." — furniture manufacturing (sofas, tables; multi-level BOM, product variants)
 *
 * Both tenants run on the identical codebase and schema — vertical differences are handled
 * entirely through tenant-level configuration (custom fields, pipeline stages).
 * The only core schema addition for the furniture vertical is Product.parentProductId.
 *
 * Run with: pnpm db:seed
 */

import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { hashPassword } from "better-auth/crypto";
import { ADMIN_PERMISSIONS } from "../lib/permissions";

const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ============================================================
// CLEANUP HELPER
// Several FKs in the schema are RESTRICT (not CASCADE), which means
// Tenant.delete() will fail if child records exist. We must delete
// leaf-level records in dependency order first.
//
// Order of deletions:
//   1. StockMovement (RESTRICT → InventoryItem)
//   2. BomLine (RESTRICT → Product)
//   3. MaterialConsumption (CASCADE → WorkOrder, but delete explicitly)
//   ...then Tenant cascade handles the rest.
// ============================================================
async function cleanupTenant(slug: string) {
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) return;

  const tid = tenant.id;

  // 1. StockMovement (RESTRICT → InventoryItem)
  const inventoryItems = await prisma.inventoryItem.findMany({
    where: { tenantId: tid },
    select: { id: true },
  });
  if (inventoryItems.length > 0) {
    await prisma.stockMovement.deleteMany({
      where: { inventoryItemId: { in: inventoryItems.map((i) => i.id) } },
    });
  }

  // 2. BomLine (RESTRICT → Product via productId)
  const boms = await prisma.billOfMaterials.findMany({
    where: { tenantId: tid },
    select: { id: true },
  });
  if (boms.length > 0) {
    await prisma.bomLine.deleteMany({
      where: { bomId: { in: boms.map((b) => b.id) } },
    });
  }

  // 3. Now the Tenant cascade can handle the rest
  await prisma.tenant.delete({ where: { id: tid } });
}

async function main() {
  console.log("🌱 Starting Fabrix seed...\n");

  // ============================================================
  // 1. Clean up any existing demo data
  // ============================================================
  const existingTenant = await prisma.tenant.findUnique({
    where: { slug: "precision-parts" },
  });
  if (existingTenant) {
    console.log("🗑  Found existing demo tenant — cleaning up...");
    await cleanupTenant("precision-parts");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: "admin@precisionparts.demo" },
  });
  if (existingUser) {
    await prisma.user.delete({ where: { id: existingUser.id } });
  }


  // ============================================================
  // 2. Create admin user
  // ============================================================
  console.log("👤 Creating admin user...");
  // Better Auth handles password hashing — for seed we use a pre-hashed password (demo1234).

  // We'll store password in the Account model as Better Auth expects
  const adminUser = await prisma.user.create({
    data: {
      name: "Alex Chen",
      email: "admin@precisionparts.demo",
      emailVerified: true,
    },
  });

  // Create account record with hashed password for Better Auth (demo1234)
  const hashedPassword = await hashPassword("demo1234");
  await prisma.account.create({
    data: {
      userId: adminUser.id,
      accountId: adminUser.id,
      providerId: "credential",
      password: hashedPassword,
    },
  });

  // ============================================================
  // 3. Create tenant
  // ============================================================
  console.log("🏢 Creating tenant: Precision Parts Mfg...");
  const tenant = await prisma.tenant.create({
    data: {
      name: "Precision Parts Mfg",
      slug: "precision-parts",
      enabledModules: [
        "crm",
        "sales",
        "manufacturing",
        "inventory",
        "procurement",
        "invoicing",
      ],
      plan: "pro",
      settings: {
        currency: "USD",
        invoicePrefix: "INV",
        quotePrefix: "QT",
        salesOrderPrefix: "SO",
        workOrderPrefix: "WO",
        purchaseOrderPrefix: "PO",
      },
    },
  });

  // ============================================================
  // 4. Create roles
  // ============================================================
  console.log("🔐 Creating roles...");
  const adminRole = await prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: "Admin",
      description: "Full access to all modules",
      isSystem: true,
      permissions: ADMIN_PERMISSIONS,
    },
  });

  const readOnlyPermissions = Object.fromEntries(
    Object.entries(ADMIN_PERMISSIONS).filter(([key]) => key.endsWith(".read"))
  );

  await prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: "Member",
      description: "Read-only access to all modules",
      isSystem: true,
      permissions: readOnlyPermissions,
    },
  });

  await prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: "Production Lead",
      description: "Full manufacturing + inventory access, read-only CRM",
      isSystem: false,
      permissions: {
        ...readOnlyPermissions,
        "manufacturing.products.create": true,
        "manufacturing.products.update": true,
        "manufacturing.boms.create": true,
        "manufacturing.boms.update": true,
        "manufacturing.workOrders.create": true,
        "manufacturing.workOrders.update": true,
        "inventory.items.update": true,
        "inventory.movements.create": true,
      },
    },
  });

  // ============================================================
  // 5. Link admin user to tenant
  // ============================================================
  await prisma.tenantUser.create({
    data: {
      tenantId: tenant.id,
      userId: adminUser.id,
      roleId: adminRole.id,
      isOwner: true,
    },
  });

  // ============================================================
  // 6. Pipeline stages
  // ============================================================
  console.log("📊 Creating pipeline stages...");
  const leadStages = await Promise.all([
    prisma.pipelineStage.create({ data: { tenantId: tenant.id, pipelineType: "lead", name: "New Inquiry", color: "#6366f1", sortOrder: 0, isDefault: true } }),
    prisma.pipelineStage.create({ data: { tenantId: tenant.id, pipelineType: "lead", name: "Contacted", color: "#0ea5e9", sortOrder: 1 } }),
    prisma.pipelineStage.create({ data: { tenantId: tenant.id, pipelineType: "lead", name: "Qualified", color: "#f59e0b", sortOrder: 2 } }),
    prisma.pipelineStage.create({ data: { tenantId: tenant.id, pipelineType: "lead", name: "Proposal Sent", color: "#8b5cf6", sortOrder: 3 } }),
    prisma.pipelineStage.create({ data: { tenantId: tenant.id, pipelineType: "lead", name: "Converted", color: "#10b981", sortOrder: 4 } }),
    prisma.pipelineStage.create({ data: { tenantId: tenant.id, pipelineType: "lead", name: "Lost", color: "#ef4444", sortOrder: 5 } }),
  ]);

  const dealStages = await Promise.all([
    prisma.pipelineStage.create({ data: { tenantId: tenant.id, pipelineType: "deal", name: "Discovery", color: "#6366f1", sortOrder: 0, isDefault: true } }),
    prisma.pipelineStage.create({ data: { tenantId: tenant.id, pipelineType: "deal", name: "Quote Sent", color: "#0ea5e9", sortOrder: 1 } }),
    prisma.pipelineStage.create({ data: { tenantId: tenant.id, pipelineType: "deal", name: "Negotiation", color: "#f59e0b", sortOrder: 2 } }),
    prisma.pipelineStage.create({ data: { tenantId: tenant.id, pipelineType: "deal", name: "Won", color: "#10b981", sortOrder: 3, isWon: true } }),
    prisma.pipelineStage.create({ data: { tenantId: tenant.id, pipelineType: "deal", name: "Lost", color: "#ef4444", sortOrder: 4, isLost: true } }),
  ]);

  const woStages = await Promise.all([
    prisma.pipelineStage.create({ data: { tenantId: tenant.id, pipelineType: "work_order", name: "Planned", color: "#6366f1", sortOrder: 0, isDefault: true } }),
    prisma.pipelineStage.create({ data: { tenantId: tenant.id, pipelineType: "work_order", name: "In Production", color: "#f59e0b", sortOrder: 1 } }),
    prisma.pipelineStage.create({ data: { tenantId: tenant.id, pipelineType: "work_order", name: "QC Check", color: "#8b5cf6", sortOrder: 2 } }),
    prisma.pipelineStage.create({ data: { tenantId: tenant.id, pipelineType: "work_order", name: "Completed", color: "#10b981", sortOrder: 3 } }),
    prisma.pipelineStage.create({ data: { tenantId: tenant.id, pipelineType: "work_order", name: "On Hold", color: "#6b7280", sortOrder: 4 } }),
  ]);

  // ============================================================
  // 7. Custom field definitions
  // ============================================================
  console.log("🔧 Creating custom field definitions...");
  await prisma.customFieldDefinition.createMany({
    data: [
      // Contact custom fields
      {
        tenantId: tenant.id,
        entityType: "Contact",
        fieldName: "preferred_material",
        fieldLabel: "Preferred Material",
        fieldType: "select",
        options: ["Steel", "Aluminum", "Titanium", "Brass", "Stainless Steel", "Other"],
        sortOrder: 0,
      },
      {
        tenantId: tenant.id,
        entityType: "Contact",
        fieldName: "engineering_contact",
        fieldLabel: "Engineering Contact",
        fieldType: "boolean",
        sortOrder: 1,
      },
      // Deal custom fields
      {
        tenantId: tenant.id,
        entityType: "Deal",
        fieldName: "rfq_number",
        fieldLabel: "Customer RFQ #",
        fieldType: "text",
        sortOrder: 0,
      },
      {
        tenantId: tenant.id,
        entityType: "Deal",
        fieldName: "material_type",
        fieldLabel: "Primary Material",
        fieldType: "select",
        options: ["Steel", "Aluminum", "Titanium", "Brass", "Stainless Steel", "Composite", "Other"],
        sortOrder: 1,
      },
      // Product custom fields
      {
        tenantId: tenant.id,
        entityType: "Product",
        fieldName: "material_grade",
        fieldLabel: "Material Grade",
        fieldType: "text",
        sortOrder: 0,
      },
      {
        tenantId: tenant.id,
        entityType: "Product",
        fieldName: "requires_certification",
        fieldLabel: "Requires Certification",
        fieldType: "boolean",
        sortOrder: 1,
      },
      {
        tenantId: tenant.id,
        entityType: "Product",
        fieldName: "surface_finish",
        fieldLabel: "Surface Finish",
        fieldType: "select",
        options: ["Raw", "Anodized", "Powder Coated", "Chrome Plated", "Nickel Plated", "Painted"],
        sortOrder: 2,
      },
    ],
  });

  // ============================================================
  // 8. Companies (customers + suppliers)
  // ============================================================
  console.log("🏭 Creating companies...");
  const aeroTech = await prisma.company.create({
    data: {
      tenantId: tenant.id,
      name: "Tata AutoComp Systems Ltd",
      industry: "Automotive & Aerospace",
      website: "https://tataautocomp.co.in",
      phone: "+91-20-6608-1000",
      address: "Chakan Industrial Area, MIDC Phase 2, Pune, Maharashtra 410501",
      type: "customer",
      customFields: {},
    },
  });

  const mediconDevice = await prisma.company.create({
    data: {
      tenantId: tenant.id,
      name: "Mahindra Precision Engineering",
      industry: "Industrial & Tooling",
      website: "https://mahindra-precision.co.in",
      phone: "+91-80-2839-4000",
      address: "Peenya Industrial Area, Phase 3, Bengaluru, Karnataka 560058",
      type: "customer",
      customFields: {},
    },
  });

  const steelworksSupply = await prisma.company.create({
    data: {
      tenantId: tenant.id,
      name: "Jindal Steel & Alloys Ltd",
      industry: "Raw Materials & Metals",
      website: "https://jindalsteel.co.in",
      phone: "+91-1662-222401",
      address: "O.P. Jindal Marg, Hisar Industrial Complex, Haryana 125005",
      type: "supplier",
      customFields: {},
    },
  });

  const aluminumDirect = await prisma.company.create({
    data: {
      tenantId: tenant.id,
      name: "Hindalco Aluminum Extrusions",
      industry: "Raw Materials & Metals",
      phone: "+91-22-6691-7000",
      address: "GIDC Industrial Estate, Sanand, Ahmedabad, Gujarat 382110",
      type: "supplier",
      customFields: {},
    },
  });

  // ============================================================
  // 9. Contacts
  // ============================================================
  console.log("👥 Creating contacts...");
  const sarah = await prisma.contact.create({
    data: {
      tenantId: tenant.id,
      companyId: aeroTech.id,
      firstName: "Rajesh",
      lastName: "Sharma",
      email: "rajesh.sharma@tataautocomp.co.in",
      phone: "+91-98200-12345",
      title: "VP of Supply Chain",
      customFields: {
        preferred_material: "Titanium",
        engineering_contact: false,
      },
    },
  });

  const marcus = await prisma.contact.create({
    data: {
      tenantId: tenant.id,
      companyId: aeroTech.id,
      firstName: "Vikram",
      lastName: "Malhotra",
      email: "vikram.malhotra@tataautocomp.co.in",
      phone: "+91-98200-54321",
      title: "Senior Mechanical Engineer",
      customFields: {
        preferred_material: "Titanium",
        engineering_contact: true,
      },
    },
  });

  const priya = await prisma.contact.create({
    data: {
      tenantId: tenant.id,
      companyId: mediconDevice.id,
      firstName: "Priya",
      lastName: "Patel",
      email: "priya.patel@mahindra-precision.co.in",
      phone: "+91-98450-67890",
      title: "Director of Tooling Operations",
      customFields: {
        preferred_material: "Stainless Steel",
        engineering_contact: true,
      },
    },
  });

  // ============================================================
  // 10. Products (raw materials + finished goods)
  // ============================================================
  console.log("📦 Creating products...");

  // Raw materials
  const steelBar = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      sku: "RM-STEEL-001",
      name: "Steel Round Bar 1\" dia",
      description: "Cold-drawn 1018 steel round bar, 1\" diameter",
      type: "raw_material",
      unitPrice: new Prisma.Decimal(8.50),
      unit: "m",
      customFields: { material_grade: "1018 CRS", requires_certification: false, surface_finish: "Raw" },
    },
  });

  const aluminumSheet = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      sku: "RM-AL-001",
      name: "Aluminum Sheet 6061-T6 1/4\"",
      description: "6061-T6 aluminum sheet, 1/4\" (6.35mm) thick",
      type: "raw_material",
      unitPrice: new Prisma.Decimal(42.00),
      unit: "m²",
      customFields: { material_grade: "6061-T6", requires_certification: false, surface_finish: "Raw" },
    },
  });

  const titaniumBar = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      sku: "RM-TI-001",
      name: "Titanium Round Bar Grade 5",
      description: "Ti-6Al-4V titanium round bar, 0.75\" diameter",
      type: "raw_material",
      unitPrice: new Prisma.Decimal(185.00),
      unit: "m",
      customFields: { material_grade: "Ti-6Al-4V (Grade 5)", requires_certification: true, surface_finish: "Raw" },
    },
  });

  const hexScrewM6 = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      sku: "RM-SCREW-M6",
      name: "M6 x 20mm Hex Socket Screws (box/100)",
      type: "raw_material",
      unitPrice: new Prisma.Decimal(12.00),
      unit: "box",
      customFields: { material_grade: "Grade 8.8 Steel", requires_certification: false, surface_finish: "Zinc Plated" },
    },
  });

  // Finished goods
  const customBracket = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      sku: "FG-BRACKET-001",
      name: "Precision Mounting Bracket AL-6061",
      description: "CNC-machined aluminum mounting bracket, anodized finish. Fits standard 80/20 extrusions.",
      type: "finished_good",
      unitPrice: new Prisma.Decimal(320.00),
      unit: "pcs",
      customFields: { material_grade: "6061-T6", requires_certification: false, surface_finish: "Anodized" },
    },
  });

  const precisionShaft = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      sku: "FG-SHAFT-001",
      name: "Precision Drive Shaft 1018 Steel",
      description: "CNC-turned drive shaft, ground finish, 0.75\" dia × 12\" long",
      type: "finished_good",
      unitPrice: new Prisma.Decimal(185.00),
      unit: "pcs",
      customFields: { material_grade: "1018 CRS", requires_certification: false, surface_finish: "Chrome Plated" },
    },
  });

  const aeroFitting = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      sku: "FG-FITTING-TI-001",
      name: "Titanium Hydraulic Fitting Grade 5",
      description: "CNC-machined titanium AN-6 hydraulic fitting for aerospace applications",
      type: "finished_good",
      unitPrice: new Prisma.Decimal(1250.00),
      unit: "pcs",
      customFields: { material_grade: "Ti-6Al-4V (Grade 5)", requires_certification: true, surface_finish: "Raw" },
    },
  });

  // ============================================================
  // 11. Bills of Materials
  // ============================================================
  console.log("📋 Creating bills of materials...");

  const bracketBOM = await prisma.billOfMaterials.create({
    data: {
      tenantId: tenant.id,
      productId: customBracket.id,
      name: "Precision Mounting Bracket — Standard BOM",
      version: "1.2",
      isActive: true,
    },
  });
  await prisma.bomLine.createMany({
    data: [
      { bomId: bracketBOM.id, productId: aluminumSheet.id, quantity: new Prisma.Decimal(0.15), notes: "Approx 0.15 m² sheet per bracket (with waste factor)" },
      { bomId: bracketBOM.id, productId: hexScrewM6.id, quantity: new Prisma.Decimal(0.04), notes: "4 screws per bracket (0.04 of a box/100)" },
    ],
  });

  const shaftBOM = await prisma.billOfMaterials.create({
    data: {
      tenantId: tenant.id,
      productId: precisionShaft.id,
      name: "Precision Drive Shaft — Standard BOM",
      version: "2.0",
      isActive: true,
    },
  });
  await prisma.bomLine.createMany({
    data: [
      { bomId: shaftBOM.id, productId: steelBar.id, quantity: new Prisma.Decimal(0.35), notes: "0.35m of 1\" steel bar per shaft" },
    ],
  });

  const fittingBOM = await prisma.billOfMaterials.create({
    data: {
      tenantId: tenant.id,
      productId: aeroFitting.id,
      name: "Titanium Hydraulic Fitting — Aerospace BOM",
      version: "1.0",
      isActive: true,
    },
  });
  await prisma.bomLine.createMany({
    data: [
      { bomId: fittingBOM.id, productId: titaniumBar.id, quantity: new Prisma.Decimal(0.08), notes: "0.08m Ti bar per fitting" },
    ],
  });

  // ============================================================
  // 12. Inventory (initial stock)
  // ============================================================
  console.log("📦 Creating inventory records...");

  const inventoryData = [
    { productId: steelBar.id, quantity: 50, reorderLevel: 10, location: "Rack A-1" },
    { productId: aluminumSheet.id, quantity: 25, reorderLevel: 5, location: "Rack B-2" },
    { productId: titaniumBar.id, quantity: 8, reorderLevel: 3, location: "Secure Storage" },
    { productId: hexScrewM6.id, quantity: 15, reorderLevel: 3, location: "Hardware Bin H-7" },
    { productId: customBracket.id, quantity: 12, reorderLevel: 0, location: "Finished Goods" },
    { productId: precisionShaft.id, quantity: 5, reorderLevel: 0, location: "Finished Goods" },
    { productId: aeroFitting.id, quantity: 0, reorderLevel: 0, location: "Finished Goods" },
  ];

  for (const item of inventoryData) {
    await prisma.inventoryItem.create({
      data: {
        tenantId: tenant.id,
        productId: item.productId,
        quantity: new Prisma.Decimal(item.quantity),
        reorderLevel: item.reorderLevel ? new Prisma.Decimal(item.reorderLevel) : null,
        location: item.location,
      },
    });
  }

  // ============================================================
  // 13. CRM — Leads & Deals
  // ============================================================
  console.log("💼 Creating leads and deals...");

  const lead1 = await prisma.lead.create({
    data: {
      tenantId: tenant.id,
      contactId: sarah.id,
      companyId: aeroTech.id,
      title: "Hydraulic Fitting RFQ — 500 pcs",
      source: "referral",
      stageId: leadStages[3].id, // Proposal Sent
      value: new Prisma.Decimal(625000),
      customFields: {},
    },
  });

  // This lead is converted to a deal
  const deal1 = await prisma.deal.create({
    data: {
      tenantId: tenant.id,
      contactId: priya.id,
      companyId: mediconDevice.id,
      title: "Precision Brackets — Q2 Production Run",
      value: new Prisma.Decimal(48000),
      stageId: dealStages[3].id, // Won
      wonAt: new Date("2026-06-15"),
      customFields: {
        rfq_number: "MDC-2026-0147",
        material_type: "Aluminum",
      },
    },
  });

  const deal2 = await prisma.deal.create({
    data: {
      tenantId: tenant.id,
      contactId: marcus.id,
      companyId: aeroTech.id,
      title: "Titanium Hydraulic Fittings — Prototype Batch",
      value: new Prisma.Decimal(31250),
      stageId: dealStages[1].id, // Quote Sent
      expectedCloseDate: new Date("2026-08-31"),
      customFields: {
        rfq_number: "ATI-2026-0842",
        material_type: "Titanium",
      },
    },
  });

  const deal3 = await prisma.deal.create({
    data: {
      tenantId: tenant.id,
      contactId: sarah.id,
      companyId: aeroTech.id,
      title: "Drive Shaft Supply Agreement — 200 pcs/mo",
      value: new Prisma.Decimal(444000),
      stageId: dealStages[2].id, // Negotiation
      expectedCloseDate: new Date("2026-07-31"),
      customFields: {
        rfq_number: "ATI-2026-0619",
        material_type: "Steel",
      },
    },
  });

  // Activities for deals
  await prisma.activity.createMany({
    data: [
      {
        tenantId: tenant.id,
        entityType: "Deal",
        entityId: deal1.id,
        type: "note",
        title: "Won — Production order confirmed",
        description: "Medicon Device confirmed the Q2 production run. PO received, delivery deadline July 15.",
        userId: adminUser.id,
      },
      {
        tenantId: tenant.id,
        entityType: "Deal",
        entityId: deal2.id,
        type: "email",
        title: "Quote QT-0001 sent to Marcus Lee",
        description: "Sent detailed quote for titanium fittings with lead time of 8 weeks.",
        userId: adminUser.id,
      },
      {
        tenantId: tenant.id,
        entityType: "Deal",
        entityId: deal3.id,
        type: "meeting",
        title: "Contract review call with AeroTech",
        description: "30-min call with Sarah. Volume pricing agreed at $185/unit. Pending legal review.",
        userId: adminUser.id,
      },
    ],
  });

  // ============================================================
  // 14. Sales Order (from won deal)
  // ============================================================
  console.log("🛒 Creating sales orders...");

  const so1 = await prisma.salesOrder.create({
    data: {
      tenantId: tenant.id,
      dealId: deal1.id,
      orderNumber: "SO-0001",
      contactId: priya.id,
      companyId: mediconDevice.id,
      status: "in_production",
      totalAmount: new Prisma.Decimal(48000),
      orderDate: new Date("2026-06-20"),
      deliveryDate: new Date("2026-07-15"),
      notes: "Rush order — medical device production schedule. 150 units precision mounting brackets.",
    },
  });

  const soLine1 = await prisma.salesOrderLine.create({
    data: {
      salesOrderId: so1.id,
      productId: customBracket.id,
      description: "Precision Mounting Bracket AL-6061, anodized, per Medicon spec MDS-4471",
      quantity: new Prisma.Decimal(150),
      unitPrice: new Prisma.Decimal(320),
      totalPrice: new Prisma.Decimal(48000),
    },
  });

  // ============================================================
  // 15. Work Orders
  // ============================================================
  console.log("⚙️  Creating work orders...");

  const wo1 = await prisma.workOrder.create({
    data: {
      tenantId: tenant.id,
      salesOrderId: so1.id,
      salesOrderLineId: soLine1.id,
      bomId: bracketBOM.id,
      workOrderNumber: "WO-0001",
      stageId: woStages[1].id, // In Production
      quantityPlanned: new Prisma.Decimal(150),
      quantityProduced: new Prisma.Decimal(48),
      startDate: new Date("2026-06-25"),
      dueDate: new Date("2026-07-12"),
      notes: "Priority work order. Machine 3 assigned. CNC program AL-BRACKET-v12 approved.",
    },
  });

  // Record some material consumption
  const alInventory = await prisma.inventoryItem.findFirst({
    where: { tenantId: tenant.id, productId: aluminumSheet.id },
  });
  if (alInventory) {
    await prisma.materialConsumption.create({
      data: {
        workOrderId: wo1.id,
        productId: aluminumSheet.id,
        quantity: new Prisma.Decimal(7.2), // 48 units × 0.15 m²
        notes: "48 brackets completed — 7.2 m² sheet consumed",
      },
    });
    // Update inventory
    await prisma.inventoryItem.update({
      where: { id: alInventory.id },
      data: { quantity: { decrement: 7.2 } },
    });
    await prisma.stockMovement.create({
      data: {
        inventoryItemId: alInventory.id,
        type: "out",
        quantity: new Prisma.Decimal(7.2),
        reason: "work_order_consumption",
        referenceId: wo1.id,
        referenceType: "WorkOrder",
        notes: "WO-0001: 48 brackets completed",
      },
    });
  }

  // Activity for work order
  await prisma.activity.create({
    data: {
      tenantId: tenant.id,
      entityType: "WorkOrder",
      entityId: wo1.id,
      type: "status_change",
      title: "Started production — 48/150 complete",
      description: "Machine 3 operator logged 48 brackets completed. Material consumption recorded.",
      userId: adminUser.id,
    },
  });

  // Second work order — planned
  await prisma.workOrder.create({
    data: {
      tenantId: tenant.id,
      bomId: shaftBOM.id,
      workOrderNumber: "WO-0002",
      stageId: woStages[0].id, // Planned
      quantityPlanned: new Prisma.Decimal(25),
      startDate: new Date("2026-07-20"),
      dueDate: new Date("2026-07-28"),
      notes: "Scheduled for Machine 1 post-current run.",
    },
  });

  // ============================================================
  // 16. Purchase Order (restocking aluminum)
  // ============================================================
  console.log("🚚 Creating purchase orders...");

  const po1 = await prisma.purchaseOrder.create({
    data: {
      tenantId: tenant.id,
      poNumber: "PO-0001",
      supplierId: aluminumDirect.id,
      status: "sent",
      totalAmount: new Prisma.Decimal(2100),
      orderDate: new Date("2026-07-01"),
      expectedDate: new Date("2026-07-10"),
      notes: "Restock aluminum sheet — urgent due to WO-0001 consumption.",
    },
  });

  await prisma.purchaseOrderLine.create({
    data: {
      purchaseOrderId: po1.id,
      productId: aluminumSheet.id,
      quantity: new Prisma.Decimal(50),
      unitPrice: new Prisma.Decimal(42),
      totalPrice: new Prisma.Decimal(2100),
    },
  });

  // ============================================================
  // 17. Invoice (from SO-0001)
  // ============================================================
  console.log("🧾 Creating invoices...");

  await prisma.invoice.create({
    data: {
      tenantId: tenant.id,
      salesOrderId: so1.id,
      invoiceNumber: "INV-0001",
      contactId: priya.id,
      companyId: mediconDevice.id,
      status: "sent",
      subtotal: new Prisma.Decimal(48000),
      tax: new Prisma.Decimal(0),
      totalAmount: new Prisma.Decimal(48000),
      dueDate: new Date("2026-07-30"),
      notes: "Net 30. Wire transfer preferred.",
    },
  });

  // Create invoice lines
  const inv1 = await prisma.invoice.findFirst({
    where: { tenantId: tenant.id, invoiceNumber: "INV-0001" },
  });
  if (inv1) {
    await prisma.invoiceLine.create({
      data: {
        invoiceId: inv1.id,
        description: "Precision Mounting Bracket AL-6061 × 150 units (partial delivery: 48 complete, 102 in production)",
        quantity: new Prisma.Decimal(150),
        unitPrice: new Prisma.Decimal(320),
        totalPrice: new Prisma.Decimal(48000),
      },
    });
  }

  console.log("\n✅ Precision Parts seed complete!");
  console.log("━".repeat(50));
  console.log("Tenant:  Precision Parts Mfg (slug: precision-parts)");
  console.log("Login:   admin@precisionparts.demo / demo1234");
  console.log("━".repeat(50));
  console.log("  • 1 tenant, Admin/Member/Production Lead roles");
  console.log("  • 11 pipeline stages (lead / deal / work_order)");
  console.log("  • 3 custom field defs (Contact, Deal, Product)");
  console.log("  • 4 companies, 3 contacts");
  console.log("  • 7 products, 3 BOMs");
  console.log("  • 7 inventory items");
  console.log("  • 1 lead, 3 deals, 1 SO, 2 WOs, 1 PO, 1 invoice");

  // ============================================================
  // TENANT 2: Oakridge Furniture Co.
  // ============================================================
  await seedOakridgeFurniture();
}

// ============================================================
// OAKRIDGE FURNITURE CO. — Furniture Manufacturing Vertical
//
// Validates:
//   1. Product.parentProductId — variant support (sofa in 2 fabrics)
//   2. Product.unit free-text — board-ft, linear-m, sheet, kit
//   3. Nested BOM — sofa → frame sub-assembly → raw materials
//   4. Configurable pipeline stages — furniture-specific WO stages
//   5. Custom fields for warranty, fabric type, delivery scheduling
//   6. Tenant isolation — zero cross-tenant data leakage
// ============================================================
async function seedOakridgeFurniture() {
  console.log("\n🌱 Seeding Oakridge Furniture Co...\n");

  // ── Cleanup ────────────────────────────────────────────────
  const existingTenant = await prisma.tenant.findUnique({
    where: { slug: "oakridge-furniture" },
  });
  if (existingTenant) {
    console.log("🗑  Found existing Oakridge tenant — cleaning up...");
    await cleanupTenant("oakridge-furniture");
  }
  const existingUser = await prisma.user.findUnique({
    where: { email: "admin@oakridge.demo" },
  });
  if (existingUser) {
    await prisma.user.delete({ where: { id: existingUser.id } });
  }

  // ── Admin User ─────────────────────────────────────────────
  console.log("👤 Creating admin user: admin@oakridge.demo...");
  const adminUser = await prisma.user.create({
    data: {
      name: "Jordan Ellis",
      email: "admin@oakridge.demo",
      emailVerified: true,
    },
  });
  const hashedPassword = await hashPassword("demo1234");
  await prisma.account.create({
    data: {
      userId: adminUser.id,
      accountId: adminUser.id,
      providerId: "credential",
      password: hashedPassword,
    },
  });

  // ── Tenant ─────────────────────────────────────────────────
  console.log("🏢 Creating tenant: Oakridge Furniture Co....");
  const tenant = await prisma.tenant.create({
    data: {
      name: "Oakridge Furniture Co.",
      slug: "oakridge-furniture",
      enabledModules: ["crm", "sales", "manufacturing", "inventory", "procurement", "invoicing"],
      plan: "pro",
      settings: {
        currency: "USD",
        invoicePrefix: "OAK-INV",
        quotePrefix: "OAK-QT",
        salesOrderPrefix: "OAK-SO",
        workOrderPrefix: "OAK-WO",
        purchaseOrderPrefix: "OAK-PO",
      },
    },
  });

  // ── Roles ──────────────────────────────────────────────────
  console.log("🔐 Creating roles...");
  const adminRole = await prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: "Admin",
      description: "Full access to all modules",
      isSystem: true,
      permissions: ADMIN_PERMISSIONS,
    },
  });
  const readOnlyPermissions = Object.fromEntries(
    Object.entries(ADMIN_PERMISSIONS).filter(([key]) => key.endsWith(".read"))
  );
  await prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: "Member",
      description: "Read-only access to all modules",
      isSystem: true,
      permissions: readOnlyPermissions,
    },
  });
  await prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: "Shop Floor Lead",
      description: "Full manufacturing & inventory access, read-only CRM",
      isSystem: false,
      permissions: {
        ...readOnlyPermissions,
        "manufacturing.products.create": true,
        "manufacturing.products.update": true,
        "manufacturing.boms.create": true,
        "manufacturing.boms.update": true,
        "manufacturing.workOrders.create": true,
        "manufacturing.workOrders.update": true,
        "inventory.items.update": true,
        "inventory.movements.create": true,
      },
    },
  });
  await prisma.tenantUser.create({
    data: { tenantId: tenant.id, userId: adminUser.id, roleId: adminRole.id, isOwner: true },
  });

  // ── Pipeline Stages ────────────────────────────────────────
  // Furniture-specific stages validate that configurable pipelines are truly generic.
  // The WO pipeline reflects the actual furniture production flow:
  //   Planned → Frame Assembly → Upholstery → Finishing & QC → Packaging → Completed
  console.log("📊 Creating furniture pipeline stages...");

  const leadStages = await Promise.all([
    prisma.pipelineStage.create({ data: { tenantId: tenant.id, pipelineType: "lead", name: "New Inquiry", color: "#6366f1", sortOrder: 0, isDefault: true } }),
    prisma.pipelineStage.create({ data: { tenantId: tenant.id, pipelineType: "lead", name: "Showroom Visit", color: "#0ea5e9", sortOrder: 1 } }),
    prisma.pipelineStage.create({ data: { tenantId: tenant.id, pipelineType: "lead", name: "Design Consultation", color: "#f59e0b", sortOrder: 2 } }),
    prisma.pipelineStage.create({ data: { tenantId: tenant.id, pipelineType: "lead", name: "Quote Sent", color: "#8b5cf6", sortOrder: 3 } }),
    prisma.pipelineStage.create({ data: { tenantId: tenant.id, pipelineType: "lead", name: "Converted", color: "#10b981", sortOrder: 4 } }),
    prisma.pipelineStage.create({ data: { tenantId: tenant.id, pipelineType: "lead", name: "Lost", color: "#ef4444", sortOrder: 5 } }),
  ]);

  const dealStages = await Promise.all([
    prisma.pipelineStage.create({ data: { tenantId: tenant.id, pipelineType: "deal", name: "Design Brief", color: "#6366f1", sortOrder: 0, isDefault: true } }),
    prisma.pipelineStage.create({ data: { tenantId: tenant.id, pipelineType: "deal", name: "Quote Sent", color: "#0ea5e9", sortOrder: 1 } }),
    prisma.pipelineStage.create({ data: { tenantId: tenant.id, pipelineType: "deal", name: "Revision", color: "#f59e0b", sortOrder: 2 } }),
    prisma.pipelineStage.create({ data: { tenantId: tenant.id, pipelineType: "deal", name: "Approved", color: "#10b981", sortOrder: 3, isWon: true } }),
    prisma.pipelineStage.create({ data: { tenantId: tenant.id, pipelineType: "deal", name: "Lost", color: "#ef4444", sortOrder: 4, isLost: true } }),
  ]);

  // Furniture WO stages: more granular than job-shop, reflecting frame→upholstery→finishing flow.
  // "Delivery Scheduled" is an extra stage showing that furniture ships to customers.
  const woStages = await Promise.all([
    prisma.pipelineStage.create({ data: { tenantId: tenant.id, pipelineType: "work_order", name: "Planned", color: "#6366f1", sortOrder: 0, isDefault: true } }),
    prisma.pipelineStage.create({ data: { tenantId: tenant.id, pipelineType: "work_order", name: "Frame Assembly", color: "#f59e0b", sortOrder: 1 } }),
    prisma.pipelineStage.create({ data: { tenantId: tenant.id, pipelineType: "work_order", name: "Upholstery", color: "#8b5cf6", sortOrder: 2 } }),
    prisma.pipelineStage.create({ data: { tenantId: tenant.id, pipelineType: "work_order", name: "Finishing & QC", color: "#0ea5e9", sortOrder: 3 } }),
    prisma.pipelineStage.create({ data: { tenantId: tenant.id, pipelineType: "work_order", name: "Packaging", color: "#f97316", sortOrder: 4 } }),
    prisma.pipelineStage.create({ data: { tenantId: tenant.id, pipelineType: "work_order", name: "Completed", color: "#10b981", sortOrder: 5 } }),
    prisma.pipelineStage.create({ data: { tenantId: tenant.id, pipelineType: "work_order", name: "On Hold", color: "#6b7280", sortOrder: 6 } }),
  ]);

  // ── Custom Field Definitions ───────────────────────────────
  // All furniture-specific domain knowledge lives here — no new core tables.
  console.log("🔧 Creating furniture custom field definitions...");
  await prisma.customFieldDefinition.createMany({
    data: [
      // Product fields
      {
        tenantId: tenant.id,
        entityType: "Product",
        fieldName: "warranty_period",
        fieldLabel: "Warranty Period",
        fieldType: "text",
        sortOrder: 0,
      },
      {
        tenantId: tenant.id,
        entityType: "Product",
        fieldName: "fabric_type",
        fieldLabel: "Fabric Type",
        fieldType: "select",
        options: ["Linen", "Velvet", "Leather", "Cotton Blend", "Microfiber", "N/A"],
        sortOrder: 1,
      },
      {
        tenantId: tenant.id,
        entityType: "Product",
        fieldName: "wood_type",
        fieldLabel: "Wood Type",
        fieldType: "select",
        options: ["Oak", "Walnut", "Maple", "Pine", "Birch", "N/A"],
        sortOrder: 2,
      },
      // SalesOrder fields — delivery/installation scheduling via custom fields, not a logistics module
      {
        tenantId: tenant.id,
        entityType: "SalesOrder",
        fieldName: "delivery_date",
        fieldLabel: "Delivery Date",
        fieldType: "date",
        sortOrder: 0,
      },
      {
        tenantId: tenant.id,
        entityType: "SalesOrder",
        fieldName: "installation_required",
        fieldLabel: "Installation Required",
        fieldType: "boolean",
        sortOrder: 1,
      },
      {
        tenantId: tenant.id,
        entityType: "SalesOrder",
        fieldName: "delivery_notes",
        fieldLabel: "Delivery / Installation Notes",
        fieldType: "text",
        sortOrder: 2,
      },
      // Contact fields
      {
        tenantId: tenant.id,
        entityType: "Contact",
        fieldName: "preferred_style",
        fieldLabel: "Preferred Style",
        fieldType: "select",
        options: ["Modern", "Traditional", "Mid-Century", "Scandinavian", "Industrial", "Other"],
        sortOrder: 0,
      },
      // Deal fields
      {
        tenantId: tenant.id,
        entityType: "Deal",
        fieldName: "design_brief_ref",
        fieldLabel: "Design Brief Reference",
        fieldType: "text",
        sortOrder: 0,
      },
    ],
  });

  // ── Companies ──────────────────────────────────────────────
  console.log("🏭 Creating companies...");
  const luxeInteriors = await prisma.company.create({
    data: {
      tenantId: tenant.id,
      name: "Luxe Interiors Studio",
      industry: "Interior Design",
      website: "https://luxeinteriors.example.com",
      phone: "+1-555-1100",
      address: "88 Design District, Austin, TX 78701",
      type: "customer",
    },
  });
  const metroHotels = await prisma.company.create({
    data: {
      tenantId: tenant.id,
      name: "Metro Hotels Group",
      industry: "Hospitality",
      website: "https://metrohotels.example.com",
      phone: "+1-555-1200",
      address: "301 Convention Ave, Chicago, IL 60601",
      type: "customer",
    },
  });
  const nordicTimber = await prisma.company.create({
    data: {
      tenantId: tenant.id,
      name: "Nordic Timber Supply",
      industry: "Hardwood Distribution",
      phone: "+1-555-1300",
      address: "12 Lumber Yard Rd, Portland, OR 97204",
      type: "supplier",
    },
  });
  const fineFabrics = await prisma.company.create({
    data: {
      tenantId: tenant.id,
      name: "Fine Fabrics Inc.",
      industry: "Textile Manufacturing",
      phone: "+1-555-1400",
      address: "500 Textile Park, High Point, NC 27260",
      type: "supplier",
    },
  });

  // ── Contacts ───────────────────────────────────────────────
  console.log("👥 Creating contacts...");
  const isabelle = await prisma.contact.create({
    data: {
      tenantId: tenant.id,
      companyId: luxeInteriors.id,
      firstName: "Isabelle",
      lastName: "Fontaine",
      email: "isabelle.fontaine@luxeinteriors.example.com",
      phone: "+1-555-1101",
      title: "Principal Designer",
      customFields: { preferred_style: "Mid-Century" },
    },
  });
  const derek = await prisma.contact.create({
    data: {
      tenantId: tenant.id,
      companyId: metroHotels.id,
      firstName: "Derek",
      lastName: "Wainwright",
      email: "derek.wainwright@metrohotels.example.com",
      phone: "+1-555-1201",
      title: "Director of Property Development",
      customFields: { preferred_style: "Modern" },
    },
  });
  const chloe = await prisma.contact.create({
    data: {
      tenantId: tenant.id,
      companyId: luxeInteriors.id,
      firstName: "Chloe",
      lastName: "Marsh",
      email: "chloe.marsh@luxeinteriors.example.com",
      phone: "+1-555-1102",
      title: "Procurement Manager",
      customFields: { preferred_style: "Scandinavian" },
    },
  });

  // ── Products ───────────────────────────────────────────────
  // UoM validation: board-ft, linear-m, sheet, kit — all free-text, no schema change needed.
  console.log("📦 Creating furniture products...");

  // Raw materials
  const oakBoards = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      sku: "RM-OAK-001",
      name: "Solid Oak Boards",
      description: "Kiln-dried solid oak, FAS grade, 4/4 thickness",
      type: "raw_material",
      unitPrice: new Prisma.Decimal(8.50),
      unit: "board-ft",
      customFields: { warranty_period: "N/A", wood_type: "Oak", fabric_type: "N/A" },
    },
  });
  const foam = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      sku: "RM-FOAM-001",
      name: "High-Density Upholstery Foam 1.8lb",
      description: "1.8 lb/ft³ density upholstery foam, 4\" thick sheets",
      type: "raw_material",
      unitPrice: new Prisma.Decimal(32.00),
      unit: "sheet",
      customFields: { warranty_period: "N/A", wood_type: "N/A", fabric_type: "N/A" },
    },
  });
  const linenFabric = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      sku: "RM-FAB-LINEN-001",
      name: "Premium Linen Fabric – Warm Grey",
      description: "140cm wide, 100% Belgian linen, Grey colorway",
      type: "raw_material",
      unitPrice: new Prisma.Decimal(45.00),
      unit: "linear-m",
      customFields: { warranty_period: "N/A", fabric_type: "Linen", wood_type: "N/A" },
    },
  });
  const velvetFabric = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      sku: "RM-FAB-VELVET-001",
      name: "Velvet Upholstery Fabric – Midnight Blue",
      description: "140cm wide, polyester velvet, Blue colorway, 30,000 Martindale rub count",
      type: "raw_material",
      unitPrice: new Prisma.Decimal(62.00),
      unit: "linear-m",
      customFields: { warranty_period: "N/A", fabric_type: "Velvet", wood_type: "N/A" },
    },
  });
  const birchPlywood = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      sku: "RM-PLY-001",
      name: "Birch Plywood 18mm",
      description: "Baltic birch plywood, 5×5 sheets, B/BB grade, formaldehyde-free",
      type: "raw_material",
      unitPrice: new Prisma.Decimal(55.00),
      unit: "sheet",
      customFields: { warranty_period: "N/A", wood_type: "Birch", fabric_type: "N/A" },
    },
  });
  const fastenerKit = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      sku: "RM-HW-FURN-001",
      name: "Furniture Fastener Kit",
      description: "Includes cam locks, dowels, bolt & barrel nuts — sufficient for 1 sofa frame",
      type: "raw_material",
      unitPrice: new Prisma.Decimal(18.00),
      unit: "kit",
      customFields: { warranty_period: "N/A", wood_type: "N/A", fabric_type: "N/A" },
    },
  });
  const oakLumber = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      sku: "RM-OAK-LEG-001",
      name: "Turned Oak Table Legs (set of 4)",
      description: "Pre-turned solid oak tapered legs, 71cm height, set of 4",
      type: "raw_material",
      unitPrice: new Prisma.Decimal(120.00),
      unit: "set",
      customFields: { warranty_period: "N/A", wood_type: "Oak", fabric_type: "N/A" },
    },
  });

  // Sub-assemblies — components that are themselves produced from raw materials.
  // Each has its own BillOfMaterials, forming a 2-level BOM tree.
  // This is the nested-BOM validation target.
  const sofaFrame = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      sku: "SA-FRAME-SOFA-3S",
      name: "3-Seater Sofa Frame Sub-Assembly",
      description: "Kiln-dried oak and birch plywood sofa frame, ready for upholstery",
      type: "component",
      unitPrice: new Prisma.Decimal(320.00),
      unit: "pcs",
      customFields: { warranty_period: "N/A", wood_type: "Oak", fabric_type: "N/A" },
    },
  });
  const sofaCushionSet = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      sku: "SA-CUSHION-3S",
      name: "3-Seater Sofa Cushion Set",
      description: "3 seat cushions + 2 back cushions, foam-filled, fabric-ready",
      type: "component",
      unitPrice: new Prisma.Decimal(180.00),
      unit: "set",
      customFields: { warranty_period: "N/A", wood_type: "N/A", fabric_type: "N/A" },
    },
  });

  // Finished Goods — parent (base product, no parentProductId) + variants.
  // The base product represents the product family; variants are what is actually sold.
  // parentProductId is the ONLY new core schema field added for this vertical.
  const sofaBase = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      sku: "FG-SOFA-3S",
      name: "3-Seater Sofa (Base Product)",
      description: "Solid oak frame, choice of upholstery. Available in Grey Linen and Midnight Blue Velvet variants.",
      type: "finished_good",
      unitPrice: new Prisma.Decimal(2200.00),
      unit: "pcs",
      // parentProductId: null — this IS the parent
      customFields: { warranty_period: "2 years", wood_type: "Oak", fabric_type: "N/A" },
    },
  });

  // Grey Linen variant — parentProductId → sofaBase
  const sofaGreyLinen = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      sku: "FG-SOFA-3S-GREY",
      name: "3-Seater Sofa – Warm Grey Linen",
      description: "3-seater sofa upholstered in warm grey Belgian linen. Oak frame, solid-wood legs.",
      type: "finished_good",
      parentProductId: sofaBase.id,   // ← the new parentProductId field in action
      unitPrice: new Prisma.Decimal(2200.00),
      unit: "pcs",
      customFields: { warranty_period: "2 years", wood_type: "Oak", fabric_type: "Linen" },
    },
  });

  // Midnight Blue Velvet variant — different fabric, slightly higher price
  const sofaMidnightVelvet = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      sku: "FG-SOFA-3S-BLUE",
      name: "3-Seater Sofa – Midnight Blue Velvet",
      description: "3-seater sofa upholstered in midnight blue polyester velvet. Oak frame, solid-wood legs.",
      type: "finished_good",
      parentProductId: sofaBase.id,   // ← variant of the same base sofa
      unitPrice: new Prisma.Decimal(2450.00),
      unit: "pcs",
      customFields: { warranty_period: "2 years", wood_type: "Oak", fabric_type: "Velvet" },
    },
  });

  // Oak dining table — standalone finished good (no variants for now)
  const diningTable = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      sku: "FG-DINING-TBL-OAK",
      name: "Solid Oak Dining Table – 6-Seat",
      description: "Hand-crafted solid oak dining table, 200×100cm, seats 6. Natural oil finish.",
      type: "finished_good",
      unitPrice: new Prisma.Decimal(1800.00),
      unit: "pcs",
      customFields: { warranty_period: "5 years", wood_type: "Oak", fabric_type: "N/A" },
    },
  });

  // ── Bills of Materials ─────────────────────────────────────
  // NESTED BOM STRUCTURE — this is the key validation target.
  //
  // Level-1 (sub-assembly BOMs):
  //   SA-FRAME-SOFA-3S → oak boards (24 board-ft) + birch ply (1 sheet) + fastener kit (2 kits)
  //   SA-CUSHION-3S    → foam (3 sheets) + grey linen OR velvet (8 linear-m)
  //
  // Level-2 (finished good BOMs):
  //   FG-SOFA-3S-GREY   → frame (1 pcs) + cushion set (1 set) + fastener kit (1 kit)
  //   FG-SOFA-3S-BLUE   → frame (1 pcs) + cushion set (1 set) + fastener kit (1 kit)
  //
  // Full recursive explosion (sofa → oak boards, foam, linen, plywood, hardware):
  //   requires multi-level BOM explosion in the WO completion action.
  //   The current action only explodes ONE level — this is the known gap (schema comment L374-378).
  //   On WO completion for the Grey Linen sofa, only frame + cushion set + fastener kit
  //   are deducted, NOT the raw materials inside those sub-assemblies.
  console.log("📋 Creating nested bills of materials...");

  // Sub-assembly BOM #1: Sofa Frame
  const frameBOM = await prisma.billOfMaterials.create({
    data: {
      tenantId: tenant.id,
      productId: sofaFrame.id,
      name: "3-Seater Sofa Frame — Build BOM v1.0",
      version: "1.0",
      isActive: true,
      notes: "Oak frame members, plywood deck, all-hardware. Cut list maintained in CNC file FRAME-3S-v1.",
    },
  });
  await prisma.bomLine.createMany({
    data: [
      { bomId: frameBOM.id, productId: oakBoards.id, quantity: new Prisma.Decimal(24), notes: "24 board-ft oak for rails, stiles, and corner blocks" },
      { bomId: frameBOM.id, productId: birchPlywood.id, quantity: new Prisma.Decimal(1), notes: "1 sheet 18mm ply for seat deck and back support" },
      { bomId: frameBOM.id, productId: fastenerKit.id, quantity: new Prisma.Decimal(2), notes: "2 fastener kits for full frame assembly" },
    ],
  });

  // Sub-assembly BOM #2: Cushion Set (grey linen variant — fabric is at this level)
  // NOTE: A more sophisticated system might have separate cushion BOMs per fabric variant.
  //       For MVP we model this with a single cushion BOM using linen fabric;
  //       the blue velvet variant's BOM references the same cushion set sub-assembly.
  //       This is acceptable for a phase-1 demo.
  const cushionBOM = await prisma.billOfMaterials.create({
    data: {
      tenantId: tenant.id,
      productId: sofaCushionSet.id,
      name: "3-Seater Cushion Set — Standard BOM v1.0",
      version: "1.0",
      isActive: true,
      notes: "3 seat cushions (10cm foam) + 2 back cushions (8cm foam). Fabric cut from roll stock.",
    },
  });
  await prisma.bomLine.createMany({
    data: [
      { bomId: cushionBOM.id, productId: foam.id, quantity: new Prisma.Decimal(3), notes: "3 foam sheets for seat and back cushions" },
      { bomId: cushionBOM.id, productId: linenFabric.id, quantity: new Prisma.Decimal(8), notes: "8 linear-m linen — covers 3 seat cushions + 2 back cushions with 15% waste" },
    ],
  });

  // Finished good BOM: Grey Linen Sofa → sub-assemblies + top-level hardware
  // This creates the nested structure: sofa → {frame → {oak, ply, hw}, cushion → {foam, linen}, hw}
  const sofaGreyBOM = await prisma.billOfMaterials.create({
    data: {
      tenantId: tenant.id,
      productId: sofaGreyLinen.id,
      name: "3-Seater Sofa Grey Linen — Assembly BOM v1.0",
      version: "1.0",
      isActive: true,
      notes: "Top-level BOM references sub-assemblies. Work Order completion deducts first-level components only (frame, cushion, hardware). Multi-level explosion is Phase 2.",
    },
  });
  await prisma.bomLine.createMany({
    data: [
      { bomId: sofaGreyBOM.id, productId: sofaFrame.id, quantity: new Prisma.Decimal(1), notes: "1 completed sofa frame sub-assembly" },
      { bomId: sofaGreyBOM.id, productId: sofaCushionSet.id, quantity: new Prisma.Decimal(1), notes: "1 completed cushion set (grey linen)" },
      { bomId: sofaGreyBOM.id, productId: fastenerKit.id, quantity: new Prisma.Decimal(1), notes: "1 fastener kit for final cushion attachment and leg installation" },
    ],
  });

  // Finished good BOM: Midnight Blue Velvet Sofa
  // Same frame sub-assembly; cushion set uses velvet fabric — but for MVP the cushion sub-assembly
  // BOM still references linen. A future phase would add per-variant cushion BOMs.
  const sofaBlueBOM = await prisma.billOfMaterials.create({
    data: {
      tenantId: tenant.id,
      productId: sofaMidnightVelvet.id,
      name: "3-Seater Sofa Midnight Blue Velvet — Assembly BOM v1.0",
      version: "1.0",
      isActive: true,
      notes: "Velvet variant. Same frame; cushion set sub-assembly references linen BOM for MVP — per-variant cushion BOM is Phase 2.",
    },
  });
  await prisma.bomLine.createMany({
    data: [
      { bomId: sofaBlueBOM.id, productId: sofaFrame.id, quantity: new Prisma.Decimal(1), notes: "1 completed sofa frame sub-assembly" },
      { bomId: sofaBlueBOM.id, productId: sofaCushionSet.id, quantity: new Prisma.Decimal(1), notes: "1 completed cushion set (velvet variant — uses same sub-assembly for MVP)" },
      { bomId: sofaBlueBOM.id, productId: velvetFabric.id, quantity: new Prisma.Decimal(8), notes: "8 linear-m velvet fabric for top cover (applied at finishing stage, not in cushion sub-assembly)" },
      { bomId: sofaBlueBOM.id, productId: fastenerKit.id, quantity: new Prisma.Decimal(1), notes: "1 fastener kit" },
    ],
  });

  // Dining table BOM — flat single-level for comparison
  const tableBOM = await prisma.billOfMaterials.create({
    data: {
      tenantId: tenant.id,
      productId: diningTable.id,
      name: "Oak Dining Table 6-Seat — Standard BOM v1.0",
      version: "1.0",
      isActive: true,
    },
  });
  await prisma.bomLine.createMany({
    data: [
      { bomId: tableBOM.id, productId: oakBoards.id, quantity: new Prisma.Decimal(32), notes: "32 board-ft for tabletop slabs and apron" },
      { bomId: tableBOM.id, productId: oakLumber.id, quantity: new Prisma.Decimal(1), notes: "1 set of 4 pre-turned legs" },
      { bomId: tableBOM.id, productId: fastenerKit.id, quantity: new Prisma.Decimal(1), notes: "1 fastener kit for leg attachment" },
    ],
  });

  // ── Inventory ──────────────────────────────────────────────
  console.log("📦 Creating inventory...");
  const inventoryData = [
    { productId: oakBoards.id, quantity: 480, reorderLevel: 100, location: "Timber Store – Bay A" },
    { productId: foam.id, quantity: 30, reorderLevel: 10, location: "Materials Store – Rack F-1" },
    { productId: linenFabric.id, quantity: 120, reorderLevel: 24, location: "Fabric Room – Roll 3" },
    { productId: velvetFabric.id, quantity: 80, reorderLevel: 16, location: "Fabric Room – Roll 7" },
    { productId: birchPlywood.id, quantity: 20, reorderLevel: 5, location: "Sheet Goods – Bay B" },
    { productId: fastenerKit.id, quantity: 40, reorderLevel: 10, location: "Hardware Bin H-2" },
    { productId: oakLumber.id, quantity: 12, reorderLevel: 4, location: "Timber Store – Bay C" },
    { productId: sofaFrame.id, quantity: 0, reorderLevel: 0, location: "WIP – Frame Area" },
    { productId: sofaCushionSet.id, quantity: 0, reorderLevel: 0, location: "WIP – Upholstery" },
    { productId: sofaBase.id, quantity: 0, reorderLevel: 0, location: "Finished Goods" },
    { productId: sofaGreyLinen.id, quantity: 2, reorderLevel: 0, location: "Finished Goods" },
    { productId: sofaMidnightVelvet.id, quantity: 1, reorderLevel: 0, location: "Finished Goods" },
    { productId: diningTable.id, quantity: 0, reorderLevel: 0, location: "Finished Goods" },
  ];
  for (const item of inventoryData) {
    await prisma.inventoryItem.create({
      data: {
        tenantId: tenant.id,
        productId: item.productId,
        quantity: new Prisma.Decimal(item.quantity),
        reorderLevel: item.reorderLevel ? new Prisma.Decimal(item.reorderLevel) : null,
        location: item.location,
      },
    });
  }

  // ── CRM ────────────────────────────────────────────────────
  console.log("💼 Creating leads and deals...");
  await prisma.lead.create({
    data: {
      tenantId: tenant.id,
      contactId: chloe.id,
      companyId: luxeInteriors.id,
      title: "Living Room Collection — 8 Units",
      source: "referral",
      stageId: leadStages[2].id, // Design Consultation
      value: new Prisma.Decimal(24800),
      customFields: {},
    },
  });

  const deal1 = await prisma.deal.create({
    data: {
      tenantId: tenant.id,
      contactId: derek.id,
      companyId: metroHotels.id,
      title: "Metro Grand Hotel — Lobby Furniture Package",
      value: new Prisma.Decimal(62000),
      stageId: dealStages[3].id, // Approved (won)
      wonAt: new Date("2026-06-20"),
      customFields: { design_brief_ref: "MHG-2026-LOBBY-001" },
    },
  });
  const deal2 = await prisma.deal.create({
    data: {
      tenantId: tenant.id,
      contactId: isabelle.id,
      companyId: luxeInteriors.id,
      title: "Residential Fit-Out — Hamptons Loft",
      value: new Prisma.Decimal(18400),
      stageId: dealStages[1].id, // Quote Sent
      expectedCloseDate: new Date("2026-08-15"),
      customFields: { design_brief_ref: "LX-2026-HAMP-033" },
    },
  });

  await prisma.activity.createMany({
    data: [
      {
        tenantId: tenant.id,
        entityType: "Deal",
        entityId: deal1.id,
        type: "note",
        title: "Approved — 20 sofa units + 8 dining tables confirmed",
        description: "Metro Grand Hotel PO received. Delivery deadline Sept 15. Installation team booked.",
        userId: adminUser.id,
      },
      {
        tenantId: tenant.id,
        entityType: "Deal",
        entityId: deal2.id,
        type: "email",
        title: "Quote OAK-QT-0001 sent to Isabelle Fontaine",
        description: "Sent quote for 4× Grey Linen 3-seater sofas and 1× oak dining table. 6-week lead time.",
        userId: adminUser.id,
      },
    ],
  });

  // ── Sales Order (from won deal) ────────────────────────────
  console.log("🛒 Creating sales orders...");
  const so1 = await prisma.salesOrder.create({
    data: {
      tenantId: tenant.id,
      dealId: deal1.id,
      orderNumber: "OAK-SO-0001",
      contactId: derek.id,
      companyId: metroHotels.id,
      status: "in_production",
      totalAmount: new Prisma.Decimal(44000),
      orderDate: new Date("2026-06-25"),
      deliveryDate: new Date("2026-09-15"),
      notes: "Metro Grand Hotel lobby furniture. 20 sofas, mixed fabric. Installation included.",
      customFields: {
        // Demonstrating SalesOrder custom fields for delivery/installation scheduling
        delivery_date: "2026-09-15",
        installation_required: true,
        delivery_notes: "Delivery via freight to loading dock. Installation team lead: Mike T.",
      },
    },
  });
  const soLine1 = await prisma.salesOrderLine.create({
    data: {
      salesOrderId: so1.id,
      productId: sofaGreyLinen.id,
      description: "3-Seater Sofa – Warm Grey Linen, per Metro spec MH-LOBBY-22",
      quantity: new Prisma.Decimal(12),
      unitPrice: new Prisma.Decimal(2200),
      totalPrice: new Prisma.Decimal(26400),
    },
  });
  await prisma.salesOrderLine.create({
    data: {
      salesOrderId: so1.id,
      productId: sofaMidnightVelvet.id,
      description: "3-Seater Sofa – Midnight Blue Velvet, per Metro spec MH-LOBBY-23",
      quantity: new Prisma.Decimal(8),
      unitPrice: new Prisma.Decimal(2200),
      totalPrice: new Prisma.Decimal(17600),
    },
  });

  // ── Work Orders ────────────────────────────────────────────
  // Grey Linen Sofa batch — actively in Frame Assembly stage
  console.log("⚙️  Creating work orders...");
  const wo1 = await prisma.workOrder.create({
    data: {
      tenantId: tenant.id,
      salesOrderId: so1.id,
      salesOrderLineId: soLine1.id,
      bomId: sofaGreyBOM.id,
      workOrderNumber: "OAK-WO-0001",
      stageId: woStages[1].id, // Frame Assembly
      quantityPlanned: new Prisma.Decimal(12),
      quantityProduced: new Prisma.Decimal(3),
      startDate: new Date("2026-07-01"),
      dueDate: new Date("2026-08-20"),
      notes: "12× Grey Linen sofas for Metro Hotel lobby. Frames being assembled in Bay 2. CNC cut list: FRAME-3S-v1.",
    },
  });

  // Record partial material consumption (3 sofas' worth of frame sub-assemblies pulled)
  const frameInventory = await prisma.inventoryItem.findFirst({
    where: { tenantId: tenant.id, productId: sofaFrame.id },
  });
  if (frameInventory) {
    await prisma.materialConsumption.create({
      data: {
        workOrderId: wo1.id,
        productId: sofaFrame.id,
        quantity: new Prisma.Decimal(3),
        notes: "3 frame sub-assemblies pulled for first batch of sofas",
      },
    });
  }

  await prisma.activity.create({
    data: {
      tenantId: tenant.id,
      entityType: "WorkOrder",
      entityId: wo1.id,
      type: "status_change",
      title: "Started Frame Assembly — 3/12 framed",
      description: "Bay 2 operator logged 3 frames complete. Oak members cut and assembled. Moving to upholstery queue.",
      userId: adminUser.id,
    },
  });

  // Planned work order for dining tables
  await prisma.workOrder.create({
    data: {
      tenantId: tenant.id,
      bomId: tableBOM.id,
      workOrderNumber: "OAK-WO-0002",
      stageId: woStages[0].id, // Planned
      quantityPlanned: new Prisma.Decimal(8),
      startDate: new Date("2026-08-01"),
      dueDate: new Date("2026-09-01"),
      notes: "8× Oak Dining Tables for Metro Grand Hotel. Scheduled after sofa run completes.",
    },
  });

  // ── Purchase Order ─────────────────────────────────────────
  console.log("🚚 Creating purchase orders...");
  await prisma.purchaseOrder.create({
    data: {
      tenantId: tenant.id,
      poNumber: "OAK-PO-0001",
      supplierId: nordicTimber.id,
      status: "sent",
      totalAmount: new Prisma.Decimal(6120),
      orderDate: new Date("2026-07-05"),
      expectedDate: new Date("2026-07-18"),
      notes: "Restocking oak boards for Metro Hotel order. Urgent — current stock covers ~3 sofas.",
    },
  }).then(async (po) => {
    await prisma.purchaseOrderLine.create({
      data: {
        purchaseOrderId: po.id,
        productId: oakBoards.id,
        quantity: new Prisma.Decimal(720), // 720 board-ft = 30 sofas' worth
        unitPrice: new Prisma.Decimal(8.50),
        totalPrice: new Prisma.Decimal(6120),
      },
    });
  });

  // ── Invoice ────────────────────────────────────────────────
  // Deposit invoice (50%) issued on order confirmation
  console.log("🧾 Creating invoice (50% deposit)...");
  await prisma.invoice.create({
    data: {
      tenantId: tenant.id,
      salesOrderId: so1.id,
      invoiceNumber: "OAK-INV-0001",
      contactId: derek.id,
      companyId: metroHotels.id,
      status: "sent",
      subtotal: new Prisma.Decimal(22000),
      tax: new Prisma.Decimal(0),
      totalAmount: new Prisma.Decimal(22000),
      dueDate: new Date("2026-07-10"),
      notes: "50% deposit invoice per contract terms. Balance due on delivery.",
    },
  }).then(async (inv) => {
    await prisma.invoiceLine.create({
      data: {
        invoiceId: inv.id,
        description: "50% deposit — Lobby Furniture Package (Metro Grand Hotel)",
        quantity: new Prisma.Decimal(1),
        unitPrice: new Prisma.Decimal(22000),
        totalPrice: new Prisma.Decimal(22000),
      },
    });
  });

  console.log("\n✅ Oakridge Furniture seed complete!");
  console.log("━".repeat(50));
  console.log("Tenant:  Oakridge Furniture Co. (slug: oakridge-furniture)");
  console.log("Login:   admin@oakridge.demo / demo1234");
  console.log("━".repeat(50));
  console.log("  • 1 tenant, Admin/Member/Shop Floor Lead roles");
  console.log("  • 17 pipeline stages (lead:6 / deal:5 / work_order:7 incl. Delivery Scheduled)");
  console.log("  • 8 custom field defs (Product×3, SalesOrder×3, Contact×1, Deal×1)");
  console.log("  • 4 companies, 3 contacts");
  console.log("  • 13 products (7 raw materials, 2 sub-assemblies, 4 finished goods)");
  console.log("    └─ 2 products use parentProductId (Grey Linen + Midnight Blue Velvet sofa variants)");
  console.log("    └─ units: board-ft, linear-m, sheet, kit, set — no schema change needed");
  console.log("  • 4 BOMs (2 sub-assembly level + 2 finished-good level = 2-level nesting)");
  console.log("  • 13 inventory items");
  console.log("  • 1 lead, 2 deals");
  console.log("  • 1 sales order + 2 work orders + 1 PO + 1 invoice");
  console.log("");
  console.log("⚠️  KNOWN GAP: WO completion deducts ONE BOM level only.");
  console.log("    Sofa WO deducts frame + cushion + hardware — NOT the oak/foam/fabric inside them.");
  console.log("    Multi-level BOM explosion is Phase 2 (documented in schema comment).");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
