import { type Request, type Response } from 'express';
import { TokenStatus } from '@prisma/client';
import { stellarService } from '../services/stellar.service.js';
import { db } from '../lib/db.js';

function serializeToken(token: any) {
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
    exit_date: token.exitDate ? new Date(token.exitDate).toISOString() : null,
    status: token.status,
    is_locked: token.isLocked,
    tx_hash: token.txHash,
    stellar_explorer_link: token.stellarExplorerLink,
  };
}

export async function processExit(req: Request, res: Response): Promise<void> {
  const tokenId = req.params.token_id;

  if (!tokenId) {
    res.status(400).json({ success: false, error: 'Token ID is required' });
    return;
  }

  try {
    const burnResult = await stellarService.burn({
      tokenId,
      exitReason: req.body.exit_reason,
      deliveryNoteNumber: req.body.delivery_note_number,
    });

    const existingToken = await db.token.findUnique({
      where: { txHash: burnResult.txHash },
      include: { warehouse: true },
    });

    if (existingToken) {
      res.status(200).json({ success: true, data: serializeToken(existingToken) });
      return;
    }

    const token = await db.token.findFirst({
      where: { OR: [{ id: tokenId }, { tokenId }] },
      include: { warehouse: true },
    });

    if (!token) {
      res.status(404).json({ success: false, error: 'Token not found' });
      return;
    }

    const exitedToken = await db.token.update({
      where: { id: token.id },
      data: {
        status: TokenStatus.exited,
        exitDate: new Date(),
        txHash: burnResult.txHash,
        stellarExplorerLink: burnResult.stellarExplorerLink,
      },
      include: { warehouse: true },
    });

    res.status(200).json({ success: true, data: serializeToken(exitedToken) });
  } catch (error) {
    console.error('Failed to process exit:', error);
    res.status(500).json({ success: false, error: 'Failed to process exit' });
  }
}
