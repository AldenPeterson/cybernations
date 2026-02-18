import { Request, Response } from 'express';
import { WarManagementService } from '../services/warManagementService.js';
import { WarAssignmentService } from '../services/warAssignmentService.js';

export class WarManagementController {
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

      const nationWars = await WarManagementService.getNationWars(allianceId, includePeaceMode, needsStagger);
      
      // Count nations and wars
      const nationCount = nationWars.length;
      const totalWars = nationWars.reduce((count, nw) => {
        return count + nw.attackingWars.length + nw.defendingWars.length;
      }, 0);
      const defendingWarsCount = nationWars.reduce((count, nw) => count + nw.defendingWars.length, 0);
      const attackingWarsCount = nationWars.reduce((count, nw) => count + nw.attackingWars.length, 0);
      console.log(`[API] getNationWars (allianceId: ${allianceId}, includePeaceMode: ${includePeaceMode}, needsStagger: ${needsStagger}): Returning ${nationCount} nations with ${totalWars} total wars (${defendingWarsCount} defending, ${attackingWarsCount} attacking)`);
      
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
   * Get active war assignments for an alliance
   */
  static async getWarAssignments(req: Request, res: Response) {
    try {
      const allianceId = parseInt(req.params.allianceId);
      if (isNaN(allianceId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid alliance ID'
        });
      }

      const assignments = await WarAssignmentService.listActiveAssignmentsForAlliance(allianceId);

      res.json({
        success: true,
        assignments
      });
    } catch (error) {
      console.error('Error in getWarAssignments:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch war assignments'
      });
    }
  }

  /**
   * Create a new war assignment for an alliance
   */
  static async createWarAssignment(req: Request, res: Response) {
    try {
      const allianceId = parseInt(req.params.allianceId);
      if (isNaN(allianceId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid alliance ID'
        });
      }

      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const { attackerNationId, defenderNationId, assignmentDate, note } = req.body || {};

      if (!attackerNationId || !defenderNationId || !assignmentDate) {
        return res.status(400).json({
          success: false,
          error: 'attackerNationId, defenderNationId, and assignmentDate are required'
        });
      }

      const assignment = await WarAssignmentService.createAssignment({
        allianceId,
        attackerNationId: Number(attackerNationId),
        defenderNationId: Number(defenderNationId),
        assignmentDate: String(assignmentDate),
        note: note ? String(note) : undefined,
        createdByUserId: userId
      });

      res.status(201).json({
        success: true,
        assignment
      });
    } catch (error: any) {
      console.error('Error in createWarAssignment:', error);
      const message = error instanceof Error ? error.message : 'Failed to create war assignment';
      res.status(400).json({
        success: false,
        error: message
      });
    }
  }

  /**
   * Delete a war assignment for an alliance
   */
  static async deleteWarAssignment(req: Request, res: Response) {
    try {
      const allianceId = parseInt(req.params.allianceId);
      const assignmentId = parseInt(req.params.assignmentId);
      
      if (isNaN(allianceId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid alliance ID'
        });
      }

      if (isNaN(assignmentId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid assignment ID'
        });
      }

      await WarAssignmentService.deleteAssignment(assignmentId, allianceId);

      res.json({
        success: true,
        message: 'Assignment deleted successfully'
      });
    } catch (error: any) {
      console.error('Error in deleteWarAssignment:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete war assignment';
      res.status(400).json({
        success: false,
        error: message
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

      const defendingWars = await WarManagementService.getDefendingWars(allianceId);
      
      console.log(`[API] getDefendingWars (allianceId: ${allianceId}): Returning ${defendingWars.length} defending wars`);
      
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

      const stats = await WarManagementService.getDefendingWarsStats(allianceId, includeExpired);

      console.log(`[API] getDefendingWarsStats (allianceId: ${allianceId}, includeExpired: ${includeExpired}): ${stats.totalDefendingWars} defending wars, ${stats.totalAttackingWars} attacking wars, ${stats.totalActiveWars} total active wars`);

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

      const stats = await WarManagementService.getDefendingWarsStats(allianceId, includeExpired);

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

      console.log(`[API] getAllianceWarCounts (allianceId: ${allianceId}, includeExpired: ${includeExpired}): ${stats.totalDefendingWars} defending wars, ${stats.totalAttackingWars} attacking wars, ${stats.totalActiveWars} total active wars, ${byAlliance.length} opposing alliances`);

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
