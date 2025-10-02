import { 
  loadDataFromFilesWithUpdate, 
  getAidSlotsForAlliance 
} from './dataProcessingService.js';
import { 
  categorizeNations, 
  getNationsThatShouldGetCash,
  getNationsThatShouldSendTechnology,
  getNationsThatShouldGetTechnology,
  getNationsThatShouldSendCash
} from './nationCategorizationService.js';
import { AllianceService } from './allianceService.js';
import { AidOffer } from '../models/index.js';

export class AidService {
  /**
   * Get aid slots for a specific alliance
   */
  static async getAidSlots(allianceId: number) {
    const { nations, aidOffers } = await loadDataFromFilesWithUpdate();
    return await getAidSlotsForAlliance(allianceId, nations, aidOffers);
  }

  /**
   * Get alliance aid statistics
   */
  static async getAllianceAidStats(allianceId: number) {
    const { nations, aidOffers, useJsonData } = await AllianceService.getAllianceDataWithJsonPriority(allianceId);
    
    if (nations.length === 0) {
      return {
        totalNations: 0,
        totalOutgoingAid: 0,
        totalIncomingAid: 0,
        totalMoneyOut: 0,
        totalMoneyIn: 0,
        totalTechOut: 0,
        totalTechIn: 0,
        totalSoldiersOut: 0,
        totalSoldiersIn: 0
      };
    }

    // If using JSON data, nations already have slots assigned
    // If using raw data, need to categorize them
    const categorizedNations = useJsonData ? nations : categorizeNations(nations);
    
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

    return {
      totalNations: nations.length,
      totalOutgoingAid: outgoingOffers.length,
      totalIncomingAid: incomingOffers.length,
      totalMoneyOut: outgoingOffers.reduce((sum, offer) => sum + offer.money, 0),
      totalMoneyIn: incomingOffers.reduce((sum, offer) => sum + offer.money, 0),
      totalTechOut: outgoingOffers.reduce((sum, offer) => sum + offer.technology, 0),
      totalTechIn: incomingOffers.reduce((sum, offer) => sum + offer.technology, 0),
      totalSoldiersOut: outgoingOffers.reduce((sum, offer) => sum + offer.soldiers, 0),
      totalSoldiersIn: incomingOffers.reduce((sum, offer) => sum + offer.soldiers, 0),
      aidDirections: {
        shouldGetCash: nationsThatShouldGetCash.length,
        shouldSendTechnology: nationsThatShouldSendTechnology.length,
        shouldGetTechnology: nationsThatShouldGetTechnology.length,
        shouldSendCash: nationsThatShouldSendCash.length
      }
    };
  }

