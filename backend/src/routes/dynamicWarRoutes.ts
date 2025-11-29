import { Router } from 'express';
import { DynamicWarController } from '../controllers/dynamicWarController.js';

export const dynamicWarRoutes = Router();

// Add or update wars in the War table (same as CSV sync process)
// This endpoint now updates the wars table directly instead of a separate dynamic_wars table
dynamicWarRoutes.post('/dynamic-wars/ingest', DynamicWarController.addDynamicWar);
