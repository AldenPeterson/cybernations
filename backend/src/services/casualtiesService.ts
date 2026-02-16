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

const CASUALTIES_CACHE_KEY = 'casualties_stats';
const CASUALTIES_CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes

/**
 * Invalidate the casualties cache
 */
export function invalidateCasualtiesCache(): void {
  warStatsCache.invalidate(CASUALTIES_CACHE_KEY);
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

