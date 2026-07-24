"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogOut, User, Settings, Bell } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
  tenantName: string;
}

export function Header({ user, tenantName }: HeaderProps) {
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push("/login");
    router.refresh();
    toast.success("Signed out successfully");
  }

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-border bg-background/95 backdrop-blur-sm flex-shrink-0">
      {/* Breadcrumb area — children can override via portal or slot pattern */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{tenantName}</span>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Notification bell — placeholder for Phase 2 */}
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 text-muted-foreground hover:text-foreground"
          title="Notifications (coming soon)"
        >
          <Bell className="h-4 w-4" />
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg hover:bg-muted p-1.5 transition-colors border-0 bg-transparent cursor-pointer">
            <Avatar className="h-7 w-7">
              <AvatarImage src={user.image ?? undefined} alt={user.name} />
              <AvatarFallback className="text-[10px] font-semibold bg-primary text-primary-foreground">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-medium leading-none">{user.name}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-none">{user.email}</p>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user.name}</p>
                <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings/profile")}>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
