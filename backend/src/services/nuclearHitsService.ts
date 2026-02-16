import { parseCentralTimeDate } from '../utils/dateUtils.js';
import { prisma } from '../utils/prisma.js';

export interface NuclearReportInput {
  AttackingNation: string | number;
  DefendingNation: string | number;
  time: string; // e.g., "10/7/2025 8:36:21 AM"
  result?: string;
}

export interface NuclearHitRecord {
  attackingNation: string;
  defendingNation: string;
  result?: string;
  sentAt: string; // original sent date string from input
}

type NuclearHitStore = Record<string, NuclearHitRecord>;

function toKey(attackingNation: string | number, defendingNation: string | number, timestampMs: number): string {
  const a = String(attackingNation).trim();
  const d = String(defendingNation).trim();
  return `${a}_${d}_${timestampMs}`;
}

function parseTimestampMs(time: string): number {
  const d = parseCentralTimeDate(time);
  const t = d.getTime();
  if (Number.isNaN(t)) {
    throw new Error(`Invalid time string: ${time}`);
  }
  return t;
}

export function normalizeReport(input: NuclearReportInput): { key: string; record: NuclearHitRecord } {
  const timestampMs = parseTimestampMs(input.time);
  const attackingNation = String(input.AttackingNation).trim();
  const defendingNation = String(input.DefendingNation).trim();
  const key = toKey(attackingNation, defendingNation, timestampMs);
  const record: NuclearHitRecord = { attackingNation, defendingNation, result: input.result, sentAt: input.time };
  return { key, record };
}

export async function readNuclearHits(): Promise<NuclearHitStore> {
  try {
    const hits = await prisma.nuclearHit.findMany();
    const store: NuclearHitStore = {};
    
    for (const hit of hits) {
      store[hit.key] = {
        attackingNation: hit.attackingNation,
        defendingNation: hit.defendingNation,
        result: hit.result || undefined,
        sentAt: hit.sentAt,
      };
    }
    
    return store;
  } catch (error) {
    console.error('Failed to read nuclear hits from database:', error);
    return {};
  }
}

