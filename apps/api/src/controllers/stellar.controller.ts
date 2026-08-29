import { type Request, type Response } from 'express'
import { sdk } from '../services/sdk.js'
import { db } from '../lib/db.js'
import { TokenStatus } from '@prisma/client'
import { farmerWalletSigner } from '../services/stellar.service.js'

export const initiateTransfer = async (req: Request, res: Response) => {
  try {
    const { token_id, buyer_wallet_address } = req.body

    let token = null
    try {
      token = await db.token.findFirst({
        where: {
          OR: [{ id: token_id }, { tokenId: token_id }],
        },
      })
    } catch (_err) {
      // Fallback
    }

    if (token) {
      if (token.isLocked) {
        return res.status(400).json({ success: false, error: 'Cannot transfer a locked token' })
      }
      if (token.status !== TokenStatus.active) {
        return res.status(400).json({ success: false, error: 'Cannot transfer a non-active token' })
      }

      const signature = await farmerWalletSigner.signAsFarmer()

      const sdkResult = await sdk.transfer({
        tokenId: token.tokenId,
        buyerWalletAddress: buyer_wallet_address,
        signature
      })

      const updatedToken = await db.token.update({
        where: { id: token.id },
        data: { status: TokenStatus.transferred },
      })

      return res.status(200).json({
        success: true,
        data: {
          token_id: updatedToken.tokenId,
          status: updatedToken.status,
          new_owner: sdkResult.newOwner,
          tx_hash: sdkResult.txHash,
          stellar_explorer_link: sdkResult.stellarExplorerLink,
        },
      })
    }

    const signature = await farmerWalletSigner.signAsFarmer()
    const sdkResult = await sdk.transfer({
      tokenId: token_id,
      buyerWalletAddress: buyer_wallet_address,
      signature
    })

    return res.status(200).json({
      success: true,
      data: {
        token_id,
        status: 'transferred',
        new_owner: sdkResult.newOwner,
        tx_hash: sdkResult.txHash,
        stellar_explorer_link: sdkResult.stellarExplorerLink,
      },
    })
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Transfer failed' })
  }
}
