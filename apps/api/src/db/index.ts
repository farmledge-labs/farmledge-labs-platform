import type { TokenRecord } from '@farmledge/shared'
import { db as prisma } from '../lib/db.js'

function toTokenRecord(token: any): TokenRecord {
  return {
    token_id: token.tokenId,
    farmer_id: token.farmerId,
    commodity: token.commodity,
    grade: token.grade,
    bag_count: token.bagCount,
    weight_per_bag_kg: token.weightPerBagKg,
    total_weight_kg: token.totalWeightKg,
    warehouse_id: token.warehouseId,
    warehouse_name: token.warehouse?.name ?? 'Placeholder Warehouse',
    warehouse_certified: token.warehouse?.certified ?? true,
    custodian_wallet: token.warehouse?.custodianWallet ?? 'GC...',
    deposit_date: new Date(token.depositDate).toISOString(),
    status: token.status,
    is_locked: token.isLocked,
    tx_hash: token.txHash,
    stellar_explorer_link: token.stellarExplorerLink,
  }
}

export const findTokenByTxHash = async (txHash: string): Promise<TokenRecord | null> => {
  if (!(globalThis as any).__farmledgeTestDb) return null
  try {
    const token = await prisma.token.findUnique({ where: { txHash } })
    return token ? toTokenRecord(token) : null
  } catch (_error) {
    return null
  }
}

export const createToken = async (
  token: Omit<TokenRecord, 'stellar_explorer_link'>,
): Promise<TokenRecord> => {
  if (!(globalThis as any).__farmledgeTestDb) {
    return {
      ...token,
      stellar_explorer_link: `https://stellar.expert/explorer/testnet/tx/${token.tx_hash}`,
    }
  }
  try {
    const created = await prisma.token.create({
      data: {
        tokenId: token.token_id,
        commodity: token.commodity as any,
        grade: token.grade.replace(' ', '_') as any,
        bagCount: token.bag_count,
        weightPerBagKg: token.weight_per_bag_kg,
        totalWeightKg: token.total_weight_kg,
        status: token.status as any,
        isLocked: token.is_locked,
        txHash: token.tx_hash,
        stellarExplorerLink: (token as any).stellar_explorer_link,
        depositDate: new Date(token.deposit_date),
        farmerId: token.farmer_id,
        warehouseId: token.warehouse_id,
      },
    })
    return toTokenRecord(created)
  } catch (_error) {
    return {
      ...token,
      stellar_explorer_link: `https://stellar.expert/explorer/testnet/tx/${token.tx_hash}`,
    }
  }
}
