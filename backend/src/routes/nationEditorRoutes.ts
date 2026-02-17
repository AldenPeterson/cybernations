import { Router } from 'express';
import { NationEditorController } from '../controllers/nationEditorController.js';
import { validateAllianceId, validateNationId, validateSlots } from '../middleware/validation.js';

export const nationEditorRoutes = Router();

// Get nations data from alliance files for a specific alliance
nationEditorRoutes.get('/alliances/:allianceId/nations-config', validateAllianceId, NationEditorController.getNationsConfig);

// Update a specific nation's data in alliance files
nationEditorRoutes.put(
  '/alliances/:allianceId/nations/:nationId',
  validateAllianceId,
  validateNationId,
  validateSlots,
  NationEditorController.updateNation
);
