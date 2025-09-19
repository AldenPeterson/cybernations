import { Router } from 'express';
import { 
  loadDataFromFilesWithUpdate, 
  groupNationsByAlliance, 
  getAidSlotsForAlliance,
  Alliance,
  NationAidSlots 
} from '../utils/dataParser.js';
import { 
  categorizeNations, 
  getNationsByCategory, 
  getCategoryCounts, 
  getNationsThatShouldGetCash,
  getNationsThatShouldSendTechnology,
  getNationsThatShouldGetTechnology,
  getNationsThatShouldSendCash,
  NationCategory,
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

    const { nations, aidOffers } = await loadDataFromFilesWithUpdate();
    const allianceNations = nations.filter(nation => nation.allianceId === allianceId);
    
    if (allianceNations.length === 0) {
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

    // Categorize nations
    const categorizedNations = categorizeNations(allianceNations);
    const categoryCounts = getCategoryCounts(categorizedNations);
    
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
        totalNations: allianceNations.length,
        totalOutgoingAid: outgoingOffers.length,
        totalIncomingAid: incomingOffers.length,
        totalMoneyOut: outgoingOffers.reduce((sum, offer) => sum + offer.money, 0),
        totalMoneyIn: incomingOffers.reduce((sum, offer) => sum + offer.money, 0),
        totalTechOut: outgoingOffers.reduce((sum, offer) => sum + offer.technology, 0),
        totalTechIn: incomingOffers.reduce((sum, offer) => sum + offer.technology, 0),
        totalSoldiersOut: outgoingOffers.reduce((sum, offer) => sum + offer.soldiers, 0),
        totalSoldiersIn: incomingOffers.reduce((sum, offer) => sum + offer.soldiers, 0)
      },
      categorization: {
        farms: categoryCounts.farms,
        banks: categoryCounts.banks,
        none: categoryCounts.none
      },
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

    const { nations, aidOffers } = await loadDataFromFilesWithUpdate();
    const allianceNations = nations.filter(nation => nation.allianceId === allianceId);
    
    if (allianceNations.length === 0) {
      return res.json({
        success: true,
        allianceId,
        recommendations: []
      });
    }

    // Categorize nations
    const categorizedNations = categorizeNations(allianceNations);
    
    // Debug logging
    categorizedNations.forEach(nation => {
      const tech = parseFloat(nation.technology.replace(/,/g, '')) || 0;
      const infra = parseFloat(nation.infrastructure.replace(/,/g, '')) || 0;
      console.log(`Nation: ${nation.nationName}, Tech: ${nation.technology} (${tech}), Infra: ${nation.infrastructure} (${infra}), Category: ${nation.category}`);
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

    const recommendations: any[] = [];
    const recommendationCounts = new Map<number, number>();

    // Priority 0: Re-establish expired offers that match current categorization
    const banks = getNationsByCategory(categorizedNations, NationCategory.BANK);
    const farms = getNationsByCategory(categorizedNations, NationCategory.FARM);
    const none = getNationsByCategory(categorizedNations, NationCategory.NONE);
    
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
          const senderAidCount = nationAidCounts.get(offer.declaringId) || 0;
          const recipientAidCount = nationAidCounts.get(offer.receivingId) || 0;
          
          if (senderAidCount < sender.slots.sendCash && recipientAidCount < recipient.slots.getCash) {
            recommendations.push({
              priority: 0,
              type: 'reestablish_cash',
              sender: {
                id: sender.id,
                rulerName: sender.rulerName,
                nationName: sender.nationName,
                category: sender.category,
                slots: sender.slots,
                currentAidCount: senderAidCount
              },
              recipient: {
                id: recipient.id,
                rulerName: recipient.rulerName,
                nationName: recipient.nationName,
                category: recipient.category,
                slots: recipient.slots,
                currentAidCount: recipientAidCount
              },
              reason: `Re-establish expired cash aid: ${sender.nationName} → ${recipient.nationName}`,
              previousOffer: {
                money: offer.money,
                technology: offer.technology,
                soldiers: offer.soldiers,
                reason: offer.reason
              }
            });
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
          const senderAidCount = nationAidCounts.get(offer.declaringId) || 0;
          const recipientAidCount = nationAidCounts.get(offer.receivingId) || 0;
          
          if (senderAidCount < sender.slots.sendTech && recipientAidCount < recipient.slots.getTech) {
            recommendations.push({
              priority: 0,
              type: 'reestablish_tech',
              sender: {
                id: sender.id,
                rulerName: sender.rulerName,
                nationName: sender.nationName,
                category: sender.category,
                slots: sender.slots,
                currentAidCount: senderAidCount
              },
              recipient: {
                id: recipient.id,
                rulerName: recipient.rulerName,
                nationName: recipient.nationName,
                category: recipient.category,
                slots: recipient.slots,
                currentAidCount: recipientAidCount
              },
              reason: `Re-establish expired tech aid: ${sender.nationName} → ${recipient.nationName}`,
              previousOffer: {
                money: offer.money,
                technology: offer.technology,
                soldiers: offer.soldiers,
                reason: offer.reason
              }
            });
          }
        }
      }
    });

    // Priority 1: New cash aid recommendations (banks to farms)
    nationsThatShouldSendCash.forEach(sender => {
      const senderAidCount = nationAidCounts.get(sender.id) || 0;
      
      if (senderAidCount < sender.slots.sendCash) {
        nationsThatShouldGetCash.forEach(recipient => {
          const recipientAidCount = nationAidCounts.get(recipient.id) || 0;
          const pair = `${Math.min(sender.id, recipient.id)}-${Math.max(sender.id, recipient.id)}`;
          
          if (recipientAidCount < recipient.slots.getCash && 
              !existingPairs.has(pair) && 
              !expiredPairs.has(pair)) {
            
            const senderCount = recommendationCounts.get(sender.id) || 0;
            const recipientCount = recommendationCounts.get(recipient.id) || 0;
            
            if (senderCount < 3 && recipientCount < 3) {
              recommendations.push({
                priority: 1,
                type: 'new_cash',
                sender: {
                  id: sender.id,
                  rulerName: sender.rulerName,
                  nationName: sender.nationName,
                  category: sender.category,
                  slots: sender.slots,
                  currentAidCount: senderAidCount
                },
                recipient: {
                  id: recipient.id,
                  rulerName: recipient.rulerName,
                  nationName: recipient.nationName,
                  category: recipient.category,
                  slots: recipient.slots,
                  currentAidCount: recipientAidCount
                },
                reason: `New cash aid: ${sender.nationName} (${sender.category}) → ${recipient.nationName} (${recipient.category})`
              });
              
              recommendationCounts.set(sender.id, senderCount + 1);
              recommendationCounts.set(recipient.id, recipientCount + 1);
            }
          }
        });
      }
    });

    // Priority 2: New tech aid recommendations
    nationsThatShouldSendTechnology.forEach(sender => {
      const senderAidCount = nationAidCounts.get(sender.id) || 0;
      
      if (senderAidCount < sender.slots.sendTech) {
        nationsThatShouldGetTechnology.forEach(recipient => {
          const recipientAidCount = nationAidCounts.get(recipient.id) || 0;
          const pair = `${Math.min(sender.id, recipient.id)}-${Math.max(sender.id, recipient.id)}`;
          
          if (recipientAidCount < recipient.slots.getTech && 
              !existingPairs.has(pair) && 
              !expiredPairs.has(pair)) {
            
            const senderCount = recommendationCounts.get(sender.id) || 0;
            const recipientCount = recommendationCounts.get(recipient.id) || 0;
            
            if (senderCount < 3 && recipientCount < 3) {
              recommendations.push({
                priority: 2,
                type: 'new_tech',
                sender: {
                  id: sender.id,
                  rulerName: sender.rulerName,
                  nationName: sender.nationName,
                  category: sender.category,
                  slots: sender.slots,
                  currentAidCount: senderAidCount
                },
                recipient: {
                  id: recipient.id,
                  rulerName: recipient.rulerName,
                  nationName: recipient.nationName,
                  category: recipient.category,
                  slots: recipient.slots,
                  currentAidCount: recipientAidCount
                },
                reason: `New tech aid: ${sender.nationName} (${sender.category}) → ${recipient.nationName} (${recipient.category})`
              });
              
              recommendationCounts.set(sender.id, senderCount + 1);
              recommendationCounts.set(recipient.id, recipientCount + 1);
            }
          }
        });
      }
    });

    // Sort recommendations by priority
    recommendations.sort((a, b) => a.priority - b.priority);

    res.json({
      success: true,
      allianceId,
      recommendations: recommendations.slice(0, 50) // Limit to 50 recommendations
    });
  } catch (error) {
    console.error('Error fetching aid recommendations:', error);
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
