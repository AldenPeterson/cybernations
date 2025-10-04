import { Request, Response } from 'express';
import { DefendingWarsService } from '../services/defendingWarsService.js';

export class DefendingWarsController {
  /**
   * Get wars organized by nation for a specific alliance
   */
  static async getNationWars(req: Request, res: Response) {
    try {
      const allianceId = parseInt(req.params.allianceId);
      const includePeaceMode = req.query.includePeaceMode === 'true';
      
      if (isNaN(allianceId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid alliance ID'
        });
      }

      const nationWars = await DefendingWarsService.getNationWars(allianceId, includePeaceMode);
      
      res.json({
        success: true,
        allianceId,
        nationWars
      });
    } catch (error) {
      console.error('Error fetching nation wars:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get defending wars for a specific alliance
   */
  static async getDefendingWars(req: Request, res: Response) {
    try {
      const allianceId = parseInt(req.params.allianceId);
      
      if (isNaN(allianceId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid alliance ID'
        });
      }

      const defendingWars = await DefendingWarsService.getDefendingWars(allianceId);
      
      res.json({
        success: true,
        allianceId,
        defendingWars
      });
    } catch (error) {
      console.error('Error fetching defending wars:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get defending wars statistics for an alliance
   */
  static async getDefendingWarsStats(req: Request, res: Response) {
    try {
      const allianceId = parseInt(req.params.allianceId);
      
      if (isNaN(allianceId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid alliance ID'
        });
      }

      const stats = await DefendingWarsService.getDefendingWarsStats(allianceId);

      res.json({
        success: true,
        allianceId,
        stats
      });
    } catch (error) {
      console.error('Error fetching defending wars stats:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
