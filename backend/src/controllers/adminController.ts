import { Request, Response } from 'express';
import { AdminService } from '../services/adminService.js';

export class AdminController {
  /**
   * Search for nations by name or ruler name
   */
  static async searchNations(req: Request, res: Response) {
    try {
      const query = req.query.q as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

      if (!query || query.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Search query is required'
        });
      }

      const results = await AdminService.searchNations(query.trim(), limit);

      res.json({
        success: true,
        nations: results
      });
    } catch (error) {
      console.error('Error in searchNations:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search nations'
      });
    }
  }

  /**
   * Set or clear the targeting alliance override for a nation
   */
  static async setNationTargetingAlliance(req: Request, res: Response) {
    try {
      const nationId = parseInt(req.params.nationId);
      const { targetingAllianceId } = req.body;

      if (isNaN(nationId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid nation ID'
        });
      }

      // targetingAllianceId can be null to clear the override
      const allianceId = targetingAllianceId === null || targetingAllianceId === undefined
        ? null
        : parseInt(String(targetingAllianceId), 10);

      if (allianceId !== null && isNaN(allianceId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid targeting alliance ID'
        });
      }

      const result = await AdminService.setNationTargetingAlliance(nationId, allianceId);

      res.json({
        success: true,
        nation: result
      });
    } catch (error) {
      console.error('Error in setNationTargetingAlliance:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set targeting alliance'
      });
    }
  }

  /**
   * Search for wars by war ID, nation name, or ruler name
   */
  static async searchWars(req: Request, res: Response) {
    try {
      const query = req.query.q as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const activeOnly = req.query.activeOnly !== 'false'; // Default to true if not explicitly false

      if (!query || query.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Search query is required'
        });
      }

      const results = await AdminService.searchWars(query.trim(), limit, activeOnly);

      res.json({
        success: true,
        wars: results
      });
    } catch (error) {
      console.error('Error in searchWars:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search wars'
      });
    }
  }

  /**
   * Update the declaring or receiving alliance ID for a war
   */
  static async updateWarAllianceIds(req: Request, res: Response) {
    try {
      const warId = parseInt(req.params.warId);
      const { declaringAllianceId, receivingAllianceId } = req.body;

      if (isNaN(warId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid war ID'
        });
      }

      // Parse alliance IDs (can be null to clear, or undefined to leave unchanged)
      let parsedDeclaringAllianceId: number | null | undefined = undefined;
      if (declaringAllianceId !== undefined) {
        parsedDeclaringAllianceId = declaringAllianceId === null
          ? null
          : parseInt(String(declaringAllianceId), 10);
        if (parsedDeclaringAllianceId !== null && isNaN(parsedDeclaringAllianceId)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid declaring alliance ID'
          });
        }
      }

      let parsedReceivingAllianceId: number | null | undefined = undefined;
      if (receivingAllianceId !== undefined) {
        parsedReceivingAllianceId = receivingAllianceId === null
          ? null
          : parseInt(String(receivingAllianceId), 10);
        if (parsedReceivingAllianceId !== null && isNaN(parsedReceivingAllianceId)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid receiving alliance ID'
          });
        }
      }

      // At least one field must be provided
      if (parsedDeclaringAllianceId === undefined && parsedReceivingAllianceId === undefined) {
        return res.status(400).json({
          success: false,
          error: 'At least one alliance ID (declaringAllianceId or receivingAllianceId) must be provided'
        });
      }

      const result = await AdminService.updateWarAllianceIds(
        warId,
        parsedDeclaringAllianceId,
        parsedReceivingAllianceId
      );

      res.json({
        success: true,
        war: result
      });
    } catch (error) {
      console.error('Error in updateWarAllianceIds:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update war alliance IDs'
      });
    }
  }
}

