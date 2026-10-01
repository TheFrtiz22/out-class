import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Prefer the configured Prisma pooler URL on Vercel.
    // Keep DATABASE_URL as the fallback for local and standalone deployments.
    ...(process.env.POSTGRES_PRISMA_URL
      ? { datasourceUrl: process.env.POSTGRES_PRISMA_URL }
      : {}),
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
