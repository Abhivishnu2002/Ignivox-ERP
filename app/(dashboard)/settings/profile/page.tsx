import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getInitials, formatDate } from "@/lib/utils";
import {
  User,
  Mail,
  Building2,
  ShieldCheck,
  Calendar,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

export default async function ProfilePage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const membership = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id },
    include: { tenant: true, role: true },
  });

  if (!membership) redirect("/onboarding");

  const user = session.user;
  const tenant = membership.tenant;
  const role = membership.role;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Top Header */}
      <div>
        <Link
          href="/settings"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Settings
        </Link>
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">User Profile & Account</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your personal account details, organization membership, and active session.
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="bg-card border border-border rounded-xl p-6 md:col-span-2 space-y-6">
          <div className="flex items-center gap-4 border-b border-border pb-6">
            <Avatar className="h-16 w-16 border-2 border-primary/20">
              <AvatarImage src={user.image ?? undefined} alt={user.name} />
              <AvatarFallback className="text-lg font-bold bg-primary text-primary-foreground">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">{user.name}</h2>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Active
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                {user.email}
              </p>
            </div>
          </div>

          {/* Account Details Table */}
          <div className="space-y-4 text-xs">
            <h3 className="text-sm font-semibold">Account Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-muted/30 border border-border/60 rounded-lg p-3 space-y-1">
                <p className="text-muted-foreground font-medium flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-primary" /> Organization Tenant
                </p>
                <p className="text-sm font-semibold">{tenant.name}</p>
                <p className="text-[10px] text-muted-foreground font-mono">slug: {tenant.slug}</p>
              </div>

              <div className="bg-muted/30 border border-border/60 rounded-lg p-3 space-y-1">
                <p className="text-muted-foreground font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Assigned Role
                </p>
                <p className="text-sm font-semibold">{role.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {membership.isOwner ? "Tenant Owner (Full Access)" : role.description || "Standard Member"}
                </p>
              </div>

              <div className="bg-muted/30 border border-border/60 rounded-lg p-3 space-y-1">
                <p className="text-muted-foreground font-medium flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-primary" /> User ID
                </p>
                <p className="text-xs font-mono font-medium truncate">{user.id}</p>
              </div>

              <div className="bg-muted/30 border border-border/60 rounded-lg p-3 space-y-1">
                <p className="text-muted-foreground font-medium flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-primary" /> Member Since
                </p>
                <p className="text-sm font-semibold">{formatDate(user.createdAt)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Session & Logout Card */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold">Active Session</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              You are currently logged into <strong>{tenant.name}</strong> as <strong>{user.email}</strong>.
            </p>

            <div className="pt-2 border-t border-border">
              <SignOutButton variant="destructive" size="default" className="w-full justify-center" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
