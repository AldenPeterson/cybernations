import { Router } from 'express';
import { DynamicWarController } from '../controllers/dynamicWarController.js';

export const dynamicWarRoutes = Router();

// Add a new dynamic war
dynamicWarRoutes.post('/dynamic-wars/ingest', DynamicWarController.addDynamicWar);

// Get all dynamic wars
dynamicWarRoutes.get('/dynamic-wars', DynamicWarController.getAllDynamicWars);

// Get active dynamic wars only
dynamicWarRoutes.get('/dynamic-wars/active', DynamicWarController.getActiveDynamicWars);

// Get dynamic wars by alliance
dynamicWarRoutes.get('/alliances/:allianceId/dynamic-wars', DynamicWarController.getDynamicWarsByAlliance);

// Get dynamic wars by nation
dynamicWarRoutes.get('/nations/:nationId/dynamic-wars', DynamicWarController.getDynamicWarsByNation);

// Remove a specific dynamic war
dynamicWarRoutes.delete('/dynamic-wars/:warId', DynamicWarController.removeDynamicWar);

// Clear all dynamic wars
dynamicWarRoutes.delete('/dynamic-wars', DynamicWarController.clearAllDynamicWars);

// Cleanup old dynamic wars
dynamicWarRoutes.post('/dynamic-wars/cleanup', DynamicWarController.cleanupOldWars);
