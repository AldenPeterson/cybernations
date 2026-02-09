import { Router } from 'express';
import { WarStatisticsController } from '../controllers/warStatisticsController.js';

export const warStatisticsRoutes = Router();

// War statistics endpoints - optimized with caching and filtering
warStatisticsRoutes.get('/war-statistics/alliance-totals', WarStatisticsController.getAllianceTotals);
warStatisticsRoutes.get('/war-statistics/nation-breakdown', WarStatisticsController.getNationBreakdown);
warStatisticsRoutes.get('/war-statistics/war-records', WarStatisticsController.getWarRecords);
warStatisticsRoutes.post('/war-statistics/invalidate-cache', WarStatisticsController.invalidateCache);

