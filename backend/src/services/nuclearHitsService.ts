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


