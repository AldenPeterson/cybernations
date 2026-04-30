import { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { DONATION_TIERS, NATION_EVENT_TYPES } from '../services/eventService.js';

interface DeltaBucket {
  infra: number;
  land: number;
  tech: number;
}

interface NationDonationSummary {
  nationId: number;
  rulerName: string;
  nationName: string;
  counts: Record<string, Record<string, number>>;
  // summed actual stat gains keyed by month then tier (USD as string)
  deltas: Record<string, Record<string, DeltaBucket>>;
}

interface AllianceDonationSummary {
  allianceId: number | null;
  allianceName: string;
  // event counts keyed by month (YYYY-MM) then by donation tier (USD as string).
  // USD totals are derivable as tier × count, so the backend only ships counts.
  counts: Record<string, Record<string, number>>;
  nations: NationDonationSummary[];
}

interface DonationSummaryResponse {
  success: boolean;
  months: string[];
  tiers: number[];
  alliances: AllianceDonationSummary[];
}

interface CacheEntry {
  data: DonationSummaryResponse;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export class DonationsController {
  /**
   * GET /api/donations/summary
   * Aggregates possible_donation events into per-alliance totals and a per-month breakdown.
   * USD values come from metadata.suspectedDonationUsd (heuristic / estimated).
   */
  static async getDonationSummary(req: Request, res: Response) {
    try {
      const cacheKey = 'donation-summary';
      const now = Date.now();
      const cached = cache.get(cacheKey);
      if (cached && now - cached.timestamp < CACHE_TTL_MS) {
        return res.json(cached.data);
      }

      const events = await prisma.event.findMany({
        where: { eventType: NATION_EVENT_TYPES.POSSIBLE_DONATION },
        select: {
          allianceId: true,
          nationId: true,
          createdAt: true,
          metadata: true,
          alliance: { select: { id: true, name: true } },
          nation: { select: { id: true, rulerName: true, nationName: true } },
        },
        orderBy: { createdAt: 'asc' },
      });

      const monthsSet = new Set<string>();
      const allianceMap = new Map<string, AllianceDonationSummary>();
      const nationMaps = new Map<string, Map<number, NationDonationSummary>>();

      for (const event of events) {
        const metadata = event.metadata as Record<string, unknown> | null;
        const usd = typeof metadata?.suspectedDonationUsd === 'number' ? metadata.suspectedDonationUsd : 0;
        if (!usd) continue;

        const month = `${event.createdAt.getUTCFullYear()}-${String(event.createdAt.getUTCMonth() + 1).padStart(2, '0')}`;
        monthsSet.add(month);

        const allianceIdValue = event.allianceId;
        const allianceName =
          event.alliance?.name ||
          (typeof metadata?.allianceName === 'string' ? metadata.allianceName : null) ||
          (allianceIdValue ? `Alliance #${allianceIdValue}` : 'No Alliance');
        const key = allianceIdValue !== null ? String(allianceIdValue) : 'none';

        let summary = allianceMap.get(key);
        if (!summary) {
          summary = {
            allianceId: allianceIdValue,
            allianceName,
            counts: {},
            nations: [],
          };
          allianceMap.set(key, summary);
          nationMaps.set(key, new Map());
        }

        const tierKey = String(usd);
        const monthBucket = summary.counts[month] || {};
        monthBucket[tierKey] = (monthBucket[tierKey] || 0) + 1;
        summary.counts[month] = monthBucket;

        if (event.nationId !== null) {
          const nationMap = nationMaps.get(key)!;
          let nation = nationMap.get(event.nationId);
          if (!nation) {
            const rulerName =
              event.nation?.rulerName ||
              (typeof metadata?.rulerName === 'string' ? metadata.rulerName : null) ||
              'Unknown Ruler';
            const nationName =
              event.nation?.nationName ||
              (typeof metadata?.nationName === 'string' ? metadata.nationName : null) ||
              `Nation #${event.nationId}`;
            nation = {
              nationId: event.nationId,
              rulerName,
              nationName,
              counts: {},
              deltas: {},
            };
            nationMap.set(event.nationId, nation);
          }
          const nationMonthBucket = nation.counts[month] || {};
          nationMonthBucket[tierKey] = (nationMonthBucket[tierKey] || 0) + 1;
          nation.counts[month] = nationMonthBucket;

          const dInfra =
            typeof metadata?.deltaInfrastructure === 'number' ? metadata.deltaInfrastructure : 0;
          const dLand = typeof metadata?.deltaLand === 'number' ? metadata.deltaLand : 0;
          const dTech =
            typeof metadata?.deltaTechnology === 'number' ? metadata.deltaTechnology : 0;
          const monthDeltas = nation.deltas[month] || {};
          const tierDeltas = monthDeltas[tierKey] || { infra: 0, land: 0, tech: 0 };
          tierDeltas.infra += dInfra;
          tierDeltas.land += dLand;
          tierDeltas.tech += dTech;
          monthDeltas[tierKey] = tierDeltas;
          nation.deltas[month] = monthDeltas;
        }
      }

      for (const [key, summary] of allianceMap.entries()) {
        const nationMap = nationMaps.get(key);
        if (nationMap) {
          summary.nations = Array.from(nationMap.values());
        }
      }

      const months = Array.from(monthsSet).sort().reverse();
      const tiers = DONATION_TIERS.map((t) => t.usd);
      const alliances = Array.from(allianceMap.values()).sort((a, b) => {
        const sum = (s: AllianceDonationSummary) =>
          Object.values(s.counts).reduce(
            (acc, monthBucket) =>
              acc +
              Object.entries(monthBucket).reduce(
                (a2, [tier, count]) => a2 + parseInt(tier, 10) * count,
                0
              ),
            0
          );
        return sum(b) - sum(a);
      });

      const response: DonationSummaryResponse = {
        success: true,
        months,
        tiers,
        alliances,
      };

      cache.set(cacheKey, { data: response, timestamp: now });
      res.json(response);
    } catch (error: any) {
      console.error('Error fetching donation summary:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch donation summary',
      });
    }
  }
}
