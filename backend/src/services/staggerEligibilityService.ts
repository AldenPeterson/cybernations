import { Nation, War } from '../models/index.js';
import { isWarExpired } from '../utils/dateUtils.js';
import { warStatsCache, CacheKeys } from '../utils/warStatsCache.js';

export interface StaggerEligibilityData {
  defendingNation: {
    id: number;
    name: string;
    ruler: string;
    alliance: string;
    allianceId: number;
    strength: number;
    technology: string;
    activity: string;
    inWarMode: boolean;
    governmentType: string;
    openWarSlots: number;
    currentWars: number;
  };
  eligibleAttackers: {
    id: number;
    name: string;
    ruler: string;
    alliance: string;
    allianceId: number;
    strength: number;
    technology: string;
    nuclearWeapons: number;
    activity: string;
    inWarMode: boolean;
    governmentType: string;
    currentWars: number;
    strengthRatio: number;
    rank?: number;
  }[];
}

export class StaggerEligibilityService {
  /**
   * Calculate if a nation can sell down infrastructure and land to become eligible
   * This includes both NS range eligibility and rank range eligibility
   * Infrastructure is worth 3 NS per unit, land is worth 1.5 NS per unit
   * Stagger range is 75%-133% of defending nation's strength
   * Rank range is +/- 100 ranks
   */
  private static canSellDownToTarget(
    attacker: any, 
    defendingNation: any, 
    militaryNS: number,
    allNations?: any[]
  ): boolean {
    console.log(`canSellDownToTarget called: attacker ${attacker.name} (rank ${attacker.rank}, NS ${attacker.strength}), defender ${defendingNation.name} (rank ${defendingNation.rank}, NS ${defendingNation.strength}), militaryNS ${militaryNS}`);
    
    try {
      const attackerInfra = parseFloat((attacker.infrastructure || '0').replace(/,/g, '')) || 0;
      const attackerLand = parseFloat((attacker.land || '0').replace(/,/g, '')) || 0;
      const attackerCurrentNS = attacker.strength;
      const defendingNS = defendingNation.strength;
      
      // Calculate how much NS we can reduce by selling infrastructure and land
      const maxInfraReduction = attackerInfra * 3; // Each infrastructure unit = 3 NS
      const maxLandReduction = attackerLand * 1.5; // Each land unit = 1.5 NS
      const maxTotalReduction = maxInfraReduction + maxLandReduction;
      
      console.log(`Max reduction possible: infra ${maxInfraReduction}, land ${maxLandReduction}, total ${maxTotalReduction}`);
      
      // Calculate the stagger range (75%-133% of defending nation's strength)
      const minStaggerNS = defendingNS * 0.75;
      const maxStaggerNS = defendingNS * 1.33;
      
      // Calculate effective NS after reducing by militaryNS amount
      const effectiveNS = attackerCurrentNS - militaryNS;
      
      console.log(`NS analysis: current ${attackerCurrentNS}, effective ${effectiveNS}, stagger range ${minStaggerNS}-${maxStaggerNS}`);
      
      // Check 1: Can they get within NS range by selling down?
      let canGetWithinNSRange = false;
      
      if (effectiveNS >= minStaggerNS && effectiveNS <= maxStaggerNS) {
        // Already within NS range
        canGetWithinNSRange = true;
        console.log(`Already within NS range`);
      } else if (effectiveNS > maxStaggerNS) {
        // Too high, check if we can sell down enough
        const reductionNeeded = effectiveNS - maxStaggerNS;
        canGetWithinNSRange = reductionNeeded <= maxTotalReduction;
        console.log(`Too high NS, reduction needed: ${reductionNeeded}, can reduce: ${maxTotalReduction}, result: ${canGetWithinNSRange}`);
      } else {
        // Too low, can't sell down to get higher
        canGetWithinNSRange = false;
        console.log(`Too low NS, cannot sell down to get higher`);
      }
      
      // Check 2: Can they get within rank range by selling down?
      let canGetWithinRankRange = false;
      
      if (attacker.rank && defendingNation.rank && allNations) {
        const currentRankDifference = Math.abs(attacker.rank - defendingNation.rank);
        console.log(`Current rank difference: ${currentRankDifference}`);
        
        if (currentRankDifference > 100) {
          // Calculate NS after maximum possible sell-down
          const nsAfterSellDown = effectiveNS - maxTotalReduction;
          console.log(`NS after sell-down: ${nsAfterSellDown}`);
          
          // Find what rank this NS would correspond to in the current nation list
          const sortedNations = [...allNations].sort((a, b) => b.strength - a.strength);
          let estimatedRank = sortedNations.length; // Start with worst rank
          
          for (let i = 0; i < sortedNations.length; i++) {
            if (sortedNations[i].strength <= nsAfterSellDown) {
              estimatedRank = i + 1; // Rank is 1-based
              break;
            }
          }
          
          console.log(`Estimated rank after sell-down: ${estimatedRank}`);
          
          // Check if the estimated rank would be within +/- 100 of defending nation's rank
          const newRankDifference = Math.abs(estimatedRank - defendingNation.rank);
          console.log(`New rank difference: ${newRankDifference}`);
          
          canGetWithinRankRange = newRankDifference <= 100;
          console.log(`Can get within rank range: ${canGetWithinRankRange}`);
        } else {
          console.log(`Already within rank range`);
          canGetWithinRankRange = true;
        }
      }
      
      // Return true if they can get within either NS range OR rank range
      const result = canGetWithinNSRange || canGetWithinRankRange;
      console.log(`Final result: ${result} (NS: ${canGetWithinNSRange}, Rank: ${canGetWithinRankRange})`);
      
      return result;
      
    } catch (error) {
      console.error('Error in canSellDownToTarget:', error, { attacker, defendingNation, militaryNS });
      return false;
    }
  }

