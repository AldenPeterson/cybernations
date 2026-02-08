import { 
  loadDataFromFilesWithUpdate
} from './dataProcessingService.js';
import { AllianceService } from './allianceService.js';
import { War } from '../models/index.js';
import { calculateWarDateInfo, calculateStaggeredStatus, parseCentralTimeDate, formatCentralTimeDate, isWarExpired } from '../utils/dateUtils.js';
import { readNuclearHits } from './nuclearHitsService.js';
import { loadSpyglassData, getSpyglassDataForNation } from './spyglassService.js';

export class DefendingWarsService {
  /**
   * Get wars organized by nation for a specific alliance
   */
  static async getNationWars(allianceId: number, includePeaceMode: boolean = false, needsStagger: boolean = false) {
    const { prisma } = await import('../utils/prisma.js');
    
    // Query only nations in this alliance
    const allianceNationRecords = await prisma.nation.findMany({
      where: { 
        allianceId,
        isActive: true,
        ...(includePeaceMode ? {} : { inWarMode: true })
      },
      include: { alliance: true }
    });
    
    const allianceNations = allianceNationRecords.map((n: any) => ({
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
    
    const allianceNationIdList = allianceNations.map(n => n.id);
    
    if (allianceNationIdList.length === 0) {
      return [];
    }
    
    // Query only wars involving nations in this alliance
    const warRecords = await prisma.war.findMany({
      where: {
        OR: [
          { declaringNationId: { in: allianceNationIdList } },
          { receivingNationId: { in: allianceNationIdList } }
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
    
    // Filter out expired wars by date
    const activeWars = warRecords.filter((war: any) => {
      try {
        return !isWarExpired(war.endDate);
      } catch (error) {
        console.warn(`Failed to parse end date for war ${war.warId}: ${error}`);
        return false;
      }
    }).map((war: any) => ({
      warId: war.warId,
      declaringId: war.declaringNationId,
      declaringRuler: war.declaringNation.rulerName,
      declaringNation: war.declaringNation.nationName,
      declaringAlliance: war.declaringNation.alliance.name,
      declaringAllianceId: war.declaringNation.allianceId,
      receivingId: war.receivingNationId,
      receivingRuler: war.receivingNation.rulerName,
      receivingNation: war.receivingNation.nationName,
      receivingAlliance: war.receivingNation.alliance.name,
      receivingAllianceId: war.receivingNation.allianceId,
      status: war.status,
      date: war.date,
      endDate: war.endDate,
    }));
    
    // Get all nation IDs involved in wars (for looking up opposing nations)
    const allWarNationIds = new Set<number>();
    activeWars.forEach((war: any) => {
      allWarNationIds.add(war.declaringId);
      allWarNationIds.add(war.receivingId);
    });
    
    // Query opposing nations that aren't in the alliance
    const opposingNationRecords = await prisma.nation.findMany({
      where: {
        id: { in: Array.from(allWarNationIds) },
        allianceId: { not: allianceId },
        isActive: true
      },
      include: { alliance: true }
    });
    
    const opposingNations = opposingNationRecords.map((n: any) => ({
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
    
    // Create a combined nations map for lookups
    const nationsMap = new Map<number, any>();
    allianceNations.forEach(n => nationsMap.set(n.id, n));
    opposingNations.forEach(n => nationsMap.set(n.id, n));
    const nations = Array.from(nationsMap.values());
    const relevantWars = activeWars;

    // Load spyglass data
    const spyglassMap = loadSpyglassData();

    // Build latest nuked date map for defending nations from nuclear hits
    const nuclearStore = readNuclearHits();
    const latestNukedDateByNationId = new Map<number, string>(); // formatted date MM/DD/YYYY (Central)
    for (const record of Object.values(nuclearStore)) {
      // Only count successful nuclear hits
      if ((record.result || '').toLowerCase() !== 'direct hit') continue;
      const defendingId = parseInt(String(record.defendingNation).trim(), 10);
      if (!defendingId) continue;
      try {
        const sentDate = parseCentralTimeDate(record.sentAt);
        const formatted = formatCentralTimeDate(sentDate);
        const existing = latestNukedDateByNationId.get(defendingId);
        if (!existing) {
          latestNukedDateByNationId.set(defendingId, formatted);
        } else {
          // Keep the most recent by comparing actual times
          const existingMs = parseCentralTimeDate(existing + ' 00:00:00').getTime();
          const currentMs = sentDate.getTime();
          if (currentMs > existingMs) {
            latestNukedDateByNationId.set(defendingId, formatted);
          }
        }
      } catch {
        // ignore malformed dates
      }
    }
    
    const allianceNationIds = new Set(allianceNations.map(nation => nation.id));

    // Organize wars by nation
    const nationWars = allianceNations.map(nation => {
      const attackingWars = relevantWars
        .filter(war => war.declaringId === nation.id)
        .map(war => {
          const defendingNation = nations.find(n => n.id === war.receivingId);
          const spyglassData = defendingNation ? getSpyglassDataForNation(spyglassMap, defendingNation.rulerName, defendingNation.nationName) : undefined;
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
              technology: defendingNation?.technology || '0',
              activity: defendingNation?.activity || '',
              inWarMode: defendingNation?.inWarMode || false,
              nuclearWeapons: defendingNation?.nuclearWeapons || 0,
              governmentType: defendingNation?.governmentType || '',
              warchest: spyglassData?.warchest,
              spyglassLastUpdated: spyglassData?.daysOld
            },
            attackingNation: {
              id: war.declaringId,
              name: war.declaringNation,
              ruler: war.declaringRuler,
              alliance: war.declaringAlliance,
              allianceId: war.declaringAllianceId,
              strength: nation.strength,
              technology: nation.technology,
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
          const spyglassData = attackingNation ? getSpyglassDataForNation(spyglassMap, attackingNation.rulerName, attackingNation.nationName) : undefined;
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
              technology: nation.technology,
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
              technology: attackingNation?.technology || '0',
              activity: attackingNation?.activity || '',
              inWarMode: attackingNation?.inWarMode || false,
              nuclearWeapons: attackingNation?.nuclearWeapons || 0,
              governmentType: attackingNation?.governmentType || '',
              warchest: spyglassData?.warchest,
              spyglassLastUpdated: spyglassData?.daysOld
            },
            status: war.status,
            date: war.date,
            endDate: war.endDate,
            ...warDateInfo
          };
        });

      const sortedDefendingWars = defendingWars.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const staggeredStatus = calculateStaggeredStatus(sortedDefendingWars);

      // Get spyglass data for current nation
      const nationSpyglassData = getSpyglassDataForNation(spyglassMap, nation.rulerName, nation.nationName);

      return {
        nation: {
          id: nation.id,
          name: nation.nationName,
          ruler: nation.rulerName,
          alliance: nation.alliance,
          allianceId: nation.allianceId,
          strength: nation.strength,
          technology: nation.technology,
          activity: nation.activity,
          inWarMode: nation.inWarMode,
          nuclearWeapons: nation.nuclearWeapons,
          governmentType: nation.governmentType,
          lastNukedDate: latestNukedDateByNationId.get(nation.id),
          warchest: nationSpyglassData?.warchest,
          spyglassLastUpdated: nationSpyglassData?.daysOld
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
    const { prisma } = await import('../utils/prisma.js');
    
    // Query only nations in this alliance
    const allianceNationRecords = await prisma.nation.findMany({
      where: { allianceId, isActive: true },
      select: { id: true }
    });
    
    const allianceNationIds = allianceNationRecords.map(n => n.id);
    
    if (allianceNationIds.length === 0) {
      return [];
    }
    
    // Query only wars where alliance members are defending (receiving attacks)
    const warRecords = await prisma.war.findMany({
      where: {
        receivingNationId: { in: allianceNationIds },
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
    
    // Filter out expired wars by date
    const defendingWars = warRecords.filter((war: any) => {
      try {
        return !isWarExpired(war.endDate);
      } catch (error) {
        console.warn(`Failed to parse end date for war ${war.warId}: ${error}`);
        return false;
      }
    });

    // Add nation information to each war
    const warsWithNationInfo = defendingWars.map((war: any) => {
      const warDateInfo = calculateWarDateInfo(war.endDate);
      
      return {
        warId: war.warId,
        defendingNation: {
          id: war.receivingNationId,
          name: war.receivingNation.nationName,
          ruler: war.receivingNation.rulerName,
          alliance: war.receivingNation.alliance.name,
          allianceId: war.receivingNation.allianceId,
          strength: war.receivingNation.strength || 0,
          technology: war.receivingNation.technology || '0',
          activity: war.receivingNation.activity || '',
          inWarMode: war.receivingNation.inWarMode || false,
          nuclearWeapons: war.receivingNation.nuclearWeapons || 0,
          governmentType: war.receivingNation.governmentType || ''
        },
        attackingNation: {
          id: war.declaringNationId,
          name: war.declaringNation.nationName,
          ruler: war.declaringNation.rulerName,
          alliance: war.declaringNation.alliance.name,
          allianceId: war.declaringNation.allianceId,
          strength: war.declaringNation.strength || 0,
          technology: war.declaringNation.technology || '0',
          activity: war.declaringNation.activity || '',
          inWarMode: war.declaringNation.inWarMode || false,
          nuclearWeapons: war.declaringNation.nuclearWeapons || 0,
          governmentType: war.declaringNation.governmentType || ''
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
  static async getDefendingWarsStats(allianceId: number, includeExpired: boolean = false) {
    const { prisma } = await import('../utils/prisma.js');
    
    // Query only nations in this alliance
    const allianceNationRecords = await prisma.nation.findMany({
      where: { allianceId, isActive: true },
      select: { id: true }
    });
    
    const allianceNationIds = allianceNationRecords.map(n => n.id);
    
    if (allianceNationIds.length === 0) {
      return {
        totalDefendingWars: 0,
        totalAttackingWars: 0,
        totalActiveWars: 0,
        defendingByAlliance: [],
        attackingByAlliance: []
      };
    }
    
    // Query all wars involving alliance members
    const warRecords = await prisma.war.findMany({
      where: {
        OR: [
          { declaringNationId: { in: allianceNationIds } },
          { receivingNationId: { in: allianceNationIds } }
        ],
        isActive: true,
        ...(includeExpired ? {} : {
          status: {
            notIn: ['Ended', 'Peace']
          }
        })
      },
      include: {
        declaringNation: { include: { alliance: true } },
        receivingNation: { include: { alliance: true } }
      }
    });
    
    // Filter out expired wars by date if not including expired
    const allianceWars = includeExpired 
      ? warRecords 
      : warRecords.filter((war: any) => {
          try {
            return !isWarExpired(war.endDate);
          } catch (error) {
            console.warn(`Failed to parse end date for war ${war.warId}: ${error}`);
            return false;
          }
        });

    const defendingWars = allianceWars.filter((war: any) => allianceNationIds.includes(war.receivingNationId));
    const attackingWars = allianceWars.filter((war: any) => allianceNationIds.includes(war.declaringNationId));

    // Count wars by alliance - use current alliance data for nations
    const defendingByAlliance = new Map<number, { allianceId: number; allianceName: string; count: number }>();
    const attackingByAlliance = new Map<number, { allianceId: number; allianceName: string; count: number }>();

    defendingWars.forEach((war: any) => {
      // Get the current alliance of the attacking nation
      const attackingNation = war.declaringNation;
      if (attackingNation) {
        const attackingAllianceId = attackingNation.allianceId;
        const attackingAllianceName = attackingNation.alliance.name;
        const current = defendingByAlliance.get(attackingAllianceId) || { allianceId: attackingAllianceId, allianceName: attackingAllianceName, count: 0 };
        defendingByAlliance.set(attackingAllianceId, { allianceId: attackingAllianceId, allianceName: attackingAllianceName, count: current.count + 1 });
      }
    });

    attackingWars.forEach((war: any) => {
      // Get the current alliance of the defending nation
      const defendingNation = war.receivingNation;
      if (defendingNation) {
        const defendingAllianceId = defendingNation.allianceId;
        const defendingAllianceName = defendingNation.alliance.name;
        const current = attackingByAlliance.get(defendingAllianceId) || { allianceId: defendingAllianceId, allianceName: defendingAllianceName, count: 0 };
        attackingByAlliance.set(defendingAllianceId, { allianceId: defendingAllianceId, allianceName: defendingAllianceName, count: current.count + 1 });
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
