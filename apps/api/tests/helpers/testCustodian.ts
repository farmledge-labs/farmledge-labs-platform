import { signToken } from '../../src/lib/jwt.js'

export const testCustodian = {
  id: 'custodian-e2e',
  warehouseId: 'warehouse-e2e',
  token: signToken({ sub: 'custodian-e2e', role: 'custodian' }),
}

export function custodianHeaders() {
  return {
    Authorization: `Bearer ${testCustodian.token}`,
    'Content-Type': 'application/json',
  }
}