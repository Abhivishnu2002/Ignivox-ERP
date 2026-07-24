import {
  Users,
  Building2,
  Target,
  Handshake,
  FileText,
  ShoppingCart,
  Factory,
  Package,
  Boxes,
  Truck,
  Receipt,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { PERMISSIONS } from "./permissions";

export type ModuleId =
  | "crm"
  | "sales"
  | "manufacturing"
  | "inventory"
  | "procurement"
  | "invoicing";

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  permission: string;
}

export interface ModuleConfig {
  id: ModuleId;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  navItems: NavItem[];
}

export const MODULES: Record<ModuleId, ModuleConfig> = {
  crm: {
    id: "crm",
    name: "CRM",
    description: "Contacts, leads, and deal management",
    icon: Users,
    color: "#6366f1",
    navItems: [
      {
        path: "/contacts",
        label: "Contacts",
        icon: Users,
        permission: PERMISSIONS.CRM.CONTACTS.READ,
      },
      {
        path: "/companies",
        label: "Companies",
        icon: Building2,
        permission: PERMISSIONS.CRM.COMPANIES.READ,
      },
      {
        path: "/leads",
        label: "Leads",
        icon: Target,
        permission: PERMISSIONS.CRM.LEADS.READ,
      },
      {
        path: "/deals",
        label: "Deals",
        icon: Handshake,
        permission: PERMISSIONS.CRM.DEALS.READ,
      },
    ],
  },
  sales: {
    id: "sales",
    name: "Sales",
    description: "Quotes and sales orders",
    icon: FileText,
    color: "#0ea5e9",
    navItems: [
      {
        path: "/quotes",
        label: "Quotes",
        icon: FileText,
        permission: PERMISSIONS.SALES.QUOTES.READ,
      },
      {
        path: "/sales-orders",
        label: "Sales Orders",
        icon: ShoppingCart,
        permission: PERMISSIONS.SALES.ORDERS.READ,
      },
    ],
  },
  manufacturing: {
    id: "manufacturing",
    name: "Manufacturing",
    description: "Products, BOMs, and work orders",
    icon: Factory,
    color: "#f59e0b",
    navItems: [
      {
        path: "/products",
        label: "Products",
        icon: Package,
        permission: PERMISSIONS.MANUFACTURING.PRODUCTS.READ,
      },
      {
        path: "/boms",
        label: "Bills of Materials",
        icon: FileText,
        permission: PERMISSIONS.MANUFACTURING.BOMS.READ,
      },
      {
        path: "/work-orders",
        label: "Work Orders",
        icon: Factory,
        permission: PERMISSIONS.MANUFACTURING.WORK_ORDERS.READ,
      },
    ],
  },
  inventory: {
    id: "inventory",
    name: "Inventory",
    description: "Stock levels and movements",
    icon: Boxes,
    color: "#10b981",
    navItems: [
      {
        path: "/inventory",
        label: "Inventory",
        icon: Boxes,
        permission: PERMISSIONS.INVENTORY.ITEMS.READ,
      },
    ],
  },
  procurement: {
    id: "procurement",
    name: "Procurement",
    description: "Purchase orders and suppliers",
    icon: Truck,
    color: "#8b5cf6",
    navItems: [
      {
        path: "/purchase-orders",
        label: "Purchase Orders",
        icon: Truck,
        permission: PERMISSIONS.PROCUREMENT.PURCHASE_ORDERS.READ,
      },
    ],
  },
  invoicing: {
    id: "invoicing",
    name: "Invoicing",
    description: "Invoices and billing",
    icon: Receipt,
    color: "#ec4899",
    navItems: [
      {
        path: "/invoices",
        label: "Invoices",
        icon: Receipt,
        permission: PERMISSIONS.INVOICING.INVOICES.READ,
      },
    ],
  },
};

// Always-visible nav items (not behind a module toggle)
export const STATIC_NAV_ITEMS: NavItem[] = [
  {
    path: "/settings",
    label: "Settings",
    icon: Settings,
    permission: "admin.roles.read",
  },
];

export function getEnabledModules(enabledModuleIds: string[]): ModuleConfig[] {
  return enabledModuleIds
    .filter((id): id is ModuleId => id in MODULES)
    .map((id) => MODULES[id]);
}

export function getNavItemsForUser(
  enabledModuleIds: string[],
  userPermissions: Record<string, boolean>
): { module: ModuleConfig; items: NavItem[] }[] {
  return getEnabledModules(enabledModuleIds)
    .map((module) => ({
      module,
      items: module.navItems.filter(
        (item) => userPermissions[item.permission] === true
      ),
    }))
    .filter(({ items }) => items.length > 0);
}
