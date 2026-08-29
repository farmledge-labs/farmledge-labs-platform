type MintResult = {
  txHash: string;
  tokenId: string;
};

export type BurnParams = {
  tokenId: string;
  exitReason?: string;
  deliveryNoteNumber?: string;
};

export type BurnResult = {
  txHash: string;
  tokenId: string;
  stellarExplorerLink: string;
};

export const mint = async (_depositData: unknown): Promise<MintResult> => {
  return {
    txHash: 'mock-tx-hash',
    tokenId: 'mock-token-id',
  };
};

export const burn = async ({ tokenId }: BurnParams): Promise<BurnResult> => {
  const txHash = `0x${Buffer.from(`burn-${tokenId}`).toString('hex').slice(0, 64)}`;

  return {
    txHash,
    tokenId,
    stellarExplorerLink: `https://stellar.expert/explorer/testnet/tx/${txHash}`,
  };
};

export const stellarService = { burn };

export const farmerWalletSigner = {
  signAsFarmer: async (): Promise<string> => {
    return 'mock-farmer-signature';
  },
};
