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
import { readFileSync } from 'fs';
import { join } from 'path';

export class AidService {
  /**
   * Load cross-alliance aid coordination configuration
   */
  private static loadCrossAllianceConfig(): Record<string, string> {
    // Skip file operations in serverless environments like Vercel
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      console.log('Skipping cross-alliance config load in serverless environment');
      return {};
    }

    try {
      const configPath = join(process.cwd(), 'src', 'config', 'crossAllianceAid.json');
      const configData = readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configData);
      return config.cross_alliance_aid_coordination || {};
    } catch (error) {
      console.warn('Could not load cross-alliance aid config:', error);
      return {};
    }
  }

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
  static async getAidRecommendations(allianceId: number, crossAllianceEnabled: boolean = true) {
    const { nations, aidOffers, useJsonData } = await AllianceService.getAllianceDataWithJsonPriority(allianceId);
    
    if (nations.length === 0) {
      return {
        recommendations: [],
        slotCounts: null
      };
    }

    // If using JSON data, nations already have slots assigned
    // If using raw data, need to categorize them
    let categorizedNations = useJsonData ? nations : categorizeNations(nations);
    
    // Load cross-alliance configuration only if enabled
    let crossAllianceConfig: Record<string, string> = {};
    let receivingAllianceId: string | undefined;
    
    if (crossAllianceEnabled) {
      crossAllianceConfig = this.loadCrossAllianceConfig();
      receivingAllianceId = crossAllianceConfig[allianceId.toString()];
      
      // If this alliance has a linked receiving alliance, include those nations
      if (receivingAllianceId) {
        try {
          const { nations: receivingNations, useJsonData: receivingUseJsonData } = 
            await AllianceService.getAllianceDataWithJsonPriority(parseInt(receivingAllianceId));
          
          if (receivingNations.length > 0) {
            const categorizedReceivingNations = receivingUseJsonData ? receivingNations : categorizeNations(receivingNations);
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

    // Create a set to track recommendation pairs to prevent duplicates within the same generation cycle
    const recommendationPairs = new Set();

    // Count active aid offers per nation (both incoming and outgoing)
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
    // Sort senders by send_priority (1 = highest priority)
    const sortedInternalCashSenders = activeInternalNationsThatShouldSendCash.sort((a, b) => a.slots.send_priority - b.slots.send_priority);
    // Sort recipients by receive_priority (1 = highest priority)
    const sortedInternalCashRecipients = internalNationsThatShouldGetCash.sort((a, b) => a.slots.receive_priority - b.slots.receive_priority);
    
    sortedInternalCashSenders.forEach(sender => {
      sortedInternalCashRecipients.forEach(recipient => {
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

    // Priority 2: Cross-alliance cash aid recommendations (only if internal slots are filled and cross-alliance is enabled)
    if (crossAllianceEnabled && crossAllianceNationsThatShouldGetCash.length > 0) {
      const sortedCrossAllianceCashRecipients = crossAllianceNationsThatShouldGetCash.sort((a, b) => a.slots.receive_priority - b.slots.receive_priority);
      
      sortedInternalCashSenders.forEach(sender => {
        // Only consider cross-alliance if sender still has capacity after internal recommendations
        const hasRemainingCapacity = hasOutgoingCashCapacity(sender.id, sender.slots);
        if (hasRemainingCapacity) {
          sortedCrossAllianceCashRecipients.forEach(recipient => {
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

    // Priority 3: Internal tech aid recommendations
    // Sort senders by send_priority (1 = highest priority)
    const sortedInternalTechSenders = activeInternalNationsThatShouldSendTechnology.sort((a, b) => a.slots.send_priority - b.slots.send_priority);
    // Sort recipients by receive_priority (1 = highest priority)
    const sortedInternalTechRecipients = internalNationsThatShouldGetTechnology.sort((a, b) => a.slots.receive_priority - b.slots.receive_priority);
    
    sortedInternalTechSenders.forEach(sender => {
      sortedInternalTechRecipients.forEach(recipient => {
        const pair = `${Math.min(sender.id, recipient.id)}-${Math.max(sender.id, recipient.id)}`;
        
        if (!existingPairs.has(pair) && !expiredPairs.has(pair) && !recommendationPairs.has(pair) && canRecommendTech(sender, recipient)) {
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
        }
      });
    });

    // Priority 4: Cross-alliance tech aid recommendations (only if internal slots are filled and cross-alliance is enabled)
    if (crossAllianceEnabled && crossAllianceNationsThatShouldGetTechnology.length > 0) {
      const sortedCrossAllianceTechRecipients = crossAllianceNationsThatShouldGetTechnology.sort((a, b) => a.slots.receive_priority - b.slots.receive_priority);
      
      sortedInternalTechSenders.forEach(sender => {
        // Only consider cross-alliance if sender still has capacity after internal recommendations
        const hasRemainingCapacity = hasOutgoingTechCapacity(sender.id, sender.slots);
        if (hasRemainingCapacity) {
          sortedCrossAllianceTechRecipients.forEach(recipient => {
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

    // Sort recommendations by priority
    recommendations.sort((a, b) => a.priority - b.priority);

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
      totalUnassigned: categorizedNations.reduce((sum, nation) => {
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

        // Track outgoing offers
        if (senderNation) {
          if (isCash) {
            if (!sendCashOffersByNation.has(offer.declaringId)) {
              sendCashOffersByNation.set(offer.declaringId, []);
            }
            sendCashOffersByNation.get(offer.declaringId)!.push({
              ...offer,
              direction: 'sent',
              type: 'cash'
            });
          }
          if (isTech) {
            if (!sendTechOffersByNation.has(offer.declaringId)) {
              sendTechOffersByNation.set(offer.declaringId, []);
            }
            sendTechOffersByNation.get(offer.declaringId)!.push({
              ...offer,
              direction: 'sent',
              type: 'tech'
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

        // Track incoming offers
        if (receiverNation) {
          if (isCash) {
            if (!getCashOffersByNation.has(offer.receivingId)) {
              getCashOffersByNation.set(offer.receivingId, []);
            }
            getCashOffersByNation.get(offer.receivingId)!.push({
              ...offer,
              direction: 'received',
              type: 'cash'
            });
          }
          if (isTech) {
            if (!getTechOffersByNation.has(offer.receivingId)) {
              getTechOffersByNation.set(offer.receivingId, []);
            }
            getTechOffersByNation.get(offer.receivingId)!.push({
              ...offer,
              direction: 'received',
              type: 'tech'
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
      // Send Cash mismatches
      const sendCashAssigned = nation.slots.sendCash || 0;
      const sendCashOffers = sendCashOffersByNation.get(nation.id) || [];
      if (sendCashOffers.length > sendCashAssigned) {
        const excessOffers = sendCashOffers.slice(sendCashAssigned);
        mismatchedOffers.allianceOffers.sendCash.push({
          nation: {
            id: nation.id,
            nationName: nation.nationName,
            rulerName: nation.rulerName,
            inWarMode: nation.inWarMode
          },
          offers: excessOffers
        });
      }

      // Send Tech mismatches
      const sendTechAssigned = nation.slots.sendTech || 0;
      const sendTechOffers = sendTechOffersByNation.get(nation.id) || [];
      if (sendTechOffers.length > sendTechAssigned) {
        const excessOffers = sendTechOffers.slice(sendTechAssigned);
        mismatchedOffers.allianceOffers.sendTech.push({
          nation: {
            id: nation.id,
            nationName: nation.nationName,
            rulerName: nation.rulerName,
            inWarMode: nation.inWarMode
          },
          offers: excessOffers
        });
      }

      // Get Cash mismatches
      const getCashAssigned = nation.slots.getCash || 0;
      const getCashOffers = getCashOffersByNation.get(nation.id) || [];
      if (getCashOffers.length > getCashAssigned) {
        const excessOffers = getCashOffers.slice(getCashAssigned);
        mismatchedOffers.allianceOffers.getCash.push({
          nation: {
            id: nation.id,
            nationName: nation.nationName,
            rulerName: nation.rulerName,
            inWarMode: nation.inWarMode
          },
          offers: excessOffers
        });
      }

      // Get Tech mismatches
      const getTechAssigned = nation.slots.getTech || 0;
      const getTechOffers = getTechOffersByNation.get(nation.id) || [];
      if (getTechOffers.length > getTechAssigned) {
        const excessOffers = getTechOffers.slice(getTechAssigned);
        mismatchedOffers.allianceOffers.getTech.push({
          nation: {
            id: nation.id,
            nationName: nation.nationName,
            rulerName: nation.rulerName,
            inWarMode: nation.inWarMode
          },
          offers: excessOffers
        });
      }

      // External mismatches: nations with external slots configured but internal offers that exceed tracked slots
      const externalAssigned = nation.slots.external || 0;
      const internalOffers = internalOffersByNation.get(nation.id) || [];
      // Calculate total tracked slots (excluding external)
      const totalTrackedSlots = (nation.slots.sendCash || 0) + (nation.slots.sendTech || 0) + 
                                (nation.slots.getCash || 0) + (nation.slots.getTech || 0);
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

    return {
      recommendations,
      slotCounts,
      availableSlots,
      mismatchedOffers
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
