import { Router } from 'express';
import { WarManagementController } from '../controllers/warManagementController.js';
import { validateAllianceId } from '../middleware/validation.js';

export const warManagementRoutes = Router();

// Get wars organized by nation for a specific alliance
warManagementRoutes.get('/alliances/:allianceId/nation-wars', validateAllianceId, WarManagementController.getNationWars);

// Get defending wars for a specific alliance
warManagementRoutes.get('/alliances/:allianceId/defending-wars', validateAllianceId, WarManagementController.getDefendingWars);

// Get defending wars statistics for an alliance
warManagementRoutes.get('/alliances/:allianceId/defending-wars-stats', validateAllianceId, WarManagementController.getDefendingWarsStats);

// Get active war counts (attacking vs defending) for an alliance
warManagementRoutes.get('/alliances/:allianceId/war-counts', validateAllianceId, WarManagementController.getAllianceWarCounts);
