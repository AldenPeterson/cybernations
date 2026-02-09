import { Request, Response } from 'express';
import { DynamicWarService } from '../services/dynamicWarService.js';

export class DynamicWarController {
  /**
   * Add wars to the War table (only creates new wars, does not update existing ones)
   * This prevents overwriting accurate CSV data with potentially incomplete scraper data
   */
  static async addDynamicWar(req: Request, res: Response) {
    try {
      // Determine if input is array or single object
      const warsToProcess = Array.isArray(req.body) ? req.body : [req.body];
      
      if (!Array.isArray(warsToProcess) || warsToProcess.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Request body must be an array of wars or a single war object'
        });
      }

      const newWars = [];
      const skippedWars = [];
      const errors = [];

      for (let i = 0; i < warsToProcess.length; i++) {
        try {
          const warData = warsToProcess[i];
          const {
            warId,
            declaringId,
            receivingId,
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
            receivingId: parseInt(receivingId),
            status: status || 'Active',
            date: date,
            endDate: endDate,
            reason: reason,
            destruction: destruction,
            attackPercent: attackPercent !== undefined && attackPercent !== null && attackPercent !== '' ? parseFloat(attackPercent) : undefined,
            defendPercent: defendPercent !== undefined && defendPercent !== null && defendPercent !== '' ? parseFloat(defendPercent) : undefined
          };

          const result = await DynamicWarService.addDynamicWar(processedWarData);
          
          if (result.wasNew) {
            newWars.push(result.war);
          } else {
            skippedWars.push({ warId: processedWarData.warId, reason: 'Already exists' });
          }
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
        total: warsToProcess.length,
        created: newWars.length,
        skipped: skippedWars.length,
        failed: errors.length,
        newWars: newWars,
        skippedWars: skippedWars
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

}
