import { Router } from 'express';
import { AidController } from '../controllers/aidController.js';
import { validateAllianceId } from '../middleware/validation.js';

export const aidRoutes = Router();

// Get aid slots for a specific alliance
aidRoutes.get('/alliances/:allianceId/aid-slots', validateAllianceId, AidController.getAidSlots);

// Get alliance aid statistics
aidRoutes.get('/alliances/:allianceId/aid-stats', validateAllianceId, AidController.getAllianceAidStats);

// Get active aid offers grouped by alliance
aidRoutes.get('/alliances/:allianceId/active-aid-by-alliance', validateAllianceId, AidController.getActiveAidOffersByAlliance);

// Get aid recommendations for an alliance
aidRoutes.get('/alliances/:allianceId/recommendations', validateAllianceId, AidController.getAidRecommendations);

// Get categorized nations with slots for a specific alliance
aidRoutes.get('/alliances/:allianceId/categorized-nations', validateAllianceId, AidController.getCategorizedNations);

// Get nation aid efficiency for an alliance over a date range
aidRoutes.get('/alliances/:allianceId/nation-aid-efficiency', validateAllianceId, AidController.getNationAidEfficiency);

// Get alliance aid totals aggregated by alliance over a date range
aidRoutes.get('/alliance-aid-totals', AidController.getAllianceAidTotals);

// Get interalliance aid data between two alliances
aidRoutes.get('/interalliance-aid/:alliance1Id/:alliance2Id', AidController.getInterallianceAid);

// Get small aid offers
aidRoutes.get('/small-aid-offers', AidController.getSmallAidOffers);
