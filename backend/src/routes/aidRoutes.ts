import { Router } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { 
  loadAllianceById, 
  saveAllianceData, 
  updateNationData,
  AllianceData,
  loadAllianceDataWithJsonPriority
} from '../utils/allianceDataLoader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { 
  loadDataFromFilesWithUpdate, 
  groupNationsByAlliance, 
  getAidSlotsForAlliance,
  Alliance,
  NationAidSlots 
} from '../utils/dataParser.js';
import { 
  categorizeNations, 
  getSlotStatistics, 
  getNationsThatShouldGetCash,
  getNationsThatShouldSendTechnology,
  getNationsThatShouldGetTechnology,
  getNationsThatShouldSendCash,
  AidType
} from '../utils/nationCategorizer.js';

export const aidRoutes = Router();

// Get aid slots for a specific alliance
aidRoutes.get('/alliances/:allianceId/aid-slots', async (req, res) => {
  try {
    const allianceId = parseInt(req.params.allianceId);
    
    if (isNaN(allianceId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid alliance ID'
      });
    }

    const { nations, aidOffers } = await loadDataFromFilesWithUpdate();
    const aidSlots = getAidSlotsForAlliance(allianceId, nations, aidOffers);
    
    res.json({
      success: true,
      allianceId,
      aidSlots: aidSlots.map(nationAidSlots => ({
        nation: {
          id: nationAidSlots.nation.id,
          rulerName: nationAidSlots.nation.rulerName,
          nationName: nationAidSlots.nation.nationName,
          strength: nationAidSlots.nation.strength,
          activity: nationAidSlots.nation.activity
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
});

// Get alliance aid statistics
aidRoutes.get('/alliances/:allianceId/alliance-aid-stats', async (req, res) => {
  try {
    const allianceId = parseInt(req.params.allianceId);
    
    if (isNaN(allianceId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid alliance ID'
      });
    }

    const { nations, aidOffers, useJsonData } = await loadAllianceDataWithJsonPriority(allianceId);
    
    if (nations.length === 0) {
      return res.json({
        success: true,
        allianceId,
        stats: {
          totalNations: 0,
          totalOutgoingAid: 0,
          totalIncomingAid: 0,
          totalMoneyOut: 0,
          totalMoneyIn: 0,
          totalTechOut: 0,
          totalTechIn: 0,
          totalSoldiersOut: 0,
          totalSoldiersIn: 0
        }
      });
    }

    // If using JSON data, nations already have slots assigned
    // If using raw data, need to categorize them
    const categorizedNations = useJsonData ? nations : categorizeNations(nations);
    const slotStatistics = getSlotStatistics(categorizedNations);
    
    // Get existing aid offers (exclude expired)
    const existingOffers = aidOffers.filter(offer => 
      offer.status !== 'Expired' && 
      (offer.declaringAllianceId === allianceId || offer.receivingAllianceId === allianceId)
    );

    const outgoingOffers = existingOffers.filter(offer => offer.declaringAllianceId === allianceId);
    const incomingOffers = existingOffers.filter(offer => offer.receivingAllianceId === allianceId);

    // Get nations by aid direction
    const nationsThatShouldGetCash = getNationsThatShouldGetCash(categorizedNations);
    const nationsThatShouldSendTechnology = getNationsThatShouldSendTechnology(categorizedNations);
    const nationsThatShouldGetTechnology = getNationsThatShouldGetTechnology(categorizedNations);
    const nationsThatShouldSendCash = getNationsThatShouldSendCash(categorizedNations);

    res.json({
      success: true,
      allianceId,
      stats: {
        totalNations: nations.length,
        totalOutgoingAid: outgoingOffers.length,
        totalIncomingAid: incomingOffers.length,
        totalMoneyOut: outgoingOffers.reduce((sum, offer) => sum + offer.money, 0),
        totalMoneyIn: incomingOffers.reduce((sum, offer) => sum + offer.money, 0),
        totalTechOut: outgoingOffers.reduce((sum, offer) => sum + offer.technology, 0),
        totalTechIn: incomingOffers.reduce((sum, offer) => sum + offer.technology, 0),
        totalSoldiersOut: outgoingOffers.reduce((sum, offer) => sum + offer.soldiers, 0),
        totalSoldiersIn: incomingOffers.reduce((sum, offer) => sum + offer.soldiers, 0)
      },
      slotStatistics: slotStatistics,
      aidDirections: {
        shouldGetCash: nationsThatShouldGetCash.length,
        shouldSendTechnology: nationsThatShouldSendTechnology.length,
        shouldGetTechnology: nationsThatShouldGetTechnology.length,
        shouldSendCash: nationsThatShouldSendCash.length
      }
    });
  } catch (error) {
    console.error('Error fetching alliance aid stats:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get aid recommendations for an alliance
aidRoutes.get('/alliances/:allianceId/recommendations', async (req, res) => {
  try {
    const allianceId = parseInt(req.params.allianceId);
    
    if (isNaN(allianceId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid alliance ID'
      });
    }

    const { nations, aidOffers, useJsonData } = await loadAllianceDataWithJsonPriority(allianceId);
    
    if (nations.length === 0) {
      return res.json({
        success: true,
        allianceId,
        recommendations: []
      });
    }

    // If using JSON data, nations already have slots assigned
    // If using raw data, need to categorize them
    const categorizedNations = useJsonData ? nations : categorizeNations(nations);
    
    // Debug logging
    categorizedNations.forEach(nation => {
      const tech = parseFloat(nation.technology.replace(/,/g, '')) || 0;
      const infra = parseFloat(nation.infrastructure.replace(/,/g, '')) || 0;
      console.log(`Nation: ${nation.nationName}, Tech: ${nation.technology} (${tech}), Infra: ${nation.infrastructure} (${infra})`);
    });

    // Get existing aid offers (exclude expired)
    const existingOffers = aidOffers.filter(offer => 
      offer.status !== 'Expired' && 
      (offer.declaringAllianceId === allianceId || offer.receivingAllianceId === allianceId)
    );

    // Get expired aid offers for prioritization
    const expiredOffers = aidOffers.filter(offer => 
      offer.status === 'Expired' && 
      (offer.declaringAllianceId === allianceId || offer.receivingAllianceId === allianceId)
    );

    // Create a set of existing aid pairs to avoid duplicates
    const existingPairs = new Set();
    existingOffers.forEach(offer => {
      const pair = `${Math.min(offer.declaringId, offer.receivingId)}-${Math.max(offer.declaringId, offer.receivingId)}`;
      existingPairs.add(pair);
    });

    // Create a set of expired aid pairs for prioritization
    const expiredPairs = new Set();
    expiredOffers.forEach(offer => {
      const pair = `${Math.min(offer.declaringId, offer.receivingId)}-${Math.max(offer.declaringId, offer.receivingId)}`;
      expiredPairs.add(pair);
    });

    // Count active aid offers per nation (both incoming and outgoing)
    const nationAidCounts = new Map<number, number>();
    existingOffers.forEach(offer => {
      // Count outgoing aid
      if (offer.declaringAllianceId === allianceId) {
        const count = nationAidCounts.get(offer.declaringId) || 0;
        nationAidCounts.set(offer.declaringId, count + 1);
      }
      // Count incoming aid
      if (offer.receivingAllianceId === allianceId) {
        const count = nationAidCounts.get(offer.receivingId) || 0;
        nationAidCounts.set(offer.receivingId, count + 1);
      }
    });

    // Per-type existing counts
    const outgoingCashExisting = new Map<number, number>();
    const incomingCashExisting = new Map<number, number>();
    const outgoingTechExisting = new Map<number, number>();
    const incomingTechExisting = new Map<number, number>();
    existingOffers.forEach(offer => {
      const isCash = offer.money > 0;
      const isTech = offer.technology > 0;
      if (offer.declaringAllianceId === allianceId) {
        if (isCash) outgoingCashExisting.set(offer.declaringId, (outgoingCashExisting.get(offer.declaringId) || 0) + 1);
        if (isTech) outgoingTechExisting.set(offer.declaringId, (outgoingTechExisting.get(offer.declaringId) || 0) + 1);
      }
      if (offer.receivingAllianceId === allianceId) {
        if (isCash) incomingCashExisting.set(offer.receivingId, (incomingCashExisting.get(offer.receivingId) || 0) + 1);
        if (isTech) incomingTechExisting.set(offer.receivingId, (incomingTechExisting.get(offer.receivingId) || 0) + 1);
      }
    });

    // Total slot capacity by nation
    const totalSlotsByNation = new Map<number, number>();
    categorizedNations.forEach(n => {
      const total = n.slots.getCash + n.slots.getTech + n.slots.sendCash + n.slots.sendTech;
      totalSlotsByNation.set(n.id, total);
    });

    // Recommended counts (total and per-type) to avoid exceeding capacity when adding recs
    const recommendationCounts = new Map<number, number>();
    const recOutgoingCash = new Map<number, number>();
    const recIncomingCash = new Map<number, number>();
    const recOutgoingTech = new Map<number, number>();
    const recIncomingTech = new Map<number, number>();

    const hasTotalCapacity = (nationId: number): boolean => {
      const totalCap = totalSlotsByNation.get(nationId) || 0;
      const existing = nationAidCounts.get(nationId) || 0;
      const planned = recommendationCounts.get(nationId) || 0;
      return existing + planned < totalCap;
    };

    const hasOutgoingCashCapacity = (senderId: number, senderSlots: any): boolean => {
      const existing = outgoingCashExisting.get(senderId) || 0;
      const planned = recOutgoingCash.get(senderId) || 0;
      return existing + planned < senderSlots.sendCash;
    };

    const hasIncomingCashCapacity = (recipientId: number, recipientSlots: any): boolean => {
      const existing = incomingCashExisting.get(recipientId) || 0;
      const planned = recIncomingCash.get(recipientId) || 0;
      return existing + planned < recipientSlots.getCash;
    };

    const hasOutgoingTechCapacity = (senderId: number, senderSlots: any): boolean => {
      const existing = outgoingTechExisting.get(senderId) || 0;
      const planned = recOutgoingTech.get(senderId) || 0;
      return existing + planned < senderSlots.sendTech;
    };

    const hasIncomingTechCapacity = (recipientId: number, recipientSlots: any): boolean => {
      const existing = incomingTechExisting.get(recipientId) || 0;
      const planned = recIncomingTech.get(recipientId) || 0;
      return existing + planned < recipientSlots.getTech;
    };

    const incrementCounts = (senderId: number, recipientId: number, type: 'cash' | 'tech') => {
      recommendationCounts.set(senderId, (recommendationCounts.get(senderId) || 0) + 1);
      recommendationCounts.set(recipientId, (recommendationCounts.get(recipientId) || 0) + 1);
      if (type === 'cash') {
        recOutgoingCash.set(senderId, (recOutgoingCash.get(senderId) || 0) + 1);
        recIncomingCash.set(recipientId, (recIncomingCash.get(recipientId) || 0) + 1);
      } else {
        recOutgoingTech.set(senderId, (recOutgoingTech.get(senderId) || 0) + 1);
        recIncomingTech.set(recipientId, (recIncomingTech.get(recipientId) || 0) + 1);
      }
    };

    const canRecommendCash = (sender: any, recipient: any): boolean => {
      return hasTotalCapacity(sender.id) && hasTotalCapacity(recipient.id)
        && hasOutgoingCashCapacity(sender.id, sender.slots)
        && hasIncomingCashCapacity(recipient.id, recipient.slots);
    };

    const canRecommendTech = (sender: any, recipient: any): boolean => {
      return hasTotalCapacity(sender.id) && hasTotalCapacity(recipient.id)
        && hasOutgoingTechCapacity(sender.id, sender.slots)
        && hasIncomingTechCapacity(recipient.id, recipient.slots);
    };

    const recommendations: any[] = [];

    // Priority 0: Re-establish expired offers based on slot availability
    
    // Get nations by aid direction
    const nationsThatShouldGetCash = getNationsThatShouldGetCash(categorizedNations);
    const nationsThatShouldSendTechnology = getNationsThatShouldSendTechnology(categorizedNations);
    const nationsThatShouldGetTechnology = getNationsThatShouldGetTechnology(categorizedNations);
    const nationsThatShouldSendCash = getNationsThatShouldSendCash(categorizedNations);

    // Find expired cash offers (nations that should send cash to nations that should get cash)
    expiredOffers.forEach(offer => {
      if (offer.declaringAllianceId === allianceId) {
        const sender = categorizedNations.find(n => n.id === offer.declaringId);
        const recipient = categorizedNations.find(n => n.id === offer.receivingId);
        
        if (sender && recipient && 
            sender.slots.sendCash > 0 && recipient.slots.getCash > 0 &&
            offer.money > 0) {
          
          const pair = `${Math.min(offer.declaringId, offer.receivingId)}-${Math.max(offer.declaringId, offer.receivingId)}`;
          
          if (!existingPairs.has(pair) && canRecommendCash(sender, recipient)) {
            recommendations.push({
              priority: 0,
              type: 'reestablish_cash',
              sender: {
                id: sender.id,
                rulerName: sender.rulerName,
                nationName: sender.nationName,
                slots: sender.slots,
                currentAidCount: nationAidCounts.get(sender.id) || 0
              },
              recipient: {
                id: recipient.id,
                rulerName: recipient.rulerName,
                nationName: recipient.nationName,
                slots: recipient.slots,
                currentAidCount: nationAidCounts.get(recipient.id) || 0
              },
              reason: `Re-establish expired cash aid: ${sender.nationName} → ${recipient.nationName}`,
              previousOffer: {
                money: offer.money,
                technology: offer.technology,
                soldiers: offer.soldiers,
                reason: offer.reason
              }
            });
            incrementCounts(sender.id, recipient.id, 'cash');
          }
        }
      }
    });

    // Find expired tech offers (nations that should send tech to nations that should get tech)
    expiredOffers.forEach(offer => {
      if (offer.declaringAllianceId === allianceId) {
        const sender = categorizedNations.find(n => n.id === offer.declaringId);
        const recipient = categorizedNations.find(n => n.id === offer.receivingId);
        
        if (sender && recipient && 
            sender.slots.sendTech > 0 && recipient.slots.getTech > 0 &&
            offer.technology > 0) {
          
          const pair = `${Math.min(offer.declaringId, offer.receivingId)}-${Math.max(offer.declaringId, offer.receivingId)}`;
          
          if (!existingPairs.has(pair) && canRecommendTech(sender, recipient)) {
            recommendations.push({
              priority: 0,
              type: 'reestablish_tech',
              sender: {
                id: sender.id,
                rulerName: sender.rulerName,
                nationName: sender.nationName,
                slots: sender.slots,
                currentAidCount: nationAidCounts.get(sender.id) || 0
              },
              recipient: {
                id: recipient.id,
                rulerName: recipient.rulerName,
                nationName: recipient.nationName,
                slots: recipient.slots,
                currentAidCount: nationAidCounts.get(recipient.id) || 0
              },
              reason: `Re-establish expired tech aid: ${sender.nationName} → ${recipient.nationName}`,
              previousOffer: {
                money: offer.money,
                technology: offer.technology,
                soldiers: offer.soldiers,
                reason: offer.reason
              }
            });
            incrementCounts(sender.id, recipient.id, 'tech');
          }
        }
      }
    });

    // Priority 1: New cash aid recommendations (banks to farms)
    nationsThatShouldSendCash.forEach(sender => {
      nationsThatShouldGetCash.forEach(recipient => {
        const pair = `${Math.min(sender.id, recipient.id)}-${Math.max(sender.id, recipient.id)}`;
        
        if (!existingPairs.has(pair) && !expiredPairs.has(pair) && canRecommendCash(sender, recipient)) {
          recommendations.push({
            priority: 1,
            type: 'new_cash',
            sender: {
              id: sender.id,
              rulerName: sender.rulerName,
              nationName: sender.nationName,
              slots: sender.slots,
              currentAidCount: nationAidCounts.get(sender.id) || 0
            },
            recipient: {
              id: recipient.id,
              rulerName: recipient.rulerName,
              nationName: recipient.nationName,
              slots: recipient.slots,
              currentAidCount: nationAidCounts.get(recipient.id) || 0
            },
            reason: `New cash aid: ${sender.nationName} → ${recipient.nationName}`
          });
          incrementCounts(sender.id, recipient.id, 'cash');
        }
      });
    });

    // Priority 2: New tech aid recommendations
    nationsThatShouldSendTechnology.forEach(sender => {
      nationsThatShouldGetTechnology.forEach(recipient => {
        const pair = `${Math.min(sender.id, recipient.id)}-${Math.max(sender.id, recipient.id)}`;
        
        if (!existingPairs.has(pair) && !expiredPairs.has(pair) && canRecommendTech(sender, recipient)) {
          recommendations.push({
            priority: 2,
            type: 'new_tech',
            sender: {
              id: sender.id,
              rulerName: sender.rulerName,
              nationName: sender.nationName,
              slots: sender.slots,
              currentAidCount: nationAidCounts.get(sender.id) || 0
            },
            recipient: {
              id: recipient.id,
              rulerName: recipient.rulerName,
              nationName: recipient.nationName,
              slots: recipient.slots,
              currentAidCount: nationAidCounts.get(recipient.id) || 0
            },
            reason: `New tech aid: ${sender.nationName} → ${recipient.nationName}`
          });
          incrementCounts(sender.id, recipient.id, 'tech');
        }
      });
    });

    // Sort recommendations by priority
    recommendations.sort((a, b) => a.priority - b.priority);

    // Calculate total slot counts
    const slotCounts = {
      totalGetCash: categorizedNations.reduce((sum, nation) => sum + nation.slots.getCash, 0),
      totalGetTech: categorizedNations.reduce((sum, nation) => sum + nation.slots.getTech, 0),
      totalSendCash: categorizedNations.reduce((sum, nation) => sum + nation.slots.sendCash, 0),
      totalSendTech: categorizedNations.reduce((sum, nation) => sum + nation.slots.sendTech, 0)
    };

    res.json({
      success: true,
      allianceId,
      recommendations: recommendations, // Return all recommendations
      slotStatistics: getSlotStatistics(categorizedNations),
      slotCounts
    });
  } catch (error) {
    console.error('Error fetching aid recommendations:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get categorized nations with slots for a specific alliance
aidRoutes.get('/alliances/:allianceId/categorized-nations', async (req, res) => {
  try {
    const allianceId = parseInt(req.params.allianceId);
    
    if (isNaN(allianceId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid alliance ID'
      });
    }

    const { nations, useJsonData } = await loadAllianceDataWithJsonPriority(allianceId);
    
    if (nations.length === 0) {
      return res.json({
        success: true,
        allianceId,
        categorizedNations: []
      });
    }

    // If using JSON data, nations already have slots assigned
    // If using raw data, need to categorize them
    const categorizedNations = useJsonData ? nations : categorizeNations(nations);
    
    res.json({
      success: true,
      allianceId,
      categorizedNations: categorizedNations.map(nation => ({
        id: nation.id,
        rulerName: nation.rulerName,
        nationName: nation.nationName,
        technology: nation.technology,
        infrastructure: nation.infrastructure,
        slots: nation.slots
      }))
    });
  } catch (error) {
    console.error('Error fetching categorized nations:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get nations data from alliance files for a specific alliance
aidRoutes.get('/alliances/:allianceId/nations-config', async (req, res) => {
  try {
    const allianceId = parseInt(req.params.allianceId);
    
    if (isNaN(allianceId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid alliance ID'
      });
    }

    const allianceData = loadAllianceById(allianceId);
    
    if (!allianceData) {
      return res.json({
        success: true,
        allianceId,
        allianceExists: false,
        nations: []
      });
    }

    // Convert nations object back to array format for compatibility
    const nationsArray = Object.entries(allianceData.nations).map(([nationId, nationData]) => ({
      nation_id: parseInt(nationId),
      ...nationData
    }));

    res.json({
      success: true,
      allianceId,
      allianceExists: true,
      allianceName: allianceData.alliance_name,
      nations: nationsArray
    });
  } catch (error) {
    console.error('Error fetching nations config:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update a specific nation's data in alliance files
aidRoutes.put('/alliances/:allianceId/nations/:nationId', async (req, res) => {
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

    const allianceData = loadAllianceById(allianceId);
    
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

    // Update using the utility function
    const success = updateNationData(allianceId, nationId, updates);
    
    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to update nation data'
      });
    }

    // Get the updated nation data
    const updatedAlliance = loadAllianceById(allianceId);
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
});

// Get small aid offers
aidRoutes.get('/small-aid-offers', async (req, res) => {
  try {
    const { nations, aidOffers } = await loadDataFromFilesWithUpdate();
    
    // Filter for small aid offers (money < 1000000 and technology < 50)
    const smallOffers = aidOffers.filter(offer => 
      offer.status !== 'Expired' && 
      offer.money < 1000000 && 
      offer.technology < 50
    );

    // Add alliance information to each offer
    const offersWithAllianceInfo = smallOffers.map(offer => {
      const declaringNation = nations.find(n => n.id === offer.declaringId);
      const receivingNation = nations.find(n => n.id === offer.receivingId);
      
      return {
        aidId: offer.aidId,
        declaringNation: {
          id: offer.declaringId,
          name: offer.declaringNation,
          ruler: offer.declaringRuler,
          alliance: offer.declaringAlliance,
          allianceId: offer.declaringAllianceId
        },
        receivingNation: {
          id: offer.receivingId,
          name: offer.receivingNation,
          ruler: offer.receivingRuler,
          alliance: offer.receivingAlliance,
          allianceId: offer.receivingAllianceId
        },
        money: offer.money,
        technology: offer.technology,
        soldiers: offer.soldiers,
        reason: offer.reason,
        date: offer.date
      };
    });

    // Sort by date (most recent first)
    offersWithAllianceInfo.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json({
      success: true,
      smallAidOffers: offersWithAllianceInfo,
      totalCount: offersWithAllianceInfo.length
    });
  } catch (error) {
    console.error('Error fetching small aid offers:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
