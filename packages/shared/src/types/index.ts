export type Commodity = 'MAIZE_WHITE' | 'MAIZE_YELLOW' | 'SESAME';

export type Grade = 'Grade A' | 'Grade B' | 'Grade C';

export type TokenStatus = 'active' | 'transferred' | 'exited';

export interface TokenRecord {
  token_id: string;
  farmer_id: string;
  commodity: Commodity;
  grade: Grade;
  bag_count: number;
  weight_per_bag_kg: number;
  total_weight_kg: number;
  warehouse_id: string;
  warehouse_name: string;
  warehouse_certified: boolean;
  custodian_wallet: string;
  deposit_date: string;
  status: TokenStatus;
  is_locked: boolean;
  locked_by_lender_id?: string;
  loan_reference?: string;
  exit_date?: string;
  tx_hash: string;
  stellar_explorer_link: string;
}
