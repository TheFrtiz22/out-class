import { randomUUID } from "node:crypto"
import { PrismaClient } from '@prisma/client'
import { supportContext, supportInternal } from '@/utils/support-audit'

const globalForPrisma = globalThis as unknown as {
  outclassPrismaBase: PrismaClient | undefined
}

function createPrisma() {
  const client =
    globalForPrisma.outclassPrismaBase ??
    new PrismaClient({
      // Prefer the configured Prisma pooler URL on Vercel.
      // Keep DATABASE_URL as the fallback for local and standalone deployments.
      ...(process.env.POSTGRES_PRISMA_URL
        ? { datasourceUrl: process.env.POSTGRES_PRISMA_URL }
        : {}),
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'error', 'warn']
          : ['error'],
    })

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.outclassPrismaBase = client
  }

  return client.$extends({
    name: 'support-actor-audit',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // Session lifecycle events already have an explicit real actor.
          // Resolution must not recurse.
          if (supportInternal.getStore() || model === 'PlatformViewSession') {
            return query(args)
          }

          const mutations = [
            'create',
            'createMany',
            'createManyAndReturn',
            'update',
            'updateMany',
            'updateManyAndReturn',
            'upsert',
            'delete',
            'deleteMany',
          ]

          if (!mutations.includes(operation)) {
            return query(args)
          }

          if (
            model === 'AuditLog' &&
            operation === 'create' &&
            String(
              (args as { data: { action?: string } }).data.action
            ).startsWith('platform.view-as.')
          ) {
            return query(args)
          }

          const session = await supportContext()

          if (!session) {
            return query(args)
          }

          if (model === 'AuditLog' && operation === 'create') {
            const data = (args as { data: Record<string, unknown> }).data

            // Lifecycle events are always the real actor;
            // application events gain both identities.
            data.actorId = session.actorId
            data.effectiveUserId = session.targetUserId
            data.supportSessionId = session.id

            return query(args)
          }

          if (model === 'PlatformAdmin' || model === 'AuditLog') {
            throw new Error(
              'This operation is unavailable during impersonation.'
            )
          }

          // Durable, append-only attempt record before every ORM mutation,
          // including nested writes. Do not claim a transaction committed:
          // a later statement may still roll it back.
          const operationId = randomUUID()

          await client.auditLog.create({
            data: {
              actorId: session.actorId,
              effectiveUserId: session.targetUserId,
              supportSessionId: session.id,
              action: 'platform.impersonation.mutation-attempt',
              targetId: session.targetUserId,
              details: {
                model,
                operation,
                operationId,
              },
            },
          })

          const result = await query(args)

          await client.auditLog.create({
            data: {
              actorId: session.actorId,
              effectiveUserId: session.targetUserId,
              supportSessionId: session.id,
              action: 'platform.impersonation.statement-returned',
              targetId:
                typeof result === 'object' &&
                result &&
                'id' in result &&
                typeof result.id === 'string'
                  ? result.id
                  : session.targetUserId,
              details: {
                model,
                operation,
                operationId,
                transactionMayStillRollback: true,
              },
            },
          })

          return result
        },
      },
    },
  })
}

type AppPrisma = ReturnType<typeof createPrisma>

export type AppTransactionClient =
  Parameters<Parameters<AppPrisma['$transaction']>[0]>[0]

export const prisma = createPrisma()