  /**
   * Get cached or query nations for an alliance
   */
  private static async getNationsForAlliance(
    allianceId: number,
    prisma: any
  ): Promise<any[]> {
    const cacheKey = CacheKeys.nations(allianceId);
    const cached = warStatsCache.get<any[]>(cacheKey);
    
    if (cached) {
      console.log(`[StaggerEligibility] Returning cached nations for alliance ${allianceId} (${cached.length} nations)`);
      return cached;
    }

    console.log(`[StaggerEligibility] Cache miss - querying database for nations in alliance ${allianceId}`);
    // Query from database
    const nationRecords = await prisma.nation.findMany({
      where: { 
        allianceId,
        isActive: true
      },
      include: { alliance: true }
    });

    // Map to expected format
    const nations = nationRecords.map((n: any) => ({
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
      rank: n.rank ?? undefined,
    }));

    console.log(`[StaggerEligibility] Queried ${nations.length} nations for alliance ${allianceId}, caching for 10 minutes`);
    // Cache for 10 minutes (nations change less frequently)
    warStatsCache.set(cacheKey, nations, 10 * 60 * 1000);
    
    return nations;
  }

  /**
   * Get cached or query wars for nations in an alliance
   */
  private static async getWarsForAlliance(
    allianceId: number,
    nationIds: number[],
    prisma: any
  ): Promise<any[]> {
    const cacheKey = CacheKeys.warsForAlliance(allianceId);
    const cached = warStatsCache.get<any[]>(cacheKey);
    
    if (cached) {
      console.log(`[StaggerEligibility] Returning cached wars for alliance ${allianceId} (${cached.length} wars)`);
      return cached;
    }

    console.log(`[StaggerEligibility] Cache miss - querying database for wars involving alliance ${allianceId}`);
    // Query all wars for nations in this alliance (regardless of opponent)
    const warRecords = await prisma.war.findMany({
      where: {
        OR: [
          { declaringNationId: { in: nationIds } },
          { receivingNationId: { in: nationIds } }
        ],
        isActive: true,
        status: {
          notIn: ['Ended', 'Peace']
        }
      },
      include: {
        declaringNation: { include: { alliance: true } },
        receivingNation: { include: { alliance: true } }
      }
    });

    // Filter out expired wars by date and map to expected format
    const activeWars = warRecords
      .filter((war: any) => {
        if (war.status.toLowerCase() === 'ended' || war.status.toLowerCase() === 'expired') {
          return false;
        }
        try {
          return !isWarExpired(war.endDate);
        } catch (error) {
          console.warn(`Failed to parse end date for war ${war.warId}: ${error}`);
          return false;
        }
      })
      .map((war: any) => ({
        warId: war.warId,
        declaringId: war.declaringNationId,
        receivingId: war.receivingNationId,
        status: war.status,
        endDate: war.endDate,
      }));

    console.log(`[StaggerEligibility] Queried ${activeWars.length} active wars for alliance ${allianceId}, caching for 5 minutes`);
    // Cache for 5 minutes (wars change more frequently)
    warStatsCache.set(cacheKey, activeWars, 5 * 60 * 1000);
    
    return activeWars;
  }

