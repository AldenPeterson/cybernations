import { Request, Response } from 'express';
import { AidService } from '../services/aidService.js';

export class AidController {
  /**
   * Get aid slots for a specific alliance
   */
  static async getAidSlots(req: Request, res: Response) {
    try {
      const allianceId = parseInt(req.params.allianceId);
      
      if (isNaN(allianceId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid alliance ID'
        });
      }

      const aidSlots = await AidService.getAidSlots(allianceId);
      
      res.json({
        success: true,
        allianceId,
        aidSlots: aidSlots.map(nationAidSlots => ({
          nation: {
            id: nationAidSlots.nation.id,
            rulerName: nationAidSlots.nation.rulerName,
            nationName: nationAidSlots.nation.nationName,
            strength: nationAidSlots.nation.strength,
            activity: nationAidSlots.nation.activity,
            warStatus: nationAidSlots.nation.warStatus
          },
          aidSlots: nationAidSlots.aidSlots.map(slot => ({
            slotNumber: slot.slotNumber,
            isOutgoing: slot.isOutgoing,
            aidOffer: slot.aidOffer ? {
              aidId: slot.aidOffer.aidId,
              targetNation: slot.isOutgoing ? slot.aidOffer.receivingNation : slot.aidOffer.declaringNation,
              targetRuler: slot.isOutgoing ? slot.aidOffer.receivingRuler : slot.aidOffer.declaringRuler,
              targetId: slot.isOutgoing ? slot.aidOffer.receivingId : slot.aidOffer.declaringId,
              declaringId: slot.aidOffer.declaringId,
              receivingId: slot.aidOffer.receivingId,
              money: slot.aidOffer.money,
              technology: slot.aidOffer.technology,
              soldiers: slot.aidOffer.soldiers,
              reason: slot.aidOffer.reason,
              date: slot.aidOffer.date
            } : null
          }))
        }))
      });
    } catch (error) {
      console.error('Error fetching aid slots:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get alliance aid statistics
   */
  static async getAllianceAidStats(req: Request, res: Response) {
    try {
      const allianceId = parseInt(req.params.allianceId);
      
      if (isNaN(allianceId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid alliance ID'
        });
      }

      const stats = await AidService.getAllianceAidStats(allianceId);

      res.json({
        success: true,
        allianceId,
        stats
      });
    } catch (error) {
      console.error('Error fetching alliance aid stats:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get aid recommendations for an alliance
   */
  static async getAidRecommendations(req: Request, res: Response) {
    try {
      const allianceId = parseInt(req.params.allianceId);
      
      if (isNaN(allianceId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid alliance ID'
        });
      }

      const result = await AidService.getAidRecommendations(allianceId);

      res.json({
        success: true,
        allianceId,
        ...result
      });
    } catch (error) {
      console.error('Error fetching aid recommendations:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get categorized nations with slots for a specific alliance
   */
  static async getCategorizedNations(req: Request, res: Response) {
    try {
      const allianceId = parseInt(req.params.allianceId);
      
      if (isNaN(allianceId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid alliance ID'
        });
      }

      const categorizedNations = await AidService.getCategorizedNations(allianceId);

      res.json({
        success: true,
        allianceId,
        categorizedNations
      });
    } catch (error) {
      console.error('Error fetching categorized nations:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get small aid offers
   */
  static async getSmallAidOffers(req: Request, res: Response) {
    try {
      const result = await AidService.getSmallAidOffers();

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Error fetching small aid offers:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
