import { Router } from 'express';
import { AidController } from '../controllers/aidController.js';
import { validateAllianceId } from '../middleware/validation.js';

export const aidRoutes = Router();

// Get aid slots for a specific alliance
aidRoutes.get('/alliances/:allianceId/aid-slots', validateAllianceId, AidController.getAidSlots);

// Get alliance aid statistics
aidRoutes.get('/alliances/:allianceId/aid-stats', validateAllianceId, AidController.getAllianceAidStats);

// Get aid recommendations for an alliance
aidRoutes.get('/alliances/:allianceId/recommendations', validateAllianceId, AidController.getAidRecommendations);

// Get categorized nations with slots for a specific alliance
aidRoutes.get('/alliances/:allianceId/categorized-nations', validateAllianceId, AidController.getCategorizedNations);


// Get small aid offers
aidRoutes.get('/small-aid-offers', AidController.getSmallAidOffers);
