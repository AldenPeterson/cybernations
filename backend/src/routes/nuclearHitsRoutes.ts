import { Router } from 'express';
import { NuclearHitsController } from '../controllers/nuclearHitsController.js';

export const nuclearHitsRoutes = Router();

// Ingest a list of nuclear hit reports
nuclearHitsRoutes.post('/nuclear/ingest', NuclearHitsController.ingest);

// Retrieve all stored nuclear hits (keyed object)
nuclearHitsRoutes.get('/nuclear', NuclearHitsController.all);

// Retrieve computed nuclear attempt distribution stats
nuclearHitsRoutes.get('/nuclear/stats', NuclearHitsController.stats);

// Retrieve timeline aggregated counts by interval (default 5 minutes)
nuclearHitsRoutes.get('/nuclear/timeline', NuclearHitsController.timeline);


