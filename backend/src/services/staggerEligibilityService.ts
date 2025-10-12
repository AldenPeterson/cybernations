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
  }[];
}

export class StaggerEligibilityService {
  /**
   * Get stagger eligibility data for attacking alliance vs defending alliance
   */
  static async getStaggerEligibility(
    attackingAllianceId: number, 
    defendingAllianceId: number,
    hideAnarchy: boolean = false,
    hidePeaceMode: boolean = false,
    hideNonPriority: boolean = false,
    includeFullTargets: boolean = false
  ): Promise<StaggerEligibilityData[]> {
    console.log(`StaggerEligibilityService called with hideAnarchy=${hideAnarchy}, hidePeaceMode=${hidePeaceMode}, hideNonPriority=${hideNonPriority}, includeFullTargets=${includeFullTargets}`);
    const { nations, wars } = await loadDataFromFilesWithUpdate();
    
    // Get nations from both alliances
    const attackingAllianceNations = nations.filter(nation => nation.allianceId === attackingAllianceId);
    const defendingAllianceNations = nations.filter(nation => nation.allianceId === defendingAllianceId);
    
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
          const strengthRatio = attacker.strength / defendingNation.strength;
          
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
            strengthRatio
          };
        })
        .filter(attacker => {
          // Only include eligible nations (strength within 75%-133% range)
          if (attacker.strengthRatio < 0.75 || attacker.strengthRatio > 1.33) {
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
    
    return staggerData;
  }
}
