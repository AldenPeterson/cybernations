import { Request, Response } from 'express';
import { DynamicWarService } from '../services/dynamicWarService.js';
import { DynamicWar } from '../models/DynamicWar.js';

export class DynamicWarController {
  /**
   * Add dynamic wars (supports both single war and array of wars)
   */
  static async addDynamicWar(req: Request, res: Response) {
    try {
      const { source = 'api' } = req.body;

      // Determine if input is array or single object
      const warsToProcess = Array.isArray(req.body) ? req.body : [req.body];
      
      if (!Array.isArray(warsToProcess) || warsToProcess.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Request body must be an array of wars or a single war object'
        });
      }

      const results = [];
      const errors = [];

      for (let i = 0; i < warsToProcess.length; i++) {
        try {
          const warData = warsToProcess[i];
          const {
            warId,
            declaringId,
            declaringRuler,
            declaringNation,
            declaringAlliance,
            declaringAllianceId,
            receivingId,
            receivingRuler,
            receivingNation,
            receivingAlliance,
            receivingAllianceId,
            status,
            date,
            endDate,
            reason,
            destruction,
            attackPercent,
            defendPercent
          } = warData;

          // Validate required fields
          if (!warId || !declaringId || !receivingId || !status || !date || !endDate) {
            errors.push({
              index: i,
              warId: warId || 'unknown',
              error: 'Missing required fields: warId, declaringId, receivingId, status, date, endDate'
            });
            continue;
          }

          // Validate numeric fields
          if (isNaN(warId) || isNaN(declaringId) || isNaN(receivingId)) {
            errors.push({
              index: i,
              warId: warId,
              error: 'warId, declaringId, and receivingId must be valid numbers'
            });
            continue;
          }

          // Basic date validation - just check they exist
          if (!date || !endDate) {
            errors.push({
              index: i,
              warId: warId,
              error: 'Missing required date fields: date and endDate'
            });
            continue;
          }

          const processedWarData = {
            warId: parseInt(warId),
            declaringId: parseInt(declaringId),
            declaringRuler: declaringRuler || '',
            declaringNation: declaringNation || '',
            declaringAlliance: declaringAlliance || '',
            declaringAllianceId: parseInt(declaringAllianceId) || 0,
            receivingId: parseInt(receivingId),
            receivingRuler: receivingRuler || '',
            receivingNation: receivingNation || '',
            receivingAlliance: receivingAlliance || '',
            receivingAllianceId: parseInt(receivingAllianceId) || 0,
            status: status || 'Active',
            date: date,
            endDate: endDate,
            reason: reason,
            destruction: destruction,
            attackPercent: attackPercent ? parseInt(attackPercent) : undefined,
            defendPercent: defendPercent ? parseInt(defendPercent) : undefined
          };

          const dynamicWar = await DynamicWarService.addDynamicWar(processedWarData, source as DynamicWar['source']);
          results.push(dynamicWar);
        } catch (error) {
          errors.push({
            index: i,
            warId: warsToProcess[i]?.warId || 'unknown',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      const response: any = {
        success: true,
        processed: results.length,
        total: warsToProcess.length,
        results: results
      };

      if (errors.length > 0) {
        response.errors = errors;
        response.success = errors.length === warsToProcess.length ? false : true; // Only fully successful if no errors
      }

      const statusCode = errors.length === warsToProcess.length ? 400 : (errors.length > 0 ? 207 : 201); // 207 = Multi-Status
      res.status(statusCode).json(response);
    } catch (error) {
      console.error('Error adding dynamic wars:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get all dynamic wars
   */
  static async getAllDynamicWars(req: Request, res: Response) {
    try {
      const wars = await DynamicWarService.getAllDynamicWars();
      
      res.json({
        success: true,
        count: wars.length,
        wars
      });
    } catch (error) {
      console.error('Error fetching dynamic wars:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get active dynamic wars
   */
  static async getActiveDynamicWars(req: Request, res: Response) {
    try {
      const wars = await DynamicWarService.getActiveDynamicWars();
      
      res.json({
        success: true,
        count: wars.length,
        wars
      });
    } catch (error) {
      console.error('Error fetching active dynamic wars:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get dynamic wars by alliance
   */
  static async getDynamicWarsByAlliance(req: Request, res: Response) {
    try {
      const allianceId = parseInt(req.params.allianceId);
      
      if (isNaN(allianceId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid alliance ID'
        });
      }

      const wars = await DynamicWarService.getDynamicWarsByAlliance(allianceId);
      
      res.json({
        success: true,
        allianceId,
        count: wars.length,
        wars
      });
    } catch (error) {
      console.error('Error fetching dynamic wars by alliance:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get dynamic wars by nation
   */
  static async getDynamicWarsByNation(req: Request, res: Response) {
    try {
      const nationId = parseInt(req.params.nationId);
      
      if (isNaN(nationId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid nation ID'
        });
      }

      const wars = await DynamicWarService.getDynamicWarsByNation(nationId);
      
      res.json({
        success: true,
        nationId,
        count: wars.length,
        wars
      });
    } catch (error) {
      console.error('Error fetching dynamic wars by nation:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Remove a dynamic war
   */
  static async removeDynamicWar(req: Request, res: Response) {
    try {
      const warId = parseInt(req.params.warId);
      
      if (isNaN(warId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid war ID'
        });
      }

      const removed = await DynamicWarService.removeDynamicWar(warId);
      
      if (removed) {
        res.json({
          success: true,
          message: 'Dynamic war removed successfully'
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Dynamic war not found'
        });
      }
    } catch (error) {
      console.error('Error removing dynamic war:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Clear all dynamic wars
   */
  static async clearAllDynamicWars(req: Request, res: Response) {
    try {
      await DynamicWarService.clearAllDynamicWars();
      
      res.json({
        success: true,
        message: 'All dynamic wars cleared successfully'
      });
    } catch (error) {
      console.error('Error clearing dynamic wars:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Cleanup old dynamic wars
   */
  static async cleanupOldWars(req: Request, res: Response) {
    try {
      const olderThanDays = parseInt(req.query.olderThanDays as string) || 7;
      
      if (isNaN(olderThanDays) || olderThanDays < 1) {
        return res.status(400).json({
          success: false,
          error: 'olderThanDays must be a positive number'
        });
      }

      const removedCount = await DynamicWarService.cleanupOldWars(olderThanDays);
      
      res.json({
        success: true,
        message: `Cleaned up ${removedCount} old dynamic wars`,
        removedCount
      });
    } catch (error) {
      console.error('Error cleaning up old wars:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
