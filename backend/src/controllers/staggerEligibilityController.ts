import { Request, Response } from 'express';
import { StaggerEligibilityService } from '../services/staggerEligibilityService.js';

export class StaggerEligibilityController {
  /**
   * Get stagger eligibility data for two alliances
   */
  static async getStaggerEligibility(req: Request, res: Response) {
    try {
      const attackingAllianceId = parseInt(req.params.attackingAllianceId);
      const defendingAllianceId = parseInt(req.params.defendingAllianceId);
      const hideAnarchy = req.query.hideAnarchy === 'true';
      const hidePeaceMode = req.query.hidePeaceMode === 'true';
      const hideNonPriority = req.query.hideNonPriority === 'true';
      
      if (isNaN(attackingAllianceId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid attacking alliance ID'
        });
      }
      
      if (isNaN(defendingAllianceId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid defending alliance ID'
        });
      }
      
      if (attackingAllianceId === defendingAllianceId) {
        return res.status(400).json({
          success: false,
          error: 'Attacking and defending alliances cannot be the same'
        });
      }
      
      const staggerData = await StaggerEligibilityService.getStaggerEligibility(
        attackingAllianceId,
        defendingAllianceId,
        hideAnarchy,
        hidePeaceMode,
        hideNonPriority
      );
      
      res.json({
        success: true,
        attackingAllianceId,
        defendingAllianceId,
        staggerData,
        filters: {
          hideAnarchy,
          hidePeaceMode,
          hideNonPriority
        }
      });
      
    } catch (error) {
      console.error('Error getting stagger eligibility:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get stagger eligibility data'
      });
    }
  }
}
