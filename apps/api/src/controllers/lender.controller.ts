import { type Request, type Response } from 'express'
import { db } from '../lib/db.js'
import { sdk } from '../services/sdk.js'
import { getCursorPagination } from '../lib/pagination.js'

const PLACEHOLDER_PRICE_NGN_PER_KG = 1_000

interface CollateralToken {
  token_id: string
  commodity: string
  grade: string
  total_weight_kg: number
  status: string
  is_locked: boolean
  estimatedValueNgn: number
  priceTimestamp: string
  price: {
    amountNgnPerKg: number
    source: 'placeholder'
  }
  chain: {
    verified: boolean
    mismatch: boolean
    owner: string
    total_weight_kg: number
    status: string
    is_locked: boolean
    simulated: boolean
  }
}

function getFarmerId(req: Request): string | undefined {
  return req.params.farmer_id
}

export async function getFarmerCollateral(req: Request, res: Response): Promise<void> {
  const farmerId = getFarmerId(req)

  if (!farmerId) {
    res.status(401).json({ success: false, error: 'Unauthorized' })
    return
  }

  const priceTimestamp = new Date().toISOString()

  try {
    const { cursor, limit } = getCursorPagination(req)

    const sortBy =
      req.query.sortBy === 'weight'
        ? 'weight'
        : 'date'

    const orderBy =
      sortBy === 'weight'
        ? { totalWeightKg: 'desc' as const }
        : { depositDate: 'desc' as const }

    const tokens = await db.token.findMany({
      where: {
        farmerId,
        status: 'active',
        isLocked: false,
      },
      orderBy,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: limit + 1,
    })

    const hasMore = tokens.length > limit
    const pageTokens = hasMore
      ? tokens.slice(0, limit)
      : tokens

    const nextCursor = hasMore
      ? pageTokens[pageTokens.length - 1]?.id ?? null
      : null

    const collateral: CollateralToken[] = []

    for (const token of pageTokens) {
      const chain = await sdk.query({
        tokenId: token.tokenId,
        ownerWalletAddress: '',
        totalWeightKg: token.totalWeightKg,
        status: token.status,
        isLocked: token.isLocked,
      })

      const mismatch =
        chain.totalWeightKg !== token.totalWeightKg ||
        chain.status !== token.status ||
        chain.isLocked !== token.isLocked

      collateral.push({
        token_id: token.tokenId,
        commodity: token.commodity,
        grade: token.grade,
        total_weight_kg: token.totalWeightKg,
        status: token.status,
        is_locked: token.isLocked,
        estimatedValueNgn:
          token.totalWeightKg * PLACEHOLDER_PRICE_NGN_PER_KG,
        priceTimestamp,
        price: {
          amountNgnPerKg: PLACEHOLDER_PRICE_NGN_PER_KG,
          source: 'placeholder',
        },
        chain: {
          verified: !mismatch,
          mismatch,
          owner: chain.owner,
          total_weight_kg: chain.totalWeightKg,
          status: chain.status,
          is_locked: chain.isLocked,
          simulated: chain.simulated,
        },
      })
    }

    res.status(200).json({
      success: true,
      data: {
        farmer_id: farmerId,
        estimatedValueNgn: collateral.reduce(
          (total, token) => total + token.estimatedValueNgn,
          0,
        ),
        priceTimestamp,
        price: {
          amountNgnPerKg: PLACEHOLDER_PRICE_NGN_PER_KG,
          source: 'placeholder',
        },
        tokens: collateral,
      },
      pagination: {
        limit,
        next_cursor: nextCursor,
        has_more: hasMore,
        sort_by: sortBy,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch farmer collateral',
    })
  }
}

export async function unlockToken(req: Request, res: Response): Promise<void> {
  const tokenId = req.params.token_id
  const { lender_id: lenderId, loan_reference: loanReference } = req.body

  if (!tokenId) {
    res.status(400).json({ success: false, error: 'Token ID is required' })
    return
  }

  try {
    const token = await db.token.findFirst({
      where: {
        OR: [{ id: tokenId }, { tokenId }],
      },
    })

    if (!token) {
      res.status(404).json({ success: false, error: 'Token not found' })
      return
    }

    if (!token.isLocked) {
      res.status(400).json({ success: false, error: 'Token is not locked' })
      return
    }

    if (token.lockedByLenderId !== lenderId || token.loanReference !== loanReference) {
      res.status(403).json({ success: false, error: 'Token lock does not belong to this loan' })
      return
    }

    const unlockedToken = await db.token.update({
      where: { id: token.id },
      data: {
        isLocked: false,
        lockedByLenderId: null,
        loanReference: null,
      },
    })

    res.status(200).json({
      success: true,
      data: {
        token_id: unlockedToken.tokenId,
        status: unlockedToken.status,
        is_locked: unlockedToken.isLocked,
        locked_by_lender_id: unlockedToken.lockedByLenderId,
        loan_reference: unlockedToken.loanReference,
      },
    })
  } catch (error) {
    console.error('Failed to unlock token:', error)
    res.status(500).json({ success: false, error: 'Failed to unlock token' })
  }
}

export async function lockToken(req: Request, res: Response): Promise<void> {
  const tokenId = req.params.token_id
  const { lender_id: lenderId, loan_reference: loanReference } = req.body

  if (!tokenId) {
    res.status(400).json({ success: false, error: 'Token ID is required' })
    return
  }

  try {
    const token = await db.token.findFirst({
      where: {
        OR: [{ id: tokenId }, { tokenId }],
      },
    })

    if (!token) {
      res.status(404).json({ success: false, error: 'Token not found' })
      return
    }

    if (token.status !== 'active') {
      res.status(400).json({ success: false, error: 'Cannot lock a non-active token' })
      return
    }

    if (token.isLocked) {
      res.status(400).json({ success: false, error: 'Token is already locked' })
      return
    }

    const lockedToken = await db.token.update({
      where: { id: token.id },
      data: {
        isLocked: true,
        lockedByLenderId: lenderId,
        loanReference,
      },
    })

    res.status(200).json({
      success: true,
      data: {
        token_id: lockedToken.tokenId,
        status: lockedToken.status,
        is_locked: lockedToken.isLocked,
        locked_by_lender_id: lockedToken.lockedByLenderId,
        loan_reference: lockedToken.loanReference,
      },
    })
  } catch (error) {
    console.error('Failed to lock token:', error)
    res.status(500).json({ success: false, error: 'Failed to lock token' })
  }
}
