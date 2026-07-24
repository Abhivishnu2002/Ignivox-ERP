"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getNavItemsForUser } from "@/lib/modules";
import { PERMISSIONS } from "@/lib/permissions";
import type { Tenant } from "@prisma/client";
import { SignOutButton } from "@/components/auth/SignOutButton";
import {
  User,
  Settings,
  LayoutDashboard,
  ChevronRight,
} from "lucide-react";

interface SidebarProps {
  tenant: Tenant;
  enabledModules: string[];
  userPermissions: Record<string, boolean>;
  isOwner: boolean;
}

export function Sidebar({ tenant, enabledModules, userPermissions, isOwner }: SidebarProps) {
  const pathname = usePathname();

  const moduleGroups = getNavItemsForUser(enabledModules, userPermissions);

  const isActive = (path: string) => {
    if (path === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(path);
  };

  return (
    <aside className="w-60 flex-shrink-0 bg-sidebar flex flex-col h-full border-r border-sidebar-border">
      {/* Logo / Tenant name */}
      <div className="px-4 py-4 border-b border-sidebar-border">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, oklch(0.62 0.22 264), oklch(0.72 0.18 290))",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <path d="M3 5h14M3 10h10M3 15h14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-sidebar-foreground truncate leading-none">
              Ignivox ERP
            </p>
            <p className="text-[10px] text-sidebar-foreground/50 truncate mt-0.5 leading-none">
              {tenant.name}
            </p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {/* Dashboard link — always visible */}
        <Link
          href="/dashboard"
          className={cn(
            "nav-item",
            isActive("/dashboard") && "active"
          )}
        >
          <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
          <span>Dashboard</span>
          {isActive("/dashboard") && (
            <ChevronRight className="w-3 h-3 ml-auto opacity-60" />
          )}
        </Link>

        {/* Module nav groups */}
        {moduleGroups.map(({ module, items }) => (
          <div key={module.id} className="mt-3">
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">
              {module.name}
            </p>
            {items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={cn("nav-item", active && "active")}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.label}</span>
                  {active && (
                    <ChevronRight className="w-3 h-3 ml-auto opacity-60" />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Settings / bottom area */}
      <div className="px-2 py-3 border-t border-sidebar-border space-y-0.5">
        <Link
          href="/settings/profile"
          className={cn("nav-item", isActive("/settings/profile") && "active")}
        >
          <User className="w-4 h-4 flex-shrink-0" />
          <span>Profile</span>
        </Link>
        {(isOwner || userPermissions[PERMISSIONS.ADMIN.ROLES.READ]) && (
          <Link
            href="/settings"
            className={cn("nav-item", isActive("/settings") && !isActive("/settings/profile") && "active")}
          >
            <Settings className="w-4 h-4 flex-shrink-0" />
            <span>Settings</span>
          </Link>
        )}
        <div className="pt-1 mt-1 border-t border-sidebar-border/60">
          <SignOutButton
            variant="ghost"
            size="sm"
            className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2 text-xs font-normal"
          />
        </div>
      </div>
    </aside>
  );
}
