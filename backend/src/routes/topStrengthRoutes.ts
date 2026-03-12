import { Router } from 'express';
import { TopStrengthController } from '../controllers/topStrengthController.js';

export const topStrengthRoutes = Router();

// Get top nations by strength with alliance aggregates
topStrengthRoutes.get('/top-strength', TopStrengthController.getTopStrength);

