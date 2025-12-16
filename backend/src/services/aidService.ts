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
import { CategorizedNation, Nation } from '../models/Nation.js';
import { prisma } from '../utils/prisma.js';
import { isAidOfferExpired, calculateAidDateInfo, getAidDaysUntilExpiration } from '../utils/dateUtils.js';

export class AidService {
  /**
   * Helper function to check if an aid offer is expired (by status or by date)
   */
  private static isOfferExpired(offer: AidOffer): boolean {
    // Check status first
    if (offer.status === 'Expired' || offer.status === 'Cancelled') {
      return true;
    }
    
    // Check date-based expiration - use the calculated field if available
    if (offer.isExpired === true) {
      return true;
    }
    
    // Also check daysUntilExpiration - if 0 or negative, it's expired
    if (offer.daysUntilExpiration !== undefined) {
      if (offer.daysUntilExpiration <= 0) {
        return true;
      }
      // If daysUntilExpiration > 0, it's not expired
      return false;
    }
    
    // Calculate expiration based on date if not already calculated
    if (offer.date) {
      try {
        return isAidOfferExpired(offer.date);
      } catch (error) {
        console.warn(`Failed to calculate expiration for aid offer ${offer.aidId} with date "${offer.date}":`, error);
        // If we can't parse the date, don't filter it out - allow it through
        return false;
      }
    }
    
    // If no date available, can't determine expiration - don't filter it out
    return false;
  }

  /**
   * Load cross-alliance aid coordination configuration from database
   */
  private static async loadCrossAllianceConfig(): Promise<Record<string, string>> {
    try {
      const configs = await prisma.crossAllianceAid.findMany({
        include: {
          sourceAlliance: true,
          targetAlliance: true,
        },
      });

      const result: Record<string, string> = {};
      for (const config of configs) {
        result[config.sourceAllianceId.toString()] = config.targetAllianceId.toString();
      }

      return result;
    } catch (error) {
      console.warn('Could not load cross-alliance aid config from database:', error);
      return {};
    }
  }

  /**
   * Get aid slots for a specific alliance
   * Optimized to query database directly instead of loading all data
   */
  static async getAidSlots(allianceId: number) {
    const { prisma } = await import('../utils/prisma.js');
    
    // Query only nations in this alliance
    const nationRecords = await prisma.nation.findMany({
      where: { allianceId, isActive: true },
      include: { alliance: true },
    });
    
    const nations: Nation[] = nationRecords.map((n: any) => ({
      id: n.id,
      rulerName: n.rulerName,
      nationName: n.nationName,
      alliance: n.alliance.name,
      allianceId: n.allianceId,
      team: n.team,
      strength: n.strength,
      activity: n.activity,
      technology: n.technology,
      infrastructure: n.infrastructure,
      land: n.land,
      nuclearWeapons: n.nuclearWeapons,
      governmentType: n.governmentType,
      inWarMode: n.inWarMode,
      attackingCasualties: n.attackingCasualties ?? undefined,
      defensiveCasualties: n.defensiveCasualties ?? undefined,
      warchest: n.warchest ?? undefined,
      spyglassLastUpdated: n.spyglassLastUpdated ?? undefined,
      rank: n.rank ?? undefined,
    }));
    
    // Get alliance nation IDs for filtering aid offers
    const allianceNationIds = new Set(nations.map(n => n.id));
    
    // Query aid offers involving nations in this alliance
    // Only get active offers (present in latest CSV data)
    // Don't filter by status here - we'll filter by date-based expiration in memory
    const aidOfferRecords = await prisma.aidOffer.findMany({
      where: {
        isActive: true,
        OR: [
          { declaringNationId: { in: Array.from(allianceNationIds) } },
          { receivingNationId: { in: Array.from(allianceNationIds) } }
        ]
      },
      include: {
        declaringNation: {
          include: { alliance: true },
        },
        receivingNation: {
          include: { alliance: true },
        },
      },
    });
    
    const aidOffers: AidOffer[] = aidOfferRecords
      .map((a: any) => {
        // Calculate all date-related fields
        // Note: Prisma maps 'date' field to 'aid_timestamp' column in database
        let dateInfo: { expirationDate?: string; daysUntilExpiration?: number; isExpired?: boolean } = {};
        
        // Debug: Log what Prisma is returning for the date field
        if (!a.date && aidOfferRecords.length > 0 && aidOfferRecords[0].aidId === a.aidId) {
          console.log(`[DEBUG] First aid offer ${a.aidId} - Prisma returned:`, {
            hasDate: 'date' in a,
            dateValue: a.date,
            allKeys: Object.keys(a).filter(k => k.includes('date') || k.includes('timestamp') || k.includes('Date'))
          });
        }
        
        try {
          if (a.date) {
            dateInfo = calculateAidDateInfo(a.date);
          } else {
            // Only log first few to avoid spam
            if (aidOfferRecords.indexOf(a) < 3) {
              console.warn(`Aid offer ${a.aidId} has no date field (date is null/undefined). Available fields: ${Object.keys(a).join(', ')}`);
            }
          }
        } catch (error) {
          console.warn(`Failed to calculate date info for aid offer ${a.aidId} with date "${a.date}":`, error);
        }
        
        return {
          aidId: a.aidId,
          declaringId: a.declaringNationId,
          declaringRuler: a.declaringNation.rulerName,
          declaringNation: a.declaringNation.nationName,
          declaringAlliance: a.declaringNation.alliance.name,
          declaringAllianceId: a.declaringNation.allianceId,
          receivingId: a.receivingNationId,
          receivingRuler: a.receivingNation.rulerName,
          receivingNation: a.receivingNation.nationName,
          receivingAlliance: a.receivingNation.alliance.name,
          receivingAllianceId: a.receivingNation.allianceId,
          status: a.status,
          money: a.money,
          technology: a.technology,
          soldiers: a.soldiers,
          date: a.date || '',
          reason: a.reason,
          expirationDate: dateInfo.expirationDate,
          daysUntilExpiration: dateInfo.daysUntilExpiration,
          isExpired: dateInfo.isExpired ?? a.isExpired ?? false,
        };
      })
      // Filter out expired offers (by status OR by date calculation)
      .filter(offer => {
        const isStatusExpired = offer.status === 'Expired' || offer.status === 'Cancelled';
        const isDateExpired = offer.isExpired === true;
        return !isStatusExpired && !isDateExpired;
      });
    
    return await getAidSlotsForAlliance(allianceId, nations, aidOffers);
  }

