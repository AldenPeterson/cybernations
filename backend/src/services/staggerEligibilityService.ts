import { 
  loadDataFromFilesWithUpdate
} from './dataProcessingService.js';
import { Nation, War } from '../models/index.js';
import { isWarExpired } from '../utils/dateUtils.js';

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
      const { nations, wars } = await loadDataFromFilesWithUpdate();
      console.log(`Loaded ${nations.length} nations and ${wars.length} wars`);
      
    
      // Get nations from both alliances
      const attackingAllianceNations = nations.filter(nation => nation.allianceId === attackingAllianceId);
      const defendingAllianceNations = nations.filter(nation => nation.allianceId === defendingAllianceId);
      console.log(`Found ${attackingAllianceNations.length} attacking nations and ${defendingAllianceNations.length} defending nations`);
    
    // Get active wars to calculate current war counts and open slots
    const activeWars = wars.filter(war => {
      // Filter by status first
      if (war.status.toLowerCase() === 'ended' || war.status.toLowerCase() === 'expired') {
        return false;
      }
      
      // Also filter by date - check if the war has expired based on its end date
      try {
        return !isWarExpired(war.endDate);
      } catch (error) {
        // If we can't parse the date, exclude the war to be safe
        console.warn(`Failed to parse end date for war ${war.warId}: ${error}`);
        return false;
      }
    });
    
    // Calculate war counts for each nation
    const nationWarCounts = new Map<number, { attacking: number; defending: number }>();
    
    nations.forEach(nation => {
      const attackingWars = activeWars.filter(war => war.declaringId === nation.id).length;
      const defendingWars = activeWars.filter(war => war.receivingId === nation.id).length;
      nationWarCounts.set(nation.id, { attacking: attackingWars, defending: defendingWars });
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
            canSellDown = this.canSellDownToTarget(attacker, defendingNation, militaryNS, nations);
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
