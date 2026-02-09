import { prisma } from '../utils/prisma.js';
import { Prisma } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { warStatsCache, CacheKeys } from '../utils/warStatsCache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Helper to read a SQL query file
 */
function readSqlFile(filename: string): string {
  const projectRoot = path.resolve(__dirname, '../../');
  const sqlPath = path.join(projectRoot, 'queries', filename);
  
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`SQL file not found at ${sqlPath}`);
  }
  
  const content = fs.readFileSync(sqlPath, 'utf-8');
  
  // Remove comment lines and empty lines
  const cleanedLines = content
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith('--');
    });
  
  return cleanedLines.join('\n').trim();
}

/**
 * Read optimized Query 2 (Overall Alliance Totals)
 */
function getWarStatisticsAllianceTotalsQuery(): string {
  // Try optimized version first, fall back to original
  try {
    return readSqlFile('war_statistics_query2_alliance_totals_optimized.sql');
  } catch {
    return readSqlFile('war_statistics_query2_alliance_totals.sql');
  }
}

/**
 * Read optimized Query 3 (Nation-Level Breakdown)
 */
function getWarStatisticsNationBreakdownQuery(): string {
  try {
    return readSqlFile('war_statistics_query3_nation_breakdown_optimized.sql');
  } catch {
    return readSqlFile('war_statistics_query3_nation_breakdown.sql');
  }
}

/**
 * Read optimized Query 4 (Individual War Records)
 */
function getWarStatisticsWarRecordsQuery(): string {
  try {
    return readSqlFile('war_statistics_query4_war_records_optimized.sql');
  } catch {
    return readSqlFile('war_statistics_query4_war_records.sql');
  }
}

export interface AllianceOpponentBreakdown {
  alliance_id: number;
  alliance_name: string;
  opponent_alliance_id: number | null;
  opponent_alliance_name: string | null;
  total_damage: number;
  nations_involved: number;
}

export interface AllianceTotal {
  alliance_id: number;
  alliance_name: string;
  total_damage_dealt: number;
  total_damage_received: number;
  net_damage: number;
  offensive_wars: number;
  defensive_wars: number;
}

export interface NationBreakdown {
  alliance_id: number;
  alliance_name: string;
  nation_id: number;
  nation_name: string;
  ruler_name: string;
  opponent_alliance_id: number | null;
  opponent_alliance_name: string | null;
  damage_dealt: number;
  damage_received: number;
  net_damage: number;
  offensive_wars: number;
  defensive_wars: number;
}

export interface WarRecord {
  war_id: number;
  nation_id: number;
  alliance_id: number;
  opponent_nation_id: number;
  opponent_alliance_id: number | null;
  nation_name: string;
  ruler_name: string;
  opponent_nation_name: string;
  opponent_ruler_name: string;
  alliance_name: string;
  opponent_alliance_name: string | null;
  war_type: 'offensive' | 'defensive';
  status: string;
  date: string;
  end_date: string;
  destruction: string | null;
  damage_dealt: number;
  damage_received: number;
  net_damage: number;
  attack_percent: number | null;
  defend_percent: number | null;
}

/**
 * Get overall alliance totals with optional filtering and caching
 */