  /**
   * Get aid recommendations for an alliance
   */
  static async getAidRecommendations(allianceId: number) {
    const { nations, aidOffers, useJsonData } = await AllianceService.getAllianceDataWithJsonPriority(allianceId);
    
    if (nations.length === 0) {
      return {
        recommendations: [],
        slotCounts: null
      };
    }

    // If using JSON data, nations already have slots assigned
    // If using raw data, need to categorize them
    const categorizedNations = useJsonData ? nations : categorizeNations(nations);
    
    // Don't filter out peace mode nations - only senders are restricted, not recipients
    const activeNations = categorizedNations;
    
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
    activeNations.forEach(n => {
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

    // Get nations by aid direction
    const nationsThatShouldGetCash = getNationsThatShouldGetCash(activeNations);
    const nationsThatShouldSendTechnology = getNationsThatShouldSendTechnology(activeNations);
    const nationsThatShouldGetTechnology = getNationsThatShouldGetTechnology(activeNations);
    const nationsThatShouldSendCash = getNationsThatShouldSendCash(activeNations);
    
    // Filter out peace mode nations from sender lists only (recipients can receive in peace mode)
    const activeNationsThatShouldSendCash = nationsThatShouldSendCash.filter(nation => 
      nation.warStatus !== 'Peace Mode'
    );
    const activeNationsThatShouldSendTechnology = nationsThatShouldSendTechnology.filter(nation => 
      nation.warStatus !== 'Peace Mode'
    );

    // Priority 0: Re-establish expired offers based on slot availability
    expiredOffers.forEach(offer => {
      if (offer.declaringAllianceId === allianceId) {
        const sender = activeNations.find(n => n.id === offer.declaringId);
        const recipient = activeNations.find(n => n.id === offer.receivingId);
        
        if (sender && recipient && sender.warStatus !== 'Peace Mode') {
          const pair = `${Math.min(offer.declaringId, offer.receivingId)}-${Math.max(offer.declaringId, offer.receivingId)}`;
          
          // Re-establish expired cash aid
          if (sender.slots.sendCash > 0 && recipient.slots.getCash > 0 &&
              offer.money > 0 && !existingPairs.has(pair) && canRecommendCash(sender, recipient)) {
            recommendations.push({
              priority: 0,
              type: 'reestablish_cash',
              sender: {
                id: sender.id,
                rulerName: sender.rulerName,
                nationName: sender.nationName,
                discord_handle: sender.discord_handle,
                slots: sender.slots,
                currentAidCount: nationAidCounts.get(sender.id) || 0,
                warStatus: sender.warStatus
              },
              recipient: {
                id: recipient.id,
                rulerName: recipient.rulerName,
                nationName: recipient.nationName,
                slots: recipient.slots,
                currentAidCount: nationAidCounts.get(recipient.id) || 0,
                warStatus: recipient.warStatus
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
          
          // Re-establish expired tech aid
          if (sender.slots.sendTech > 0 && recipient.slots.getTech > 0 &&
              offer.technology > 0 && !existingPairs.has(pair) && canRecommendTech(sender, recipient)) {
            recommendations.push({
              priority: 0,
              type: 'reestablish_tech',
              sender: {
                id: sender.id,
                rulerName: sender.rulerName,
                nationName: sender.nationName,
                discord_handle: sender.discord_handle,
                slots: sender.slots,
                currentAidCount: nationAidCounts.get(sender.id) || 0,
                warStatus: sender.warStatus
              },
              recipient: {
                id: recipient.id,
                rulerName: recipient.rulerName,
                nationName: recipient.nationName,
                slots: recipient.slots,
                currentAidCount: nationAidCounts.get(recipient.id) || 0,
                warStatus: recipient.warStatus
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
    activeNationsThatShouldSendCash.forEach(sender => {
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
              discord_handle: sender.discord_handle,
              slots: sender.slots,
              currentAidCount: nationAidCounts.get(sender.id) || 0,
              warStatus: sender.warStatus
            },
            recipient: {
              id: recipient.id,
              rulerName: recipient.rulerName,
              nationName: recipient.nationName,
              slots: recipient.slots,
              currentAidCount: nationAidCounts.get(recipient.id) || 0,
              warStatus: recipient.warStatus
            },
            reason: `New cash aid: ${sender.nationName} → ${recipient.nationName}`
          });
          incrementCounts(sender.id, recipient.id, 'cash');
        }
      });
    });

    // Priority 2: New tech aid recommendations
    activeNationsThatShouldSendTechnology.forEach(sender => {
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
              discord_handle: sender.discord_handle,
              slots: sender.slots,
              currentAidCount: nationAidCounts.get(sender.id) || 0,
              warStatus: sender.warStatus
            },
            recipient: {
              id: recipient.id,
              rulerName: recipient.rulerName,
              nationName: recipient.nationName,
              slots: recipient.slots,
              currentAidCount: nationAidCounts.get(recipient.id) || 0,
              warStatus: recipient.warStatus
            },
            reason: `New tech aid: ${sender.nationName} → ${recipient.nationName}`
          });
          incrementCounts(sender.id, recipient.id, 'tech');
        }
      });
    });

    // Sort recommendations by priority
    recommendations.sort((a, b) => a.priority - b.priority);

    // Calculate total slot counts (include all nations since recipients can receive in peace mode)
    const slotCounts = {
      totalGetCash: categorizedNations.reduce((sum, nation) => sum + nation.slots.getCash, 0),
      totalGetTech: categorizedNations.reduce((sum, nation) => sum + nation.slots.getTech, 0),
      totalSendCash: categorizedNations.reduce((sum, nation) => 
        nation.warStatus !== 'Peace Mode' ? sum + nation.slots.sendCash : sum, 0),
      totalSendTech: categorizedNations.reduce((sum, nation) => 
        nation.warStatus !== 'Peace Mode' ? sum + nation.slots.sendTech : sum, 0),
      totalUnassigned: categorizedNations.reduce((sum, nation) => {
        const totalPossibleSlots = nation.has_dra ? 6 : 5;
        const assignedSlots = nation.slots.getCash + nation.slots.getTech + 
                             nation.slots.sendCash + nation.slots.sendTech;
        return sum + (totalPossibleSlots - assignedSlots);
      }, 0)
    };

    return {
      recommendations,
      slotCounts
    };
  }

  /**
   * Get categorized nations with slots for a specific alliance
   */
  static async getCategorizedNations(allianceId: number) {
    const { nations, useJsonData } = await AllianceService.getAllianceDataWithJsonPriority(allianceId);
    
    if (nations.length === 0) {
      return [];
    }

    // If using JSON data, nations already have slots assigned
    // If using raw data, need to categorize them
    const categorizedNations = useJsonData ? nations : categorizeNations(nations);
    
    // Don't filter out peace mode nations - let the UI show them with indicators
    return categorizedNations.map(nation => ({
      id: nation.id,
      rulerName: nation.rulerName,
      nationName: nation.nationName,
      technology: nation.technology,
      infrastructure: nation.infrastructure,
      warStatus: nation.warStatus,
      slots: nation.slots
    }));
  }

  /**
   * Get small aid offers
   */
  static async getSmallAidOffers() {
    const { nations, aidOffers } = await loadDataFromFilesWithUpdate();
    
    // Filter for small aid offers (money < 1000000 and technology < 100, but must have some value)
    const smallOffers = aidOffers.filter(offer => 
      offer.status !== 'Expired' && 
      ((offer.money < 1000000 && offer.technology < 100 && (offer.money > 0 || offer.technology > 0)) || 
      (offer.technology == 0 && offer.money < 6000000 && offer.money > 0))
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

    return {
      smallAidOffers: offersWithAllianceInfo,
      totalCount: offersWithAllianceInfo.length
    };
  }
}
