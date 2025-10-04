import { 
  loadDataFromFilesWithUpdate
} from './dataProcessingService.js';
import { AllianceService } from './allianceService.js';
import { War } from '../models/index.js';

export class DefendingWarsService {
  /**
   * Get wars organized by nation for a specific alliance
   */
  static async getNationWars(allianceId: number, includePeaceMode: boolean = false) {
    const { nations, wars } = await loadDataFromFilesWithUpdate();
    
    // Get alliance nations, optionally filtering out peace mode nations
    let allianceNations = nations.filter(nation => nation.allianceId === allianceId);
    
    if (!includePeaceMode) {
      allianceNations = allianceNations.filter(nation => nation.inWarMode);
    }
    
    // Filter active wars involving this alliance (exclude ended/expired wars)
    const activeWars = wars.filter(war => 
      (war.declaringAllianceId === allianceId || war.receivingAllianceId === allianceId) &&
      war.status.toLowerCase() !== 'ended' &&
      war.status.toLowerCase() !== 'expired'
    );

    // Organize wars by nation
    const nationWars = allianceNations.map(nation => {
      const attackingWars = activeWars
        .filter(war => war.declaringId === nation.id)
        .map(war => {
          const defendingNation = nations.find(n => n.id === war.receivingId);
          return {
            warId: war.warId,
            defendingNation: {
              id: war.receivingId,
              name: war.receivingNation,
              ruler: war.receivingRuler,
              alliance: war.receivingAlliance,
              allianceId: war.receivingAllianceId,
              strength: defendingNation?.strength || 0,
              activity: defendingNation?.activity || '',
              inWarMode: defendingNation?.inWarMode || false
            },
            attackingNation: {
              id: war.declaringId,
              name: war.declaringNation,
              ruler: war.declaringRuler,
              alliance: war.declaringAlliance,
              allianceId: war.declaringAllianceId,
              strength: nation.strength,
              activity: nation.activity,
              inWarMode: nation.inWarMode
            },
            status: war.status,
            date: war.date,
            endDate: war.endDate
          };
        });

      const defendingWars = activeWars
        .filter(war => war.receivingId === nation.id)
        .map(war => {
          const attackingNation = nations.find(n => n.id === war.declaringId);
          return {
            warId: war.warId,
            defendingNation: {
              id: war.receivingId,
              name: war.receivingNation,
              ruler: war.receivingRuler,
              alliance: war.receivingAlliance,
              allianceId: war.receivingAllianceId,
              strength: nation.strength,
              activity: nation.activity,
              inWarMode: nation.inWarMode
            },
            attackingNation: {
              id: war.declaringId,
              name: war.declaringNation,
              ruler: war.declaringRuler,
              alliance: war.declaringAlliance,
              allianceId: war.declaringAllianceId,
              strength: attackingNation?.strength || 0,
              activity: attackingNation?.activity || '',
              inWarMode: attackingNation?.inWarMode || false
            },
            status: war.status,
            date: war.date,
            endDate: war.endDate
          };
        });

      return {
        nation: {
          id: nation.id,
          name: nation.nationName,
          ruler: nation.rulerName,
          alliance: nation.alliance,
          allianceId: nation.allianceId,
          strength: nation.strength,
          activity: nation.activity,
          inWarMode: nation.inWarMode
        },
        attackingWars: attackingWars.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        defendingWars: defendingWars.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      };
    });

    // Sort nations by strength (highest first)
    nationWars.sort((a, b) => b.nation.strength - a.nation.strength);

    return nationWars;
  }

  /**
   * Get defending wars for a specific alliance (legacy method for backward compatibility)
   */
  static async getDefendingWars(allianceId: number) {
    const { nations, wars } = await loadDataFromFilesWithUpdate();
    
    // Filter wars where the alliance is defending (receiving attacks)
    const defendingWars = wars.filter(war => 
      war.receivingAllianceId === allianceId && 
      war.status.toLowerCase() !== 'ended' &&
      war.status.toLowerCase() !== 'expired'
    );

    // Add nation information to each war
    const warsWithNationInfo = defendingWars.map(war => {
      const defendingNation = nations.find(n => n.id === war.receivingId);
      const attackingNation = nations.find(n => n.id === war.declaringId);
      
      return {
        warId: war.warId,
        defendingNation: {
          id: war.receivingId,
          name: war.receivingNation,
          ruler: war.receivingRuler,
          alliance: war.receivingAlliance,
          allianceId: war.receivingAllianceId,
          strength: defendingNation?.strength || 0,
          activity: defendingNation?.activity || '',
          inWarMode: defendingNation?.inWarMode || false
        },
        attackingNation: {
          id: war.declaringId,
          name: war.declaringNation,
          ruler: war.declaringRuler,
          alliance: war.declaringAlliance,
          allianceId: war.declaringAllianceId,
          strength: attackingNation?.strength || 0,
          activity: attackingNation?.activity || '',
          inWarMode: attackingNation?.inWarMode || false
        },
        status: war.status,
        date: war.date,
        endDate: war.endDate
      };
    });

    // Sort by date (most recent first)
    warsWithNationInfo.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return warsWithNationInfo;
  }

  /**
   * Get defending wars statistics for an alliance
   */
  static async getDefendingWarsStats(allianceId: number) {
    const { nations, wars } = await loadDataFromFilesWithUpdate();
    
    // Get all wars involving this alliance (both attacking and defending)
    const allianceWars = wars.filter(war => 
      (war.declaringAllianceId === allianceId || war.receivingAllianceId === allianceId) &&
      war.status.toLowerCase() !== 'ended' &&
      war.status.toLowerCase() !== 'expired'
    );

    const defendingWars = allianceWars.filter(war => war.receivingAllianceId === allianceId);
    const attackingWars = allianceWars.filter(war => war.declaringAllianceId === allianceId);

    // Count wars by alliance
    const defendingByAlliance = new Map<number, { allianceName: string; count: number }>();
    const attackingByAlliance = new Map<number, { allianceName: string; count: number }>();

    defendingWars.forEach(war => {
      const allianceId = war.declaringAllianceId;
      const allianceName = war.declaringAlliance;
      const current = defendingByAlliance.get(allianceId) || { allianceName, count: 0 };
      defendingByAlliance.set(allianceId, { ...current, count: current.count + 1 });
    });

    attackingWars.forEach(war => {
      const allianceId = war.receivingAllianceId;
      const allianceName = war.receivingAlliance;
      const current = attackingByAlliance.get(allianceId) || { allianceName, count: 0 };
      attackingByAlliance.set(allianceId, { ...current, count: current.count + 1 });
    });

    return {
      totalDefendingWars: defendingWars.length,
      totalAttackingWars: attackingWars.length,
      totalActiveWars: allianceWars.length,
      defendingByAlliance: Array.from(defendingByAlliance.values()),
      attackingByAlliance: Array.from(attackingByAlliance.values())
    };
  }
}
