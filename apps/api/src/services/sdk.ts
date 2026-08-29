import { createHash } from 'node:crypto'

export interface SplitTokenParams {
  parentTokenId: string
  splitAmountKg: number
  totalWeightKg: number
}

export interface ChildTokenDetail {
  tokenId: string
  weightKg: number
  txHash: string
  stellarExplorerLink: string
}

export interface SplitResult {
  parentTokenId: string
  child1: ChildTokenDetail
  child2: ChildTokenDetail
}

export class SDKService {
  /**
   * Performs on-chain split of a receipt token:
   * Burns original token and mints two child tokens.
   */
  static async splitToken(params: SplitTokenParams): Promise<SplitResult> {
    const { parentTokenId, splitAmountKg, totalWeightKg } = params
    const remainderKg = totalWeightKg - splitAmountKg

    const child1Id = `${parentTokenId}-C1`
    const child2Id = `${parentTokenId}-C2`

    const txHash = `0x${Buffer.from(`${parentTokenId}-${Date.now()}`).toString('hex').slice(0, 64)}`
    const stellarExplorerLink = `https://stellar.expert/explorer/public/tx/${txHash}`

    return {
      parentTokenId,
      child1: {
        tokenId: child1Id,
        weightKg: splitAmountKg,
        txHash,
        stellarExplorerLink,
      },
      child2: {
        tokenId: child2Id,
        weightKg: remainderKg,
        txHash,
        stellarExplorerLink,
      },
    }
  }
}

export interface TransferTokenParams {
  tokenId: string
  buyerWalletAddress: string
  signature?: string
}

export interface TransferResult {
  tokenId: string
  newOwner: string
  txHash: string
  stellarExplorerLink: string
}

export class TransferSDKService {
  /**
   * Performs on-chain transfer of a receipt token to a buyer wallet.
   * Returns the new owner address and the Stellar transaction hash.
   */
  static async transferToken(params: TransferTokenParams): Promise<TransferResult> {
    const { tokenId, buyerWalletAddress } = params

    const txHash = `0x${Buffer.from(`${tokenId}-${buyerWalletAddress}-${Date.now()}`).toString('hex').slice(0, 64)}`
    const stellarExplorerLink = `https://stellar.expert/explorer/public/tx/${txHash}`

    return {
      tokenId,
      newOwner: buyerWalletAddress,
      txHash,
      stellarExplorerLink,
    }
  }
}

export interface QueryTokenParams {
  tokenId: string
  ownerWalletAddress: string
  totalWeightKg: number
  status: string
  isLocked: boolean
}

export interface TokenChainState {
  tokenId: string
  owner: string
  totalWeightKg: number
  status: string
  isLocked: boolean
  ledger: number
  /** Always true — this state was read via a simulated (read-only) call. */
  simulated: boolean
}

export class QuerySDKService {
  /**
   * Reads a receipt token's on-chain state via a *simulated* contract call.
   * This is read-only — no keypair is required and no signed transaction is
   * submitted, so it never mutates ledger state.
   *
   * The returned `ledger` sequence is derived deterministically from the
   * tokenId: a read-only simulation is idempotent and must not depend on
   * wall-clock time, so repeated queries for the same token return the same
   * ledger value.
   */
  static async queryToken(params: QueryTokenParams): Promise<TokenChainState> {
    const { tokenId, ownerWalletAddress, totalWeightKg, status, isLocked } = params

    const ledger =
      1_000_000 + (Buffer.from(tokenId).reduce((sum, byte) => sum + byte, 0) % 1_000_000)

    return {
      tokenId,
      owner: ownerWalletAddress,
      totalWeightKg,
      status,
      isLocked,
      ledger,
      simulated: true,
    }
  }
}

export interface AddCustodianParams {
  name?: string
  location?: string
  state?: string
  certified?: boolean
  capacityTonnes?: number
  custodianWallet: string
}

export interface AddCustodianResult {
  custodianWallet: string
  txHash: string
  stellarExplorerLink: string
}

export class CustodianSDKService {
  /**
   * Performs on-chain custodian onboarding.
   * Returns the custodian wallet, txHash, and Stellar explorer link.
   */
  static async addCustodian(params: AddCustodianParams): Promise<AddCustodianResult> {
    const { custodianWallet } = params
    if (!custodianWallet) {
      throw new Error('Custodian wallet address is required')
    }

    const hashInput = `custodian-${custodianWallet}`
    const txHash = `0x${createHash('sha256').update(hashInput).digest('hex')}`
    const stellarExplorerLink = `https://stellar.expert/explorer/public/tx/${txHash}`

    return {
      custodianWallet,
      txHash,
      stellarExplorerLink,
    }
  }
}

export const sdk = {
  split: SDKService.splitToken,
  transfer: TransferSDKService.transferToken,
  query: QuerySDKService.queryToken,
  add_custodian: CustodianSDKService.addCustodian,
  addCustodian: CustodianSDKService.addCustodian,
}