export async function getWarStatisticsAllianceTotals(filter?: string): Promise<AllianceTotal[]> {
  // Check cache first
  const cacheKey = CacheKeys.allianceTotals(filter);
  const cached = warStatsCache.get<AllianceTotal[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const sqlQuery = getWarStatisticsAllianceTotalsQuery();
  const startTime = Date.now();
  
  try {
    const results = await prisma.$queryRawUnsafe<Array<{
      alliance_id: bigint | number | null;
      alliance_name: string | null;
      total_damage_dealt: bigint | number;
      total_damage_received: bigint | number;
      net_damage: bigint | number;
      offensive_wars: bigint | number;
      defensive_wars: bigint | number;
    }>>(sqlQuery);
  
    const queryTime = Date.now() - startTime;
    console.log(`[Query Performance] Alliance totals: ${queryTime}ms, ${results.length} rows`);
  
    // Convert BigInt values to numbers and handle nulls
    let mapped = results.map(row => ({
      alliance_id: Number(row.alliance_id || 0),
      alliance_name: row.alliance_name || 'Unknown',
      total_damage_dealt: Number(row.total_damage_dealt),
      total_damage_received: Number(row.total_damage_received),
      net_damage: Number(row.net_damage),
      offensive_wars: Number(row.offensive_wars),
      defensive_wars: Number(row.defensive_wars),
    }));

    // Apply filter if provided (server-side filtering)
    if (filter) {
      const filterLower = filter.toLowerCase();
      mapped = mapped.filter(row => 
        row.alliance_name.toLowerCase().includes(filterLower)
      );
    }

    // Cache the results (5 minute TTL)
    warStatsCache.set(cacheKey, mapped, 5 * 60 * 1000);

    return mapped;
  } catch (error: any) {
    console.error('SQL Query Error:', error);
    console.error('Error message:', error?.message);
    console.error('Error code:', error?.code);
    throw error;
  }
}

/**
 * Get nation-level breakdown with optional filtering and caching
 */
export async function getWarStatisticsNationBreakdown(filter?: string): Promise<NationBreakdown[]> {
  // Check cache first
  const cacheKey = CacheKeys.nationBreakdown(filter);
  const cached = warStatsCache.get<NationBreakdown[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const sqlQuery = getWarStatisticsNationBreakdownQuery();
  const startTime = Date.now();
  
  try {
    const results = await prisma.$queryRawUnsafe<Array<{
      alliance_id: bigint | number | null;
      alliance_name: string | null;
      nation_id: bigint | number | null;
      nation_name: string | null;
      ruler_name: string | null;
      opponent_alliance_id: bigint | number | null;
      opponent_alliance_name: string | null;
      damage_dealt: bigint | number;
      damage_received: bigint | number;
      net_damage: bigint | number;
      offensive_wars: bigint | number;
      defensive_wars: bigint | number;
    }>>(sqlQuery);
  
    const queryTime = Date.now() - startTime;
    console.log(`[Query Performance] Nation breakdown: ${queryTime}ms, ${results.length} rows`);
  
    // Convert BigInt values to numbers and handle nulls
    let mapped = results.map(row => ({
      alliance_id: Number(row.alliance_id || 0),
      alliance_name: row.alliance_name || 'Unknown',
      nation_id: Number(row.nation_id || 0),
      nation_name: row.nation_name || 'Unknown',
      ruler_name: row.ruler_name || 'Unknown',
      opponent_alliance_id: row.opponent_alliance_id ? Number(row.opponent_alliance_id) : null,
      opponent_alliance_name: row.opponent_alliance_name || null,
      damage_dealt: Number(row.damage_dealt),
      damage_received: Number(row.damage_received),
      net_damage: Number(row.net_damage),
      offensive_wars: Number(row.offensive_wars),
      defensive_wars: Number(row.defensive_wars),
    }));

    // Apply filter if provided
    if (filter) {
      const filterLower = filter.toLowerCase();
      mapped = mapped.filter(row => 
        row.alliance_name.toLowerCase().includes(filterLower) ||
        row.nation_name.toLowerCase().includes(filterLower) ||
        row.ruler_name.toLowerCase().includes(filterLower) ||
        (row.opponent_alliance_name && row.opponent_alliance_name.toLowerCase().includes(filterLower))
      );
    }

    // Cache the results
    warStatsCache.set(cacheKey, mapped, 5 * 60 * 1000);

    return mapped;
  } catch (error: any) {
    console.error('SQL Query Error:', error);
    console.error('Error message:', error?.message);
    throw error;
  }
}

/**
 * Get individual war records with optional filtering and caching
 */
export async function getWarStatisticsWarRecords(filter?: string): Promise<WarRecord[]> {
  // Check cache first
  const cacheKey = CacheKeys.warRecords(filter);
  const cached = warStatsCache.get<WarRecord[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const sqlQuery = getWarStatisticsWarRecordsQuery();
  const startTime = Date.now();
  
  try {
    const results = await prisma.$queryRawUnsafe<Array<{
      war_id: bigint | number;
      nation_id: bigint | number;
      alliance_id: bigint | number;
      opponent_nation_id: bigint | number;
      opponent_alliance_id: bigint | number | null;
      nation_name: string | null;
      ruler_name: string | null;
      opponent_nation_name: string | null;
      opponent_ruler_name: string | null;
      alliance_name: string | null;
      opponent_alliance_name: string | null;
      war_type: 'offensive' | 'defensive';
      status: string;
      date: string;
      end_date: string;
      destruction: string | null;
      damage_dealt: bigint | number;
      damage_received: bigint | number;
      attack_percent: bigint | number | null;
      defend_percent: bigint | number | null;
    }>>(sqlQuery);
  
    const queryTime = Date.now() - startTime;
    console.log(`[Query Performance] War records: ${queryTime}ms, ${results.length} rows`);
  
    // Convert BigInt values to numbers and handle nulls
    let mapped = results.map(row => ({
      war_id: Number(row.war_id),
      nation_id: Number(row.nation_id),
      alliance_id: Number(row.alliance_id),
      opponent_nation_id: Number(row.opponent_nation_id),
      opponent_alliance_id: row.opponent_alliance_id ? Number(row.opponent_alliance_id) : null,
      nation_name: row.nation_name || 'Unknown',
      ruler_name: row.ruler_name || 'Unknown',
      opponent_nation_name: row.opponent_nation_name || 'Unknown',
      opponent_ruler_name: row.opponent_ruler_name || 'Unknown',
      alliance_name: row.alliance_name || 'Unknown',
      opponent_alliance_name: row.opponent_alliance_name || null,
      war_type: row.war_type,
      status: row.status,
      date: row.date,
      end_date: row.end_date,
      destruction: row.destruction,
      damage_dealt: Number(row.damage_dealt),
      damage_received: Number(row.damage_received),
      net_damage: Number(row.damage_dealt) - Number(row.damage_received),
      attack_percent: row.attack_percent ? Number(row.attack_percent) : null,
      defend_percent: row.defend_percent ? Number(row.defend_percent) : null,
    }));

    // Apply filter if provided
    if (filter) {
      const filterLower = filter.toLowerCase();
      mapped = mapped.filter(row => 
        row.alliance_name.toLowerCase().includes(filterLower) ||
        row.nation_name.toLowerCase().includes(filterLower) ||
        row.ruler_name.toLowerCase().includes(filterLower) ||
        row.opponent_nation_name.toLowerCase().includes(filterLower) ||
        (row.opponent_alliance_name && row.opponent_alliance_name.toLowerCase().includes(filterLower))
      );
    }

    // Cache the results
    warStatsCache.set(cacheKey, mapped, 5 * 60 * 1000);

    return mapped;
  } catch (error: any) {
    console.error('SQL Query Error:', error);
    console.error('Error message:', error?.message);
    throw error;
  }
}

/**
 * Invalidate all war statistics caches
 * Call this when war data is updated
 */
export function invalidateWarStatsCache(): void {
  warStatsCache.invalidateAll();
}