  /**
   * Get stagger eligibility data for attacking alliance vs defending alliance
   */
  static async getStaggerEligibility(
    attackingAllianceId: number, 
    defendingAllianceId: number,
    hideAnarchy: boolean = false,
    hidePeaceMode: boolean = false,
    hideNonPriority: boolean = false,
    includeFullTargets: boolean = false,
    sellDownEnabled: boolean = false,
    militaryNS: number = 0
  ): Promise<StaggerEligibilityData[]> {
    console.log(`StaggerEligibilityService called with hideAnarchy=${hideAnarchy}, hidePeaceMode=${hidePeaceMode}, hideNonPriority=${hideNonPriority}, includeFullTargets=${includeFullTargets}, sellDownEnabled=${sellDownEnabled}, militaryNS=${militaryNS}`);
    
    try {
      const { prisma } = await import('../utils/prisma.js');
      
      // Get nations from cache or database (cached per alliance)
      const [attackingAllianceNations, defendingAllianceNations] = await Promise.all([
        this.getNationsForAlliance(attackingAllianceId, prisma),
        this.getNationsForAlliance(defendingAllianceId, prisma)
      ]);
      
      console.log(`Found ${attackingAllianceNations.length} attacking nations and ${defendingAllianceNations.length} defending nations`);
      
      // Get all nation IDs from both alliances
      const allNationIds = [
        ...attackingAllianceNations.map(n => n.id),
        ...defendingAllianceNations.map(n => n.id)
      ];
      
      if (allNationIds.length === 0) {
        console.log('No nations found in either alliance');
        return [];
      }
      
      // Get wars from cache or database (cached per alliance)
      const [attackingWars, defendingWars] = await Promise.all([
        this.getWarsForAlliance(attackingAllianceId, attackingAllianceNations.map(n => n.id), prisma),
        this.getWarsForAlliance(defendingAllianceId, defendingAllianceNations.map(n => n.id), prisma)
      ]);
      
      // Merge and deduplicate wars (a war might appear in both if it's between these alliances)
      const allWarsMap = new Map<number, any>();
      [...attackingWars, ...defendingWars].forEach(war => {
        allWarsMap.set(war.warId, war);
      });
      const activeWars = Array.from(allWarsMap.values());
      
      console.log(`Found ${activeWars.length} active wars involving these alliances`);
    
      // Calculate war counts for each nation (only for nations in the two alliances)
      const nationWarCounts = new Map<number, { attacking: number; defending: number }>();
      
      // Initialize counts for all nations in both alliances
      [...attackingAllianceNations, ...defendingAllianceNations].forEach(nation => {
        nationWarCounts.set(nation.id, { attacking: 0, defending: 0 });
      });
      
      // Count wars for each nation
      activeWars.forEach(war => {
        const declaringCount = nationWarCounts.get(war.declaringId);
        if (declaringCount) {
          declaringCount.attacking++;
        }
        
        const receivingCount = nationWarCounts.get(war.receivingId);
        if (receivingCount) {
          receivingCount.defending++;
        }
      });
    
    // For each defending alliance nation, find eligible attackers
    const staggerData: StaggerEligibilityData[] = [];
    
    defendingAllianceNations.forEach(defendingNation => {
      // Calculate open war slots (assume max 3 defensive wars)
      const currentDefendingWars = nationWarCounts.get(defendingNation.id)?.defending || 0;
      const openWarSlots = Math.max(0, 3 - currentDefendingWars);
      
      // Skip if no open war slots (unless includeFullTargets is true)
      if (openWarSlots <= 0 && !includeFullTargets) return;
      
      // Find eligible attackers from attacking alliance
      const eligibleAttackers = attackingAllianceNations
        .map(attacker => {
          const currentAttackingWars = nationWarCounts.get(attacker.id)?.attacking || 0;
          // Use effective NS for strength ratio calculation when sell-down is enabled
          const effectiveStrength = sellDownEnabled && militaryNS > 0 ? attacker.strength - militaryNS : attacker.strength;
          const strengthRatio = effectiveStrength / defendingNation.strength;
          
          
          return {
            id: attacker.id,
            name: attacker.nationName,
            ruler: attacker.rulerName,
            alliance: attacker.alliance,
            allianceId: attacker.allianceId,
            strength: attacker.strength,
            technology: attacker.technology,
            nuclearWeapons: attacker.nuclearWeapons,
            activity: attacker.activity,
            inWarMode: attacker.inWarMode,
            governmentType: attacker.governmentType,
            currentWars: currentAttackingWars,
            strengthRatio,
            infrastructure: attacker.infrastructure,
            land: attacker.land,
            rank: attacker.rank
          };
        })
        .filter(attacker => {
          // Check 1: Are they within the NS range (75%-133%)?
          const strengthRatio = attacker.strengthRatio;
          const withinNSRange = strengthRatio >= 0.75 && strengthRatio <= 1.33;
          
          // Check 2: Are they within the rank range (+/- 100 ranks)?
          let withinRankRange = true;
          if (attacker.rank && defendingNation.rank) {
            const rankDifference = Math.abs(attacker.rank - defendingNation.rank);
            withinRankRange = rankDifference <= 100;
          }
          
          // Check 3: Can they sell down (if sell-down toggle is enabled)?
          let canSellDown = false;
          if (sellDownEnabled) {
            // Pass all nations from both alliances for rank calculation
            const allNations = [...attackingAllianceNations, ...defendingAllianceNations];
            canSellDown = this.canSellDownToTarget(attacker, defendingNation, militaryNS, allNations);
            console.log(`Sell-down result for ${attacker.name}: ${canSellDown}`);
          }
          
          // Include if ANY of the three criteria are met
          const isEligible = withinNSRange || withinRankRange || canSellDown;
          
          if (!isEligible) {
            return false;
          }
          
          // Apply additional filters
          if (hideAnarchy && attacker.governmentType.toLowerCase() === 'anarchy') {
            return false;
          }
          if (hidePeaceMode && !attacker.inWarMode) {
            return false;
          }
          return true;
        })
        .sort((a, b) => {
          // Sort by strength (highest first)
          return b.strength - a.strength;
        });
      
      // Check if defending nation is priority
      const isPriorityDefendingNation = () => {
        // Priority if in anarchy
        if (defendingNation.governmentType.toLowerCase() === 'anarchy') {
          return true;
        }
        
        // Priority if not staggered but has defending wars
        // "Not staggered" means they have open war slots (less than 3 defensive wars)
        if (openWarSlots > 0 && currentDefendingWars > 0) {
          return true;
        }
        
        return false;
      };

      // Apply non-priority filter if enabled
      if (hideNonPriority && !isPriorityDefendingNation()) {
        return;
      }

      // Only include if there are eligible attackers
      if (eligibleAttackers.length > 0) {
        staggerData.push({
          defendingNation: {
            id: defendingNation.id,
            name: defendingNation.nationName,
            ruler: defendingNation.rulerName,
            alliance: defendingNation.alliance,
            allianceId: defendingAllianceId,
            strength: defendingNation.strength,
            technology: defendingNation.technology,
            activity: defendingNation.activity,
            inWarMode: defendingNation.inWarMode,
            governmentType: defendingNation.governmentType,
            openWarSlots,
            currentWars: currentDefendingWars
          },
          eligibleAttackers
        });
      }
    });
    
      // Sort by defending nation strength (highest first)
      staggerData.sort((a, b) => b.defendingNation.strength - a.defendingNation.strength);
      
      console.log(`Returning ${staggerData.length} stagger data entries`);
      return staggerData;
    } catch (error) {
      console.error('Error in StaggerEligibilityService:', error);
      throw error;
    }
  }
}
