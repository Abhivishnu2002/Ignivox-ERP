import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// ============================================================
// TENANT TRANSACTION — the secure way to run tenant-scoped queries
//
// CRITICAL: Uses set_config(..., true) which is equivalent to SET LOCAL —
// the tenant setting is scoped ONLY to the current transaction.
// When the transaction ends (commit or rollback), the session variable is
// cleared automatically. This makes it safe with connection pooling
// (Prisma's built-in pool, PgBouncer, Supabase pooler, etc.).
//
// A plain SET on a pooled connection would persist for the lifetime of
// that connection, potentially leaking one tenant's data into the next
// request that reuses the same connection.
//
// Usage in Server Actions / API routes:
//   const contacts = await tenantTransaction(tenantId, async (tx) => {
//     return tx.contact.findMany({ where: { ... } });
//     // RLS policy enforced automatically by PostgreSQL
//   });
// ============================================================
export async function tenantTransaction<T>(
  tenantId: string,
  fn: (tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // set_config(setting, value, is_local) — is_local=true makes it transaction-local
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(tx);
  });
}

export type TenantTx = Parameters<Parameters<typeof tenantTransaction>[1]>[0];
