import { Router } from 'express';
import { StaggerEligibilityController } from '../controllers/staggerEligibilityController.js';

const router = Router();

// Get stagger eligibility data for two alliances
router.get('/:attackingAllianceId/:defendingAllianceId', 
  StaggerEligibilityController.getStaggerEligibility
);

export default router;
