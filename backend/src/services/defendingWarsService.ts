import { 
  loadDataFromFilesWithUpdate
} from './dataProcessingService.js';
import { AllianceService } from './allianceService.js';
import { War } from '../models/index.js';
import { calculateWarDateInfo, calculateStaggeredStatus } from '../utils/dateUtils.js';

export class DefendingWarsService {
  /**
   * Get wars organized by nation for a specific alliance
   */
  static async getNationWars(allianceId: number, includePeaceMode: boolean = false, needsStagger: boolean = false) {
    const { nations, wars } = await loadDataFromFilesWithUpdate();
    
    // Get alliance nations, optionally filtering out peace mode nations
    let allianceNations = nations.filter(nation => nation.allianceId === allianceId);
    
    if (!includePeaceMode) {
      allianceNations = allianceNations.filter(nation => nation.inWarMode);
    }
    
    // Get all active wars (exclude ended/expired wars)
    const activeWars = wars.filter(war => 
      war.status.toLowerCase() !== 'ended' &&
      war.status.toLowerCase() !== 'expired'
    );
    
    // Find all wars involving current alliance members
    const allianceNationIds = new Set(allianceNations.map(nation => nation.id));
    const relevantWars = activeWars.filter(war => 
      allianceNationIds.has(war.declaringId) || allianceNationIds.has(war.receivingId)
    );

    // Organize wars by nation
    const nationWars = allianceNations.map(nation => {
      const attackingWars = relevantWars
        .filter(war => war.declaringId === nation.id)
        .map(war => {
          const defendingNation = nations.find(n => n.id === war.receivingId);
          const warDateInfo = calculateWarDateInfo(war.endDate);
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
              inWarMode: defendingNation?.inWarMode || false,
              nuclearWeapons: defendingNation?.nuclearWeapons || 0,
              governmentType: defendingNation?.governmentType || ''
            },
            attackingNation: {
              id: war.declaringId,
              name: war.declaringNation,
              ruler: war.declaringRuler,
              alliance: war.declaringAlliance,
              allianceId: war.declaringAllianceId,
              strength: nation.strength,
              activity: nation.activity,
              inWarMode: nation.inWarMode,
              nuclearWeapons: nation.nuclearWeapons,
              governmentType: nation.governmentType
            },
            status: war.status,
            date: war.date,
            endDate: war.endDate,
            ...warDateInfo
          };
        });

      const defendingWars = relevantWars
        .filter(war => war.receivingId === nation.id)
        .map(war => {
          const attackingNation = nations.find(n => n.id === war.declaringId);
          const warDateInfo = calculateWarDateInfo(war.endDate);
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
              inWarMode: nation.inWarMode,
              nuclearWeapons: nation.nuclearWeapons,
              governmentType: nation.governmentType
            },
            attackingNation: {
              id: war.declaringId,
              name: war.declaringNation,
              ruler: war.declaringRuler,
              alliance: war.declaringAlliance,
              allianceId: war.declaringAllianceId,
              strength: attackingNation?.strength || 0,
              activity: attackingNation?.activity || '',
              inWarMode: attackingNation?.inWarMode || false,
              nuclearWeapons: attackingNation?.nuclearWeapons || 0,
              governmentType: attackingNation?.governmentType || ''
            },
            status: war.status,
            date: war.date,
            endDate: war.endDate,
            ...warDateInfo
          };
        });

      const sortedDefendingWars = defendingWars.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const staggeredStatus = calculateStaggeredStatus(sortedDefendingWars);

      return {
        nation: {
          id: nation.id,
          name: nation.nationName,
          ruler: nation.rulerName,
          alliance: nation.alliance,
          allianceId: nation.allianceId,
          strength: nation.strength,
          activity: nation.activity,
          inWarMode: nation.inWarMode,
          nuclearWeapons: nation.nuclearWeapons,
          governmentType: nation.governmentType
        },
        attackingWars: attackingWars.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        defendingWars: sortedDefendingWars,
        staggeredStatus: staggeredStatus
      };
    });

    // Apply needsStagger filter if requested
    let filteredNationWars = nationWars;
    if (needsStagger) {
      filteredNationWars = nationWars.filter(nationWar => 
        nationWar.nation.inWarMode && nationWar.staggeredStatus.status !== 'staggered'
      );
    }


    // Sort nations by strength (highest first)
    filteredNationWars.sort((a, b) => b.nation.strength - a.nation.strength);

    return filteredNationWars;
  }

  /**
   * Get defending wars for a specific alliance (legacy method for backward compatibility)
   */
  static async getDefendingWars(allianceId: number) {
    const { nations, wars } = await loadDataFromFilesWithUpdate();
    
    // Get current alliance members
    const allianceNations = nations.filter(nation => nation.allianceId === allianceId);
    const allianceNationIds = new Set(allianceNations.map(nation => nation.id));
    
    // Filter wars where current alliance members are defending (receiving attacks)
    const defendingWars = wars.filter(war => 
      allianceNationIds.has(war.receivingId) && 
      war.status.toLowerCase() !== 'ended' &&
      war.status.toLowerCase() !== 'expired'
    );

    // Add nation information to each war
    const warsWithNationInfo = defendingWars.map(war => {
      const defendingNation = nations.find(n => n.id === war.receivingId);
      const attackingNation = nations.find(n => n.id === war.declaringId);
      const warDateInfo = calculateWarDateInfo(war.endDate);
      
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
          inWarMode: defendingNation?.inWarMode || false,
          nuclearWeapons: defendingNation?.nuclearWeapons || 0,
          governmentType: defendingNation?.governmentType || ''
        },
        attackingNation: {
          id: war.declaringId,
          name: war.declaringNation,
          ruler: war.declaringRuler,
          alliance: war.declaringAlliance,
          allianceId: war.declaringAllianceId,
          strength: attackingNation?.strength || 0,
          activity: attackingNation?.activity || '',
          inWarMode: attackingNation?.inWarMode || false,
          nuclearWeapons: attackingNation?.nuclearWeapons || 0,
          governmentType: attackingNation?.governmentType || ''
        },
        status: war.status,
        date: war.date,
        endDate: war.endDate,
        ...warDateInfo
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
    
    // Get current alliance members
    const allianceNations = nations.filter(nation => nation.allianceId === allianceId);
    const allianceNationIds = new Set(allianceNations.map(nation => nation.id));
    
    // Get all wars involving current alliance members (both attacking and defending)
    const allianceWars = wars.filter(war => 
      (allianceNationIds.has(war.declaringId) || allianceNationIds.has(war.receivingId)) &&
      war.status.toLowerCase() !== 'ended' &&
      war.status.toLowerCase() !== 'expired'
    );

    const defendingWars = allianceWars.filter(war => allianceNationIds.has(war.receivingId));
    const attackingWars = allianceWars.filter(war => allianceNationIds.has(war.declaringId));

    // Count wars by alliance - use current alliance data for nations
    const defendingByAlliance = new Map<number, { allianceName: string; count: number }>();
    const attackingByAlliance = new Map<number, { allianceName: string; count: number }>();

    defendingWars.forEach(war => {
      // Get the current alliance of the attacking nation
      const attackingNation = nations.find(n => n.id === war.declaringId);
      if (attackingNation) {
        const allianceId = attackingNation.allianceId;
        const allianceName = attackingNation.alliance;
        const current = defendingByAlliance.get(allianceId) || { allianceName, count: 0 };
        defendingByAlliance.set(allianceId, { ...current, count: current.count + 1 });
      }
    });

    attackingWars.forEach(war => {
      // Get the current alliance of the defending nation
      const defendingNation = nations.find(n => n.id === war.receivingId);
      if (defendingNation) {
        const allianceId = defendingNation.allianceId;
        const allianceName = defendingNation.alliance;
        const current = attackingByAlliance.get(allianceId) || { allianceName, count: 0 };
        attackingByAlliance.set(allianceId, { ...current, count: current.count + 1 });
      }
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
