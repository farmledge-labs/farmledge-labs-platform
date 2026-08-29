import { CommodityType, Grade } from './token.js';

export interface DepositRequestBody {
  farmer_id: string;
  commodity: CommodityType;
  grade: Grade;
  bag_count: number;
  weight_per_bag_kg: number;
  warehouse_id: string;
  photos: string[];
}

export interface ExitRequestBody {
  exit_reason: string;
  delivery_note_number: string;
}

export interface TransferRequestBody {
  token_id: string;
  buyer_wallet_address: string;
}

export interface LockRequestBody {
  lender_id: string;
  loan_reference: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface TokenRecord {
  token_id: string;
  farmer_id: string;
  commodity: CommodityType;
  grade: Grade;
  bag_count: number;
  weight_per_bag_kg: number;
  total_weight_kg: number;
  warehouse_id: string;
  warehouse_name: string;
  warehouse_certified: boolean;
  custodian_wallet: string;
  deposit_date: string;
  status: string;
  is_locked: boolean;
  tx_hash: string;
  stellar_explorer_link: string;
}

export interface JWTPayload {
  sub: string;
  role: 'farmer' | 'custodian';
  iat: number;
  exp: number;
}

export interface LenderAPIKeyPayload {
  lender_id: string;
  key_id: string;
}
