import { Router } from 'express';
import { StatsController } from '../controllers/statsController.js';
import { AllianceController } from '../controllers/allianceController.js';
import { CronController } from '../controllers/cronController.js';
import { AidEfficiencyController } from '../controllers/aidEfficiencyController.js';
import { aidRoutes } from './aidRoutes.js';
import { nationEditorRoutes } from './nationEditorRoutes.js';
import { defendingWarsRoutes } from './defendingWarsRoutes.js';
import { dynamicWarRoutes } from './dynamicWarRoutes.js';
import staggerEligibilityRoutes from './staggerEligibilityRoutes.js';
import { nuclearHitsRoutes } from './nuclearHitsRoutes.js';
import { csvRoutes } from './csvRoutes.js';

export const apiRoutes = Router();

// Use aid routes
apiRoutes.use('/', aidRoutes);

// Use nation editor routes
apiRoutes.use('/', nationEditorRoutes);

// Use defending wars routes
apiRoutes.use('/', defendingWarsRoutes);

// Use dynamic wars routes
apiRoutes.use('/', dynamicWarRoutes);

// Use stagger eligibility routes
apiRoutes.use('/stagger-eligibility', staggerEligibilityRoutes);

// Nuclear hits routes
apiRoutes.use('/', nuclearHitsRoutes);

// CSV management routes
apiRoutes.use('/', csvRoutes);

// Stats decode endpoint - extract zip files from raw_data folder
apiRoutes.post('/stats/decode', StatsController.decodeStats);

// Dashboard API endpoints
apiRoutes.get('/alliances', AllianceController.getAlliances);
apiRoutes.get('/alliances/:allianceId/stats', AllianceController.getAllianceStats);
apiRoutes.get('/alliances/:allianceId/nuclear-stats', AllianceController.getNuclearWeaponStats);
apiRoutes.post('/sync/alliances', AllianceController.syncAlliances);

// Aid efficiency endpoint
apiRoutes.get('/aid-efficiency', AidEfficiencyController.getAidEfficiency);

// Cron job endpoints (protected by CRON_SECRET)
apiRoutes.post('/cron/sync-all', CronController.syncAll);
apiRoutes.post('/cron/sync-all-detailed', CronController.syncAllDetailed);
apiRoutes.post('/cron/run-post-processing', CronController.runPostProcessing);



