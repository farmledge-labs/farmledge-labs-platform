import { type Request, type Response } from 'express'
import * as stellarService from '../services/stellar.service.js'
import * as db from '../db/index.js'
import { type TokenRecord } from '@farmledge/shared'

export const createDeposit = async (req: Request, res: Response) => {
  // The `validate` middleware has already parsed and validated req.body.
  // It also strips unknown properties, so we can safely use it.
  // The schema is defined in `src/schemas/custodian.schemas.ts` and
  // applied in `src/routes/custodian.routes.ts`.
  const depositData = req.body

  try {
    // Step 1: Mint the token on the Stellar network
    const { txHash, tokenId } = await stellarService.mint(depositData)

    // Step 2: Check for idempotency. If a token with this txHash exists, return it.
    const existingToken = await db.findTokenByTxHash(txHash)
    if (existingToken) {
      return res.status(200).json({ success: true, data: existingToken })
    }

    // Step 3: If no duplicate, create the new token record in the database.
    const newToken: TokenRecord = {
      ...depositData,
      token_id: tokenId,
      farmer_id: depositData.farmerId,
      commodity: depositData.commodity,
      grade: depositData.grade,
      warehouse_id: depositData.warehouseId,
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
      stellar_explorer_link: `https://stellar.expert/explorer/testnet/tx/${txHash}`,
    }

    const createdToken = await db.createToken(newToken)
    return res.status(201).json({ success: true, data: createdToken })
  } catch (error) {
    // If the Stellar call fails, or any other error occurs
    console.error('Failed to create deposit:', error)
    return res.status(500).json({ success: false, error: 'Failed to create deposit' })
  }
}