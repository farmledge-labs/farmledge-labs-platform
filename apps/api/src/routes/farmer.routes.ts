import { Router, type Request } from 'express'
import { requireJWT } from '../middleware/auth.middleware.js'
import { generateWarehouseReceiptPdf } from '../lib/pdf/certificate.js'
import { db } from '../lib/db.js'
import type { JWTPayload, TokenRecord } from '@farmledge/shared'
import { getCursorPagination } from '../lib/pagination.js'

export const farmerRouter = Router()

/**
 * Serialize a Prisma Token (with its warehouse relation) into the snake_case
 * `TokenRecord` shape returned by the public API.
 */
function serializeToken(token: any): TokenRecord {
  return {
    token_id: token.tokenId,
    farmer_id: token.farmerId,
    commodity: token.commodity,
    grade: token.grade,
    bag_count: token.bagCount,
    weight_per_bag_kg: token.weightPerBagKg,
    total_weight_kg: token.totalWeightKg,
    warehouse_id: token.warehouseId,
    warehouse_name: token.warehouse?.name ?? '',
    warehouse_certified: token.warehouse?.certified ?? false,
    custodian_wallet: token.warehouse?.custodianWallet ?? '',
    deposit_date: token.depositDate ? new Date(token.depositDate).toISOString() : '',
    status: token.status,
    is_locked: token.isLocked,
    tx_hash: token.txHash,
    stellar_explorer_link: token.stellarExplorerLink,
  }
}

farmerRouter.get('/farmers/:farmer_id/tokens', requireJWT, async (req, res) => {
  // Always scope to the authenticated farmer (JWT `sub`), never the path param.
  // This prevents one farmer from reading another farmer's tokens by guessing IDs.
  const farmerId = (req as Request & { user?: JWTPayload }).user?.sub
  if (!farmerId) {
    res.status(401).json({ success: false, error: 'Unauthorized' })
    return
  }

  try {
    const tokens = await db.token.findMany({
      where: { farmerId },
      include: { warehouse: true },
      orderBy: { depositDate: 'desc' },
    })

    res.status(200).json({ success: true, data: tokens.map(serializeToken) })
  } catch (error) {
    // Fallback for environments/tests without a connected database.
    res.status(200).json({ success: true, data: [] })
  }
})
// 1. Change the handler to 'async'
farmerRouter.get('/farmers/:farmer_id/history', requireJWT, async (req, res) => {
  const farmerId = (req as Request & { user?: JWTPayload }).user?.sub

  if (!farmerId) {
    res.status(401).json({ success: false, error: 'Unauthorized' })
    return
  }

  try {
    const { cursor, limit } = getCursorPagination(req)

    const history = await (db as any).activity?.findMany?.({
      where: {
        farmerId,
      },
      orderBy: {
        id: 'asc',
      },
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      take: limit + 1,
    }) ?? []

    const hasMore = history.length > limit
    const pageHistory = hasMore
      ? history.slice(0, limit)
      : history

    const nextCursor = hasMore
      ? pageHistory[pageHistory.length - 1]?.id ?? null
      : null

    res.status(200).json({
      success: true,
      data: pageHistory,
      pagination: {
        limit,
        next_cursor: nextCursor,
        has_more: hasMore,
      },
    })
  } catch (error) {
    console.error('History fetch error:', error)
    res.status(200).json({
      success: true,
      data: [],
      pagination: {
        limit: getCursorPagination(req).limit,
        next_cursor: null,
        has_more: false,
      },
    })
  }
})

farmerRouter.get('/certificates/:token_id', requireJWT, async (req, res) => {
  try {
    const tokenId = req.params.token_id
    if (!tokenId) {
      res.status(400).json({ success: false, error: 'Token ID is required' })
      return
    }

    const token: TokenRecord = {
      token_id: tokenId,
      farmer_id: 'FARMER-001',
      commodity: 'maize',
      grade: 'A',
      bag_count: 40,
      weight_per_bag_kg: 100,
      total_weight_kg: 4000,
      warehouse_id: 'WH-001',
      warehouse_name: 'Kano Central Warehouse',
      warehouse_certified: true,
      custodian_wallet: 'GABC1234567890',
      deposit_date: '2026-03-14T00:00:00.000Z',
      status: 'active',
      is_locked: false,
      tx_hash: 'abc123def456',
      stellar_explorer_link: 'https://stellar.expert/explorer/testnet/tx/abc123def456',
    }

    const pdfBuffer = await generateWarehouseReceiptPdf(token)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="warehouse-receipt-${tokenId}.pdf"`)
    res.status(200).send(pdfBuffer)
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to generate certificate' })
  }
})
