import { prisma } from '../utils/prisma.js';
import { Prisma } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get the path to the war statistics SQL query file
 */
function getWarStatisticsSqlPath(): string {
  // Get the project root directory (go up from src/services)
  const projectRoot = path.resolve(__dirname, '../../');
  const relativePath = path.join(projectRoot, 'war_statistics_query.sql');
  return relativePath;
}

/**
 * Read the SQL query from the war statistics query file
 * Returns Query 1 (Alliance Summary with Opponent Breakdown)
 */
function getWarStatisticsSqlQuery(): string {
  const sqlPath = getWarStatisticsSqlPath();
  
  try {
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`SQL script file not found at ${sqlPath}`);
    }
    
    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
    
    // Extract Query 1 section (between "-- QUERY 1:" and "-- QUERY 2:")
    const query1Match = sqlContent.match(/-- QUERY 1:.*?(?=-- QUERY 2:|$)/s);
    if (!query1Match) {
      throw new Error('Could not find Query 1 SELECT statement in SQL file');
    }
    
    const query1Part = query1Match[0];
    const selectStart = query1Part.indexOf('SELECT');
    if (selectStart === -1) {
      throw new Error('Could not find SELECT statement in Query 1');
    }
    
    // Extract everything before "-- QUERY 1:" as base CTEs
    const query1Marker = '-- QUERY 1:';
    const query1Index = sqlContent.indexOf(query1Marker);
    if (query1Index === -1) {
      throw new Error('Could not find Query 1 marker in SQL file');
    }
    
    // Find the last closing parenthesis before "-- QUERY 1:" to get the end of base CTEs
    const beforeQuery1 = sqlContent.substring(0, query1Index);
    const lastClosingParen = beforeQuery1.lastIndexOf(')');
    if (lastClosingParen === -1) {
      throw new Error('Could not find closing parenthesis for base CTEs');
    }
    
    // Extract base CTEs up to and including the closing parenthesis and comma (if present)
    // Look for comma after the closing paren
    const afterParen = sqlContent.substring(lastClosingParen + 1, query1Index).trimStart();
    let endPos = lastClosingParen + 1;
    if (afterParen.startsWith(',')) {
      // Include the comma
      endPos = lastClosingParen + 1 + 1;
    } else {
      // No comma found, we'll add one later
    }
    let baseCtes = sqlContent.substring(0, endPos).trim();
    if (!baseCtes.endsWith(',')) {
      baseCtes += ',';
    }
    
    // Extract CTEs from Query 1 section (everything before SELECT)
    let query1Ctes = query1Part.substring(0, selectStart).trim();
    
    // Extract SELECT statement
    const selectStatement = query1Part.substring(selectStart).trim();
    
    // Remove comment lines from both base CTEs and query1 CTEs
    baseCtes = baseCtes.split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('--');
      })
      .join('\n')
      .trim();
    
    query1Ctes = query1Ctes.split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('--');
      })
      .join('\n')
      .trim();
    
    // Ensure base CTEs start with WITH
    if (!baseCtes.toUpperCase().startsWith('WITH')) {
      baseCtes = 'WITH ' + baseCtes;
    }
    
    // Remove leading WITH from query1Ctes if present
    if (query1Ctes.toUpperCase().startsWith('WITH')) {
      query1Ctes = query1Ctes.substring(4).trim();
    }
    
    // Ensure base CTEs end with comma (for continuing WITH clause)
    let baseCtesWithComma = baseCtes.trim();
    if (!baseCtesWithComma.endsWith(',')) {
      // Add comma after the closing parenthesis
      baseCtesWithComma = baseCtesWithComma.replace(/\s*\)\s*$/, '),');
    }
    
    // Combine: base CTEs (with comma) + query1 CTEs + SELECT
    const fullQuery = `${baseCtesWithComma}\n${query1Ctes}\n${selectStatement}`;
    
    const cleanedQuery = fullQuery.trim();
    
    // Validate that we have exactly one WITH clause at the start
    const withCount = (cleanedQuery.match(/\bWITH\b/gi) || []).length;
    if (withCount !== 1 || !cleanedQuery.toUpperCase().startsWith('WITH')) {
      console.error('Invalid query structure - WITH clause issue');
      console.error('Base CTEs:', baseCtesWithComma.substring(0, 200));
      console.error('Query1 CTEs:', query1Ctes.substring(0, 200));
      throw new Error(`Invalid SQL structure: expected exactly one WITH clause at start, found ${withCount}`);
    }
    
    return cleanedQuery;
  } catch (error: any) {
    throw new Error(`Failed to read war statistics SQL query: ${error?.message || String(error)}`);
  }
}

