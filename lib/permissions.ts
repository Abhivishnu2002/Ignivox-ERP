// ============================================================
// PERMISSION SYSTEM
// Convention: {module}.{entity}.{action}
// ============================================================

export const PERMISSIONS = {
  CRM: {
    CONTACTS: {
      READ: "crm.contacts.read",
      CREATE: "crm.contacts.create",
      UPDATE: "crm.contacts.update",
      DELETE: "crm.contacts.delete",
    },
    COMPANIES: {
      READ: "crm.companies.read",
      CREATE: "crm.companies.create",
      UPDATE: "crm.companies.update",
      DELETE: "crm.companies.delete",
    },
    LEADS: {
      READ: "crm.leads.read",
      CREATE: "crm.leads.create",
      UPDATE: "crm.leads.update",
      DELETE: "crm.leads.delete",
    },
    DEALS: {
      READ: "crm.deals.read",
      CREATE: "crm.deals.create",
      UPDATE: "crm.deals.update",
      DELETE: "crm.deals.delete",
    },
  },
  SALES: {
    QUOTES: {
      READ: "sales.quotes.read",
      CREATE: "sales.quotes.create",
      UPDATE: "sales.quotes.update",
      DELETE: "sales.quotes.delete",
    },
    ORDERS: {
      READ: "sales.orders.read",
      CREATE: "sales.orders.create",
      UPDATE: "sales.orders.update",
      DELETE: "sales.orders.delete",
    },
  },
  MANUFACTURING: {
    PRODUCTS: {
      READ: "manufacturing.products.read",
      CREATE: "manufacturing.products.create",
      UPDATE: "manufacturing.products.update",
      DELETE: "manufacturing.products.delete",
    },
    BOMS: {
      READ: "manufacturing.boms.read",
      CREATE: "manufacturing.boms.create",
      UPDATE: "manufacturing.boms.update",
      DELETE: "manufacturing.boms.delete",
    },
    WORK_ORDERS: {
      READ: "manufacturing.workOrders.read",
      CREATE: "manufacturing.workOrders.create",
      UPDATE: "manufacturing.workOrders.update",
      DELETE: "manufacturing.workOrders.delete",
    },
  },
  INVENTORY: {
    ITEMS: {
      READ: "inventory.items.read",
      UPDATE: "inventory.items.update",
    },
    MOVEMENTS: {
      READ: "inventory.movements.read",
      CREATE: "inventory.movements.create",
    },
  },
  PROCUREMENT: {
    PURCHASE_ORDERS: {
      READ: "procurement.purchaseOrders.read",
      CREATE: "procurement.purchaseOrders.create",
      UPDATE: "procurement.purchaseOrders.update",
      DELETE: "procurement.purchaseOrders.delete",
    },
  },
  INVOICING: {
    INVOICES: {
      READ: "invoicing.invoices.read",
      CREATE: "invoicing.invoices.create",
      UPDATE: "invoicing.invoices.update",
      DELETE: "invoicing.invoices.delete",
    },
  },
  ADMIN: {
    ROLES: {
      READ: "admin.roles.read",
      MANAGE: "admin.roles.manage",
    },
    CUSTOM_FIELDS: {
      READ: "admin.customFields.read",
      MANAGE: "admin.customFields.manage",
    },
    PIPELINE_STAGES: {
      READ: "admin.pipelineStages.read",
      MANAGE: "admin.pipelineStages.manage",
    },
    MEMBERS: {
      READ: "admin.members.read",
      MANAGE: "admin.members.manage",
    },
    MODULES: {
      MANAGE: "admin.modules.manage",
    },
  },
} as const;

// All permissions that a full Admin role should have
export const ADMIN_PERMISSIONS: Record<string, boolean> = Object.values(
  PERMISSIONS
).reduce((acc, module) => {
  Object.values(module).forEach((entity) => {
    Object.values(entity).forEach((permission) => {
      acc[permission as string] = true;
    });
  });
  return acc;
}, {} as Record<string, boolean>);

// Check if a user has a specific permission
export function hasPermission(
  userPermissions: Record<string, boolean>,
  permission: string
): boolean {
  return userPermissions[permission] === true;
}

// Check if a user has ANY of the given permissions
export function hasAnyPermission(
  userPermissions: Record<string, boolean>,
  permissions: string[]
): boolean {
  return permissions.some((p) => userPermissions[p] === true);
}

// Check if a user has ALL of the given permissions
export function hasAllPermissions(
  userPermissions: Record<string, boolean>,
  permissions: string[]
): boolean {
  return permissions.every((p) => userPermissions[p] === true);
}

// Grouped permissions for the permission matrix UI
export const PERMISSION_GROUPS = [
  {
    id: "crm",
    label: "CRM",
    entities: [
      { id: "contacts", label: "Contacts", permissions: PERMISSIONS.CRM.CONTACTS },
      { id: "companies", label: "Companies", permissions: PERMISSIONS.CRM.COMPANIES },
      { id: "leads", label: "Leads", permissions: PERMISSIONS.CRM.LEADS },
      { id: "deals", label: "Deals", permissions: PERMISSIONS.CRM.DEALS },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    entities: [
      { id: "quotes", label: "Quotes", permissions: PERMISSIONS.SALES.QUOTES },
      { id: "orders", label: "Sales Orders", permissions: PERMISSIONS.SALES.ORDERS },
    ],
  },
  {
    id: "manufacturing",
    label: "Manufacturing",
    entities: [
      { id: "products", label: "Products", permissions: PERMISSIONS.MANUFACTURING.PRODUCTS },
      { id: "boms", label: "Bills of Materials", permissions: PERMISSIONS.MANUFACTURING.BOMS },
      { id: "workOrders", label: "Work Orders", permissions: PERMISSIONS.MANUFACTURING.WORK_ORDERS },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    entities: [
      { id: "items", label: "Stock Items", permissions: PERMISSIONS.INVENTORY.ITEMS },
      { id: "movements", label: "Stock Movements", permissions: PERMISSIONS.INVENTORY.MOVEMENTS },
    ],
  },
  {
    id: "procurement",
    label: "Procurement",
    entities: [
      { id: "purchaseOrders", label: "Purchase Orders", permissions: PERMISSIONS.PROCUREMENT.PURCHASE_ORDERS },
    ],
  },
  {
    id: "invoicing",
    label: "Invoicing",
    entities: [
      { id: "invoices", label: "Invoices", permissions: PERMISSIONS.INVOICING.INVOICES },
    ],
  },
  {
    id: "admin",
    label: "Administration",
    entities: [
      { id: "roles", label: "Roles", permissions: PERMISSIONS.ADMIN.ROLES },
      { id: "customFields", label: "Custom Fields", permissions: PERMISSIONS.ADMIN.CUSTOM_FIELDS },
      { id: "pipelineStages", label: "Pipeline Stages", permissions: PERMISSIONS.ADMIN.PIPELINE_STAGES },
      { id: "members", label: "Members", permissions: PERMISSIONS.ADMIN.MEMBERS },
      { id: "modules", label: "Modules", permissions: PERMISSIONS.ADMIN.MODULES },
    ],
  },
];
