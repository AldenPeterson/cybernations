import { Request, Response } from 'express';
import {
  getWarStatisticsAllianceTotals,
  getWarStatisticsNationBreakdown,
  getWarStatisticsWarRecords,
  invalidateWarStatsCache,
} from '../services/warStatisticsService.js';

export class WarStatisticsController {
  /**
   * Get overall alliance totals with optional filtering
   */
  static async getAllianceTotals(req: Request, res: Response) {
    try {
      const filter = req.query.filter as string | undefined;
      const data = await getWarStatisticsAllianceTotals(filter);
      
      // Add metadata about filtering
      return res.json({
        data,
        meta: {
          count: data.length,
          filtered: !!filter,
          filter: filter || null,
        },
      });
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
   * Get nation-level breakdown with optional filtering
   */
  static async getNationBreakdown(req: Request, res: Response) {
    try {
      const filter = req.query.filter as string | undefined;
      const data = await getWarStatisticsNationBreakdown(filter);
      
      return res.json({
        data,
        meta: {
          count: data.length,
          filtered: !!filter,
          filter: filter || null,
        },
      });
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

  /**
   * Get individual war records with optional filtering
   */
  static async getWarRecords(req: Request, res: Response) {
    try {
      const filter = req.query.filter as string | undefined;
      const data = await getWarStatisticsWarRecords(filter);
      
      return res.json({
        data,
        meta: {
          count: data.length,
          filtered: !!filter,
          filter: filter || null,
        },
      });
    } catch (error: any) {
      console.error('Error fetching war records:', error);
      console.error('Error stack:', error?.stack);
      return res.status(500).json({ 
        error: 'Failed to fetch war records',
        message: error?.message || String(error),
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      });
    }
  }

  /**
   * Invalidate war statistics cache
   * Useful for admin operations or after bulk data updates
   */
  static async invalidateCache(req: Request, res: Response) {
    try {
      invalidateWarStatsCache();
      return res.json({
        success: true,
        message: 'War statistics cache invalidated',
      });
    } catch (error: any) {
      console.error('Error invalidating cache:', error);
      return res.status(500).json({ 
        error: 'Failed to invalidate cache',
        message: error?.message || String(error),
      });
    }
  }
}
