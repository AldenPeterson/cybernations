import { Request, Response } from 'express';
import { loadDataFromFilesWithUpdate, groupNationsByAlliance } from '../services/dataProcessingService.js';
import { AllianceService } from '../services/allianceService.js';
import * as fs from 'fs';
import * as path from 'path';

export class AllianceController {
  /**
   * Load alliances from static configuration files (for production environments)
   */
  private static loadAlliancesFromConfig(): any[] {
    try {
      const alliancesDir = path.join(process.cwd(), 'src', 'config', 'alliances');
      
      if (!fs.existsSync(alliancesDir)) {
        console.warn('Alliances directory does not exist:', alliancesDir);
        return [];
      }
      
      const files = fs.readdirSync(alliancesDir).filter(file => file.endsWith('.json'));
      const alliances: any[] = [];
      
      for (const file of files) {
        try {
          const filePath = path.join(alliancesDir, file);
          const allianceData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          
          alliances.push({
            id: allianceData.alliance_id,
            name: allianceData.alliance_name,
            nationCount: Object.keys(allianceData.nations).length
          });
        } catch (error) {
          console.error(`Error loading alliance file ${file}:`, error);
        }
      }
      
      // Sort by nation count (descending - most nations first)
      return alliances.sort((a, b) => b.nationCount - a.nationCount);
    } catch (error) {
      console.error('Error loading alliances from config:', error);
      return [];
    }
  }

  /**
   * Get all alliances
   */
  static async getAlliances(req: Request, res: Response) {
    try {
      // In production/Vercel environments, use static configuration files
      if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
        console.log('Using static alliance configuration files in production');
        const alliances = AllianceController.loadAlliancesFromConfig();
        
        res.json({
          success: true,
          alliances: alliances
        });
        return;
      }

      // In development, use the dynamic data loading
      const { nations } = await loadDataFromFilesWithUpdate();
      const alliances = groupNationsByAlliance(nations);
      
      // Filter out alliances with no name and sort by nation count (descending - most nations first)
      const filteredAndSortedAlliances = alliances
        .filter(alliance => alliance.name && alliance.name.trim() !== '')
        .sort((a, b) => b.nations.length - a.nations.length);
      
      res.json({
        success: true,
        alliances: filteredAndSortedAlliances.map(alliance => ({
          id: alliance.id,
          name: alliance.name,
          nationCount: alliance.nations.length
        }))
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
      
      // Get the latest nation data
      const { nations } = await loadDataFromFilesWithUpdate();
      
      if (nations.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No nation data available for sync'
        });
      }
      
      // Sync alliance files
      await AllianceService.syncAllianceFilesWithNewData(nations);
      
      res.json({
        success: true,
        message: 'Alliance files synchronized successfully',
        nationsProcessed: nations.length
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
