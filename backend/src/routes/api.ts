import { Router } from 'express';
import { StatsController } from '../controllers/statsController.js';
import { AllianceController } from '../controllers/allianceController.js';
import { aidRoutes } from './aidRoutes.js';

export const apiRoutes = Router();

// Use aid routes
apiRoutes.use('/', aidRoutes);

// Stats decode endpoint - extract zip files from raw_data folder
apiRoutes.post('/stats/decode', StatsController.decodeStats);

// Dashboard API endpoints
apiRoutes.get('/alliances', AllianceController.getAlliances);
apiRoutes.get('/alliances/:allianceId/stats', AllianceController.getAllianceStats);
apiRoutes.post('/sync/alliances', AllianceController.syncAlliances);



