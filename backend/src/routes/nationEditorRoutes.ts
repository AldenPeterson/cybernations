import { Router } from 'express';
import { NationEditorController } from '../controllers/nationEditorController.js';
import { validateAllianceId, validateNationId, validateSlots } from '../middleware/validation.js';
import { requireCapability } from '../middleware/authMiddleware.js';

export const nationEditorRoutes = Router();

// Get nations data from alliance files for a specific alliance (backend protects with manage_alliance capability)
nationEditorRoutes.get(
  '/alliances/:allianceId/nations-config',
  validateAllianceId,
  requireCapability('manage_alliance', { paramKey: 'allianceId' }),
  NationEditorController.getNationsConfig
);

// Update a specific nation's data in alliance files
nationEditorRoutes.put(
  '/alliances/:allianceId/nations/:nationId',
  validateAllianceId,
  requireCapability('manage_alliance', { paramKey: 'allianceId' }),
  validateNationId,
  validateSlots,
  NationEditorController.updateNation
);
