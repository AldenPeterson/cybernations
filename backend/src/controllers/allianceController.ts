import { Request, Response } from 'express';
import { loadDataFromFilesWithUpdate, groupNationsByAlliance } from '../services/dataProcessingService.js';
import { AllianceService } from '../services/allianceService.js';
import { syncAllianceFiles } from '../utils/dataDownloader.js';

// Cache for alliances list
interface AlliancesCache {
  data: any[];
  timestamp: number;
}

let alliancesCache: AlliancesCache | null = null;
const ALLIANCES_CACHE_TTL_MS = 300000; // 5 minutes cache TTL

export class AllianceController {
  /**
   * Load alliances from database
   */
  private static async loadAlliancesFromConfig(): Promise<any[]> {
    try {
      const { prisma } = await import('../utils/prisma.js');
      const alliances = await prisma.alliance.findMany({
        include: {
          nations: {
            include: {
              nationConfig: true,
            },
          },
        },
      });

      return alliances.map(alliance => ({
        id: alliance.id,
        name: alliance.name,
        nationCount: alliance.nations.filter(n => n.nationConfig !== null).length
      })).sort((a: { id: number; name: string; nationCount: number }, b: { id: number; name: string; nationCount: number }) => b.nationCount - a.nationCount);
    } catch (error) {
      console.error('Error loading alliances from database:', error);
      return [];
    }
  }

  /**
   * Get all alliances
   */
  static async getAlliances(req: Request, res: Response) {
    try {
      // Check cache first
      const now = Date.now();
      if (alliancesCache && (now - alliancesCache.timestamp) < ALLIANCES_CACHE_TTL_MS) {
        console.log('Returning cached alliances list');
        return res.json({
          success: true,
          alliances: alliancesCache.data
        });
      }
      
      console.log('Starting alliance data loading from database...');
      
      const { prisma } = await import('../utils/prisma.js');
      
      // Query alliances directly with nation counts using aggregation
      const alliancesWithCounts = await prisma.alliance.findMany({
        where: {
          id: { gt: 0 },
          name: { not: '' }
        },
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              nations: true
            }
          }
        }
      });
      
      // Filter alliances with at least 10 nations and sort by nation count
      const filteredAlliances = alliancesWithCounts
        .filter(alliance => alliance.name && alliance.name.trim() !== '')
        .filter(alliance => alliance._count.nations >= 10)
        .sort((a, b) => b._count.nations - a._count.nations)
        .map(alliance => ({
          id: alliance.id,
          name: alliance.name,
          nationCount: alliance._count.nations
        }));
      
      // Update cache
      alliancesCache = {
        data: filteredAlliances,
        timestamp: now
      };
      
      console.log(`Loaded ${filteredAlliances.length} alliances from database (with nation counts)`);
      
      res.json({
        success: true,
        alliances: filteredAlliances
      });
    } catch (error) {
      console.error('Error fetching alliances:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get alliance statistics
   */
  static async getAllianceStats(req: Request, res: Response) {
    try {
      const allianceId = parseInt(req.params.allianceId);
      
      if (isNaN(allianceId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid alliance ID'
        });
      }

      const stats = await AllianceService.getAllianceStats(allianceId);

      console.log(`[API] getAllianceStats (allianceId: ${allianceId}): ${stats.totalNations} nations, ${stats.totalOutgoingAid} outgoing aid, ${stats.totalIncomingAid} incoming aid`);

      res.json({
        success: true,
        allianceId,
        stats
      });
    } catch (error) {
      console.error('Error fetching alliance stats:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Sync alliance files with new data
   */
  static async syncAlliances(req: Request, res: Response) {
    try {
      console.log('Manual alliance sync requested');
      await syncAllianceFiles();
      
      res.json({
        success: true,
        message: 'Alliance files synchronized successfully'
      });
    } catch (error) {
      console.error('Error syncing alliance files:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }


  /**
   * Get nuclear weapon statistics for an alliance
   */
  static async getNuclearWeaponStats(req: Request, res: Response) {
    try {
      const allianceId = parseInt(req.params.allianceId);
      
      if (isNaN(allianceId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid alliance ID'
        });
      }

      const { nations } = await loadDataFromFilesWithUpdate();
      
      // Filter nations by alliance ID
      const allianceNations = nations.filter(nation => nation.allianceId === allianceId);
      
      if (allianceNations.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No nations found for this alliance'
        });
      }

      // Categorize nations by nuclear weapon count
      const stats = {
        totalNations: allianceNations.length,
        noNuclearWeapons: allianceNations.filter(nation => nation.nuclearWeapons === 0),
        hasNuclearWeaponsButLessThan25: allianceNations.filter(nation => nation.nuclearWeapons > 0 && nation.nuclearWeapons < 25),
        has25NuclearWeapons: allianceNations.filter(nation => nation.nuclearWeapons === 25),
        hasMoreThan25NuclearWeapons: allianceNations.filter(nation => nation.nuclearWeapons > 25)
      };

      // Get alliance name from first nation
      const allianceName = allianceNations[0]?.alliance || 'Unknown Alliance';

      res.json({
        success: true,
        allianceId,
        allianceName,
        stats: {
          totalNations: stats.totalNations,
          noNuclearWeapons: {
            count: stats.noNuclearWeapons.length,
            nations: stats.noNuclearWeapons.map(nation => ({
              id: nation.id,
              rulerName: nation.rulerName,
              nationName: nation.nationName,
              nuclearWeapons: nation.nuclearWeapons
            }))
          },
          hasNuclearWeaponsButLessThan25: {
            count: stats.hasNuclearWeaponsButLessThan25.length,
            nations: stats.hasNuclearWeaponsButLessThan25.map(nation => ({
              id: nation.id,
              rulerName: nation.rulerName,
              nationName: nation.nationName,
              nuclearWeapons: nation.nuclearWeapons
            }))
          },
          has25NuclearWeapons: {
            count: stats.has25NuclearWeapons.length,
            nations: stats.has25NuclearWeapons.map(nation => ({
              id: nation.id,
              rulerName: nation.rulerName,
              nationName: nation.nationName,
              nuclearWeapons: nation.nuclearWeapons
            }))
          },
          hasMoreThan25NuclearWeapons: {
            count: stats.hasMoreThan25NuclearWeapons.length,
            nations: stats.hasMoreThan25NuclearWeapons.map(nation => ({
              id: nation.id,
              rulerName: nation.rulerName,
              nationName: nation.nationName,
              nuclearWeapons: nation.nuclearWeapons
            }))
          }
        }
      });
    } catch (error) {
      console.error('Error fetching nuclear weapon stats:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

}
