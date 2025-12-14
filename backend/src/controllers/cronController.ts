import { Request, Response } from 'express';
import { CsvController } from './csvController.js';
import { ensureRecentFiles } from '../utils/dataDownloader.js';

export class CronController {
  /**
   * Sync all data types (nations, aid-offers, wars)
   * This endpoint is designed to be called by Vercel cron jobs
   * 
   * POST /api/cron/sync-all?force=true
   * 
   * Query Parameters:
   * - force: Set to 'true' or '1' to force reprocessing even if files are fresh
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

      // Check for force parameter
      const force = req.query.force === 'true' || req.query.force === '1';
      if (force) {
        console.log('[Cron] Force mode enabled - will reprocess all files regardless of freshness');
      }

      console.log('[Cron] Starting sync-all job at', new Date().toISOString());

      // Use the existing ensureRecentFiles function which:
      // 1. Checks if files are stale
      // 2. Downloads new files if needed
      // 3. Imports CSV data into database
      // 4. Syncs alliance files
      try {
        const downloadResults = await ensureRecentFiles(force);
        console.log('[Cron] Sync-all job completed successfully');
        
        // Format results for response
        const results = downloadResults.map(result => ({
          fileType: result.fileType,
          success: result.success,
          filename: result.filename,
          error: result.error
        }));
        
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        
        let message: string;
        if (results.length === 0) {
          message = 'Sync job completed: All files are already up to date (no downloads needed)';
        } else if (failed > 0) {
          message = `Sync job completed: ${successful} succeeded, ${failed} failed`;
        } else {
          message = `Sync job completed: All ${successful} files downloaded successfully`;
        }
        
        res.json({
          success: true,
          message,
          timestamp: new Date().toISOString(),
          downloads: results,
          summary: {
            total: results.length,
            successful,
            failed
          }
        });
      } catch (error: any) {
        // Log the error but don't fail the entire request
        // ensureRecentFiles already handles errors gracefully
        const errorMsg = error?.message || String(error);
        console.error('[Cron] Error in sync-all job (non-fatal):', errorMsg);
        
        res.json({
          success: true,
          message: `Sync job completed with warnings: ${errorMsg}`,
          timestamp: new Date().toISOString(),
          downloads: [],
          summary: {
            total: 0,
            successful: 0,
            failed: 0
          }
        });
      }
    } catch (error: any) {
      console.error('[Cron] Fatal error in sync-all job:', error);
      res.status(500).json({
        success: false,
        error: error?.message || 'Failed to sync all data types',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Alternative endpoint that syncs each type individually
   * Useful for debugging or manual triggers
   * 
   * POST /api/cron/sync-all-detailed?force=true
   * 
   * Query Parameters:
   * - force: Set to 'true' or '1' to force reprocessing even if files are fresh
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

      // Check for force parameter
      const force = req.query.force === 'true' || req.query.force === '1';
      if (force) {
        console.log('[Cron] Force mode enabled - will reprocess all files regardless of freshness');
      }

      console.log('[Cron] Starting detailed sync-all job at', new Date().toISOString());

      const results: Record<string, any> = {};

      // Create mock request/response objects for CsvController.syncCsv
      // We'll call the sync logic directly instead
      const types = ['nations', 'aid-offers', 'wars'];
      
      for (const type of types) {
        try {
          console.log(`[Cron] Syncing ${type}...`);
          
          // Create a mock request object with force parameter
          const mockReq = {
            params: { type },
            query: { force: force ? 'true' : undefined },
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

      // If all syncs succeeded and at least one actually updated data (isFresh === false),
      // run the post-processing SQL script, mirroring the behavior of sync-all.
      if (allSuccess) {
        const anyUpdated = Object.values(results).some((r: any) => r && r.isFresh === false);

        if (anyUpdated) {
          console.log('[Cron] All detailed syncs succeeded with updates, executing post-processing SQL query...');
          try {
            const { executePostProcessingIfConfigured } = await import('../services/postProcessingService.js');
            const executed = await executePostProcessingIfConfigured();
            if (executed) {
              console.log('[Cron] Post-processing SQL query executed successfully');
            } else {
              console.log('[Cron] Post-processing SQL query was not executed (no SQL configured)');
            }
          } catch (error: any) {
            console.error('[Cron] Error during post-processing after detailed sync-all:', error?.message || String(error));
          }
        } else {
          console.log('[Cron] Detailed sync-all completed but no datasets reported updates; skipping post-processing SQL query');
        }
      }

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

  /**
   * Manually trigger the post-processing SQL script
   *
   * POST /api/cron/run-post-processing
   *
   * Security: Same as other cron endpoints (Vercel cron header or CRON_SECRET)
   */
  static async runPostProcessing(req: Request, res: Response) {
    try {
      // Reuse cron security checks
      const vercelCronHeader = req.headers['x-vercel-cron'];
      const authHeader = req.headers.authorization;
      const cronSecret = process.env.CRON_SECRET;

      const isVercelCron = vercelCronHeader === '1';

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
        console.warn('[Cron] Warning: No security verification configured for cron endpoint (run-post-processing)');
      }

      console.log('[Cron] Manually triggering post-processing SQL query...');

      const { executePostProcessingIfConfigured } = await import('../services/postProcessingService.js');
      const executed = await executePostProcessingIfConfigured();

      if (executed) {
        return res.json({
          success: true,
          message: 'Post-processing SQL query executed successfully',
          timestamp: new Date().toISOString()
        });
      } else {
        return res.json({
          success: true,
          message: 'Post-processing SQL query not executed (no SQL configured)',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error: any) {
      console.error('[Cron] Error in run-post-processing endpoint:', error);
      res.status(500).json({
        success: false,
        error: error?.message || 'Failed to execute post-processing SQL query',
        timestamp: new Date().toISOString()
      });
    }
  }
}

