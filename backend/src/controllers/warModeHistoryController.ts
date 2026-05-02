import { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';

/**
 * Reconstructs an alliance's war/peace headcount over time by walking the event
 * log backward from each nation's current state. This is a prototype; for a
 * production chart we'd materialize daily snapshots in a table.
 *
 * Caveats (also surfaced in the response):
 *  - Accurate only back to event-system genesis. Pre-tracking history is lost.
 *  - `new_nation` metadata doesn't include initial inWarMode, so the implied
 *    initial mode is whatever value precedes the first war_mode_change (or the
 *    current value if none) — accurate iff the first observation matches.
 *  - Reactivations from inactive don't generate events. We treat each
 *    `nation_inactive` as the only direction of activity change; if a nation
 *    bounced inactive→active silently, the walk under-counts during the gap.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const CACHE_TTL_MS = 300_000; // 5 minutes
const CACHE_MAX_ENTRIES = 200;

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
  return new Date(`${y}-${mo}-${d}T00:00:00-06:00`);
};

const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * MS_PER_DAY);

interface NationState {
  allianceId: number | null;
  inWarMode: boolean;
  isActive: boolean;
  exists: boolean;
  nationName: string;
  rulerName: string;
  strength: number;
}

interface NationRef {
  nationId: number;
  nationName: string;
  rulerName: string;
  strength: number;
}

interface DaySnapshot {
  date: string;
  warMode: number;
  peaceMode: number;
  total: number;
  warModeNations: NationRef[];
  peaceModeNations: NationRef[];
}

interface ResponseBody {
  allianceId: number;
  allianceName: string;
  startDate: string;
  endDate: string;
  earliestEventDate: string | null;
  series: DaySnapshot[];
}

interface CachedResponse {
  data: ResponseBody;
  timestamp: number;
}

const cache = new Map<string, CachedResponse>();

const getCacheKey = (allianceId: number, startDate: string, endDate: string): string =>
  `${allianceId}|${startDate}|${endDate}`;

const sweepExpired = (now: number): void => {
  for (const [k, v] of cache.entries()) {
    if (now - v.timestamp >= CACHE_TTL_MS) {
      cache.delete(k);
    }
  }
};

export class WarModeHistoryController {
  /**
   * GET /api/alliances/:allianceId/war-mode-history?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
   */
  static async getWarModeHistory(req: Request, res: Response) {
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
      const cached = cache.get(cacheKey);
      if (cached && now - cached.timestamp < CACHE_TTL_MS) {
        return res.json({ success: true, ...cached.data });
      }
      if (cache.size > CACHE_MAX_ENTRIES) {
        sweepExpired(now);
      }

      const alliance = await prisma.alliance.findUnique({
        where: { id: allianceId },
        select: { id: true, name: true },
      });
      if (!alliance) {
        return res.status(404).json({ success: false, error: 'Alliance not found' });
      }

      // Candidate nations: anyone currently in the alliance, plus anyone whose
      // alliance_change event within [startDate, ∞) references this alliance.
      // Bounding by createdAt >= startDate is correct because:
      //  - Nations still in X are in currentMembers regardless of when they joined.
      //  - Nations who left X before startDate weren't in X during the window.
      //  - Nations who left X on/after startDate have a qualifying event in range.
      // We still scan metadata in memory because the join direction lives in JSON.
      const [currentMembers, allianceChangeEvents] = await Promise.all([
        prisma.nation.findMany({
          where: { allianceId },
          select: { id: true },
        }),
        prisma.event.findMany({
          where: { eventType: 'alliance_change', createdAt: { gte: startDate } },
          select: { nationId: true, metadata: true },
        }),
      ]);

      const nationIds = new Set<number>();
      for (const n of currentMembers) nationIds.add(n.id);
      for (const ev of allianceChangeEvents) {
        if (!ev.nationId) continue;
        const md = ev.metadata as Record<string, unknown> | null;
        if (md?.oldAllianceId === allianceId || md?.newAllianceId === allianceId) {
          nationIds.add(ev.nationId);
        }
      }

      if (nationIds.size === 0) {
        const empty: ResponseBody = {
          allianceId: alliance.id,
          allianceName: alliance.name,
          startDate: startDateStr,
          endDate: endDateStr,
          earliestEventDate: null,
          series: [],
        };
        cache.set(cacheKey, { data: empty, timestamp: Date.now() });
        return res.json({ success: true, ...empty });
      }

      const nationIdArr = Array.from(nationIds);

      // Pull current per-nation state for every candidate.
      const nations = await prisma.nation.findMany({
        where: { id: { in: nationIdArr } },
        select: {
          id: true,
          allianceId: true,
          inWarMode: true,
          isActive: true,
          nationName: true,
          rulerName: true,
          strength: true,
        },
      });
      const state = new Map<number, NationState>();
      for (const n of nations) {
        state.set(n.id, {
          allianceId: n.allianceId,
          inWarMode: n.inWarMode,
          isActive: n.isActive,
          exists: true,
          nationName: n.nationName,
          rulerName: n.rulerName,
          strength: n.strength,
        });
      }

      // Pull events that could mutate state for these nations, descending by
      // createdAt. Bounded to events on/after startDate — events earlier than
      // that are never applied because the walk only inverts events with day
      // strictly greater than the day being snapshotted. We additionally pull a
      // cheap aggregate for the genuine earliest event date (unbounded), so the
      // "reliable from" caption still reflects event-system genesis rather than
      // the requested window.
      const eventTypeFilter = {
        in: ['alliance_change', 'war_mode_change', 'new_nation', 'nation_inactive'],
      };
      const [events, earliestEventAgg] = await Promise.all([
        prisma.event.findMany({
          where: {
            nationId: { in: nationIdArr },
            eventType: eventTypeFilter,
            createdAt: { gte: startDate },
          },
          orderBy: { createdAt: 'desc' },
          select: {
            nationId: true,
            eventType: true,
            metadata: true,
            createdAt: true,
          },
        }),
        prisma.event.aggregate({
          where: { nationId: { in: nationIdArr }, eventType: eventTypeFilter },
          _min: { createdAt: true },
        }),
      ]);

      const applyInverse = (
        eventType: string,
        metadata: Record<string, unknown> | null,
        ns: NationState
      ): void => {
        switch (eventType) {
          case 'alliance_change': {
            // Before this event, nation was in oldAllianceId.
            if (metadata && 'oldAllianceId' in metadata) {
              const v = metadata.oldAllianceId;
              ns.allianceId = typeof v === 'number' ? v : null;
            }
            break;
          }
          case 'war_mode_change': {
            if (metadata && typeof metadata.oldInWarMode === 'boolean') {
              ns.inWarMode = metadata.oldInWarMode;
            }
            break;
          }
          case 'new_nation': {
            // Before this event, the nation didn't exist.
            ns.exists = false;
            break;
          }
          case 'nation_inactive': {
            // Before this event, the nation was active.
            ns.isActive = true;
            break;
          }
        }
      };

      const snapshotMembers = (): { warMode: NationRef[]; peaceMode: NationRef[] } => {
        const warMode: NationRef[] = [];
        const peaceMode: NationRef[] = [];
        for (const [id, ns] of state.entries()) {
          if (!ns.exists || !ns.isActive) continue;
          if (ns.allianceId !== allianceId) continue;
          const ref: NationRef = {
            nationId: id,
            nationName: ns.nationName,
            rulerName: ns.rulerName,
            strength: ns.strength,
          };
          if (ns.inWarMode) warMode.push(ref);
          else peaceMode.push(ref);
        }
        // Sort by strength desc so the popover surfaces the heavyweights first.
        warMode.sort((a, b) => b.strength - a.strength);
        peaceMode.sort((a, b) => b.strength - a.strength);
        return { warMode, peaceMode };
      };

      // Walk: iterate days from endDate down to startDate, applying inverses
      // for any events whose Central-Time day is strictly greater than the
      // current target day. Events on day D itself are NOT inverted when we
      // record snapshot[D] — they're considered part of D's end-of-day state.
      const series: DaySnapshot[] = [];
      let eventIdx = 0;

      for (let t = endDate.getTime(); t >= startDate.getTime(); t -= MS_PER_DAY) {
        const D = toCentralDateString(new Date(t));
        while (
          eventIdx < events.length &&
          toCentralDateString(events[eventIdx].createdAt) > D
        ) {
          const ev = events[eventIdx];
          const ns = ev.nationId != null ? state.get(ev.nationId) : undefined;
          if (ns) {
            applyInverse(ev.eventType, ev.metadata as Record<string, unknown> | null, ns);
          }
          eventIdx += 1;
        }
        const members = snapshotMembers();
        series.push({
          date: D,
          warMode: members.warMode.length,
          peaceMode: members.peaceMode.length,
          total: members.warMode.length + members.peaceMode.length,
          warModeNations: members.warMode,
          peaceModeNations: members.peaceMode,
        });
      }
      // We pushed in descending-day order; flip to ascending for the client.
      series.reverse();

      const earliestEvent = earliestEventAgg._min.createdAt ?? null;

      const responseBody: ResponseBody = {
        allianceId: alliance.id,
        allianceName: alliance.name,
        startDate: startDateStr,
        endDate: endDateStr,
        earliestEventDate: earliestEvent ? toCentralDateString(earliestEvent) : null,
        series,
      };
      cache.set(cacheKey, { data: responseBody, timestamp: Date.now() });

      res.json({ success: true, ...responseBody });
    } catch (error: any) {
      console.error('Error fetching war-mode history:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch war-mode history',
      });
    }
  }
}
