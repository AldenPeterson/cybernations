import { Router } from 'express';
import { StatsController } from '../controllers/statsController.js';
import { AllianceController } from '../controllers/allianceController.js';
import { aidRoutes } from './aidRoutes.js';
import { nationEditorRoutes } from './nationEditorRoutes.js';

export const apiRoutes = Router();

// Use aid routes
apiRoutes.use('/', aidRoutes);

// Use nation editor routes
apiRoutes.use('/', nationEditorRoutes);

// Stats decode endpoint - extract zip files from raw_data folder
apiRoutes.post('/stats/decode', StatsController.decodeStats);

// Dashboard API endpoints
apiRoutes.get('/alliances', AllianceController.getAlliances);
apiRoutes.get('/alliances/:allianceId/stats', AllianceController.getAllianceStats);
apiRoutes.get('/alliances/:allianceId/nuclear-stats', AllianceController.getNuclearWeaponStats);
apiRoutes.post('/sync/alliances', AllianceController.syncAlliances);



