type MintResult = {
  txHash: string
  tokenId: string
}

export const mint = async (_depositData: unknown): Promise<MintResult> => {
  return {
    txHash: 'mock-tx-hash',
    tokenId: 'mock-token-id',
  }
}
