import { Request, Response } from 'express';
import { AidService } from '../services/aidService.js';
import { calculateAidDateInfo } from '../utils/dateUtils.js';

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
      
      // Count nations and aid offers
      const nationCount = aidSlots.length;
      const aidOfferCount = aidSlots.reduce((count, nationAidSlots) => {
        return count + nationAidSlots.aidSlots.filter(slot => slot.aidOffer !== null).length;
      }, 0);
      console.log(`[API] getAidSlots (allianceId: ${allianceId}): Returning ${nationCount} nations with ${aidOfferCount} aid offers`);
      
      // Debug: Log details for nation 518299
      const nation518299 = aidSlots.find(nas => nas.nation.id === 518299);
      if (nation518299) {
        const offers = nation518299.aidSlots.filter(slot => slot.aidOffer !== null);
        console.log(`[DEBUG] Nation 518299 has ${offers.length} aid offers:`);
        offers.forEach(slot => {
          const offer = slot.aidOffer!;
          console.log(`  - Aid ID: ${offer.aidId}, Date: ${offer.date}, Status: ${offer.status}, isExpired: ${offer.isExpired}, daysUntilExpiration: ${offer.daysUntilExpiration}`);
        });
      }
      
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
            inWarMode: nationAidSlots.nation.inWarMode
          },
          aidSlots: nationAidSlots.aidSlots.map(slot => ({
            slotNumber: slot.slotNumber,
            isOutgoing: slot.isOutgoing,
            aidOffer: slot.aidOffer ? (() => {
              // Calculate date fields only for aid offers that are actually being returned
              const dateInfo = slot.aidOffer.date ? (() => {
                try {
                  return calculateAidDateInfo(slot.aidOffer.date);
                } catch (error) {
                  console.warn(`Failed to parse date "${slot.aidOffer.date}" for aid offer ${slot.aidOffer.aidId}:`, error);
                  return {};
                }
              })() : {};

              return {
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
                date: slot.aidOffer.date,
                ...dateInfo
              };
            })() : null
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

      console.log(`[API] getAllianceAidStats (allianceId: ${allianceId}): ${stats.totalOutgoingAid} outgoing aid, ${stats.totalIncomingAid} incoming aid`);

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
      const crossAllianceEnabled = req.query.crossAlliance === 'true';
      
      if (isNaN(allianceId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid alliance ID'
        });
      }

      const result = await AidService.getAidRecommendations(allianceId, crossAllianceEnabled);

      const recommendationCount = result.recommendations?.length || 0;
      console.log(`[API] getAidRecommendations (allianceId: ${allianceId}, crossAlliance: ${crossAllianceEnabled}): Returning ${recommendationCount} recommendations`);

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

      const nationCount = Array.isArray(categorizedNations) ? categorizedNations.length : 0;
      console.log(`[API] getCategorizedNations (allianceId: ${allianceId}): Returning ${nationCount} nations`);

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

      const offerCount = result.smallAidOffers?.length || result.totalCount || 0;
      console.log(`[API] getSmallAidOffers: Returning ${offerCount} aid offers`);

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

  /**
   * Get nation aid efficiency for an alliance over a date range
   */
  static async getNationAidEfficiency(req: Request, res: Response) {
    try {
      const allianceId = parseInt(req.params.allianceId);
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      
      if (isNaN(allianceId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid alliance ID'
        });
      }

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'startDate and endDate query parameters are required (format: MM/DD/YYYY)'
        });
      }

      const result = await AidService.getNationAidEfficiency(allianceId, startDate, endDate);

      console.log(`[API] getNationAidEfficiency (allianceId: ${allianceId}, startDate: ${startDate}, endDate: ${endDate}): Returning ${result.length} nations`);

      res.json({
        success: true,
        allianceId,
        startDate,
        endDate,
        data: result
      });
    } catch (error) {
      console.error('Error fetching nation aid efficiency:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