export async function writeNuclearHits(store: NuclearHitStore): Promise<boolean> {
  try {
    const totalRecords = Object.keys(store).length;
    const keys = Object.keys(store);
    
    // Single query to get existing records
    const existingHits = await prisma.nuclearHit.findMany({
      where: {
        key: { in: keys }
      },
      select: {
        key: true,
        attackingNation: true,
        defendingNation: true,
        result: true,
        sentAt: true,
      }
    });
    
    const existingMap = new Map(existingHits.map(hit => [hit.key, hit]));
    
    // Separate records into new, changed, and unchanged
    const recordsToCreate: Array<{
      key: string;
      attackingNation: string;
      defendingNation: string;
      result: string | null;
      sentAt: string;
    }> = [];
    
    const recordsToUpdate: Array<{
      key: string;
      attackingNation: string;
      defendingNation: string;
      result: string | null;
      sentAt: string;
    }> = [];
    
    let unchangedRecords = 0;
    
    for (const [key, record] of Object.entries(store)) {
      const existing = existingMap.get(key);
      
      if (!existing) {
        // New record - batch create
        recordsToCreate.push({
          key,
          attackingNation: record.attackingNation,
          defendingNation: record.defendingNation,
          result: record.result || null,
          sentAt: record.sentAt,
        });
      } else {
        // Check if record has changed
        const hasChanged = 
          existing.attackingNation !== record.attackingNation ||
          existing.defendingNation !== record.defendingNation ||
          (existing.result || null) !== (record.result || null) ||
          existing.sentAt !== record.sentAt;
        
        if (hasChanged) {
          // Changed record - batch update
          recordsToUpdate.push({
            key,
            attackingNation: record.attackingNation,
            defendingNation: record.defendingNation,
            result: record.result || null,
            sentAt: record.sentAt,
          });
        } else {
          unchangedRecords++;
        }
      }
    }
    
    // Batch create all new records in a single query
    if (recordsToCreate.length > 0) {
      await prisma.nuclearHit.createMany({
        data: recordsToCreate,
        skipDuplicates: true,
      });
    }
    
    // Batch update changed records using Promise.all for parallelization
    // Note: Prisma doesn't support batch updates with different values per record,
    // so we parallelize individual updates
    if (recordsToUpdate.length > 0) {
      await Promise.all(
        recordsToUpdate.map(record =>
          prisma.nuclearHit.update({
            where: { key: record.key },
            data: {
              attackingNation: record.attackingNation,
              defendingNation: record.defendingNation,
              result: record.result,
              sentAt: record.sentAt,
            },
          })
        )
      );
    }
    
    const newRecords = recordsToCreate.length;
    const updatedRecords = recordsToUpdate.length;
    const changedRecords = newRecords + updatedRecords;
    
    console.log(`[Nuclear Data] Processed ${totalRecords} nuclear hit records: ${newRecords} new, ${updatedRecords} updated, ${unchangedRecords} unchanged`);
    
    if (changedRecords > 0) {
      console.log(`[Nuclear Data] Wrote ${changedRecords} changed nuclear hit records to database`);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to write nuclear hits to database:', error);
    return false;
  }
}

export async function upsertNuclearReports(inputs: NuclearReportInput[]): Promise<{ added: number; skipped: number; addedKeys: string[] }> {
  if (!Array.isArray(inputs)) {
    return { added: 0, skipped: 0, addedKeys: [] };
  }

  console.log(`[Nuclear Data] Processing ${inputs.length} nuclear report inputs`);
  
  // Normalize all inputs first
  const normalizedInputs: Array<{ key: string; record: NuclearHitRecord }> = [];
  for (const input of inputs) {
    try {
      const normalized = normalizeReport(input);
      normalizedInputs.push(normalized);
    } catch (_err) {
      // Skip invalid entries
    }
  }

  if (normalizedInputs.length === 0) {
    return { added: 0, skipped: inputs.length, addedKeys: [] };
  }

  // Only fetch records for the keys we're actually processing
  const keysToCheck = normalizedInputs.map(n => n.key);
  const existingHits = await prisma.nuclearHit.findMany({
    where: {
      key: { in: keysToCheck }
    },
    select: {
      key: true,
    }
  });

  const existingKeys = new Set(existingHits.map(hit => hit.key));

  // Separate new records from duplicates
  const recordsToCreate: Array<{
    key: string;
    attackingNation: string;
    defendingNation: string;
    result: string | null;
    sentAt: string;
  }> = [];

  let added = 0;
  let skipped = 0;
  const addedKeys: string[] = [];

  for (const { key, record } of normalizedInputs) {
    if (existingKeys.has(key)) {
      skipped += 1;
      continue;
    }
    
    recordsToCreate.push({
      key,
      attackingNation: record.attackingNation,
      defendingNation: record.defendingNation,
      result: record.result || null,
      sentAt: record.sentAt,
    });
    added += 1;
    addedKeys.push(key);
  }

  // Batch create only the new records
  if (recordsToCreate.length > 0) {
    await prisma.nuclearHit.createMany({
      data: recordsToCreate,
      skipDuplicates: true,
    });
    console.log(`[Nuclear Data] Created ${recordsToCreate.length} new nuclear hit records`);
  }

  console.log(`[Nuclear Data] Processed reports: ${added} added, ${skipped} skipped (duplicates or invalid)`);
  return { added, skipped, addedKeys };
}

// Classify a result string into thwarted/hit/unknown
function classifyResult(result?: string): 'thwarted' | 'hit' | 'unknown' {
  if (!result) return 'unknown';
  const s = result.toLowerCase();
  if (s.includes('thwart')) return 'thwarted';
  // Consider generic success phrases
  if (s.includes('hit') || s.includes('detonat') || s.includes('struck') || s.includes('landed')) return 'hit';
  return 'unknown';
}

export interface ThwartedBeforeHitByPair {
  attackingNation: string;
  defendingNation: string;
  thwartedBeforeHit: number;
  hitAchieved: boolean;
  date: string; // YYYY-MM-DD (Central Time)
  firstEventAt?: string; // first attempt timestamp for context
  firstHitAt?: string; // timestamp of first successful hit, if any
}

export interface NuclearAttemptDistribution {
  byPair: ThwartedBeforeHitByPair[];
  distribution: Record<string, number>; // thwarted count -> pairs that later hit
  distributionNoHit: Record<string, number>; // thwarted count -> pairs that never hit
  onlyThwartedPairs: number; // pairs with attempts but no hit
}

export interface NuclearTimelineBucket {
  start: string; // ISO string representing the start of the bucket in Central Time offset
  end: string;   // ISO string representing the end of the bucket
  thwarted: number;
  hit: number;
  unknown: number;
}

export interface NuclearTimelineResponse {
  intervalMinutes: number;
  buckets: NuclearTimelineBucket[];
  totalEvents: number;
  firstEvent?: string;
  lastEvent?: string;
}

/**
 * Compute, for each attacker→defender pair, how many thwarted attempts occurred before the first hit,
 * and whether a hit was ever achieved. Also returns an aggregated distribution across all pairs that achieved a hit.
 */
export async function computeNuclearAttemptDistribution(): Promise<NuclearAttemptDistribution> {
  const store = await readNuclearHits();

  // Group attempts by attacker->defender pair
  const grouped: Record<string, { a: string; d: string; events: { t: number; sentAt: string; result?: string }[] }> = {};
  for (const rec of Object.values(store)) {
    const a = rec.attackingNation;
    const d = rec.defendingNation;
    const key = `${a}→${d}`;
    const t = (() => {
      try {
        return parseTimestampMs(rec.sentAt);
      } catch {
        return Number.NaN;
      }
    })();
    if (!grouped[key]) grouped[key] = { a, d, events: [] };
    grouped[key].events.push({ t, sentAt: rec.sentAt, result: rec.result });
  }

  const byPair: ThwartedBeforeHitByPair[] = [];
  const distribution: Record<string, number> = {};
  const distributionNoHit: Record<string, number> = {};
  let onlyThwartedPairs = 0;

  for (const { a, d, events } of Object.values(grouped)) {
    // Sort by timestamp ascending; fall back to original order for NaN
    events.sort((e1, e2) => {
      const t1 = Number.isNaN(e1.t) ? 0 : e1.t;
      const t2 = Number.isNaN(e2.t) ? 0 : e2.t;
      return t1 - t2;
    });

    // Now split into daily sequences (Central Time date of sentAt)
    const byDate: Record<string, { t: number; sentAt: string; result?: string }[]> = {};
    for (const ev of events) {
      // Build date key in Central Time
      let dateKey = 'invalid-date';
      try {
        const dt = parseCentralTimeDate(ev.sentAt);
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const d2 = String(dt.getDate()).padStart(2, '0');
        dateKey = `${y}-${m}-${d2}`;
      } catch {
        // keep invalid-date; will still group but unlikely
      }
      if (!byDate[dateKey]) byDate[dateKey] = [];
      byDate[dateKey].push(ev);
    }

    let anyHitForPair = false;
    let anyAttemptsForPair = false;

    for (const [dateKey, dayEvents] of Object.entries(byDate)) {
      dayEvents.sort((e1, e2) => {
        const t1 = Number.isNaN(e1.t) ? 0 : e1.t;
        const t2 = Number.isNaN(e2.t) ? 0 : e2.t;
        return t1 - t2;
      });

      if (dayEvents.length === 0) continue;
      anyAttemptsForPair = true;

      let thwartedCount = 0;
      let hitAchieved = false;
      const firstEventAt = dayEvents[0]?.sentAt;
      let firstHitAt: string | undefined = undefined;

      for (const ev of dayEvents) {
        const cls = classifyResult(ev.result);
        if (cls === 'thwarted') {
          if (!hitAchieved) thwartedCount += 1;
        } else if (cls === 'hit') {
          if (!hitAchieved) {
            hitAchieved = true;
            firstHitAt = ev.sentAt;
            break;
          }
        }
      }

      const k = String(thwartedCount);
      if (!hitAchieved) {
        distributionNoHit[k] = (distributionNoHit[k] || 0) + 1;
      } else {
        distribution[k] = (distribution[k] || 0) + 1;
        anyHitForPair = true;
      }

      byPair.push({
        attackingNation: a,
        defendingNation: d,
        date: dateKey,
        thwartedBeforeHit: thwartedCount,
        hitAchieved,
        firstEventAt,
        firstHitAt
      });
    }

    if (anyAttemptsForPair && !anyHitForPair) {
      onlyThwartedPairs += 1;
    }
  }

  return { byPair, distribution, distributionNoHit, onlyThwartedPairs };
}

/**
 * Compute a timeline of nuclear attempts aggregated by time of day only (ignoring date).
 * Groups all events that occur in the same time interval across all days (default 5 minutes).
 * All parsing respects Central Time via parseCentralTimeDate.
 */
export async function computeNuclearTimeline(intervalMinutes: number = 5): Promise<NuclearTimelineResponse> {
  const store = await readNuclearHits();
  const intervalMinutesActual = Math.max(1, Math.floor(intervalMinutes));
  const intervalsPerDay = Math.floor((24 * 60) / intervalMinutesActual); // e.g., 288 for 5-minute intervals

  // Helper to extract Central Time hours and minutes directly from the string
  // Format: "M/D/YYYY H:MM:SS AM/PM" or "M/D/YYYY H:MM:SS"
  const extractCentralTimeHoursMinutes = (timeStr: string): { hours: number; minutes: number } | null => {
    try {
      const parts = timeStr.split(' ');
      if (parts.length < 2) return null;
      
      // parts[0] = "M/D/YYYY", parts[1] = "H:MM:SS", parts[2] = "AM/PM" (if present)
      const timePart = parts[1]; // "H:MM:SS"
      const period = parts.length >= 3 ? parts[2] : undefined; // "AM" or "PM" or undefined
      
      const timeParts = timePart.split(':');
      if (timeParts.length < 2) return null;
      
      const hours = parseInt(timeParts[0]);
      const minutes = parseInt(timeParts[1]);
      
      if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
      
      let hour24 = hours;
      if (period) {
        // 12-hour format with AM/PM
        const periodUpper = period.toUpperCase();
        if (periodUpper === 'PM' && hour24 !== 12) hour24 += 12;
        if (periodUpper === 'AM' && hour24 === 12) hour24 = 0;
      }
      
      return { hours: hour24, minutes };
    } catch {
      return null;
    }
  };

  const events: { minutesOfDay: number; sentAt: string; cls: 'thwarted' | 'hit' | 'unknown' }[] = [];
  for (const rec of Object.values(store)) {
    try {
      const timeInfo = extractCentralTimeHoursMinutes(rec.sentAt);
      if (!timeInfo) continue;
      
      // Validate hours and minutes are in valid range
      if (timeInfo.hours < 0 || timeInfo.hours >= 24 || timeInfo.minutes < 0 || timeInfo.minutes >= 60) {
        continue;
      }
      
      const minutesOfDay = timeInfo.hours * 60 + timeInfo.minutes;
      // Ensure minutesOfDay is within valid 24-hour range (0-1439)
      if (minutesOfDay < 0 || minutesOfDay >= 1440) {
        continue;
      }
      
      const cls = classifyResult(rec.result);
      events.push({ minutesOfDay, sentAt: rec.sentAt, cls });
    } catch {
      // skip invalid
    }
  }

  if (events.length === 0) {
    return { intervalMinutes: intervalMinutesActual, buckets: [], totalEvents: 0 };
  }

  // Create buckets for each time interval in a 24-hour day
  const buckets: NuclearTimelineBucket[] = [];
  for (let i = 0; i < intervalsPerDay; i++) {
    const startMinutes = i * intervalMinutesActual;
    const endMinutes = startMinutes + intervalMinutesActual;
    const startHours = Math.floor(startMinutes / 60);
    const startMins = startMinutes % 60;
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;
    
    // Format as "HH:MM" for display
    const startStr = `${String(startHours).padStart(2, '0')}:${String(startMins).padStart(2, '0')}`;
    const endStr = `${String(endHours % 24).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
    
    buckets.push({ start: startStr, end: endStr, thwarted: 0, hit: 0, unknown: 0 });
  }

  // Index events into buckets based on time of day
  for (const ev of events) {
    const bucketIdx = Math.floor(ev.minutesOfDay / intervalMinutesActual);
    if (bucketIdx < 0 || bucketIdx >= buckets.length) continue;
    const b = buckets[bucketIdx];
    if (ev.cls === 'thwarted') b.thwarted += 1;
    else if (ev.cls === 'hit') b.hit += 1;
    else b.unknown += 1;
  }

  return {
    intervalMinutes: intervalMinutesActual,
    buckets,
    totalEvents: events.length,
    firstEvent: undefined, // Not applicable when grouping by time of day
    lastEvent: undefined
  };
}
