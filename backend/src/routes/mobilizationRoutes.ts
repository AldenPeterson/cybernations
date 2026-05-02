import { Router } from 'express';
import { MobilizationController } from '../controllers/mobilizationController.js';
import { WarModeHistoryController } from '../controllers/warModeHistoryController.js';
import { validateAllianceId } from '../middleware/validation.js';

export const mobilizationRoutes = Router();

mobilizationRoutes.get(
  '/alliances/:allianceId/mobilization',
  validateAllianceId,
  MobilizationController.getMobilization
);

mobilizationRoutes.get(
  '/alliances/:allianceId/war-mode-history',
  validateAllianceId,
  WarModeHistoryController.getWarModeHistory
);
