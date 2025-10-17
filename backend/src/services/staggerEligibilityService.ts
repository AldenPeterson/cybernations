import { 
  loadDataFromFilesWithUpdate
} from './dataProcessingService.js';
import { Nation, War } from '../models/index.js';

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
   * Calculate if a nation can sell down infrastructure and land to get within stagger range
   * Infrastructure is worth 3 NS per unit, land is worth 1.5 NS per unit
   * Stagger range is 75%-133% of defending nation's strength
   */
  private static canSellDownToTarget(
    attacker: any, 
    defendingNation: any, 
    militaryNS: number
  ): boolean {
    try {
      const attackerInfra = parseFloat((attacker.infrastructure || '0').replace(/,/g, '')) || 0;
      const attackerLand = parseFloat((attacker.land || '0').replace(/,/g, '')) || 0;
      const attackerCurrentNS = attacker.strength;
      const defendingNS = defendingNation.strength;
      
      // Calculate how much NS we can reduce by selling infrastructure and land
      const maxInfraReduction = attackerInfra * 3; // Each infrastructure unit = 3 NS
      const maxLandReduction = attackerLand * 1.5; // Each land unit = 1.5 NS
      const maxTotalReduction = maxInfraReduction + maxLandReduction;
      
      // Calculate the stagger range (75%-133% of defending nation's strength)
      const minStaggerNS = defendingNS * 0.75;
      const maxStaggerNS = defendingNS * 1.33;
      
      if (attackerCurrentNS > 120000) {
        console.log(`canSellDownToTarget debug: attacker=${attackerCurrentNS} NS, defender=${defendingNS} NS, militaryNS=${militaryNS}, staggerRange=${minStaggerNS}-${maxStaggerNS}, maxReduction=${maxTotalReduction}`);
      }
      
      // Calculate effective NS after reducing by militaryNS amount
      const effectiveNS = attackerCurrentNS - militaryNS;
      
      // If militaryNS is 0, check if nation is already within range
      if (militaryNS === 0) {
        if (attackerCurrentNS > 120000) {
          console.log(`militaryNS=0 branch: attackerCurrentNS=${attackerCurrentNS}, minStaggerNS=${minStaggerNS}, maxStaggerNS=${maxStaggerNS}`);
        }
        
        // Check if current NS is within stagger range
        if (attackerCurrentNS >= minStaggerNS && attackerCurrentNS <= maxStaggerNS) {
          if (attackerCurrentNS > 120000) {
            console.log(`Attacker within range: returning true`);
          }
          return true;
        }
        
        // If current NS is too high, check if we can sell down enough infrastructure/land
        if (attackerCurrentNS > maxStaggerNS) {
          const reductionNeeded = attackerCurrentNS - maxStaggerNS;
          if (attackerCurrentNS > 120000) {
            console.log(`Attacker too high: reductionNeeded=${reductionNeeded}, maxTotalReduction=${maxTotalReduction}, canReduce=${reductionNeeded <= maxTotalReduction}`);
          }
          return reductionNeeded <= maxTotalReduction;
        }
        
        // If current NS is too low, they can't sell down to get into range
        // (selling down would make them even lower)
        if (attackerCurrentNS > 120000) {
          console.log(`Attacker too low: returning false`);
        }
        return false;
      }
      
      // Handle case when militaryNS > 0 (military reduction applied)
      // Check if effective NS is within stagger range
      if (effectiveNS >= minStaggerNS && effectiveNS <= maxStaggerNS) {
        // Effective NS is within range, can sell down
        return true;
      }
      
      // If effective NS is still too high, check if we can sell down enough infrastructure/land
      if (effectiveNS > maxStaggerNS) {
        // Calculate additional NS reduction needed beyond militaryNS
        const additionalReductionNeeded = effectiveNS - maxStaggerNS;
        
        // Check if we can reduce enough additional NS through infrastructure/land sales
        return additionalReductionNeeded <= maxTotalReduction;
      }
      
      // If effective NS is too low, they can't sell down to get into range
      // (selling down would make them even lower)
      if (effectiveNS < minStaggerNS) {
        return false;
      }
      
      return false;
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
    const activeWars = wars.filter(war => 
      war.status.toLowerCase() !== 'ended' &&
      war.status.toLowerCase() !== 'expired'
    );
    
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
          
          // Debug: Log high NS attackers being processed
          if (attacker.strength > 120000) {
            console.log(`Processing high NS attacker: ${attacker.name} (${attacker.strength} NS) vs defender ${defendingNation.nationName} (${defendingNation.strength} NS)`);
          }
          
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
          // Debug: Count high NS attackers at each filter step
          const isHighNS = attacker.strength > 120000;
          if (isHighNS) {
            console.log(`Checking eligibility for: ${attacker.name} (${attacker.strength} NS)`);
          }
          
          // Check 1: Are they within the NS range (75%-133%)?
          const strengthRatio = attacker.strengthRatio;
          const withinNSRange = strengthRatio >= 0.75 && strengthRatio <= 1.33;
          if (isHighNS) {
            console.log(`NS range check: strengthRatio=${strengthRatio}, withinNSRange=${withinNSRange}`);
          }
          
          // Check 2: Are they within the rank range (+/- 100 ranks)?
          let withinRankRange = true;
          if (attacker.rank && defendingNation.rank) {
            const rankDifference = Math.abs(attacker.rank - defendingNation.rank);
            withinRankRange = rankDifference <= 100;
            if (isHighNS) {
              console.log(`Rank range check: rankDifference=${rankDifference}, withinRankRange=${withinRankRange}`);
            }
          }
          
          // Check 3: Can they sell down (if sell-down toggle is enabled)?
          let canSellDown = false;
          if (sellDownEnabled) {
            canSellDown = this.canSellDownToTarget(attacker, defendingNation, militaryNS);
            if (isHighNS) {
              console.log(`Sell-down check: sellDownEnabled=${sellDownEnabled}, militaryNS=${militaryNS}, canSellDown=${canSellDown}`);
            }
          } else if (isHighNS) {
            console.log(`Sell-down check: sellDownEnabled=${sellDownEnabled}, skipping sell-down check`);
          }
          
          // Include if ANY of the three criteria are met
          const isEligible = withinNSRange || withinRankRange || canSellDown;
          if (isHighNS) {
            console.log(`Final eligibility: withinNSRange=${withinNSRange}, withinRankRange=${withinRankRange}, canSellDown=${canSellDown}, isEligible=${isEligible}`);
          }
          
          if (!isEligible) {
            if (isHighNS) {
              console.log(`Filtered out: ${attacker.name} - failed all criteria`);
            }
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
