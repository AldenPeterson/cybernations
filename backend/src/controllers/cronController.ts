import { Request, Response } from 'express';
import { CsvController } from './csvController.js';
import { ensureRecentFiles } from '../utils/dataDownloader.js';

export class CronController {
  /**
   * Sync all data types (nations, aid-offers, wars)
   * This endpoint is designed to be called by Vercel cron jobs
   * 
   * POST /api/cron/sync-all
   * 
   * Security: Verifies request is from Vercel cron using:
   * 1. x-vercel-cron header (automatically set by Vercel)
   * 2. OR Authorization header with Bearer token matching CRON_SECRET env var
   */
  static async syncAll(req: Request, res: Response) {
    try {
      // Verify the request is from Vercel cron
      const vercelCronHeader = req.headers['x-vercel-cron'];
      const authHeader = req.headers.authorization;
      const cronSecret = process.env.CRON_SECRET;
      
      // Check if request is from Vercel cron (preferred method)
      const isVercelCron = vercelCronHeader === '1';
      
      // If not from Vercel cron, check for secret token
      if (!isVercelCron && cronSecret) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({
            success: false,
            error: 'Missing or invalid authorization header'
          });
        }
        
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        if (token !== cronSecret) {
          return res.status(403).json({
            success: false,
            error: 'Invalid authorization token'
          });
        }
      } else if (!isVercelCron && !cronSecret) {
        // If neither Vercel cron header nor secret is configured, allow it
        // (for development/testing purposes)
        console.warn('[Cron] Warning: No security verification configured for cron endpoint');
      }

      console.log('[Cron] Starting sync-all job at', new Date().toISOString());

      // Use the existing ensureRecentFiles function which:
      // 1. Checks if files are stale
      // 2. Downloads new files if needed
      // 3. Imports CSV data into database
      // 4. Syncs alliance files
      await ensureRecentFiles();

      console.log('[Cron] Sync-all job completed successfully');

      res.json({
        success: true,
        message: 'All data types synced successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[Cron] Error in sync-all job:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to sync all data types',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Alternative endpoint that syncs each type individually
   * Useful for debugging or manual triggers
   * 
   * POST /api/cron/sync-all-detailed
   */
  static async syncAllDetailed(req: Request, res: Response) {
    try {
      // Verify the request is from Vercel cron
      const vercelCronHeader = req.headers['x-vercel-cron'];
      const authHeader = req.headers.authorization;
      const cronSecret = process.env.CRON_SECRET;
      
      // Check if request is from Vercel cron (preferred method)
      const isVercelCron = vercelCronHeader === '1';
      
      // If not from Vercel cron, check for secret token
      if (!isVercelCron && cronSecret) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({
            success: false,
            error: 'Missing or invalid authorization header'
          });
        }
        
        const token = authHeader.substring(7);
        if (token !== cronSecret) {
          return res.status(403).json({
            success: false,
            error: 'Invalid authorization token'
          });
        }
      } else if (!isVercelCron && !cronSecret) {
        // If neither Vercel cron header nor secret is configured, allow it
        // (for development/testing purposes)
        console.warn('[Cron] Warning: No security verification configured for cron endpoint');
      }

      console.log('[Cron] Starting detailed sync-all job at', new Date().toISOString());

      const results: Record<string, any> = {};

      // Create mock request/response objects for CsvController.syncCsv
      // We'll call the sync logic directly instead
      const types = ['nations', 'aid-offers', 'wars'];
      
      for (const type of types) {
        try {
          console.log(`[Cron] Syncing ${type}...`);
          
          // Create a mock request object
          const mockReq = {
            params: { type },
            headers: req.headers
          } as unknown as Request;
          
          // Create a mock response object that captures the result
          let syncResult: any = null;
          const mockRes = {
            json: (data: any) => {
              syncResult = data;
            },
            status: (code: number) => ({
              json: (data: any) => {
                syncResult = { ...data, statusCode: code };
              }
            })
          } as any;

          await CsvController.syncCsv(mockReq, mockRes);
          results[type] = syncResult || { success: false, error: 'No response' };
          
          console.log(`[Cron] ${type} sync result:`, syncResult?.success ? 'success' : 'failed');
        } catch (error: any) {
          console.error(`[Cron] Error syncing ${type}:`, error);
          results[type] = {
            success: false,
            error: error.message || 'Unknown error'
          };
        }
      }

      const allSuccess = Object.values(results).every((r: any) => r.success);
      const statusCode = allSuccess ? 200 : 500;

      console.log('[Cron] Detailed sync-all job completed');

      res.status(statusCode).json({
        success: allSuccess,
        message: 'Detailed sync completed',
        results,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[Cron] Error in detailed sync-all job:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to sync all data types',
        timestamp: new Date().toISOString()
      });
    }
  }
}

