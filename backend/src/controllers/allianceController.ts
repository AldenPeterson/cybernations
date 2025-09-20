import { Request, Response } from 'express';
import { loadDataFromFilesWithUpdate, groupNationsByAlliance } from '../services/dataProcessingService.js';
import { AllianceService } from '../services/allianceService.js';

export class AllianceController {
  /**
   * Get all alliances
   */
  static async getAlliances(req: Request, res: Response) {
    try {
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
   * Get nations configuration for an alliance
   */
  static async getNationsConfig(req: Request, res: Response) {
    try {
      const allianceId = parseInt(req.params.allianceId);
      
      if (isNaN(allianceId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid alliance ID'
        });
      }

      const config = AllianceService.getNationsConfig(allianceId);

      res.json({
        success: true,
        allianceId,
        ...config
      });
    } catch (error) {
      console.error('Error fetching nations config:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update a specific nation's data in alliance files
   */
  static async updateNation(req: Request, res: Response) {
    try {
      console.log('updateNation called with:', req.params.allianceId, req.params.nationId, req.body);
      const allianceId = parseInt(req.params.allianceId);
      const nationId = parseInt(req.params.nationId);
      
      if (isNaN(allianceId) || isNaN(nationId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid alliance ID or nation ID'
        });
      }

      const { discord_handle, has_dra, notes, slots } = req.body;
      
      // Validate slots structure
      if (slots && (
        typeof slots.sendTech !== 'number' ||
        typeof slots.sendCash !== 'number' ||
        typeof slots.getTech !== 'number' ||
        typeof slots.getCash !== 'number'
      )) {
        return res.status(400).json({
          success: false,
          error: 'Invalid slots data structure'
        });
      }

      const allianceData = AllianceService.getAllianceById(allianceId);
      
      if (!allianceData) {
        return res.status(404).json({
          success: false,
          error: 'Alliance not found in config'
        });
      }

      const nation = allianceData.nations[nationId.toString()];
      
      if (!nation) {
        return res.status(404).json({
          success: false,
          error: 'Nation not found in alliance'
        });
      }

      // Prepare updates
      const updates: any = {};
      
      if (discord_handle !== undefined) {
        updates.discord_handle = discord_handle;
      }
      
      if (has_dra !== undefined) {
        updates.has_dra = has_dra;
      }
      
      if (notes !== undefined) {
        updates.notes = notes;
      }
      
      if (slots) {
        updates.slots = {
          sendTech: slots.sendTech,
          sendCash: slots.sendCash,
          getTech: slots.getTech,
          getCash: slots.getCash
        };
      }

      // Update using the service
      const success = AllianceService.updateNationData(allianceId, nationId, updates);
      
      if (!success) {
        return res.status(500).json({
          success: false,
          error: 'Failed to update nation data'
        });
      }

      // Get the updated nation data
      const updatedAlliance = AllianceService.getAllianceById(allianceId);
      const updatedNation = updatedAlliance?.nations[nationId.toString()];

      res.json({
        success: true,
        message: 'Nation updated successfully',
        nation: {
          nation_id: nationId,
          ...updatedNation
        }
      });
    } catch (error) {
      console.error('Error updating nation:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
