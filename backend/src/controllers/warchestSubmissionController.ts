import { Request, Response } from 'express';
import {
  parseSpyOperationText,
  createWarchestSubmission,
  getWarchestSubmissions,
  updateKilledGeneralsForNation,
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
          error: 'Could not parse spy operation text. Please ensure it contains a recognizable format.',
        });
      }

      // If we have totalMoney, treat this as a full warchest submission (existing behavior)
      if (typeof parsed.totalMoney === 'number') {
        // Use provided capturedAt or default to now
        const capturedDate = capturedAt ? new Date(capturedAt) : new Date();

        const result = await createWarchestSubmission(
          parsed.nationName,
          parsed.totalMoney,
          capturedDate,
          parsed.armyXP,
          parsed.navyXP,
          parsed.airForceXP,
          parsed.intelligenceXP,
          parsed.hasAssignedGenerals,
          parsed.assignedGenerals,
          parsed.killedGenerals
        );

        return res.json({
          success: true,
          data: result,
        });
      }

      // Otherwise, if this is an assassination-style op with killed generals but no money,
      // update the most recent submission for that nation without changing totalMoney.
      if (parsed.killedGenerals) {
        const updated = await updateKilledGeneralsForNation(
          parsed.nationName,
          parsed.killedGenerals
        );

        if (!updated) {
          return res.status(400).json({
            success: false,
            error:
              'Could not find an existing warchest submission for this nation to attach the killed general to.',
          });
        }

        return res.json({
          success: true,
          data: updated,
        });
      }

      // Fallback if we parsed but neither money nor killed general is present in a usable way
      return res.status(400).json({
        success: false,
        error: 'Parsed spy operation text but did not find total money or killed general information.',
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

