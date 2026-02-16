import { Router } from 'express';
import { CasualtiesController } from '../controllers/casualtiesController.js';

export const casualtiesRoutes = Router();

// Get casualties statistics
casualtiesRoutes.get('/casualties', CasualtiesController.getCasualtiesStats);

// Get alliance-level casualties statistics
casualtiesRoutes.get('/casualties/alliances', CasualtiesController.getAllianceCasualtiesStats);

// Invalidate casualties cache
casualtiesRoutes.post('/casualties/invalidate-cache', CasualtiesController.invalidateCache);

