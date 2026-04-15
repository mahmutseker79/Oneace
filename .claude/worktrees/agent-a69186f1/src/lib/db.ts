import { PrismaClient } from "@/generated/prisma";
import { isProduction } from "@/lib/env";

// Preserves a single PrismaClient instance across Next.js hot reloads.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Sprint 37: importing `isProduction` from the validated env module
// also guarantees that DATABASE_URL / DIRECT_URL have been schema-
// checked by the time we instantiate Prisma — a missing or malformed
// URL now throws at env load, not at the first query.
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction ? ["error"] : ["query", "error", "warn"],
  });

if (!isProduction) {
  globalForPrisma.prisma = db;
}
