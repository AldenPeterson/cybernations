import fs from 'fs';
import path from 'path';
import { parseCentralTimeDate } from '../utils/dateUtils.js';
import { fileURLToPath } from 'url';

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

function getDataFilePath(): string {
  const candidates: string[] = [];
  // 1) dist relative (when running compiled code)
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    candidates.push(path.join(__dirname, '..', 'data', 'nuclear_hits.json')); // dist/services -> dist/data
    candidates.push(path.join(__dirname, '..', '..', 'src', 'data', 'nuclear_hits.json')); // fallback to src from dist
  } catch {}
  // 2) process cwd variants
  candidates.push(path.join(process.cwd(), 'dist', 'data', 'nuclear_hits.json'));
  candidates.push(path.join(process.cwd(), 'src', 'data', 'nuclear_hits.json'));
  candidates.push(path.join(process.cwd(), 'data', 'nuclear_hits.json'));

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {}
  }
  // Default to src path; writes are skipped in prod anyway
  return candidates[candidates.length - 1];
}

export function readNuclearHits(): NuclearHitStore {
  const filePath = getDataFilePath();
  try {
    if (!fs.existsSync(filePath)) {
      return {};
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, any>;
    if (!parsed || typeof parsed !== 'object') return {};
    // Strip any legacy "key" fields from values
    const cleaned: NuclearHitStore = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v && typeof v === 'object') {
        const { attackingNation, defendingNation, result, sentAt } = v as NuclearHitRecord & { key?: string };
        cleaned[k] = { attackingNation, defendingNation, result, sentAt };
      }
    }
    return cleaned;
  } catch (error) {
    console.error('Failed to read nuclear hits file:', error);
    return {};
  }
}

export function writeNuclearHits(store: NuclearHitStore): boolean {
  // Skip file operations in serverless environments like Vercel
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    console.log('Skipping nuclear hits save in serverless environment');
    return false;
  }

  const filePath = getDataFilePath();
  const dir = path.dirname(filePath);
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    // Ensure we never persist a "key" property inside values
    const output: NuclearHitStore = {};
    for (const [k, v] of Object.entries(store)) {
      const { attackingNation, defendingNation, result, sentAt } = v;
      output[k] = { attackingNation, defendingNation, result, sentAt };
    }
    fs.writeFileSync(filePath, JSON.stringify(output, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Failed to write nuclear hits file:', error);
    return false;
  }
}

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

export function upsertNuclearReports(inputs: NuclearReportInput[]): { added: number; skipped: number; addedKeys: string[] } {
  if (!Array.isArray(inputs)) {
    return { added: 0, skipped: 0, addedKeys: [] };
  }

  const store = readNuclearHits();
  let added = 0;
  let skipped = 0;
  const addedKeys: string[] = [];

  for (const input of inputs) {
    try {
      const { key, record } = normalizeReport(input);
      if (store[key]) {
        skipped += 1;
        continue;
      }
      store[key] = record;
      added += 1;
      addedKeys.push(key);
    } catch (_err) {
      // Skip invalid entries; log minimally to avoid noisy output
      skipped += 1;
    }
  }

  writeNuclearHits(store);
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

/**
 * Compute, for each attacker→defender pair, how many thwarted attempts occurred before the first hit,
 * and whether a hit was ever achieved. Also returns an aggregated distribution across all pairs that achieved a hit.
 */
export function computeNuclearAttemptDistribution(): NuclearAttemptDistribution {
  const store = readNuclearHits();

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

