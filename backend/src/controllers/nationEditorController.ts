import { Request, Response } from 'express';
import { AllianceService } from '../services/allianceService.js';

export class NationEditorController {
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

      const config = await AllianceService.getNationsConfig(allianceId);

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
      
      // Validate slots structure - only validate fields that are present
      if (slots) {
        if (slots.sendTech !== undefined && typeof slots.sendTech !== 'number') {
          return res.status(400).json({
            success: false,
            error: 'Invalid sendTech value. Must be a number'
          });
        }
        if (slots.sendCash !== undefined && typeof slots.sendCash !== 'number') {
          return res.status(400).json({
            success: false,
            error: 'Invalid sendCash value. Must be a number'
          });
        }
        if (slots.getTech !== undefined && typeof slots.getTech !== 'number') {
          return res.status(400).json({
            success: false,
            error: 'Invalid getTech value. Must be a number'
          });
        }
        if (slots.getCash !== undefined && typeof slots.getCash !== 'number') {
          return res.status(400).json({
            success: false,
            error: 'Invalid getCash value. Must be a number'
          });
        }
      }

      // Validate priority fields if they exist in slots
      if (slots && slots.send_priority !== undefined) {
        const sendPriority = typeof slots.send_priority === 'string' ? parseInt(slots.send_priority) : slots.send_priority;
        if (isNaN(sendPriority) || sendPriority < 1 || sendPriority > 3) {
          return res.status(400).json({
            success: false,
            error: 'Invalid send_priority value. Must be 1, 2, or 3'
          });
        }
        // Convert to number if it was a string
        slots.send_priority = sendPriority;
      }

      if (slots && slots.receive_priority !== undefined) {
        const receivePriority = typeof slots.receive_priority === 'string' ? parseInt(slots.receive_priority) : slots.receive_priority;
        if (isNaN(receivePriority) || receivePriority < 1 || receivePriority > 3) {
          return res.status(400).json({
            success: false,
            error: 'Invalid receive_priority value. Must be 1, 2, or 3'
          });
        }
        // Convert to number if it was a string
        slots.receive_priority = receivePriority;
      }

      const allianceData = AllianceService.getAllianceById(allianceId);
      
      if (!allianceData) {
        return res.status(404).json({
          success: false,
          error: 'Alliance not found in config'
        });
      }

      const nation = allianceData.nations[nationId];
      
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
        updates.slots = slots;
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
      const updatedNation = updatedAlliance?.nations[nationId];

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
