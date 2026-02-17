import { Router } from 'express';
import { NationEditorController } from '../controllers/nationEditorController.js';
import { validateAllianceId, validateNationId, validateSlots } from '../middleware/validation.js';
import { requireAllianceManagerFromRequest } from '../middleware/authMiddleware.js';

export const nationEditorRoutes = Router();

// Get nations data from alliance files for a specific alliance
nationEditorRoutes.get(
  '/alliances/:allianceId/nations-config',
  requireAllianceManagerFromRequest,
  validateAllianceId,
  NationEditorController.getNationsConfig
);

// Update a specific nation's data in alliance files
nationEditorRoutes.put(
  '/alliances/:allianceId/nations/:nationId',
  requireAllianceManagerFromRequest,
  validateAllianceId,
  validateNationId,
  validateSlots,
  NationEditorController.updateNation
);
