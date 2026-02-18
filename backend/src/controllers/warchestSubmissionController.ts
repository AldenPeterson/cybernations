import { Request, Response } from 'express';
import {
  parseSpyOperationText,
  createWarchestSubmission,
  getWarchestSubmissions,
} from '../services/warchestSubmissionService.js';

export class WarchestSubmissionController {
  /**
   * Submit a warchest entry from spy operation text
   * POST /api/warchest-submissions
   */
  static submit = async (req: Request, res: Response) => {
    try {
      const { text, capturedAt } = req.body;

      if (!text || typeof text !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Text is required',
        });
      }

      // Parse the spy operation text
      const parsed = parseSpyOperationText(text);
      if (!parsed) {
        return res.status(400).json({
          success: false,
          error: 'Could not parse spy operation text. Please ensure it contains nation name and total money.',
        });
      }

      // Use provided capturedAt or default to now
      const capturedDate = capturedAt ? new Date(capturedAt) : new Date();

      // Create the submission
      const result = await createWarchestSubmission(
        parsed.nationName,
        parsed.totalMoney,
        capturedDate,
        parsed.armyXP,
        parsed.navyXP,
        parsed.airForceXP,
        parsed.intelligenceXP,
        parsed.hasAssignedGenerals,
        parsed.assignedGenerals
      );

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error creating warchest submission:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create warchest submission',
      });
    }
  };

  /**
   * Get warchest submissions
   * GET /api/warchest-submissions
   */
  static list = async (req: Request, res: Response) => {
    try {
      const nationId = req.query.nationId ? parseInt(req.query.nationId as string) : undefined;
      const nationName = req.query.nationName as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;

      const result = await getWarchestSubmissions({
        nationId,
        nationName,
        limit,
        offset,
      });

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error fetching warchest submissions:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch warchest submissions',
      });
    }
  };
}

