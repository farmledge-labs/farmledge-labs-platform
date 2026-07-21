import { type Request, type Response } from 'express'
import { z } from 'zod'
import * as stellarService from '../services/stellar.service.js'
import * as db from '../db/index.js'
import { type TokenRecord } from '../../../../packages/shared/src/types.js'

const depositSchema = z.object({
  farmerId: z.string(),
  commodity: z.enum(['MAIZE_WHITE', 'MAIZE_YELLOW', 'SESAME']),
  grade: z.enum(['Grade A', 'Grade B', 'Grade C']),
  bagCount: z.number().int().positive(),
  weightPerBagKg: z.number().positive(),
  warehouseId: z.string(),
})

export const createDeposit = async (req: Request, res: Response) => {
  const validation = depositSchema.safeParse(req.body)
  if (!validation.success) {
    return res.status(400).json({ success: false, error: validation.error.issues })
  }

  const depositData = validation.data

  try {
    // Step 1: Mint the token on the Stellar network
    const { txHash, tokenId } = await stellarService.mint(depositData)

    // Step 2: Check for idempotency. If a token with this txHash exists, return it.
    const existingToken = await db.findTokenByTxHash(txHash)
    if (existingToken) {
      return res.status(200).json({ success: true, data: existingToken })
    }

    // Step 3: If no duplicate, create the new token record in the database.
    const newToken: Omit<TokenRecord, 'stellar_explorer_link'> = {
      ...depositData,
      token_id: tokenId,
      farmer_id: depositData.farmerId,
      weight_per_bag_kg: depositData.weightPerBagKg,
      bag_count: depositData.bagCount,
      total_weight_kg: depositData.bagCount * depositData.weightPerBagKg,
      tx_hash: txHash,
      // These are placeholders until warehouse/custodian data is available
      warehouse_name: 'Placeholder Warehouse',
      warehouse_certified: true,
      custodian_wallet: 'GC...', // Placeholder
      deposit_date: new Date().toISOString(),
      status: 'active',
      is_locked: false,
    }

    const createdToken = await db.createToken(newToken)
    return res.status(201).json({ success: true, data: createdToken })
  } catch (error) {
    // If the Stellar call fails, or any other error occurs
    console.error('Failed to create deposit:', error)
    return res.status(500).json({ success: false, error: 'Failed to create deposit' })
  }
}