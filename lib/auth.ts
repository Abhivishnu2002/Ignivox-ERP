import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization } from "better-auth/plugins";
import { prisma } from "@/lib/db";
import { ADMIN_PERMISSIONS } from "@/lib/permissions";

export function getBaseUrl(): string {
  let url =
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000";

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }

  return url.replace(/\/$/, "");
}

const baseURL = getBaseUrl();

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // MVP: skip verification for easy onboarding
  },

  session: {
    // Extend session to include tenantId and permissions
    additionalFields: {
      tenantId: {
        type: "string",
        required: false,
      },
    },
  },

  plugins: [
    organization({
      // Maps Better Auth "organization" → Fabrix "tenant"
      schema: {
        organization: {
          additionalFields: {
            slug: { type: "string" },
            plan: { type: "string", defaultValue: "free" },
            enabledModules: { type: "string[]", defaultValue: ["crm", "sales", "inventory", "manufacturing", "invoicing", "procurement"] },
            settings: { type: "string", defaultValue: "{}" },
          },
        },
        member: {
          additionalFields: {
            roleId: { type: "string", required: false },
            isOwner: { type: "boolean", defaultValue: false },
          },
        },
      },
    }),
  ],

  secret: process.env.BETTER_AUTH_SECRET || "fallback_secret_ignivox_erp_key_32bytes",
  baseURL,
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://*.vercel.app",
    baseURL,
    process.env.NEXT_PUBLIC_APP_URL || "",
    process.env.BETTER_AUTH_URL || "",
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "",
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "",
  ].filter(Boolean),
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;

// ============================================================
// Helpers for Server Actions
// ============================================================

/**
 * Get the current session from a Server Component / Server Action.
 * Returns null if not authenticated.
 */
export async function getServerSession() {
  const { headers } = await import("next/headers");
  const headersList = await headers();
  return auth.api.getSession({ headers: headersList });
}

/**
 * Get the current user's tenant membership including their role/permissions.
 * Throws if not authenticated or not a member of the given tenant.
 */
export async function getTenantMembership(tenantId: string) {
  const session = await getServerSession();
  if (!session) return null;

  const membership = await prisma.tenantUser.findUnique({
    where: {
      tenantId_userId: {
        tenantId,
        userId: session.user.id,
      },
    },
    include: {
      role: true,
      tenant: true,
    },
  });

  return membership;
}

/**
 * Resolve the current session + tenant membership in one call.
 * Used as the first line of every authenticated Server Action.
 */
export async function requireTenantAccess(tenantId: string) {
  const session = await getServerSession();
  if (!session) {
    throw new Error("Unauthenticated");
  }

  const membership = await getTenantMembership(tenantId);
  if (!membership) {
    throw new Error("Unauthorized — not a member of this tenant");
  }

  const permissions = (membership.role.permissions ?? {}) as Record<string, boolean>;

  return {
    session,
    user: session.user,
    membership,
    tenant: membership.tenant,
    role: membership.role,
    permissions,
    isOwner: membership.isOwner,
    // Convenience: check if this user has a specific permission
    can: (permission: string) => membership.isOwner || permissions[permission] === true,
  };
}

// Default permissions granted to a new tenant's Admin role
export { ADMIN_PERMISSIONS };
