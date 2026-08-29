import { Router } from 'express';
import { requireJWT } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { DepositSchema, ExitSchema } from '../schemas/index.js';
import { processExit } from '../controllers/custodian.controller.js';
import { createDeposit, getWarehouseInventory } from './custodian.controller.js';

export const custodianRouter = Router();

custodianRouter.post('/deposits', requireJWT, validate(DepositSchema), createDeposit);

custodianRouter.post('/exits/:token_id', requireJWT, validate(ExitSchema), processExit);

custodianRouter.get('/warehouse/:warehouse_id/inventory', requireJWT, getWarehouseInventory);
