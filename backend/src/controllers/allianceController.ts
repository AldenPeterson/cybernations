import { Request, Response } from 'express';
import { loadDataFromFilesWithUpdate, groupNationsByAlliance } from '../services/dataProcessingService.js';
import { AllianceService } from '../services/allianceService.js';
import { syncAllianceFiles } from '../utils/dataDownloader.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class AllianceController {
  /**
   * Load alliances from static configuration files (for production environments)
   */
  private static loadAlliancesFromConfig(): any[] {
    try {
      // Try different possible paths for the alliances directory
      const possiblePaths = [
        path.join(process.cwd(), 'src', 'config', 'alliances'),
        path.join(__dirname, '..', 'config', 'alliances'),
        path.join(process.cwd(), 'dist', 'src', 'config', 'alliances'),
        path.join(__dirname, '..', '..', 'config', 'alliances')
      ];
      
      let alliancesDir = '';
      for (const possiblePath of possiblePaths) {
        if (fs.existsSync(possiblePath)) {
          alliancesDir = possiblePath;
          break;
        }
      }
      
      if (!alliancesDir) {
        console.warn('Alliances directory not found in any expected location:', possiblePaths);
        return [];
      }
      
      console.log('Using alliances directory:', alliancesDir);
      
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
      console.log('Starting alliance data loading...');
      
      // Always try to use the dynamic data loading first
      const { nations } = await loadDataFromFilesWithUpdate();
      
      console.log(`Loaded ${nations.length} nations from data files`);
      
      if (nations.length > 0) {
        // Filter out nations lacking alliance info
        const nationsWithAlliance = nations.filter(n => 
          !!n.alliance && n.alliance.trim() !== '' && !!n.allianceId && n.allianceId > 0
        );
        
        // We have nation data, group by alliance
        const alliances = groupNationsByAlliance(nationsWithAlliance);
        
        // Filter out alliances with no name and sort by nation count (descending - most nations first)
        const filteredAndSortedAlliances = alliances
          .filter(alliance => alliance.name && alliance.name.trim() !== '')
          .filter(alliance => alliance.nations.length >= 10)
          .sort((a, b) => b.nations.length - a.nations.length);
        
        res.json({
          success: true,
          alliances: filteredAndSortedAlliances.map(alliance => ({
            id: alliance.id,
            name: alliance.name,
            nationCount: alliance.nations.length
          }))
        });
        return;
      }
      
      // If no nations data available, try loading from config files as fallback
      console.log('No nations data available, trying config files as fallback');
      const alliances = AllianceController.loadAlliancesFromConfig();
      
      // Log what we found for debugging
      console.log(`Fallback loaded ${alliances.length} alliances from config files`);
      
      res.json({
        success: true,
        alliances: alliances
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
