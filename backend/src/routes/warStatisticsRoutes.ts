import { Router } from 'express';
import { WarStatisticsController } from '../controllers/warStatisticsController.js';

export const warStatisticsRoutes = Router();

// War statistics endpoints
warStatisticsRoutes.get('/war-statistics', WarStatisticsController.getWarStatistics);
warStatisticsRoutes.get('/war-statistics/alliance-totals', WarStatisticsController.getAllianceTotals);
warStatisticsRoutes.get('/war-statistics/nation-breakdown', WarStatisticsController.getNationBreakdown);

