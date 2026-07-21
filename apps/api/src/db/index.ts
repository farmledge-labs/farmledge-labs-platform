import { type TokenRecord } from 'shared/src/types'

// In-memory store for mocking DB
const tokens: TokenRecord[] = []

export const findTokenByTxHash = async (txHash: string): Promise<TokenRecord | undefined> => {
  return tokens.find((t) => t.tx_hash === txHash)
}

export const createToken = async (
  tokenData: Omit<TokenRecord, 'stellar_explorer_link'>
): Promise<TokenRecord> => {
  const newRecord: TokenRecord = {
    ...tokenData,
    stellar_explorer_link: `https://stellar.expert/explorer/testnet/tx/${tokenData.tx_hash}`,
  }
  tokens.push(newRecord)
  return newRecord
}

// Utility to clear the mock DB between tests
export const _clearTokens = () => {
  tokens.length = 0
}