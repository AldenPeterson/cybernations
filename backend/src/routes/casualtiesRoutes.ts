import { Router } from 'express';
import { CasualtiesController } from '../controllers/casualtiesController.js';

export const casualtiesRoutes = Router();

// Get casualties statistics
casualtiesRoutes.get('/casualties', CasualtiesController.getCasualtiesStats);

// Get alliance-level casualties statistics
casualtiesRoutes.get('/casualties/alliances', CasualtiesController.getAllianceCasualtiesStats);

// Get all alliance members' casualty statistics
casualtiesRoutes.get('/casualties/alliance/:allianceId', CasualtiesController.getAllianceMembersCasualtiesStats);

// Invalidate casualties cache
casualtiesRoutes.post('/casualties/invalidate-cache', CasualtiesController.invalidateCache);

