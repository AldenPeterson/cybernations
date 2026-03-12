import { prisma } from '../utils/prisma.js';
import { warStatsCache } from '../utils/warStatsCache.js';

export interface TopStrengthNationStat {
  rank: number;
  nation_id: number;
  nation_name: string;
  ruler_name: string;
  alliance_id: number;
  alliance_name: string;
  strength: number;
}

export interface TopStrengthAllianceStat {
  rank: number;
  alliance_id: number;
  alliance_name: string;
  total_strength: number;
  average_strength: number;
  nation_count: number;
}

const TOP_STRENGTH_CACHE_KEY = 'top_strength_stats';
const TOP_STRENGTH_CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes

export interface TopStrengthResponseData {
  nations: TopStrengthNationStat[];
  alliances: TopStrengthAllianceStat[];
}

/**
 * Get top nations by nation strength and aggregate by alliance.
 * Returns top `limit` nations sorted by strength descending and alliance aggregates
 * computed over that same top cohort.
 */
export async function getTopStrengthStats(limit: number = 250): Promise<TopStrengthResponseData> {
  const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 1000) : 250;
  const cacheKey = `${TOP_STRENGTH_CACHE_KEY}_${normalizedLimit}`;

  const cached = warStatsCache.get<TopStrengthResponseData>(cacheKey);
  if (cached) {
    return cached;
  }

  const nations = await prisma.nation.findMany({
    where: {
      isActive: true,
      strength: {
        gt: 0,
      },
    },
    include: {
      alliance: true,
    },
    orderBy: {
      strength: 'desc',
    },
    take: normalizedLimit,
  });

  const nationStats: TopStrengthNationStat[] = nations.map((nation, index) => ({
    rank: index + 1,
    nation_id: nation.id,
    nation_name: nation.nationName,
    ruler_name: nation.rulerName,
    alliance_id: nation.allianceId,
    alliance_name: nation.alliance?.name ?? 'No Alliance',
    strength: nation.strength,
  }));

  const allianceMap = new Map<number, TopStrengthAllianceStat>();

  for (const stat of nationStats) {
    const existing = allianceMap.get(stat.alliance_id);
    if (existing) {
      const totalStrength = existing.total_strength + stat.strength;
      const nationCount = existing.nation_count + 1;
      allianceMap.set(stat.alliance_id, {
        ...existing,
        total_strength: totalStrength,
        average_strength: nationCount > 0 ? totalStrength / nationCount : 0,
        nation_count: nationCount,
      });
    } else {
      allianceMap.set(stat.alliance_id, {
        rank: 0, // assigned after sorting
        alliance_id: stat.alliance_id,
        alliance_name: stat.alliance_name,
        total_strength: stat.strength,
        average_strength: stat.strength,
        nation_count: 1,
      });
    }
  }

  const alliances: TopStrengthAllianceStat[] = Array.from(allianceMap.values())
    .sort((a, b) => b.total_strength - a.total_strength)
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }));

  const result: TopStrengthResponseData = {
    nations: nationStats,
    alliances,
  };

  warStatsCache.set(cacheKey, result, TOP_STRENGTH_CACHE_TTL_MS);

  return result;
}