  /**
   * Get alliance aid statistics
   */
  static async getAllianceAidStats(allianceId: number) {
    const { nations, aidOffers, useJsonData } = await AllianceService.getAllianceData(allianceId);
    
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
    const categorizedNations: CategorizedNation[] = useJsonData ? (nations as CategorizedNation[]) : await categorizeNations(nations);
    
    // Get existing aid offers (exclude expired and cancelled)
    const existingOffers = aidOffers.filter(offer => 
      !this.isOfferExpired(offer) &&
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
  static async getAidRecommendations(allianceId: number, crossAllianceEnabled: boolean = false) {
    const { nations, aidOffers, useJsonData } = await AllianceService.getAllianceData(allianceId);
    
    if (nations.length === 0) {
      return {
        recommendations: [],
        slotCounts: null
      };
    }

    // If using JSON data, nations already have slots assigned
    // If using raw data, need to categorize them
    let categorizedNations: CategorizedNation[] = useJsonData ? (nations as CategorizedNation[]) : await categorizeNations(nations);
    
    // Load cross-alliance configuration only if enabled
    let crossAllianceConfig: Record<string, string> = {};
    let receivingAllianceId: string | undefined;
    
    if (crossAllianceEnabled) {
      crossAllianceConfig = await this.loadCrossAllianceConfig();
      receivingAllianceId = crossAllianceConfig[allianceId.toString()];
      
      // If this alliance has a linked receiving alliance, include those nations
      if (receivingAllianceId) {
        try {
          const { nations: receivingNations, useJsonData: receivingUseJsonData } = 
            await AllianceService.getAllianceData(parseInt(receivingAllianceId));
          
          if (receivingNations.length > 0) {
            const categorizedReceivingNations: CategorizedNation[] = receivingUseJsonData ? receivingNations as CategorizedNation[] : await categorizeNations(receivingNations);
            // Add receiving nations to the pool for cross-alliance coordination
            categorizedNations = [...categorizedNations, ...categorizedReceivingNations];
          }
        } catch (error) {
          console.warn(`Could not load receiving alliance ${receivingAllianceId} for cross-alliance coordination:`, error);
        }
      }
    }
    
    // Don't filter out peace mode nations - only senders are restricted, not recipients
    const activeNations = categorizedNations;
    
    // Get existing aid offers (exclude expired)
    const existingOffers = aidOffers.filter(offer => 
      !this.isOfferExpired(offer) &&
      (offer.declaringAllianceId === allianceId || offer.receivingAllianceId === allianceId)
    );

    // Get expired aid offers for prioritization (by status or by date)
    const expiredOffers = aidOffers.filter(offer => 
      this.isOfferExpired(offer) &&
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

    // Create a set to track recommendation pairs to prevent duplicates within the same generation cycle
    const recommendationPairs = new Set();

    // Get actual aid slots to count ALL offers (regardless of type) against total capacity
    const actualNationAidSlots = await getAidSlotsForAlliance(allianceId, nations, aidOffers);
    
    // Count actual filled slots per nation (all offers, regardless of type or configuration)
    const actualFilledSlotsByNation = new Map<number, number>();
    // Track total available slots per nation (5 or 6 based on DRA)
    const totalAvailableSlotsByNation = new Map<number, number>();
    
    actualNationAidSlots.forEach(nationAidSlots => {
      const nationId = nationAidSlots.nation.id;
      // Count how many slots are actually filled (have an aid offer)
      const filledSlots = nationAidSlots.aidSlots.filter(slot => slot.aidOffer !== null).length;
      actualFilledSlotsByNation.set(nationId, filledSlots);
      // Total slots = 5 or 6 based on DRA
      const totalSlots = nationAidSlots.aidSlots.length;
      totalAvailableSlotsByNation.set(nationId, totalSlots);
    });
    
    // Also maintain nationAidCounts for backward compatibility (tracked offers only)
    const nationAidCounts = new Map<number, number>();
    existingOffers.forEach(offer => {
      // Only count tracked offers (both sender and receiver in same alliance)
      // Exclude external offers (where sender and receiver are in different alliances)
      const isTrackedOffer = offer.declaringAllianceId === allianceId && offer.receivingAllianceId === allianceId;
      
      if (isTrackedOffer) {
        // Count outgoing aid (sender)
        const senderCount = nationAidCounts.get(offer.declaringId) || 0;
        nationAidCounts.set(offer.declaringId, senderCount + 1);
        // Count incoming aid (receiver)
        const receiverCount = nationAidCounts.get(offer.receivingId) || 0;
        nationAidCounts.set(offer.receivingId, receiverCount + 1);
      }
    });

    // Per-type existing counts (only tracked offers, excluding external)
    const outgoingCashExisting = new Map<number, number>();
    const incomingCashExisting = new Map<number, number>();
    const outgoingTechExisting = new Map<number, number>();
    const incomingTechExisting = new Map<number, number>();
    
    // Count external offers (where sender or receiver is not in the alliance)
    const externalOffersUsed = new Map<number, number>();
    
    existingOffers.forEach(offer => {
      // Only count tracked offers (both sender and receiver in same alliance)
      const isTrackedOffer = offer.declaringAllianceId === allianceId && offer.receivingAllianceId === allianceId;
      
      if (isTrackedOffer) {
        // If offer has tech, treat as tech only (even if it also has cash)
        const isTech = offer.technology > 0;
        const isCash = offer.money > 0 && offer.technology === 0; // Only cash if no tech
        if (isCash) {
          outgoingCashExisting.set(offer.declaringId, (outgoingCashExisting.get(offer.declaringId) || 0) + 1);
          incomingCashExisting.set(offer.receivingId, (incomingCashExisting.get(offer.receivingId) || 0) + 1);
        }
        if (isTech) {
          outgoingTechExisting.set(offer.declaringId, (outgoingTechExisting.get(offer.declaringId) || 0) + 1);
          incomingTechExisting.set(offer.receivingId, (incomingTechExisting.get(offer.receivingId) || 0) + 1);
        }
      } else {
        // This is an external offer - count it for both sender and receiver if they're in our alliance
        const isOutgoingExternal = offer.declaringAllianceId === allianceId && offer.receivingAllianceId !== allianceId;
        const isIncomingExternal = offer.declaringAllianceId !== allianceId && offer.receivingAllianceId === allianceId;
        
        if (isOutgoingExternal) {
          // Sender is in our alliance, receiver is not - counts against sender's external slots
          externalOffersUsed.set(offer.declaringId, (externalOffersUsed.get(offer.declaringId) || 0) + 1);
        }
        if (isIncomingExternal) {
          // Receiver is in our alliance, sender is not - counts against receiver's external slots
          externalOffersUsed.set(offer.receivingId, (externalOffersUsed.get(offer.receivingId) || 0) + 1);
        }
      }
    });

    // Total tracked slot capacity by nation (excluding external slots, which are reserved for external offers)
    const totalTrackedSlotsByNation = new Map<number, number>();
    activeNations.forEach(n => {
      // Only count tracked slots (external slots are reserved for external offers)
      const total = n.slots.getCash + n.slots.getTech + n.slots.sendCash + n.slots.sendTech;
      totalTrackedSlotsByNation.set(n.id, total);
    });

    // Recommended counts (total and per-type) to avoid exceeding capacity when adding recs
    const recommendationCounts = new Map<number, number>();
    const recOutgoingCash = new Map<number, number>();
    const recIncomingCash = new Map<number, number>();
    const recOutgoingTech = new Map<number, number>();
    const recIncomingTech = new Map<number, number>();

    const hasTotalCapacity = (nationId: number): boolean => {
      // Only check against tracked slots (external slots are reserved for external offers)
      const totalCap = totalTrackedSlotsByNation.get(nationId) || 0;
      const existing = nationAidCounts.get(nationId) || 0;
      const planned = recommendationCounts.get(nationId) || 0;
      return existing + planned < totalCap;
    };

    const hasOutgoingCashCapacity = (senderId: number, senderSlots: any): boolean => {
      const existing = outgoingCashExisting.get(senderId) || 0;
      const planned = recOutgoingCash.get(senderId) || 0;
      const typeCapacity = existing + planned < senderSlots.sendCash;
      
      // Check total capacity using actual filled slots (all offers, regardless of type or configuration)
      // This accounts for offers that don't match the configured slot type
      // Total slots = 5 or 6 based on DRA, and ALL offers (incoming + outgoing, any type) count against it
      const actualFilled = actualFilledSlotsByNation.get(senderId) || 0;
      const totalPlanned = recommendationCounts.get(senderId) || 0;
      const totalAvailable = totalAvailableSlotsByNation.get(senderId) || 0;
      const totalCapacity = actualFilled + totalPlanned < totalAvailable;
      
      // Must pass both checks: type-specific capacity AND total capacity
      return typeCapacity && totalCapacity;
    };

    const hasIncomingCashCapacity = (recipientId: number, recipientSlots: any): boolean => {
      const existing = incomingCashExisting.get(recipientId) || 0;
      const planned = recIncomingCash.get(recipientId) || 0;
      const typeCapacity = existing + planned < recipientSlots.getCash;
      
      // Check total capacity using actual filled slots (all offers, regardless of type or configuration)
      // This accounts for offers that don't match the configured slot type
      // Total slots = 5 or 6 based on DRA, and ALL offers (incoming + outgoing, any type) count against it
      const actualFilled = actualFilledSlotsByNation.get(recipientId) || 0;
      const totalPlanned = recommendationCounts.get(recipientId) || 0;
      const totalAvailable = totalAvailableSlotsByNation.get(recipientId) || 0;
      const totalCapacity = actualFilled + totalPlanned < totalAvailable;
      
      // Must pass both checks: type-specific capacity AND total capacity
      return typeCapacity && totalCapacity;
    };

    const hasOutgoingTechCapacity = (senderId: number, senderSlots: any): boolean => {
      const existing = outgoingTechExisting.get(senderId) || 0;
      const planned = recOutgoingTech.get(senderId) || 0;
      // Strict check: existing + planned must be strictly less than assigned slots
      // This ensures we never exceed capacity (e.g., if 3 existing + 3 planned = 6, and slots = 6, we stop)
      const typeCapacity = existing + planned < senderSlots.sendTech;
      
      // Check total capacity using actual filled slots (all offers, regardless of type or configuration)
      // This accounts for offers that don't match the configured slot type
      // Total slots = 5 or 6 based on DRA, and ALL offers (incoming + outgoing, any type) count against it
      const actualFilled = actualFilledSlotsByNation.get(senderId) || 0;
      const totalPlanned = recommendationCounts.get(senderId) || 0;
      const totalAvailable = totalAvailableSlotsByNation.get(senderId) || 0;
      const totalCapacity = actualFilled + totalPlanned < totalAvailable;
      
      // Must pass both checks: type-specific capacity AND total capacity
      return typeCapacity && totalCapacity;
    };

    const hasIncomingTechCapacity = (recipientId: number, recipientSlots: any): boolean => {
      const existing = incomingTechExisting.get(recipientId) || 0;
      const planned = recIncomingTech.get(recipientId) || 0;
      const typeCapacity = existing + planned < recipientSlots.getTech;
      
      // Check total capacity using actual filled slots (all offers, regardless of type or configuration)
      // This accounts for offers that don't match the configured slot type
      // Total slots = 5 or 6 based on DRA, and ALL offers (incoming + outgoing, any type) count against it
      const actualFilled = actualFilledSlotsByNation.get(recipientId) || 0;
      const totalPlanned = recommendationCounts.get(recipientId) || 0;
      const totalAvailable = totalAvailableSlotsByNation.get(recipientId) || 0;
      const totalCapacity = actualFilled + totalPlanned < totalAvailable;
      
      // Must pass both checks: type-specific capacity AND total capacity
      return typeCapacity && totalCapacity;
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

    // Get nations by aid direction - separate internal and cross-alliance
    const internalNations = activeNations.filter(nation => nation.allianceId === allianceId);
    const crossAllianceNations = crossAllianceEnabled ? activeNations.filter(nation => nation.allianceId !== allianceId) : [];
    
    // Internal alliance nations (priority)
    const internalNationsThatShouldGetCash = getNationsThatShouldGetCash(internalNations);
    const internalNationsThatShouldSendTechnology = getNationsThatShouldSendTechnology(internalNations);
    const internalNationsThatShouldGetTechnology = getNationsThatShouldGetTechnology(internalNations);
    const internalNationsThatShouldSendCash = getNationsThatShouldSendCash(internalNations);
    
    // Cross-alliance nations (secondary) - only if enabled
    const crossAllianceNationsThatShouldGetCash = crossAllianceEnabled ? getNationsThatShouldGetCash(crossAllianceNations) : [];
    const crossAllianceNationsThatShouldGetTechnology = crossAllianceEnabled ? getNationsThatShouldGetTechnology(crossAllianceNations) : [];
    
    // Filter out peace mode nations from sender lists only (recipients can receive in peace mode)
    // Sending nations must be in war mode, receiving nations can be in either mode
    const activeInternalNationsThatShouldSendCash = internalNationsThatShouldSendCash.filter(nation => 
      nation.inWarMode
    );
    const activeInternalNationsThatShouldSendTechnology = internalNationsThatShouldSendTechnology.filter(nation => 
      nation.inWarMode
    );

    // Helper function to group nations by priority for sequential processing
    const groupByPriority = <T extends { slots: { send_priority?: number; receive_priority?: number } }>(
      nations: T[],
      priorityField: 'send_priority' | 'receive_priority'
    ): Map<number, T[]> => {
      const groups = new Map<number, T[]>();
      nations.forEach(nation => {
        const priority = nation.slots[priorityField] ?? 999;
        if (!groups.has(priority)) {
          groups.set(priority, []);
        }
        groups.get(priority)!.push(nation);
      });
      return groups;
    };

    // Priority 0: Re-establish expired offers based on slot availability
    // Sort expired offers by sender and recipient priority
    const sortedExpiredOffers = expiredOffers.sort((a, b) => {
      const senderA = activeNations.find(n => n.id === a.declaringId);
      const senderB = activeNations.find(n => n.id === b.declaringId);
      const recipientA = activeNations.find(n => n.id === a.receivingId);
      const recipientB = activeNations.find(n => n.id === b.receivingId);
      
      // Primary sort by sender priority, secondary by recipient priority
      const senderPriorityDiff = (senderA?.slots.send_priority || 999) - (senderB?.slots.send_priority || 999);
      if (senderPriorityDiff !== 0) return senderPriorityDiff;
      return (recipientA?.slots.receive_priority || 999) - (recipientB?.slots.receive_priority || 999);
    });
    
    sortedExpiredOffers.forEach(offer => {
      if (offer.declaringAllianceId === allianceId) {
        const sender = activeNations.find(n => n.id === offer.declaringId);
        const recipient = activeNations.find(n => n.id === offer.receivingId);
        
        if (sender && recipient && sender.inWarMode) {
          const pair = `${Math.min(offer.declaringId, offer.receivingId)}-${Math.max(offer.declaringId, offer.receivingId)}`;
          
          // Re-establish expired cash aid
          if (sender.slots.sendCash > 0 && recipient.slots.getCash > 0 &&
              offer.money > 0 && !existingPairs.has(pair) && !recommendationPairs.has(pair) && canRecommendCash(sender, recipient)) {
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
                inWarMode: sender.inWarMode
              },
              recipient: {
                id: recipient.id,
                rulerName: recipient.rulerName,
                nationName: recipient.nationName,
                slots: recipient.slots,
                currentAidCount: nationAidCounts.get(recipient.id) || 0,
                inWarMode: recipient.inWarMode
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
            recommendationPairs.add(pair);
          }
          
          // Re-establish expired tech aid
          if (sender.slots.sendTech > 0 && recipient.slots.getTech > 0 &&
              offer.technology > 0 && !existingPairs.has(pair) && !recommendationPairs.has(pair) && canRecommendTech(sender, recipient)) {
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
                inWarMode: sender.inWarMode
              },
              recipient: {
                id: recipient.id,
                rulerName: recipient.rulerName,
                nationName: recipient.nationName,
                slots: recipient.slots,
                currentAidCount: nationAidCounts.get(recipient.id) || 0,
                inWarMode: recipient.inWarMode
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
            recommendationPairs.add(pair);
          }
        }
      }
    });

    // Priority 1: Internal cash aid recommendations (banks to farms within alliance)
    // Process internal cash aid sequentially by priority
    const internalCashSendersByPriority = groupByPriority(activeInternalNationsThatShouldSendCash, 'send_priority');
    const internalCashRecipientsByPriority = groupByPriority(internalNationsThatShouldGetCash, 'receive_priority');
    
    // Get all unique priority levels and sort them
    const allSenderPriorities = Array.from(internalCashSendersByPriority.keys()).sort((a, b) => a - b);
    const allRecipientPriorities = Array.from(internalCashRecipientsByPriority.keys()).sort((a, b) => a - b);
    
    // Process all combinations of priorities sequentially
    for (const senderPriority of allSenderPriorities) {
      for (const recipientPriority of allRecipientPriorities) {
        const senders = internalCashSendersByPriority.get(senderPriority) || [];
        const recipients = internalCashRecipientsByPriority.get(recipientPriority) || [];
        
        senders.forEach(sender => {
          recipients.forEach(recipient => {
            const pair = `${Math.min(sender.id, recipient.id)}-${Math.max(sender.id, recipient.id)}`;
            
            if (!existingPairs.has(pair) && !expiredPairs.has(pair) && !recommendationPairs.has(pair) && canRecommendCash(sender, recipient)) {
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
                  inWarMode: sender.inWarMode
                },
                recipient: {
                  id: recipient.id,
                  rulerName: recipient.rulerName,
                  nationName: recipient.nationName,
                  slots: recipient.slots,
                  currentAidCount: nationAidCounts.get(recipient.id) || 0,
                  inWarMode: recipient.inWarMode
                },
                reason: `New internal cash aid: ${sender.nationName} → ${recipient.nationName}`
              });
              incrementCounts(sender.id, recipient.id, 'cash');
              recommendationPairs.add(pair);
            }
          });
        });
      }
    }

    // Priority 2: Cross-alliance cash aid recommendations (only if internal slots are filled and cross-alliance is enabled)
    if (crossAllianceEnabled && crossAllianceNationsThatShouldGetCash.length > 0) {
      const crossAllianceCashRecipientsByPriority = groupByPriority(crossAllianceNationsThatShouldGetCash, 'receive_priority');
      const allCrossAllianceRecipientPriorities = Array.from(crossAllianceCashRecipientsByPriority.keys()).sort((a, b) => a - b);
      
      // Process cross-alliance recipients sequentially by priority
      for (const senderPriority of allSenderPriorities) {
        const senders = internalCashSendersByPriority.get(senderPriority) || [];
        for (const recipientPriority of allCrossAllianceRecipientPriorities) {
          const recipients = crossAllianceCashRecipientsByPriority.get(recipientPriority) || [];
          
          senders.forEach(sender => {
            // Only consider cross-alliance if sender still has capacity after internal recommendations
            const hasRemainingCapacity = hasOutgoingCashCapacity(sender.id, sender.slots);
            if (hasRemainingCapacity) {
              recipients.forEach(recipient => {
                const pair = `${Math.min(sender.id, recipient.id)}-${Math.max(sender.id, recipient.id)}`;
                
                if (!existingPairs.has(pair) && !expiredPairs.has(pair) && !recommendationPairs.has(pair) && canRecommendCash(sender, recipient)) {
                  recommendations.push({
                    priority: 2,
                    type: 'cross_alliance_cash',
                    sender: {
                      id: sender.id,
                      rulerName: sender.rulerName,
                      nationName: sender.nationName,
                      discord_handle: sender.discord_handle,
                      slots: sender.slots,
                      currentAidCount: nationAidCounts.get(sender.id) || 0,
                      inWarMode: sender.inWarMode
                    },
                    recipient: {
                      id: recipient.id,
                      rulerName: recipient.rulerName,
                      nationName: recipient.nationName,
                      slots: recipient.slots,
                      currentAidCount: nationAidCounts.get(recipient.id) || 0,
                      inWarMode: recipient.inWarMode
                    },
                    reason: `Cross-alliance cash aid: ${sender.nationName} → ${recipient.nationName}`
                  });
                  incrementCounts(sender.id, recipient.id, 'cash');
                  recommendationPairs.add(pair);
                }
              });
            }
          });
        }
      }
    }

    // Priority 3: Internal tech aid recommendations
    // Process internal tech aid sequentially by priority
    const internalTechSendersByPriority = groupByPriority(activeInternalNationsThatShouldSendTechnology, 'send_priority');
    const internalTechRecipientsByPriority = groupByPriority(internalNationsThatShouldGetTechnology, 'receive_priority');
    
    const allTechSenderPriorities = Array.from(internalTechSendersByPriority.keys()).sort((a, b) => a - b);
    const allTechRecipientPriorities = Array.from(internalTechRecipientsByPriority.keys()).sort((a, b) => a - b);
    
    // Process all combinations of priorities sequentially
    for (const senderPriority of allTechSenderPriorities) {
      for (const recipientPriority of allTechRecipientPriorities) {
        const senders = internalTechSendersByPriority.get(senderPriority) || [];
        const recipients = internalTechRecipientsByPriority.get(recipientPriority) || [];
        
        senders.forEach(sender => {
          // Check sender capacity before entering recipient loop
          if (!hasOutgoingTechCapacity(sender.id, sender.slots)) {
            return; // Skip this sender entirely if they're at capacity
          }
          
          recipients.forEach(recipient => {
            // Check capacity before processing to avoid unnecessary iterations
            if (!canRecommendTech(sender, recipient)) {
              return; // Skip if sender or recipient is at capacity
            }
            
            const pair = `${Math.min(sender.id, recipient.id)}-${Math.max(sender.id, recipient.id)}`;
            
            if (!existingPairs.has(pair) && !expiredPairs.has(pair) && !recommendationPairs.has(pair)) {
              recommendations.push({
                priority: 3,
                type: 'new_tech',
                sender: {
                  id: sender.id,
                  rulerName: sender.rulerName,
                  nationName: sender.nationName,
                  discord_handle: sender.discord_handle,
                  slots: sender.slots,
                  currentAidCount: nationAidCounts.get(sender.id) || 0,
                  inWarMode: sender.inWarMode
                },
                recipient: {
                  id: recipient.id,
                  rulerName: recipient.rulerName,
                  nationName: recipient.nationName,
                  slots: recipient.slots,
                  currentAidCount: nationAidCounts.get(recipient.id) || 0,
                  inWarMode: recipient.inWarMode
                },
                reason: `New internal tech aid: ${sender.nationName} → ${recipient.nationName}`
              });
              incrementCounts(sender.id, recipient.id, 'tech');
              recommendationPairs.add(pair);
              
              // After adding a recommendation, check if sender is now at capacity and break
              if (!hasOutgoingTechCapacity(sender.id, sender.slots)) {
                return; // Break out of recipient loop if sender is now at capacity
              }
            }
          });
        });
      }
    }

    // Priority 4: Cross-alliance tech aid recommendations (only if internal slots are filled and cross-alliance is enabled)
    if (crossAllianceEnabled && crossAllianceNationsThatShouldGetTechnology.length > 0) {
      const crossAllianceTechRecipientsByPriority = groupByPriority(crossAllianceNationsThatShouldGetTechnology, 'receive_priority');
      const allCrossAllianceTechRecipientPriorities = Array.from(crossAllianceTechRecipientsByPriority.keys()).sort((a, b) => a - b);
      
      // Process cross-alliance tech recipients sequentially by priority
      for (const senderPriority of allTechSenderPriorities) {
        const senders = internalTechSendersByPriority.get(senderPriority) || [];
        for (const recipientPriority of allCrossAllianceTechRecipientPriorities) {
          const recipients = crossAllianceTechRecipientsByPriority.get(recipientPriority) || [];
          
          senders.forEach(sender => {
            // Only consider cross-alliance if sender still has capacity after internal recommendations
            const hasRemainingCapacity = hasOutgoingTechCapacity(sender.id, sender.slots);
            if (hasRemainingCapacity) {
              recipients.forEach(recipient => {
                const pair = `${Math.min(sender.id, recipient.id)}-${Math.max(sender.id, recipient.id)}`;
                
                if (!existingPairs.has(pair) && !expiredPairs.has(pair) && !recommendationPairs.has(pair) && canRecommendTech(sender, recipient)) {
                  recommendations.push({
                    priority: 4,
                    type: 'cross_alliance_tech',
                    sender: {
                      id: sender.id,
                      rulerName: sender.rulerName,
                      nationName: sender.nationName,
                      discord_handle: sender.discord_handle,
                      slots: sender.slots,
                      currentAidCount: nationAidCounts.get(sender.id) || 0,
                      inWarMode: sender.inWarMode
                    },
                    recipient: {
                      id: recipient.id,
                      rulerName: recipient.rulerName,
                      nationName: recipient.nationName,
                      slots: recipient.slots,
                      currentAidCount: nationAidCounts.get(recipient.id) || 0,
                      inWarMode: recipient.inWarMode
                    },
                    reason: `Cross-alliance tech aid: ${sender.nationName} → ${recipient.nationName}`
                  });
                  incrementCounts(sender.id, recipient.id, 'tech');
                  recommendationPairs.add(pair);
                }
              });
            }
          });
        }
      }
    }

    // Sort recommendations by priority (lower number = higher priority)
    recommendations.sort((a, b) => a.priority - b.priority);

    // Final deduplication step: remove any duplicate recommendations by sender-recipient pair
    // This catches any edge cases where duplicates might have slipped through
    // Keep the first occurrence (highest priority since we sorted by priority)
    const finalRecommendations: any[] = [];
    const seenPairs = new Set<string>();
    
    for (const rec of recommendations) {
      const pair = `${Math.min(rec.sender.id, rec.recipient.id)}-${Math.max(rec.sender.id, rec.recipient.id)}`;
      if (!seenPairs.has(pair)) {
        seenPairs.add(pair);
        finalRecommendations.push(rec);
      }
    }

    // Calculate total slot counts (include all nations since recipients can receive in peace mode)
    const slotCounts = {
      totalGetCash: categorizedNations.reduce((sum, nation) => sum + nation.slots.getCash, 0),
      totalGetTech: categorizedNations.reduce((sum, nation) => sum + nation.slots.getTech, 0),
      totalSendCash: categorizedNations.reduce((sum, nation) => 
        nation.inWarMode ? sum + nation.slots.sendCash : sum, 0),
      totalSendTech: categorizedNations.reduce((sum, nation) => 
        nation.inWarMode ? sum + nation.slots.sendTech : sum, 0),
      totalExternal: categorizedNations.reduce((sum, nation) => sum + nation.slots.external, 0),
      totalSendCashPeaceMode: categorizedNations.reduce((sum, nation) => 
        !nation.inWarMode ? sum + nation.slots.sendCash : sum, 0),
      totalSendTechPeaceMode: categorizedNations.reduce((sum, nation) => 
        !nation.inWarMode ? sum + nation.slots.sendTech : sum, 0),
      totalUnassigned: internalNations.reduce((sum, nation) => {
        const totalPossibleSlots = nation.has_dra ? 6 : 5;
        const assignedSlots = nation.slots.getCash + nation.slots.getTech + 
                             nation.slots.sendCash + nation.slots.sendTech + 
                             nation.slots.external;
        return sum + (totalPossibleSlots - assignedSlots);
      }, 0),
      // Internal alliance slot counts
      internalGetCash: internalNations.reduce((sum, nation) => sum + nation.slots.getCash, 0),
      internalGetTech: internalNations.reduce((sum, nation) => sum + nation.slots.getTech, 0),
      internalSendCash: internalNations.reduce((sum, nation) => 
        nation.inWarMode ? sum + nation.slots.sendCash : sum, 0),
      internalSendTech: internalNations.reduce((sum, nation) => 
        nation.inWarMode ? sum + nation.slots.sendTech : sum, 0),
      // Cross-alliance slot counts (for receiving only) - only if enabled
      crossAllianceGetCash: crossAllianceEnabled ? crossAllianceNations.reduce((sum, nation) => sum + nation.slots.getCash, 0) : 0,
      crossAllianceGetTech: crossAllianceEnabled ? crossAllianceNations.reduce((sum, nation) => sum + nation.slots.getTech, 0) : 0,
      // Active aid offer counts by type
      activeGetCash: existingOffers.filter(offer => 
        offer.receivingAllianceId === allianceId && offer.money > 0 && offer.technology === 0
      ).length,
      activeGetTech: existingOffers.filter(offer => 
        offer.receivingAllianceId === allianceId && offer.technology > 0
      ).length,
      activeSendCash: existingOffers.filter(offer => 
        offer.declaringAllianceId === allianceId && offer.money > 0 && offer.technology === 0
      ).length,
      activeSendTech: existingOffers.filter(offer => 
        offer.declaringAllianceId === allianceId && offer.technology > 0
      ).length
    };

    // Calculate available slots by category for each nation
    // Only show nations from the current alliance (not cross-alliance nations)
    // Show nations that have slots assigned but no slots currently in use for that category
    const availableSlots = {
      sendCash: [] as Array<{ nation: any; available: number }>,
      sendTech: [] as Array<{ nation: any; available: number }>,
      getCash: [] as Array<{ nation: any; available: number }>,
      getTech: [] as Array<{ nation: any; available: number }>,
      external: [] as Array<{ nation: any; available: number }>
    };

    // Get only nations from the current alliance (exclude cross-alliance nations)
    // Use the original nations list to ensure we only include alliance nations
    const originalAllianceNationIds = new Set(nations.map(n => n.id));
    const allianceNationsOnly = categorizedNations.filter(nation => originalAllianceNationIds.has(nation.id));

    allianceNationsOnly.forEach(nation => {
      // Send Cash
      const sendCashAssigned = nation.slots.sendCash || 0;
      const sendCashUsed = outgoingCashExisting.get(nation.id) || 0;
      const sendCashPlanned = recOutgoingCash.get(nation.id) || 0;
      const sendCashAvailable = sendCashAssigned - sendCashUsed - sendCashPlanned;
      // Show if has assigned slots, none are in use, and none are planned
      if (sendCashAssigned > 0 && sendCashUsed === 0 && sendCashPlanned === 0) {
        availableSlots.sendCash.push({
          nation: {
            id: nation.id,
            nationName: nation.nationName,
            rulerName: nation.rulerName,
            inWarMode: nation.inWarMode
          },
          available: sendCashAvailable
        });
      }

      // Send Tech
      const sendTechAssigned = nation.slots.sendTech || 0;
      const sendTechUsed = outgoingTechExisting.get(nation.id) || 0;
      const sendTechPlanned = recOutgoingTech.get(nation.id) || 0;
      const sendTechAvailable = sendTechAssigned - sendTechUsed - sendTechPlanned;
      // Show if has assigned slots, none are in use, and none are planned
      if (sendTechAssigned > 0 && sendTechUsed === 0 && sendTechPlanned === 0) {
        availableSlots.sendTech.push({
          nation: {
            id: nation.id,
            nationName: nation.nationName,
            rulerName: nation.rulerName,
            inWarMode: nation.inWarMode
          },
          available: sendTechAvailable
        });
      }

      // Get Cash
      const getCashAssigned = nation.slots.getCash || 0;
      const getCashUsed = incomingCashExisting.get(nation.id) || 0;
      const getCashPlanned = recIncomingCash.get(nation.id) || 0;
      const getCashAvailable = getCashAssigned - getCashUsed - getCashPlanned;
      // Show if has assigned slots, none are in use, and none are planned
      if (getCashAssigned > 0 && getCashUsed === 0 && getCashPlanned === 0) {
        availableSlots.getCash.push({
          nation: {
            id: nation.id,
            nationName: nation.nationName,
            rulerName: nation.rulerName,
            inWarMode: nation.inWarMode
          },
          available: getCashAvailable
        });
      }

      // Get Tech
      const getTechAssigned = nation.slots.getTech || 0;
      const getTechUsed = incomingTechExisting.get(nation.id) || 0;
      const getTechPlanned = recIncomingTech.get(nation.id) || 0;
      const getTechAvailable = getTechAssigned - getTechUsed - getTechPlanned;
      // Show if has assigned slots, none are in use, and none are planned
      if (getTechAssigned > 0 && getTechUsed === 0 && getTechPlanned === 0) {
        availableSlots.getTech.push({
          nation: {
            id: nation.id,
            nationName: nation.nationName,
            rulerName: nation.rulerName,
            inWarMode: nation.inWarMode
          },
          available: getTechAvailable
        });
      }

      // External - subtract external offers that are currently active
      const externalAssigned = nation.slots.external || 0;
      const externalUsed = externalOffersUsed.get(nation.id) || 0;
      const externalAvailable = externalAssigned - externalUsed;
      // Show if has assigned slots, none are in use
      if (externalAssigned > 0 && externalUsed === 0) {
        availableSlots.external.push({
          nation: {
            id: nation.id,
            nationName: nation.nationName,
            rulerName: nation.rulerName,
            inWarMode: nation.inWarMode
          },
          available: externalAvailable
        });
      }
    });

    // Find mismatched offers - offers that don't map to configured slots
    const mismatchedOffers = {
      allianceOffers: {
        sendCash: [] as Array<{ nation: any; offers: any[] }>,
        sendTech: [] as Array<{ nation: any; offers: any[] }>,
        getCash: [] as Array<{ nation: any; offers: any[] }>,
        getTech: [] as Array<{ nation: any; offers: any[] }>
      },
      externalMismatches: [] as Array<{ nation: any; offers: any[] }>
    };

    // Create a map of nations by ID for quick lookup
    const nationMap = new Map<number, any>();
    allianceNationsOnly.forEach(nation => {
      nationMap.set(nation.id, nation);
    });

    // Track offers that exceed configured slots for each slot type
    const sendCashOffersByNation = new Map<number, any[]>();
    const sendTechOffersByNation = new Map<number, any[]>();
    const getCashOffersByNation = new Map<number, any[]>();
    const getTechOffersByNation = new Map<number, any[]>();
    const internalOffersByNation = new Map<number, any[]>();

    existingOffers.forEach(offer => {
      const isTrackedOffer = offer.declaringAllianceId === allianceId && offer.receivingAllianceId === allianceId;
      
      if (isTrackedOffer) {
        const senderNation = nationMap.get(offer.declaringId);
        const receiverNation = nationMap.get(offer.receivingId);
        
        // If offer has tech, treat as tech only (even if it also has cash)
        const isTech = offer.technology > 0;
        const isCash = offer.money > 0 && offer.technology === 0; // Only cash if no tech
        const offerType = isTech ? 'tech' : 'cash'; // Prioritize tech

        // Track outgoing offers - track all offers for mismatch detection
        if (senderNation && receiverNation) {
          const receiverSlots = receiverNation.slots || {};
          const receiverGetCash = Number(receiverSlots.getCash) || 0;
          const receiverGetTech = Number(receiverSlots.getTech) || 0;
          
          if (isCash) {
            if (!sendCashOffersByNation.has(offer.declaringId)) {
              sendCashOffersByNation.set(offer.declaringId, []);
            }
            const receiverExternal = Number(receiverSlots.external) || 0;
            const receiverGetTech = Number(receiverSlots.getTech) || 0;
            const receiverSendCash = Number(receiverSlots.sendCash) || 0;
            const receiverSendTech = Number(receiverSlots.sendTech) || 0;
            sendCashOffersByNation.get(offer.declaringId)!.push({
              ...offer,
              direction: 'sent',
              type: 'cash',
              receiverHasMatchingSlot: receiverGetCash > 0,
              receiverGetCash,
              receiverGetTech,
              receiverSendCash,
              receiverSendTech,
              receiverExternal
            });
          }
          if (isTech) {
            if (!sendTechOffersByNation.has(offer.declaringId)) {
              sendTechOffersByNation.set(offer.declaringId, []);
            }
            const receiverExternal = Number(receiverSlots.external) || 0;
            const receiverGetCash = Number(receiverSlots.getCash) || 0;
            const receiverSendCash = Number(receiverSlots.sendCash) || 0;
            const receiverSendTech = Number(receiverSlots.sendTech) || 0;
            sendTechOffersByNation.get(offer.declaringId)!.push({
              ...offer,
              direction: 'sent',
              type: 'tech',
              receiverHasMatchingSlot: receiverGetTech > 0,
              receiverGetTech,
              receiverGetCash,
              receiverSendCash,
              receiverSendTech,
              receiverExternal
            });
          }
          
          // Track all internal offers for external mismatch detection
          if (!internalOffersByNation.has(offer.declaringId)) {
            internalOffersByNation.set(offer.declaringId, []);
          }
          internalOffersByNation.get(offer.declaringId)!.push({
            ...offer,
            direction: 'sent',
            type: offerType
          });
        }

        // Track incoming offers - track all offers for mismatch detection
        if (senderNation && receiverNation) {
          const senderSlots = senderNation.slots || {};
          const senderSendCash = Number(senderSlots.sendCash) || 0;
          const senderSendTech = Number(senderSlots.sendTech) || 0;
          
          if (isCash) {
            if (!getCashOffersByNation.has(offer.receivingId)) {
              getCashOffersByNation.set(offer.receivingId, []);
            }
            const senderExternal = Number(senderSlots.external) || 0;
            const senderGetCash = Number(senderSlots.getCash) || 0;
            const senderGetTech = Number(senderSlots.getTech) || 0;
            getCashOffersByNation.get(offer.receivingId)!.push({
              ...offer,
              direction: 'received',
              type: 'cash',
              senderHasMatchingSlot: senderSendCash > 0,
              senderSendCash,
              senderSendTech,
              senderGetCash,
              senderGetTech,
              senderExternal
            });
          }
          if (isTech) {
            if (!getTechOffersByNation.has(offer.receivingId)) {
              getTechOffersByNation.set(offer.receivingId, []);
            }
            const senderExternal = Number(senderSlots.external) || 0;
            const senderGetCash = Number(senderSlots.getCash) || 0;
            const senderGetTech = Number(senderSlots.getTech) || 0;
            getTechOffersByNation.get(offer.receivingId)!.push({
              ...offer,
              direction: 'received',
              type: 'tech',
              senderHasMatchingSlot: senderSendTech > 0,
              senderSendTech,
              senderSendCash,
              senderGetCash,
              senderGetTech,
              senderExternal
            });
          }
          
          // Track all internal offers for external mismatch detection
          if (!internalOffersByNation.has(offer.receivingId)) {
            internalOffersByNation.set(offer.receivingId, []);
          }
          internalOffersByNation.get(offer.receivingId)!.push({
            ...offer,
            direction: 'received',
            type: offerType
          });
        }
      }
    });

    // Find offers that exceed configured slots for each slot type
    allianceNationsOnly.forEach(nation => {
      // Ensure slots exist and are numbers
      const slots = nation.slots || {};
      
      // Send Cash mismatches
      const sendCashAssigned = Number(slots.sendCash) || 0;
      const sendCashOffers = sendCashOffersByNation.get(nation.id) || [];
      // Flag offers that exceed configured slots OR where receiver doesn't have matching receive slots
      const sendCashMismatches = sendCashOffers
        .map((offer, index) => {
          const exceedsSlots = index >= sendCashAssigned;
          const receiverMismatch = !offer.receiverHasMatchingSlot;
          
          let mismatchReason = '';
          if (exceedsSlots && receiverMismatch) {
            // Both issues: exceeds slots AND receiver doesn't have getCash
            mismatchReason = `sender has ${index + 1}/${sendCashAssigned} send cash, receiver has no getCash slots`;
          } else if (exceedsSlots) {
            // Only exceeds slots - receiver has getCash but sender sent too many
            mismatchReason = `sender has ${index + 1}/${sendCashAssigned} send cash`;
          } else if (receiverMismatch) {
            // Receiver doesn't have getCash slots - show what they have instead
            const receiverSlotParts: string[] = [];
            if (offer.receiverSendCash > 0) receiverSlotParts.push(`${offer.receiverSendCash}x sendCash`);
            if (offer.receiverSendTech > 0) receiverSlotParts.push(`${offer.receiverSendTech}x sendTech`);
            if (offer.receiverGetTech > 0) receiverSlotParts.push(`${offer.receiverGetTech}x getTech`);
            if (offer.receiverExternal > 0) receiverSlotParts.push(`${offer.receiverExternal}x external`);
            if (receiverSlotParts.length > 0) {
              mismatchReason = `receiver has no getCash slots (has ${receiverSlotParts.join(', ')})`;
            } else {
              mismatchReason = 'receiver has no getCash slots';
            }
          }
          
          return { ...offer, mismatchReason };
        })
        .filter((offer, index) => index >= sendCashAssigned || !offer.receiverHasMatchingSlot);
      if (sendCashMismatches.length > 0) {
        mismatchedOffers.allianceOffers.sendCash.push({
          nation: {
            id: nation.id,
            nationName: nation.nationName,
            rulerName: nation.rulerName,
            inWarMode: nation.inWarMode
          },
          offers: sendCashMismatches
        });
      }

      // Send Tech mismatches
      const sendTechAssigned = Number(slots.sendTech) || 0;
      const sendTechOffers = sendTechOffersByNation.get(nation.id) || [];
      // Flag offers that exceed configured slots OR where receiver doesn't have matching receive slots
      const sendTechMismatches = sendTechOffers
        .map((offer, index) => {
          const exceedsSlots = index >= sendTechAssigned;
          const receiverMismatch = !offer.receiverHasMatchingSlot;
          
          let mismatchReason = '';
          if (exceedsSlots && receiverMismatch) {
            // Both issues: exceeds slots AND receiver doesn't have getTech
            mismatchReason = `sender has ${index + 1}/${sendTechAssigned} send tech, receiver has no getTech slots`;
          } else if (exceedsSlots) {
            // Only exceeds slots - receiver has getTech but sender sent too many
            mismatchReason = `sender has ${index + 1}/${sendTechAssigned} send tech`;
          } else if (receiverMismatch) {
            // Receiver doesn't have getTech slots - show what they have instead
            const receiverSlotParts: string[] = [];
            if (offer.receiverSendCash > 0) receiverSlotParts.push(`${offer.receiverSendCash}x sendCash`);
            if (offer.receiverSendTech > 0) receiverSlotParts.push(`${offer.receiverSendTech}x sendTech`);
            if (offer.receiverGetCash > 0) receiverSlotParts.push(`${offer.receiverGetCash}x getCash`);
            if (offer.receiverExternal > 0) receiverSlotParts.push(`${offer.receiverExternal}x external`);
            if (receiverSlotParts.length > 0) {
              mismatchReason = `receiver has no getTech slots (has ${receiverSlotParts.join(', ')})`;
            } else {
              mismatchReason = 'receiver has no getTech slots';
            }
          }
          
          return { ...offer, mismatchReason };
        })
        .filter((offer, index) => index >= sendTechAssigned || !offer.receiverHasMatchingSlot);
      if (sendTechMismatches.length > 0) {
        mismatchedOffers.allianceOffers.sendTech.push({
          nation: {
            id: nation.id,
            nationName: nation.nationName,
            rulerName: nation.rulerName,
            inWarMode: nation.inWarMode
          },
          offers: sendTechMismatches
        });
      }

      // Get Cash mismatches
      const getCashAssigned = Number(slots.getCash) || 0;
      const getCashOffers = getCashOffersByNation.get(nation.id) || [];
      // Flag offers that exceed configured slots OR where sender doesn't have matching send slots
      const getCashMismatches = getCashOffers
        .map((offer, index) => {
          const exceedsSlots = index >= getCashAssigned;
          const senderMismatch = !offer.senderHasMatchingSlot;
          
          let mismatchReason = '';
          if (exceedsSlots && senderMismatch) {
            // Both issues: exceeds slots AND sender doesn't have sendCash
            mismatchReason = `receiver has ${index + 1}/${getCashAssigned} get cash, sender has no sendCash slots`;
          } else if (exceedsSlots) {
            // Only exceeds slots - sender has sendCash but receiver received too many
            mismatchReason = `receiver has ${index + 1}/${getCashAssigned} get cash`;
          } else if (senderMismatch) {
            // Sender doesn't have sendCash slots - show what they have instead
            const senderSlotParts: string[] = [];
            if (offer.senderSendTech > 0) senderSlotParts.push(`${offer.senderSendTech}x sendTech`);
            if (offer.senderGetCash > 0) senderSlotParts.push(`${offer.senderGetCash}x getCash`);
            if (offer.senderGetTech > 0) senderSlotParts.push(`${offer.senderGetTech}x getTech`);
            if (offer.senderExternal > 0) senderSlotParts.push(`${offer.senderExternal}x external`);
            if (senderSlotParts.length > 0) {
              mismatchReason = `sender has no sendCash slots (has ${senderSlotParts.join(', ')})`;
            } else {
              mismatchReason = 'sender has no sendCash slots';
            }
          }
          
          return { ...offer, mismatchReason };
        })
        .filter((offer, index) => index >= getCashAssigned || !offer.senderHasMatchingSlot);
      if (getCashMismatches.length > 0) {
        mismatchedOffers.allianceOffers.getCash.push({
          nation: {
            id: nation.id,
            nationName: nation.nationName,
            rulerName: nation.rulerName,
            inWarMode: nation.inWarMode
          },
          offers: getCashMismatches
        });
      }

      // Get Tech mismatches
      const getTechAssigned = Number(slots.getTech) || 0;
      const getTechOffers = getTechOffersByNation.get(nation.id) || [];
      // Flag offers that exceed configured slots OR where sender doesn't have matching send slots
      const getTechMismatches = getTechOffers
        .map((offer, index) => {
          const exceedsSlots = index >= getTechAssigned;
          const senderMismatch = !offer.senderHasMatchingSlot;
          
          let mismatchReason = '';
          if (exceedsSlots && senderMismatch) {
            // Both issues: exceeds slots AND sender doesn't have sendTech
            mismatchReason = `receiver has ${index + 1}/${getTechAssigned} get tech, sender has no sendTech slots`;
          } else if (exceedsSlots) {
            // Only exceeds slots - sender has sendTech but receiver received too many
            mismatchReason = `receiver has ${index + 1}/${getTechAssigned} get tech`;
          } else if (senderMismatch) {
            // Sender doesn't have sendTech slots - show what they have instead
            const senderSlotParts: string[] = [];
            if (offer.senderSendCash > 0) senderSlotParts.push(`${offer.senderSendCash}x sendCash`);
            if (offer.senderGetCash > 0) senderSlotParts.push(`${offer.senderGetCash}x getCash`);
            if (offer.senderGetTech > 0) senderSlotParts.push(`${offer.senderGetTech}x getTech`);
            if (offer.senderExternal > 0) senderSlotParts.push(`${offer.senderExternal}x external`);
            if (senderSlotParts.length > 0) {
              mismatchReason = `sender has no sendTech slots (has ${senderSlotParts.join(', ')})`;
            } else {
              mismatchReason = 'sender has no sendTech slots';
            }
          }
          
          return { ...offer, mismatchReason };
        })
        .filter((offer, index) => index >= getTechAssigned || !offer.senderHasMatchingSlot);
      if (getTechMismatches.length > 0) {
        mismatchedOffers.allianceOffers.getTech.push({
          nation: {
            id: nation.id,
            nationName: nation.nationName,
            rulerName: nation.rulerName,
            inWarMode: nation.inWarMode
          },
          offers: getTechMismatches
        });
      }

      // External mismatches: nations with external slots configured but internal offers that exceed tracked slots
      const externalAssigned = Number(slots.external) || 0;
      const internalOffers = internalOffersByNation.get(nation.id) || [];
      // Calculate total tracked slots (excluding external)
      const totalTrackedSlots = (Number(slots.sendCash) || 0) + (Number(slots.sendTech) || 0) + 
                                (Number(slots.getCash) || 0) + (Number(slots.getTech) || 0);
      // Only flag if external slots are configured AND internal offers exceed tracked slots
      if (externalAssigned > 0 && internalOffers.length > totalTrackedSlots) {
        // Only show the offers that exceed the tracked slots
        const excessOffers = internalOffers.slice(totalTrackedSlots);
        mismatchedOffers.externalMismatches.push({
          nation: {
            id: nation.id,
            nationName: nation.nationName,
            rulerName: nation.rulerName,
            inWarMode: nation.inWarMode
          },
          offers: excessOffers
        });
      }
    });

    // Calculate unfilled/used aid slots by comparing assignment slots vs existing aid slots
    // Use the existing maps that track internal offers and external offers separately
    const unfilledSlots = {
      sendCash: [] as Array<{ nation: any; assigned: number; used: number; unfilled: number }>,
      sendTech: [] as Array<{ nation: any; assigned: number; used: number; unfilled: number }>,
      getCash: [] as Array<{ nation: any; assigned: number; used: number; unfilled: number }>,
      getTech: [] as Array<{ nation: any; assigned: number; used: number; unfilled: number }>,
      external: [] as Array<{ nation: any; assigned: number; used: number; unfilled: number }>
    };

    // Also get actual aid slots to compare against assignment slots
    const nationAidSlots = await getAidSlotsForAlliance(allianceId, nations, aidOffers);
    
    // Create a map of nation ID to aid slots for quick lookup
    const aidSlotsByNation = new Map<number, typeof nationAidSlots[0]>();
    nationAidSlots.forEach(nationAidSlots => {
      aidSlotsByNation.set(nationAidSlots.nation.id, nationAidSlots);
    });

    // Process each alliance nation
    allianceNationsOnly.forEach(nation => {
      const slots = nation.slots || {};
      
      // Get used slots from existing maps (for internal tracked offers)
      const sendCashUsed = outgoingCashExisting.get(nation.id) || 0;
      const sendTechUsed = outgoingTechExisting.get(nation.id) || 0;
      const getCashUsed = incomingCashExisting.get(nation.id) || 0;
      const getTechUsed = incomingTechExisting.get(nation.id) || 0;
      const externalUsed = externalOffersUsed.get(nation.id) || 0;
      
      // Also count from actual aid slots (to capture all offers, including those that might not be in the maps)
      const nationAidSlotsData = aidSlotsByNation.get(nation.id);
      let actualUsedSlots = {
        sendCash: 0,
        sendTech: 0,
        getCash: 0,
        getTech: 0,
        external: 0
      };

      if (nationAidSlotsData) {
        nationAidSlotsData.aidSlots.forEach(slot => {
          if (slot.aidOffer && !this.isOfferExpired(slot.aidOffer)) {
            const isCash = slot.aidOffer.money > 0 && slot.aidOffer.technology === 0;
            const isTech = slot.aidOffer.technology > 0;
            
            // Check if this is an internal alliance offer or external
            const isInternal = slot.aidOffer.declaringAllianceId === allianceId && 
                              slot.aidOffer.receivingAllianceId === allianceId;
            
            if (slot.isOutgoing) {
              // Outgoing aid
              if (isCash) {
                actualUsedSlots.sendCash++;
              } else if (isTech) {
                actualUsedSlots.sendTech++;
              }
            } else {
              // Incoming aid
              if (isCash) {
                actualUsedSlots.getCash++;
              } else if (isTech) {
                actualUsedSlots.getTech++;
              }
            }
            
            // Check for external offers (offers where sender or receiver is in different alliance)
            if (!isInternal) {
              actualUsedSlots.external++;
            }
          }
        });
      }

      // Use the maximum of the two counts to ensure we capture all used slots
      const finalUsedSlots = {
        sendCash: Math.max(sendCashUsed, actualUsedSlots.sendCash),
        sendTech: Math.max(sendTechUsed, actualUsedSlots.sendTech),
        getCash: Math.max(getCashUsed, actualUsedSlots.getCash),
        getTech: Math.max(getTechUsed, actualUsedSlots.getTech),
        external: Math.max(externalUsed, actualUsedSlots.external)
      };

      // Calculate assigned and unfilled slots for each type
      // Only include nations that are below their assigned usage (used < assigned)
      const sendCashAssigned = Number(slots.sendCash) || 0;
      const sendCashUnfilled = Math.max(0, sendCashAssigned - finalUsedSlots.sendCash);
      if (sendCashAssigned > 0 && finalUsedSlots.sendCash < sendCashAssigned) {
        unfilledSlots.sendCash.push({
          nation: {
            id: nation.id,
            nationName: nation.nationName,
            rulerName: nation.rulerName,
            inWarMode: nation.inWarMode
          },
          assigned: sendCashAssigned,
          used: finalUsedSlots.sendCash,
          unfilled: sendCashUnfilled
        });
      }

      const sendTechAssigned = Number(slots.sendTech) || 0;
      const sendTechUnfilled = Math.max(0, sendTechAssigned - finalUsedSlots.sendTech);
      if (sendTechAssigned > 0 && finalUsedSlots.sendTech < sendTechAssigned) {
        unfilledSlots.sendTech.push({
          nation: {
            id: nation.id,
            nationName: nation.nationName,
            rulerName: nation.rulerName,
            inWarMode: nation.inWarMode
          },
          assigned: sendTechAssigned,
          used: finalUsedSlots.sendTech,
          unfilled: sendTechUnfilled
        });
      }

      const getCashAssigned = Number(slots.getCash) || 0;
      const getCashUnfilled = Math.max(0, getCashAssigned - finalUsedSlots.getCash);
      if (getCashAssigned > 0 && finalUsedSlots.getCash < getCashAssigned) {
        unfilledSlots.getCash.push({
          nation: {
            id: nation.id,
            nationName: nation.nationName,
            rulerName: nation.rulerName,
            inWarMode: nation.inWarMode
          },
          assigned: getCashAssigned,
          used: finalUsedSlots.getCash,
          unfilled: getCashUnfilled
        });
      }

      const getTechAssigned = Number(slots.getTech) || 0;
      const getTechUnfilled = Math.max(0, getTechAssigned - finalUsedSlots.getTech);
      if (getTechAssigned > 0 && finalUsedSlots.getTech < getTechAssigned) {
        unfilledSlots.getTech.push({
          nation: {
            id: nation.id,
            nationName: nation.nationName,
            rulerName: nation.rulerName,
            inWarMode: nation.inWarMode
          },
          assigned: getTechAssigned,
          used: finalUsedSlots.getTech,
          unfilled: getTechUnfilled
        });
      }

      const externalAssigned = Number(slots.external) || 0;
      const externalUnfilled = Math.max(0, externalAssigned - finalUsedSlots.external);
      if (externalAssigned > 0 && finalUsedSlots.external < externalAssigned) {
        unfilledSlots.external.push({
          nation: {
            id: nation.id,
            nationName: nation.nationName,
            rulerName: nation.rulerName,
            inWarMode: nation.inWarMode
          },
          assigned: externalAssigned,
          used: finalUsedSlots.external,
          unfilled: externalUnfilled
        });
      }
    });

    return {
      recommendations: finalRecommendations,
      slotCounts,
      availableSlots,
      mismatchedOffers,
      unfilledSlots
    };
  }

  /**
   * Get categorized nations with slots for a specific alliance
   */
  static async getCategorizedNations(allianceId: number) {
    const { nations, useJsonData } = await AllianceService.getAllianceData(allianceId);
    
    if (nations.length === 0) {
      return [];
    }

    // If using JSON data, nations already have slots assigned
    // If using raw data, need to categorize them
    const categorizedNations: CategorizedNation[] = useJsonData ? (nations as CategorizedNation[]) : await categorizeNations(nations);
    
    // Don't filter out peace mode nations - let the UI show them with indicators
    return categorizedNations.map(nation => ({
      id: nation.id,
      rulerName: nation.rulerName,
      nationName: nation.nationName,
      technology: nation.technology,
      infrastructure: nation.infrastructure,
      inWarMode: nation.inWarMode,
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
      !this.isOfferExpired(offer) &&
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
