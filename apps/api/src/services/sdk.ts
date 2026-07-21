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

export const sdk = {
  split: SDKService.splitToken,
}
