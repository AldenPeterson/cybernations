import { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';

interface CachedResponse {
  data: Omit<MobilizationResponseBody, 'success'>;
  timestamp: number;
}

const CACHE_TTL_MS = 300_000; // 5 minutes
const CACHE_MAX_ENTRIES = 200;
const responseCache = new Map<string, CachedResponse>();

const getCacheKey = (allianceId: number, startDate: string, endDate: string): string =>
  `${allianceId}|${startDate}|${endDate}`;

const sweepExpired = (now: number): void => {
  for (const [k, v] of responseCache.entries()) {
    if (now - v.timestamp >= CACHE_TTL_MS) {
      responseCache.delete(k);
    }
  }
};

interface MobilizationResponseBody {
  success: boolean;
  allianceId: number;
  allianceName: string;
  startDate: string;
  endDate: string;
  buckets: MobilizationBucket[];
  currentState: MobilizationCurrentState;
  totalNations: number;
}

interface MobilizationNation {
  nationId: number;
  nationName: string;
  rulerName: string;
  strength: number;
  oldDefcon?: number | null;
  newDefcon?: number | null;
  createdAt: string;
}

interface BucketCategory {
  count: number;
  nations: MobilizationNation[];
}

interface MobilizationBucket {
  date: string;
  enteredWarMode: BucketCategory;
  leftWarMode: BucketCategory;
  defconDown: BucketCategory;
  defconUp: BucketCategory;
}

interface MobilizationCurrentState {
  warModeCount: number;
  peaceModeCount: number;
  defconDistribution: Record<string, number>;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toCentralDateString = (d: Date): string => {
  const parts = d
    .toLocaleDateString('en-US', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    .split('/');
  return `${parts[2]}-${parts[0]}-${parts[1]}`;
};

const parseYmd = (s: string): Date | null => {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  // Anchor at Central Time midnight (CST offset; the actual offset doesn't matter
  // for our purposes since we re-format the resulting Date back to a CT date string).
  return new Date(`${y}-${mo}-${d}T00:00:00-06:00`);
};

const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * MS_PER_DAY);

const enumerateDates = (start: string, end: string): string[] => {
  const startDate = parseYmd(start);
  const endDate = parseYmd(end);
  if (!startDate || !endDate) return [];
  const out: string[] = [];
  for (let t = startDate.getTime(); t <= endDate.getTime(); t += MS_PER_DAY) {
    out.push(toCentralDateString(new Date(t)));
  }
  return out;
};

export class MobilizationController {
  /**
   * GET /api/alliances/:allianceId/mobilization?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
   *
   * Aggregates `defcon_change` and `war_mode_change` events into daily buckets
   * (Central Time), keyed by direction. Each bucket carries the list of nations
   * that contributed, so the UI can show drill-downs without a second round trip.
   */
  static async getMobilization(req: Request, res: Response) {
    try {
      const allianceId = parseInt(req.params.allianceId, 10);
      if (isNaN(allianceId)) {
        return res.status(400).json({ success: false, error: 'Invalid alliance ID' });
      }

      const today = toCentralDateString(new Date());
      const defaultStart = toCentralDateString(addDays(new Date(), -29));
      const startDateStr = (req.query.startDate as string) || defaultStart;
      const endDateStr = (req.query.endDate as string) || today;

      const startDate = parseYmd(startDateStr);
      const endDate = parseYmd(endDateStr);
      if (!startDate || !endDate) {
        return res
          .status(400)
          .json({ success: false, error: 'Invalid date format. Use YYYY-MM-DD.' });
      }

      const cacheKey = getCacheKey(allianceId, startDateStr, endDateStr);
      const now = Date.now();
      const cached = responseCache.get(cacheKey);
      if (cached && now - cached.timestamp < CACHE_TTL_MS) {
        return res.json({ success: true, ...cached.data });
      }
      if (responseCache.size > CACHE_MAX_ENTRIES) {
        sweepExpired(now);
      }

      // Widen the SQL window to absorb timezone edge cases; we'll re-bucket in code.
      const queryStart = addDays(startDate, -1);
      const queryEnd = addDays(endDate, 2);

      const [events, alliance, activeNations] = await Promise.all([
        prisma.event.findMany({
          where: {
            allianceId,
            eventType: { in: ['defcon_change', 'war_mode_change'] },
            createdAt: { gte: queryStart, lte: queryEnd },
          },
          include: {
            nation: {
              select: {
                id: true,
                rulerName: true,
                nationName: true,
                strength: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.alliance.findUnique({
          where: { id: allianceId },
          select: { id: true, name: true },
        }),
        prisma.nation.findMany({
          where: { allianceId, isActive: true },
          select: { inWarMode: true, defcon: true },
        }),
      ]);

      if (!alliance) {
        return res.status(404).json({ success: false, error: 'Alliance not found' });
      }

      const dates = enumerateDates(startDateStr, endDateStr);
      const bucketByDate = new Map<string, MobilizationBucket>();
      for (const d of dates) {
        bucketByDate.set(d, {
          date: d,
          enteredWarMode: { count: 0, nations: [] },
          leftWarMode: { count: 0, nations: [] },
          defconDown: { count: 0, nations: [] },
          defconUp: { count: 0, nations: [] },
        });
      }

      for (const ev of events) {
        if (!ev.nation) continue;
        const dateStr = toCentralDateString(ev.createdAt);
        const bucket = bucketByDate.get(dateStr);
        if (!bucket) continue;

        const md = (ev.metadata as Record<string, unknown> | null) || {};
        const baseNation: MobilizationNation = {
          nationId: ev.nation.id,
          nationName: ev.nation.nationName,
          rulerName: ev.nation.rulerName,
          strength: ev.nation.strength,
          createdAt: ev.createdAt.toISOString(),
        };

        if (ev.eventType === 'war_mode_change') {
          const newInWarMode = md.newInWarMode;
          if (newInWarMode === true) {
            bucket.enteredWarMode.nations.push(baseNation);
            bucket.enteredWarMode.count += 1;
          } else if (newInWarMode === false) {
            bucket.leftWarMode.nations.push(baseNation);
            bucket.leftWarMode.count += 1;
          }
        } else if (ev.eventType === 'defcon_change') {
          const oldDefcon = typeof md.oldDefcon === 'number' ? md.oldDefcon : null;
          const newDefcon = typeof md.newDefcon === 'number' ? md.newDefcon : null;
          if (oldDefcon == null || newDefcon == null) continue;
          const enriched: MobilizationNation = { ...baseNation, oldDefcon, newDefcon };
          // DEFCON 1 = highest mobilization, 5 = lowest. Decreasing number = mobilizing.
          if (newDefcon < oldDefcon) {
            bucket.defconDown.nations.push(enriched);
            bucket.defconDown.count += 1;
          } else if (newDefcon > oldDefcon) {
            bucket.defconUp.nations.push(enriched);
            bucket.defconUp.count += 1;
          }
        }
      }

      const currentState: MobilizationCurrentState = {
        warModeCount: 0,
        peaceModeCount: 0,
        defconDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, unknown: 0 },
      };
      for (const n of activeNations) {
        if (n.inWarMode) currentState.warModeCount += 1;
        else currentState.peaceModeCount += 1;
        if (n.defcon != null && n.defcon >= 1 && n.defcon <= 5) {
          currentState.defconDistribution[String(n.defcon)] += 1;
        } else {
          currentState.defconDistribution.unknown += 1;
        }
      }

      const buckets = dates.map((d) => bucketByDate.get(d)!);

      const responseBody = {
        allianceId: alliance.id,
        allianceName: alliance.name,
        startDate: startDateStr,
        endDate: endDateStr,
        buckets,
        currentState,
        totalNations: activeNations.length,
      };
      responseCache.set(cacheKey, { data: responseBody, timestamp: Date.now() });

      res.json({ success: true, ...responseBody });
    } catch (error: any) {
      console.error('Error fetching mobilization data:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch mobilization data',
      });
    }
  }
}
