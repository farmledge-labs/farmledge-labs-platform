import type { TokenRecord } from '@farmledge/shared'

export const findTokenByTxHash = async (_txHash: string): Promise<TokenRecord | null> => {
  return null
}

export const createToken = async (
  token: Omit<TokenRecord, 'stellar_explorer_link'>,
): Promise<TokenRecord> => {
  return {
    ...token,
    stellar_explorer_link: `https://stellar.expert/explorer/testnet/tx/${token.tx_hash}`,
  }
}
