import { Request, Response } from 'express';
import { getTopStrengthStats } from '../services/topStrengthService.js';

export class TopStrengthController {
  /**
   * Get top nations by nation strength with alliance aggregates.
   * Query params:
   * - limit: number of nations to include (default 250, max 1000)
   */
  static async getTopStrength(req: Request, res: Response) {
    try {
      const limitParam = req.query.limit;
      const limit = typeof limitParam === 'string' ? parseInt(limitParam, 10) : undefined;

      const data = await getTopStrengthStats(limit);

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      console.error('Error fetching top strength stats:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load top strength stats',
      });
    }
  }
}

