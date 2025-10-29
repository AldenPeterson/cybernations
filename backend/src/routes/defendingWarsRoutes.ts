import { Router } from 'express';
import { DefendingWarsController } from '../controllers/defendingWarsController.js';
import { validateAllianceId } from '../middleware/validation.js';

export const defendingWarsRoutes = Router();

// Get wars organized by nation for a specific alliance
defendingWarsRoutes.get('/alliances/:allianceId/nation-wars', validateAllianceId, DefendingWarsController.getNationWars);

// Get defending wars for a specific alliance
defendingWarsRoutes.get('/alliances/:allianceId/defending-wars', validateAllianceId, DefendingWarsController.getDefendingWars);

// Get defending wars statistics for an alliance
defendingWarsRoutes.get('/alliances/:allianceId/defending-wars-stats', validateAllianceId, DefendingWarsController.getDefendingWarsStats);

// Get active war counts (attacking vs defending) for an alliance
defendingWarsRoutes.get('/alliances/:allianceId/war-counts', validateAllianceId, DefendingWarsController.getAllianceWarCounts);
