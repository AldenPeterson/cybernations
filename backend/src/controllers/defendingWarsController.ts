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
      const needsStagger = req.query.needsStagger === 'true';
      
      if (isNaN(allianceId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid alliance ID'
        });
      }

      const nationWars = await DefendingWarsService.getNationWars(allianceId, includePeaceMode, needsStagger);
      
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
      const includeExpired = req.query.includeExpired === 'true';
      
      if (isNaN(allianceId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid alliance ID'
        });
      }

      const stats = await DefendingWarsService.getDefendingWarsStats(allianceId, includeExpired);

      res.json({
        success: true,
        allianceId,
        stats,
        includeExpired
      });
    } catch (error) {
      console.error('Error fetching defending wars stats:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get active war counts (attacking vs defending) for an alliance
   */
  static async getAllianceWarCounts(req: Request, res: Response) {
    try {
      const allianceId = parseInt(req.params.allianceId);
      const includeExpired = req.query.includeExpired === 'true';

      if (isNaN(allianceId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid alliance ID'
        });
      }

      const stats = await DefendingWarsService.getDefendingWarsStats(allianceId, includeExpired);

      // Merge attacking/defending counts by opposing alliance
      const byAllianceMap = new Map<number, { allianceId: number; allianceName: string; attacking: number; defending: number; total: number }>();

      for (const a of stats.attackingByAlliance) {
        const current = byAllianceMap.get(a.allianceId) || { allianceId: a.allianceId, allianceName: a.allianceName, attacking: 0, defending: 0, total: 0 };
        current.attacking += a.count;
        current.total = current.attacking + current.defending;
        byAllianceMap.set(a.allianceId, current);
      }

      for (const d of stats.defendingByAlliance) {
        const current = byAllianceMap.get(d.allianceId) || { allianceId: d.allianceId, allianceName: d.allianceName, attacking: 0, defending: 0, total: 0 };
        current.defending += d.count;
        current.total = current.attacking + current.defending;
        byAllianceMap.set(d.allianceId, current);
      }

      const byAlliance = Array.from(byAllianceMap.values()).sort((a, b) => b.total - a.total);

      res.json({
        success: true,
        allianceId,
        counts: {
          attacking: stats.totalAttackingWars,
          defending: stats.totalDefendingWars,
          activeTotal: stats.totalActiveWars,
          byAlliance
        },
        includeExpired
      });
    } catch (error) {
      console.error('Error fetching alliance war counts:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