/**
 * Get overall alliance totals (Query 2)
 */
function getWarStatisticsAllianceTotalsQuery(): string {
  const sqlPath = getWarStatisticsSqlPath();
  
  try {
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`SQL script file not found at ${sqlPath}`);
    }
    
    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
    
    // Find where the CTEs actually end (the closing parenthesis before "-- QUERY 1:")
    const query1Marker = '-- QUERY 1:';
    const query1Index = sqlContent.indexOf(query1Marker);
    if (query1Index === -1) {
      throw new Error('Could not find Query 1 marker in SQL file');
    }
    
    // Find the last closing parenthesis before the query marker
    const beforeQuery1 = sqlContent.substring(0, query1Index);
    const lastClosingParen = beforeQuery1.lastIndexOf(')');
    if (lastClosingParen === -1) {
      throw new Error('Could not find closing parenthesis for CTEs');
    }
    
    // Extract CTEs up to and including the closing parenthesis
    const ctes = sqlContent.substring(0, lastClosingParen + 1).trim();
    
    // Extract Query 2 section (between "-- QUERY 2:" and "-- QUERY 3:")
    const query2Match = sqlContent.match(/-- QUERY 2:.*?(?=-- QUERY 3:|$)/s);
    if (!query2Match) {
      throw new Error('Could not find Query 2 SELECT statement in SQL file');
    }
    
    const query2Part = query2Match[0];
    const selectStart = query2Part.indexOf('SELECT');
    if (selectStart === -1) {
      throw new Error('Could not find SELECT statement in Query 2');
    }
    
    // Extract Query 2 CTEs (everything before SELECT)
    let query2Ctes = query2Part.substring(0, selectStart).trim();
    const selectStatement = query2Part.substring(selectStart).trim();
    
    // Remove comment lines from query2Ctes
    query2Ctes = query2Ctes.split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('--');
      })
      .join('\n')
      .trim();
    
    // Remove leading WITH from query2Ctes if present
    if (query2Ctes.toUpperCase().startsWith('WITH')) {
      query2Ctes = query2Ctes.substring(4).trim();
    }
    
    // Ensure base CTEs end with comma
    let ctesClean = ctes.trim();
    if (!ctesClean.endsWith(',')) {
      ctesClean = ctesClean.replace(/\s*\)\s*$/, '),');
    }
    
    // Combine: base CTEs + query2 CTEs + SELECT
    const fullQuery = `${ctesClean}\n${query2Ctes}\n${selectStatement}`;
    
    // Remove comment lines (starting with --) but keep the SQL
    const lines = fullQuery.split('\n')
      .map(line => line.trim())
      .filter(line => {
        if (!line) return false;
        if (line.startsWith('--')) return false;
        return true;
      });
    
    return lines.join('\n').trim();
  } catch (error: any) {
    throw new Error(`Failed to read war statistics alliance totals SQL query: ${error?.message || String(error)}`);
  }
}

/**
 * Get nation-level breakdown (Query 3)
 */
