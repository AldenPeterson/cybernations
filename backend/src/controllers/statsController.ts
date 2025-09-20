import { Request, Response } from 'express';
import { extractAllZipFiles } from '../utils/zipExtractor.js';
import * as path from 'path';

export class StatsController {
  /**
   * Extract zip files from raw_data folder
   */
  static async decodeStats(req: Request, res: Response) {
    try {
      const rawDataPath = path.join(process.cwd(), 'src', 'raw_data');
      
      console.log(`Starting zip extraction from: ${rawDataPath}`);
      
      const result = await extractAllZipFiles(rawDataPath);
      
      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error,
          results: result.results
        });
      }

      // Count successful extractions
      const successfulExtractions = result.results.filter(r => r.extractionResult.success).length;
      const totalFiles = result.results.length;

      res.json({
        success: true,
        message: `Successfully extracted ${successfulExtractions}/${totalFiles} zip files`,
        totalZipFiles: totalFiles,
        successfulExtractions,
        results: result.results.map(r => ({
          zipFile: r.zipFile,
          success: r.extractionResult.success,
          extractedFiles: r.extractionResult.extractedFiles,
          error: r.extractionResult.error
        }))
      });
    } catch (error) {
      console.error('Error in /api/stats/decode:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }
}
