import { prisma } from '../utils/prisma.js';
import { warStatsCache } from '../utils/warStatsCache.js';

export interface CasualtyStat {
  rank: number;
  nation_id: number;
  nation_name: string;
  ruler_name: string;
  alliance_id: number;
  alliance_name: string;
  attacking_casualties: number;
  defensive_casualties: number;
  total_casualties: number;
}

export interface AllianceCasualtyStat {
  rank: number;
  alliance_id: number;
  alliance_name: string;
  total_attacking_casualties: number;
  total_defensive_casualties: number;
  total_casualties: number;
  total_members: number;
  average_casualties_per_member: number;
}

const CASUALTIES_CACHE_KEY = 'casualties_stats';
const ALLIANCE_CASUALTIES_CACHE_KEY = 'alliance_casualties_stats';
const CASUALTIES_CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes

/**
 * Invalidate the casualties cache
 */
export function invalidateCasualtiesCache(): void {
  warStatsCache.invalidate(CASUALTIES_CACHE_KEY);
  warStatsCache.invalidate(ALLIANCE_CASUALTIES_CACHE_KEY);
}

/**
 * Get top nations by total casualties (offensive + defensive combined)
 * Returns top 100 nations sorted by total casualties descending
 * Results are cached for 60 minutes
 */
export async function getCasualtiesStats(): Promise<CasualtyStat[]> {
  // Check cache first
  const cached = warStatsCache.get<CasualtyStat[]>(CASUALTIES_CACHE_KEY);
  if (cached) {
    return cached;
  }

  const nations = await prisma.nation.findMany({
    where: {
      isActive: true,
      OR: [
        { attackingCasualties: { not: null } },
        { defensiveCasualties: { not: null } }
      ]
    },
    include: {
      alliance: true
    }
  });

  // Calculate total casualties and sort
  const stats: CasualtyStat[] = nations
    .map(nation => {
      const attacking = nation.attackingCasualties ?? 0;
      const defensive = nation.defensiveCasualties ?? 0;
      const total = attacking + defensive;

      return {
        rank: 0, // Will be assigned after sorting
        nation_id: nation.id,
        nation_name: nation.nationName,
        ruler_name: nation.rulerName,
        alliance_id: nation.allianceId,
        alliance_name: nation.alliance.name,
        attacking_casualties: attacking,
        defensive_casualties: defensive,
        total_casualties: total
      };
    })
    .filter(stat => stat.total_casualties > 0) // Only include nations with at least some casualties
    .sort((a, b) => b.total_casualties - a.total_casualties) // Sort by total casualties descending
    .slice(0, 100) // Top 100
    .map((stat, index) => ({
      ...stat,
      rank: index + 1 // Assign rank 1-100 based on total casualties (this rank persists regardless of frontend sorting)
    }));

  // Cache the results (60 minute TTL)
  warStatsCache.set(CASUALTIES_CACHE_KEY, stats, CASUALTIES_CACHE_TTL_MS);

  return stats;
}

/**
 * Get alliance-level casualties statistics
 * Aggregates all nations by alliance and calculates totals and averages
 * Results are cached for 60 minutes
 */
export async function getAllianceCasualtiesStats(): Promise<AllianceCasualtyStat[]> {
  // Check cache first
  const cached = warStatsCache.get<AllianceCasualtyStat[]>(ALLIANCE_CASUALTIES_CACHE_KEY);
  if (cached) {
    return cached;
  }

  // Fetch ALL active nations (not just those with casualties) to count all members
  const nations = await prisma.nation.findMany({
    where: {
      isActive: true
    },
    include: {
      alliance: true
    }
  });

  // Aggregate by alliance
  const allianceMap = new Map<number, {
    alliance_id: number;
    alliance_name: string;
    total_attacking_casualties: number;
    total_defensive_casualties: number;
    total_members: number;
  }>();

  nations.forEach(nation => {
    const allianceId = nation.allianceId;
    const allianceName = nation.alliance.name;

    if (!allianceMap.has(allianceId)) {
      allianceMap.set(allianceId, {
        alliance_id: allianceId,
        alliance_name: allianceName,
        total_attacking_casualties: 0,
        total_defensive_casualties: 0,
        total_members: 0,
      });
    }

    const alliance = allianceMap.get(allianceId)!;
    
    // Count all members
    alliance.total_members += 1;
    
    // Only add casualties from nations that have casualties
    const attacking = nation.attackingCasualties ?? 0;
    const defensive = nation.defensiveCasualties ?? 0;
    alliance.total_attacking_casualties += attacking;
    alliance.total_defensive_casualties += defensive;
  });

  // Convert to array and calculate totals and averages
  // Only include alliances that match the dropdown criteria (at least 10 active members)
  // This matches the filter used in AllianceController.getAlliances
  const stats: AllianceCasualtyStat[] = Array.from(allianceMap.values())
    .filter(alliance => alliance.total_members >= 10) // Only include alliances with at least 10 members (matching dropdown)
    .map(alliance => {
      const total_casualties = alliance.total_attacking_casualties + alliance.total_defensive_casualties;
      const average_casualties_per_member = alliance.total_members > 0
        ? total_casualties / alliance.total_members
        : 0;

      return {
        rank: 0, // Will be assigned after sorting
        alliance_id: alliance.alliance_id,
        alliance_name: alliance.alliance_name,
        total_attacking_casualties: alliance.total_attacking_casualties,
        total_defensive_casualties: alliance.total_defensive_casualties,
        total_casualties,
        total_members: alliance.total_members,
        average_casualties_per_member,
      };
    })
    .sort((a, b) => b.total_casualties - a.total_casualties) // Sort by total casualties descending
    .map((stat, index) => ({
      ...stat,
      rank: index + 1 // Assign rank based on total casualties (this rank persists regardless of frontend sorting)
    }));

  // Cache the results (60 minute TTL)
  warStatsCache.set(ALLIANCE_CASUALTIES_CACHE_KEY, stats, CASUALTIES_CACHE_TTL_MS);

  return stats;
}