function getWarStatisticsNationBreakdownQuery(): string {
  const sqlPath = getWarStatisticsSqlPath();
  
  try {
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`SQL script file not found at ${sqlPath}`);
    }
    
    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
    
    // Find where the CTEs actually end (the closing parenthesis before "-- QUERY 1:")
    const query1Marker = '-- QUERY 1:';
    const query1Index = sqlContent.indexOf(query1Marker);
    if (query1Index === -1) {
      throw new Error('Could not find Query 1 marker in SQL file');
    }
    
    // Find the last closing parenthesis before the query marker
    const beforeQuery1 = sqlContent.substring(0, query1Index);
    const lastClosingParen = beforeQuery1.lastIndexOf(')');
    if (lastClosingParen === -1) {
      throw new Error('Could not find closing parenthesis for CTEs');
    }
    
    // Extract CTEs up to and including the closing parenthesis
    const ctes = sqlContent.substring(0, lastClosingParen + 1).trim();
    
    // Extract Query 3 section (after "-- QUERY 3:")
    const query3Match = sqlContent.match(/-- QUERY 3:.*?$/s);
    if (!query3Match) {
      throw new Error('Could not find Query 3 SELECT statement in SQL file');
    }
    
    const query3Part = query3Match[0];
    const selectStart = query3Part.indexOf('SELECT');
    if (selectStart === -1) {
      throw new Error('Could not find SELECT statement in Query 3');
    }
    
    // Extract Query 3 CTEs (everything before SELECT)
    let query3Ctes = query3Part.substring(0, selectStart).trim();
    const selectStatement = query3Part.substring(selectStart).trim();
    
    // Remove comment lines from query3Ctes
    query3Ctes = query3Ctes.split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('--');
      })
      .join('\n')
      .trim();
    
    // Remove leading WITH from query3Ctes if present
    if (query3Ctes.toUpperCase().startsWith('WITH')) {
      query3Ctes = query3Ctes.substring(4).trim();
    }
    
    // Ensure base CTEs end with comma only if Query 3 has CTEs
    let ctesClean = ctes.trim();
    if (query3Ctes && !ctesClean.endsWith(',')) {
      ctesClean = ctesClean.replace(/\s*\)\s*$/, '),');
    }
    
    // Combine: base CTEs + query3 CTEs + SELECT
    const fullQuery = query3Ctes 
      ? `${ctesClean}\n${query3Ctes}\n${selectStatement}`
      : `${ctesClean}\n${selectStatement}`;
    
    // Remove comment lines (starting with --) but keep the SQL
    const lines = fullQuery.split('\n')
      .map(line => line.trim())
      .filter(line => {
        if (!line) return false;
        if (line.startsWith('--')) return false;
        return true;
      });
    
    return lines.join('\n').trim();
  } catch (error: any) {
    throw new Error(`Failed to read war statistics nation breakdown SQL query: ${error?.message || String(error)}`);
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

/**
 * Get war statistics - Alliance Summary with Opponent Breakdown
 */
export async function getWarStatistics(): Promise<AllianceOpponentBreakdown[]> {
  const sqlQuery = getWarStatisticsSqlQuery();
  console.log('Executing war statistics query, length:', sqlQuery.length);
  
  try {
    const results = await prisma.$queryRawUnsafe<Array<{
    alliance_id: bigint | number | null;
    alliance_name: string | null;
    opponent_alliance_id: bigint | number | null;
    opponent_alliance_name: string | null;
    total_damage: bigint | number;
    nations_involved: bigint | number;
  }>>(sqlQuery);
  
    // Convert BigInt values to numbers and handle nulls
    return results.map(row => ({
    alliance_id: Number(row.alliance_id || 0),
    alliance_name: row.alliance_name || 'Unknown',
    opponent_alliance_id: row.opponent_alliance_id ? Number(row.opponent_alliance_id) : null,
    opponent_alliance_name: row.opponent_alliance_name || null,
    total_damage: Number(row.total_damage),
    nations_involved: Number(row.nations_involved),
  }));
  } catch (error: any) {
    console.error('SQL Query Error:', error);
    console.error('Query (first 500 chars):', sqlQuery.substring(0, 500));
    throw error;
  }
}

/**
 * Get overall alliance totals
 */
export async function getWarStatisticsAllianceTotals(): Promise<AllianceTotal[]> {
  const sqlQuery = getWarStatisticsAllianceTotalsQuery();
  console.log('Executing alliance totals query, length:', sqlQuery.length);
  
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
  
    console.log(`Alliance totals query returned ${results.length} rows`);
    if (results.length === 0) {
      console.log('Warning: Alliance totals query returned 0 rows');
    }
  
    // Convert BigInt values to numbers and handle nulls
    return results.map(row => ({
    alliance_id: Number(row.alliance_id || 0),
    alliance_name: row.alliance_name || 'Unknown',
    total_damage_dealt: Number(row.total_damage_dealt),
    total_damage_received: Number(row.total_damage_received),
    net_damage: Number(row.net_damage),
    offensive_wars: Number(row.offensive_wars),
    defensive_wars: Number(row.defensive_wars),
  }));
  } catch (error: any) {
    console.error('SQL Query Error:', error);
    console.error('Error message:', error?.message);
    console.error('Error code:', error?.code);
    console.error('Query (first 1000 chars):', sqlQuery.substring(0, 1000));
    throw error;
  }
}

/**
 * Get nation-level breakdown
 */
export async function getWarStatisticsNationBreakdown(): Promise<NationBreakdown[]> {
  const sqlQuery = getWarStatisticsNationBreakdownQuery();
  console.log('Executing nation breakdown query, length:', sqlQuery.length);
  
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
  
    console.log(`Nation breakdown query returned ${results.length} rows`);
    if (results.length === 0) {
      console.log('Warning: Nation breakdown query returned 0 rows');
    }
  
    // Convert BigInt values to numbers and handle nulls
    return results.map(row => ({
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
  } catch (error: any) {
    console.error('SQL Query Error:', error);
    console.error('Error message:', error?.message);
    console.error('Error code:', error?.code);
    console.error('Query (first 1000 chars):', sqlQuery.substring(0, 1000));
    throw error;
  }
}

