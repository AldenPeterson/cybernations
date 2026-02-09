import { Request, Response } from 'express';
import {
  getWarStatistics,
  getWarStatisticsAllianceTotals,
  getWarStatisticsNationBreakdown,
} from '../services/warStatisticsService.js';

export class WarStatisticsController {
  /**
   * Get war statistics - Alliance Summary with Opponent Breakdown
   */
  static async getWarStatistics(req: Request, res: Response) {
    try {
      const data = await getWarStatistics();
      return res.json(data);
    } catch (error: any) {
      console.error('Error fetching war statistics:', error);
      console.error('Error stack:', error?.stack);
      return res.status(500).json({ 
        error: 'Failed to fetch war statistics',
        message: error?.message || String(error),
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      });
    }
  }

  /**
   * Get overall alliance totals
   */
  static async getAllianceTotals(req: Request, res: Response) {
    try {
      const data = await getWarStatisticsAllianceTotals();
      return res.json(data);
    } catch (error: any) {
      console.error('Error fetching alliance totals:', error);
      console.error('Error stack:', error?.stack);
      return res.status(500).json({ 
        error: 'Failed to fetch alliance totals',
        message: error?.message || String(error),
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      });
    }
  }

  /**
   * Get nation-level breakdown
   */
  static async getNationBreakdown(req: Request, res: Response) {
    try {
      const data = await getWarStatisticsNationBreakdown();
      return res.json(data);
    } catch (error: any) {
      console.error('Error fetching nation breakdown:', error);
      console.error('Error stack:', error?.stack);
      return res.status(500).json({ 
        error: 'Failed to fetch nation breakdown',
        message: error?.message || String(error),
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      });
    }
  }
}

