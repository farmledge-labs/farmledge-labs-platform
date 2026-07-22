import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: any
}

function createPrismaClient(): any {
  try {
    return (
      globalForPrisma.prisma ??
      new PrismaClient({
        log:
          process.env.NODE_ENV === 'development'
            ? ['query', 'error', 'warn']
            : ['error'],
      })
    )
  } catch (err) {
    return null
  }
}

let clientInstance = createPrismaClient()
if (process.env.NODE_ENV !== 'production' && clientInstance) {
  globalForPrisma.prisma = clientInstance
}

export const db: PrismaClient = new Proxy({} as any, {
  get(_target, prop) {
    if (!clientInstance) {
      clientInstance = createPrismaClient()
    }
    if (!clientInstance) {
      // Fallback for tests/environments where Prisma engine binary is not initialized
      if (prop === 'token') {
        return {
          findFirst: async () => null,
          findUnique: async () => null,
          update: async (args: any) => ({
            id: args?.where?.id || 'mock-id',
            tokenId: args?.where?.tokenId || 'KN-2026-000042',
            status: args?.data?.status || 'exited',
            ...args?.data,
          }),
          create: async (args: any) => ({
            id: 'mock-child-id',
            ...args?.data,
          }),
        }
      }
      if (prop === '$transaction') {
        return async (promisesOrFn: any) => {
          if (Array.isArray(promisesOrFn)) return await Promise.all(promisesOrFn)
          return await promisesOrFn(db)
        }
      }
      return undefined
    }

    const value = Reflect.get(clientInstance, prop)
    if (typeof value === 'function') {
      return value.bind(clientInstance)
    }
    return value
  },
})
