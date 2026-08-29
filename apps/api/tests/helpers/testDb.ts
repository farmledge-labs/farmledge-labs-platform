type Token = Record<string, any>
type Warehouse = Record<string, any>

const tokens = new Map<string, Token>()
const warehouses = new Map<string, Warehouse>()

function matches(token: Token, where: any = {}) {
  if (where.warehouseId && token.warehouseId !== where.warehouseId) return false
  if (where.status) {
    const status = typeof where.status === 'object' ? where.status.equals : where.status
    if (token.status !== status) return false
  }
  if (where.txHash && token.txHash !== where.txHash) return false
  if (where.id && token.id !== where.id) return false
  if (where.tokenId && token.tokenId !== where.tokenId) return false
  if (where.OR && !where.OR.some((condition: any) => matches(token, condition))) return false
  return true
}

function withWarehouse(token: Token, include: any) {
  if (!include?.warehouse) return token
  return { ...token, warehouse: warehouses.get(token.warehouseId) ?? null }
}

export function resetTestDb() {
  tokens.clear()
  warehouses.clear()
}

export function seedTestWarehouse(record: Partial<Warehouse> & { id: string }) {
  const warehouse = {
    name: 'Test Warehouse',
    location: 'Test Location',
    state: 'Test State',
    certified: true,
    capacityTonnes: 1000,
    custodianWallet: 'GCUSTODIAN',
    ...record,
  }
  warehouses.set(warehouse.id, warehouse)
  return warehouse
}

export function getTestToken(tokenId: string) {
  return tokens.get(tokenId) ?? null
}

export function installTestDb() {
  const globalState = globalThis as any
  globalState.__farmledgeTestDb = true
  globalState.prisma = {
    warehouse: {
      findUnique: async ({ where }: any) =>
        warehouses.get(where.id) ?? warehouses.get(where.custodianWallet) ?? null,
    },
    token: {
      findUnique: async ({ where, include }: any) => {
        const token = Array.from(tokens.values()).find((item) => matches(item, where))
        return token ? withWarehouse(token, include) : null
      },
      findFirst: async ({ where, include }: any) => {
        const token = Array.from(tokens.values()).find((item) => matches(item, where))
        return token ? withWarehouse(token, include) : null
      },
      findMany: async ({ where, include }: any) =>
        Array.from(new Set(tokens.values()))
          .filter((token) => matches(token, where))
          .sort(
            (left, right) =>
              new Date(right.depositDate).getTime() - new Date(left.depositDate).getTime(),
          )
          .map((token) => withWarehouse(token, include)),
      create: async ({ data }: any) => {
        const token = { id: `token-${tokens.size + 1}`, ...data }
        tokens.set(token.id, token)
        tokens.set(token.tokenId, token)
        tokens.set(token.txHash, token)
        return token
      },
      update: async ({ where, data, include }: any) => {
        const token = Array.from(tokens.values()).find((item) => matches(item, where))
        if (!token) throw new Error('Token not found')
        const updated = { ...token, ...data, updatedAt: new Date() }
        for (const key of [token.id, token.tokenId, token.txHash]) tokens.set(key, updated)
        tokens.set(updated.txHash, updated)
        return withWarehouse(updated, include)
      },
    },
  }
  return globalState.prisma
}

export function uninstallTestDb() {
  delete (globalThis as any).__farmledgeTestDb
  delete (globalThis as any).prisma
  resetTestDb()
}
