import { prisma } from '../utils/prisma.js';
import { warStatsCache } from '../utils/warStatsCache.js';
import { STATS_EVENT_TYPE, STATS_EVENT_TYPES } from './eventService.js';

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
 * Get all alliance members' casualty statistics
 * Returns all active nations in the specified alliance, regardless of their global rank
 * Results are cached per alliance for 60 minutes
 */
export async function getAllianceMembersCasualtiesStats(allianceId: number): Promise<CasualtyStat[]> {
  const cacheKey = `alliance_${allianceId}_casualties_stats`;
  
  // Check cache first
  const cached = warStatsCache.get<CasualtyStat[]>(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch ALL active nations in this alliance (not just those with casualties)
  const nations = await prisma.nation.findMany({
    where: {
      isActive: true,
      allianceId: allianceId
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
    .sort((a, b) => b.total_casualties - a.total_casualties) // Sort by total casualties descending
    .map((stat, index) => ({
      ...stat,
      rank: index + 1 // Assign rank 1-N based on total casualties within the alliance
    }));

  // Cache the results (60 minute TTL)
  warStatsCache.set(cacheKey, stats, CASUALTIES_CACHE_TTL_MS);

  return stats;
}

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
 * Aggregates all nations by alliance and calculates totals and averages using database query
 * Results are cached for 60 minutes
 */
export async function getAllianceCasualtiesStats(): Promise<AllianceCasualtyStat[]> {
  // Check cache first
  const cached = warStatsCache.get<AllianceCasualtyStat[]>(ALLIANCE_CASUALTIES_CACHE_KEY);
  if (cached) {
    return cached;
  }

  // Use SQL aggregation query for better performance
  const sqlQuery = `
    SELECT 
      n.alliance_id,
      a.name AS alliance_name,
      COUNT(*) AS total_members,
      COALESCE(SUM(n.attacking_casualties), 0)::bigint AS total_attacking_casualties,
      COALESCE(SUM(n.defensive_casualties), 0)::bigint AS total_defensive_casualties,
      (COALESCE(SUM(n.attacking_casualties), 0) + COALESCE(SUM(n.defensive_casualties), 0))::bigint AS total_casualties
    FROM nations n
    INNER JOIN alliances a ON n.alliance_id = a.id
    WHERE n.is_active = true
    GROUP BY n.alliance_id, a.name
    HAVING COUNT(*) >= 10
    ORDER BY total_casualties DESC
  `;

  const startTime = Date.now();

  try {
    const results = await prisma.$queryRawUnsafe<Array<{
      alliance_id: bigint | number;
      alliance_name: string;
      total_members: bigint | number;
      total_attacking_casualties: bigint | number;
      total_defensive_casualties: bigint | number;
      total_casualties: bigint | number;
    }>>(sqlQuery);

    const queryTime = Date.now() - startTime;
    console.log(`[Query Performance] Alliance casualties stats: ${queryTime}ms, ${results.length} rows`);

    // Convert BigInt values to numbers and calculate averages
    const stats: AllianceCasualtyStat[] = results.map((row, index) => {
      const total_members = Number(row.total_members);
      const total_attacking_casualties = Number(row.total_attacking_casualties);
      const total_defensive_casualties = Number(row.total_defensive_casualties);
      const total_casualties = Number(row.total_casualties);
      const average_casualties_per_member = total_members > 0
        ? total_casualties / total_members
        : 0;

      return {
        rank: index + 1, // Rank based on total casualties (already sorted by SQL)
        alliance_id: Number(row.alliance_id),
        alliance_name: row.alliance_name,
        total_attacking_casualties,
        total_defensive_casualties,
        total_casualties,
        total_members,
        average_casualties_per_member,
      };
    });

    // Cache the results (60 minute TTL)
    warStatsCache.set(ALLIANCE_CASUALTIES_CACHE_KEY, stats, CASUALTIES_CACHE_TTL_MS);

    return stats;
  } catch (error: any) {
    console.error('SQL Query Error:', error);
    console.error('Error message:', error?.message);
    console.error('Error code:', error?.code);
    throw error;
  }
}

/**
 * Calculate current top 100 casualty rankings without using cache
 * This is used for comparison during import processing
 */
async function getCurrentCasualtiesStatsUncached(): Promise<CasualtyStat[]> {
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
      rank: index + 1 // Assign rank 1-100 based on total casualties
    }));

  return stats;
}

/**
 * Detect changes in top 100 casualty rankings and create events
 * Called after nation import to track ranking changes
 */
export async function detectCasualtyRankingChanges(): Promise<{
  entered: number;
  exited: number;
  changed: number;
}> {
  try {
    // Calculate current top 100 rankings (bypass cache)
    const currentStats = await getCurrentCasualtiesStatsUncached();
    const currentMap = new Map(currentStats.map(stat => [stat.nation_id, stat]));

    // Fetch most recent snapshot
    const mostRecentSnapshot = await prisma.casualtyRankingSnapshot.findFirst({
      orderBy: {
        snapshotDate: 'desc'
      },
      distinct: ['snapshotDate']
    });

    // If no previous snapshot exists, create one but don't generate events
    if (!mostRecentSnapshot) {
      const snapshotDate = new Date();
      // Create snapshot for current rankings
      await prisma.casualtyRankingSnapshot.createMany({
        data: currentStats.map(stat => ({
          snapshotDate,
          nationId: stat.nation_id,
          rank: stat.rank,
          totalCasualties: stat.total_casualties,
          attackingCasualties: stat.attacking_casualties,
          defensiveCasualties: stat.defensive_casualties,
        }))
      });
      console.log('[Casualty Rankings] Created initial snapshot (no previous snapshot to compare)');
      return { entered: 0, exited: 0, changed: 0 };
    }

    // Fetch all entries from the most recent snapshot
    const previousSnapshot = await prisma.casualtyRankingSnapshot.findMany({
      where: {
        snapshotDate: mostRecentSnapshot.snapshotDate
      },
      include: {
        nation: {
          include: {
            alliance: true
          }
        }
      }
    });

    type SnapshotWithNation = typeof previousSnapshot[0];

    const previousMap = new Map<number, SnapshotWithNation>(
      previousSnapshot.map((snap: SnapshotWithNation) => [snap.nationId, snap])
    );

    // Find changes
    const entered: CasualtyStat[] = [];
    const exited = previousSnapshot.filter((snap: SnapshotWithNation) => !currentMap.has(snap.nationId));
    const changed: Array<{ current: CasualtyStat; previous: SnapshotWithNation }> = [];

    // Check for new entries and rank changes
    for (const currentStat of currentStats) {
      const previous = previousMap.get(currentStat.nation_id);
      
      if (!previous) {
        // New entry
        entered.push(currentStat);
      } else if (previous.rank !== currentStat.rank) {
        // Rank changed
        changed.push({ current: currentStat, previous });
      }
    }

    // Create events for changes
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    let enteredCount = 0;
    let exitedCount = 0;
    let changedCount = 0;

    // Process entered events
    for (const stat of entered) {
      // Check for recent event to avoid spam
      const recentEvent = await prisma.event.findFirst({
        where: {
          type: STATS_EVENT_TYPE,
          eventType: STATS_EVENT_TYPES.CASUALTY_RANKING_ENTERED,
          nationId: stat.nation_id,
          createdAt: {
            gte: oneHourAgo
          }
        }
      });

      if (recentEvent) {
        continue; // Skip if recent event exists
      }

      const nation = await prisma.nation.findUnique({
        where: { id: stat.nation_id },
        include: { alliance: true }
      });

      if (nation) {
        await prisma.event.create({
          data: {
            type: STATS_EVENT_TYPE,
            eventType: STATS_EVENT_TYPES.CASUALTY_RANKING_ENTERED,
            nationId: stat.nation_id,
            allianceId: stat.alliance_id,
            description: `${nation.rulerName} (${nation.nationName}) from ${nation.alliance.name} entered top 100 casualty rankings at rank ${stat.rank} with ${stat.total_casualties.toLocaleString()} total casualties`,
            metadata: {
              rank: stat.rank,
              previousRank: null,
              totalCasualties: stat.total_casualties,
              attackingCasualties: stat.attacking_casualties,
              defensiveCasualties: stat.defensive_casualties,
              previousTotalCasualties: null,
              direction: null,
              rulerName: nation.rulerName,
              nationName: nation.nationName,
              allianceName: nation.alliance.name,
            }
          }
        });
        enteredCount++;
      }
    }

    // Process exited events
    for (const snap of exited) {
      // Check for recent event to avoid spam
      const recentEvent = await prisma.event.findFirst({
        where: {
          type: STATS_EVENT_TYPE,
          eventType: STATS_EVENT_TYPES.CASUALTY_RANKING_EXITED,
          nationId: snap.nationId,
          createdAt: {
            gte: oneHourAgo
          }
        }
      });

      if (recentEvent) {
        continue; // Skip if recent event exists
      }

      const nation = await prisma.nation.findUnique({
        where: { id: snap.nationId },
        include: { alliance: true }
      });

      if (nation) {
        await prisma.event.create({
          data: {
            type: STATS_EVENT_TYPE,
            eventType: STATS_EVENT_TYPES.CASUALTY_RANKING_EXITED,
            nationId: snap.nationId,
            allianceId: nation.allianceId,
            description: `${nation.rulerName} (${nation.nationName}) from ${nation.alliance.name} exited top 100 casualty rankings (was rank ${snap.rank} with ${snap.totalCasualties.toLocaleString()} total casualties)`,
            metadata: {
              rank: null,
              previousRank: snap.rank,
              totalCasualties: null,
              attackingCasualties: null,
              defensiveCasualties: null,
              previousTotalCasualties: snap.totalCasualties,
              direction: null,
              rulerName: nation.rulerName,
              nationName: nation.nationName,
              allianceName: nation.alliance.name,
            }
          }
        });
        exitedCount++;
      }
    }

    // Process rank changed events
    for (const { current, previous } of changed) {
      // Check for recent event to avoid spam
      const recentEvent = await prisma.event.findFirst({
        where: {
          type: STATS_EVENT_TYPE,
          eventType: STATS_EVENT_TYPES.CASUALTY_RANKING_CHANGED,
          nationId: current.nation_id,
          createdAt: {
            gte: oneHourAgo
          }
        }
      });

      if (recentEvent) {
        continue; // Skip if recent event exists
      }

      const nation = await prisma.nation.findUnique({
        where: { id: current.nation_id },
        include: { alliance: true }
      });

      if (nation) {
        const direction = current.rank < previous.rank ? 'up' : 'down';
        const rankDiff = Math.abs(current.rank - previous.rank);
        
        await prisma.event.create({
          data: {
            type: STATS_EVENT_TYPE,
            eventType: STATS_EVENT_TYPES.CASUALTY_RANKING_CHANGED,
            nationId: current.nation_id,
            allianceId: current.alliance_id,
            description: `${nation.rulerName} (${nation.nationName}) from ${nation.alliance.name} moved from rank ${previous.rank} to rank ${current.rank} in casualty rankings (${direction} ${rankDiff} position${rankDiff !== 1 ? 's' : ''})`,
            metadata: {
              rank: current.rank,
              previousRank: previous.rank,
              totalCasualties: current.total_casualties,
              attackingCasualties: current.attacking_casualties,
              defensiveCasualties: current.defensive_casualties,
              previousTotalCasualties: previous.totalCasualties,
              direction,
              rankDifference: rankDiff,
              rulerName: nation.rulerName,
              nationName: nation.nationName,
              allianceName: nation.alliance.name,
            }
          }
        });
        changedCount++;
      }
    }

    // Create new snapshot with current rankings
    const snapshotDate = new Date();
    await prisma.casualtyRankingSnapshot.createMany({
      data: currentStats.map(stat => ({
        snapshotDate,
        nationId: stat.nation_id,
        rank: stat.rank,
        totalCasualties: stat.total_casualties,
        attackingCasualties: stat.attacking_casualties,
        defensiveCasualties: stat.defensive_casualties,
      }))
    });

    console.log(`[Casualty Rankings] Detected changes: ${enteredCount} entered, ${exitedCount} exited, ${changedCount} changed`);

    return {
      entered: enteredCount,
      exited: exitedCount,
      changed: changedCount
    };
  } catch (error: any) {
    console.error('Error detecting casualty ranking changes:', error.message);
    // Don't throw - event creation failure shouldn't break the import
    return { entered: 0, exited: 0, changed: 0 };
  }
}

