import { Request, Response } from 'express';
import { getCasualtiesStats, getAllianceCasualtiesStats, invalidateCasualtiesCache } from '../services/casualtiesService.js';

export class CasualtiesController {
  /**
   * Get top 100 nations by total casualties (offensive + defensive combined)
   */
  static async getCasualtiesStats(_req: Request, res: Response) {
    try {
      const stats = await getCasualtiesStats();
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error fetching casualties stats:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get alliance-level casualties statistics
   */
  static async getAllianceCasualtiesStats(_req: Request, res: Response) {
    try {
      const stats = await getAllianceCasualtiesStats();
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error fetching alliance casualties stats:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Invalidate the casualties cache
   */
  static async invalidateCache(_req: Request, res: Response) {
    try {
      invalidateCasualtiesCache();
      res.json({
        success: true,
        message: 'Casualties cache invalidated'
      });
    } catch (error) {
      console.error('Error invalidating casualties cache:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

