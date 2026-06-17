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
