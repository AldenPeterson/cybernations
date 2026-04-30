import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiCallWithErrorHandling, API_ENDPOINTS } from '../utils/api';
import TableContainer from '../components/TableContainer';

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
  deltas: Record<string, Record<string, DeltaBucket>>;
}

interface AllianceDonationSummary {
  allianceId: number | null;
  allianceName: string;
  counts: Record<string, Record<string, number>>;
  nations: NationDonationSummary[];
}

interface DonationSummaryResponse {
  success: boolean;
  months: string[];
  tiers: number[];
  alliances: AllianceDonationSummary[];
}

interface MonthBucket {
  usd: number;
  count: number;
}

interface RolledNation {
  nationId: number;
  rulerName: string;
  nationName: string;
  totalUsd: number;
  totalCount: number;
  byMonth: Record<string, MonthBucket>;
  source: NationDonationSummary;
}

interface RolledAlliance {
  allianceId: number | null;
  allianceName: string;
  totalUsd: number;
  totalCount: number;
  byMonth: Record<string, MonthBucket>;
  nations: RolledNation[];
  source: AllianceDonationSummary;
}

interface RolledTotals {
  usd: number;
  count: number;
  byMonth: Record<string, MonthBucket>;
}

type SortColumn = 'alliance' | 'totalUsd' | 'totalCount' | string;

interface TierBreakdown {
  tier: number;
  count: number;
  usd: number;
}

// Each nation can donate at most once per month, so per-nation context is a single donation.
interface NationDonation {
  nationId: number;
  nationName: string;
  rulerName: string;
  tier: number;
  deltas: DeltaBucket;
}

interface AlliancePopoverContent {
  scope: 'alliance';
  title: string;
  month: string;
  monthLabel: string;
  totalUsd: number;
  contributingNations: number;
  tiers: TierBreakdown[]; // tier mix across nations
  deltas: DeltaBucket;
  nations: NationDonation[];
}

interface NationPopoverContent {
  scope: 'nation';
  title: string;
  subtitle: string;
  monthLabel: string;
  nationId: number;
  tier: number;
  deltas: DeltaBucket;
}

type PopoverContent = AlliancePopoverContent | NationPopoverContent;

interface PopoverState {
  content: PopoverContent;
  anchorRect: { top: number; bottom: number; left: number; right: number };
  locked: boolean;
}

const DEFAULT_MIN_TIER = 20;

const buildTierBreakdown = (
  tierCounts: Record<string, number> | undefined,
  selectedTiers: Set<number>
): { tiers: TierBreakdown[]; totalUsd: number; totalCount: number } => {
  if (!tierCounts) return { tiers: [], totalUsd: 0, totalCount: 0 };
  const tiers: TierBreakdown[] = [];
  let totalUsd = 0;
  let totalCount = 0;
  for (const [tierKey, count] of Object.entries(tierCounts)) {
    const tier = parseInt(tierKey, 10);
    if (!selectedTiers.has(tier)) continue;
    const usd = tier * count;
    tiers.push({ tier, count, usd });
    totalUsd += usd;
    totalCount += count;
  }
  tiers.sort((a, b) => b.tier - a.tier);
  return { tiers, totalUsd, totalCount };
};

const sumDeltasForMonth = (
  deltas: Record<string, DeltaBucket> | undefined,
  selectedTiers: Set<number>
): DeltaBucket => {
  const result: DeltaBucket = { infra: 0, land: 0, tech: 0 };
  if (!deltas) return result;
  for (const [tierKey, d] of Object.entries(deltas)) {
    const tier = parseInt(tierKey, 10);
    if (!selectedTiers.has(tier)) continue;
    result.infra += d.infra;
    result.land += d.land;
    result.tech += d.tech;
  }
  return result;
};

const formatStatGain = (value: number): string =>
  value.toLocaleString('en-US', { maximumFractionDigits: 0 });

const POPOVER_WIDTH = 340;
const POPOVER_MAX_HEIGHT = 400;

const computePopoverPosition = (
  rect: { top: number; bottom: number; left: number; right: number }
): { top: number; left: number } => {
  const margin = 8;
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  const spaceBelow = viewportH - rect.bottom;
  const spaceAbove = rect.top;
  const top =
    spaceBelow >= POPOVER_MAX_HEIGHT + margin || spaceBelow >= spaceAbove
      ? rect.bottom + margin
      : Math.max(margin, rect.top - POPOVER_MAX_HEIGHT - margin);

  // Right-align with cell, then clamp to viewport.
  let left = rect.right - POPOVER_WIDTH;
  if (left < margin) left = margin;
  if (left + POPOVER_WIDTH > viewportW - margin) {
    left = Math.max(margin, viewportW - POPOVER_WIDTH - margin);
  }
  return { top, left };
};

const formatUsd = (value: number): string =>
  `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const formatMonthLabel = (month: string): string => {
  const [year, m] = month.split('-');
  const date = new Date(Date.UTC(parseInt(year, 10), parseInt(m, 10) - 1, 1));
  return date.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
};

const rollupCounts = (
  source: Record<string, Record<string, number>>,
  selectedTiers: Set<number>
): { totalUsd: number; totalCount: number; byMonth: Record<string, MonthBucket> } => {
  let totalUsd = 0;
  let totalCount = 0;
  const byMonth: Record<string, MonthBucket> = {};
  for (const [month, tierCounts] of Object.entries(source)) {
    let mUsd = 0;
    let mCount = 0;
    for (const [tierKey, count] of Object.entries(tierCounts)) {
      const tier = parseInt(tierKey, 10);
      if (!selectedTiers.has(tier)) continue;
      mUsd += tier * count;
      mCount += count;
    }
    if (mCount > 0) {
      byMonth[month] = { usd: mUsd, count: mCount };
      totalUsd += mUsd;
      totalCount += mCount;
    }
  }
  return { totalUsd, totalCount, byMonth };
};

const DonationsPage: React.FC = () => {
  const [data, setData] = useState<DonationSummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>('totalUsd');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedTiers, setSelectedTiers] = useState<Set<number> | null>(null);
  const [expandedAlliances, setExpandedAlliances] = useState<Set<string>>(new Set());
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const hoverOpenTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const closePopover = useCallback(() => {
    setPopover(null);
  }, []);

  const cancelTimers = useCallback(() => {
    if (hoverOpenTimerRef.current !== null) {
      window.clearTimeout(hoverOpenTimerRef.current);
      hoverOpenTimerRef.current = null;
    }
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      setPopover((prev) => (prev && !prev.locked ? null : prev));
      closeTimerRef.current = null;
    }, 250);
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!popover) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePopover();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [popover, closePopover]);

  useEffect(() => {
    if (!popover?.locked) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (popoverRef.current && popoverRef.current.contains(e.target as Node)) return;
      closePopover();
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [popover?.locked, closePopover]);

  useEffect(() => () => cancelTimers(), [cancelTimers]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response: DonationSummaryResponse = await apiCallWithErrorHandling(
          API_ENDPOINTS.donationSummary
        );
        if (!cancelled) {
          if (response.success) {
            setData(response);
          } else {
            setError('Failed to load donation summary');
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load donation summary');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const effectiveTiers: Set<number> = useMemo(() => {
    if (selectedTiers) return selectedTiers;
    if (!data) return new Set();
    return new Set(data.tiers.filter((t) => t >= DEFAULT_MIN_TIER));
  }, [selectedTiers, data]);

  const toggleTier = (tier: number) => {
    setSelectedTiers((prev) => {
      const base = prev ?? new Set((data?.tiers ?? []).filter((t) => t >= DEFAULT_MIN_TIER));
      const next = new Set(base);
      if (next.has(tier)) next.delete(tier);
      else next.add(tier);
      return next;
    });
  };

  const toggleAllianceExpanded = useCallback((key: string) => {
    setExpandedAlliances((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const buildAlliancePopover = useCallback(
    (alliance: AllianceDonationSummary, month: string, tiers: Set<number>): AlliancePopoverContent | null => {
      const tierBreakdown = buildTierBreakdown(alliance.counts[month], tiers);
      if (tierBreakdown.totalCount === 0) return null;

      const allianceDeltas: DeltaBucket = { infra: 0, land: 0, tech: 0 };
      const nations: NationDonation[] = [];
      for (const nation of alliance.nations) {
        const nb = buildTierBreakdown(nation.counts[month], tiers);
        if (nb.totalCount === 0) continue;
        const nd = sumDeltasForMonth(nation.deltas[month], tiers);
        allianceDeltas.infra += nd.infra;
        allianceDeltas.land += nd.land;
        allianceDeltas.tech += nd.tech;
        // One donation per month per nation: take the (single) tier from the breakdown.
        const tier = nb.tiers[0]?.tier ?? 0;
        nations.push({
          nationId: nation.nationId,
          nationName: nation.nationName,
          rulerName: nation.rulerName,
          tier,
          deltas: nd,
        });
      }
      nations.sort((a, b) => b.tier - a.tier || a.nationName.localeCompare(b.nationName));

      return {
        scope: 'alliance',
        title: alliance.allianceName,
        month,
        monthLabel: formatMonthLabel(month),
        totalUsd: tierBreakdown.totalUsd,
        contributingNations: nations.length,
        tiers: tierBreakdown.tiers,
        deltas: allianceDeltas,
        nations,
      };
    },
    []
  );

  const buildNationPopover = useCallback(
    (
      alliance: AllianceDonationSummary,
      nation: NationDonationSummary,
      month: string,
      tiers: Set<number>
    ): NationPopoverContent | null => {
      const tb = buildTierBreakdown(nation.counts[month], tiers);
      if (tb.totalCount === 0) return null;
      const tier = tb.tiers[0]?.tier ?? 0;
      return {
        scope: 'nation',
        title: nation.nationName,
        subtitle: `${nation.rulerName} • ${alliance.allianceName}`,
        monthLabel: formatMonthLabel(month),
        nationId: nation.nationId,
        tier,
        deltas: sumDeltasForMonth(nation.deltas[month], tiers),
      };
    },
    []
  );

  const openPopoverFromEvent = useCallback(
    (e: React.MouseEvent<HTMLElement>, content: PopoverContent | null, locked: boolean) => {
      if (!content) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const anchorRect = {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
      };
      cancelTimers();
      setPopover({ content, anchorRect, locked });
    },
    [cancelTimers]
  );

  const handleCellHoverEnter = useCallback(
    (e: React.MouseEvent<HTMLElement>, content: PopoverContent | null) => {
      if (!content) return;
      cancelClose();
      // If a locked popover is already open, don't replace it on hover.
      if (popover?.locked) return;
      const target = e.currentTarget;
      const rect = target.getBoundingClientRect();
      const anchorRect = {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
      };
      if (hoverOpenTimerRef.current !== null) window.clearTimeout(hoverOpenTimerRef.current);
      hoverOpenTimerRef.current = window.setTimeout(() => {
        setPopover({ content, anchorRect, locked: false });
        hoverOpenTimerRef.current = null;
      }, 120);
    },
    [popover?.locked, cancelClose]
  );

  const handleCellHoverLeave = useCallback(() => {
    if (hoverOpenTimerRef.current !== null) {
      window.clearTimeout(hoverOpenTimerRef.current);
      hoverOpenTimerRef.current = null;
    }
    scheduleClose();
  }, [scheduleClose]);

  const { rolledAlliances, totals } = useMemo<{
    rolledAlliances: RolledAlliance[];
    totals: RolledTotals;
  }>(() => {
    if (!data) {
      return { rolledAlliances: [], totals: { usd: 0, count: 0, byMonth: {} } };
    }
    const rolled: RolledAlliance[] = [];
    const totals: RolledTotals = { usd: 0, count: 0, byMonth: {} };

    for (const alliance of data.alliances) {
      const allianceRollup = rollupCounts(alliance.counts, effectiveTiers);
      if (allianceRollup.totalCount === 0) continue;

      const nations: RolledNation[] = [];
      for (const nation of alliance.nations) {
        const nr = rollupCounts(nation.counts, effectiveTiers);
        if (nr.totalCount === 0) continue;
        nations.push({
          nationId: nation.nationId,
          rulerName: nation.rulerName,
          nationName: nation.nationName,
          totalUsd: nr.totalUsd,
          totalCount: nr.totalCount,
          byMonth: nr.byMonth,
          source: nation,
        });
      }
      nations.sort((a, b) => b.totalUsd - a.totalUsd);

      rolled.push({
        allianceId: alliance.allianceId,
        allianceName: alliance.allianceName,
        totalUsd: allianceRollup.totalUsd,
        totalCount: allianceRollup.totalCount,
        byMonth: allianceRollup.byMonth,
        nations,
        source: alliance,
      });

      totals.usd += allianceRollup.totalUsd;
      totals.count += allianceRollup.totalCount;
      for (const [month, bucket] of Object.entries(allianceRollup.byMonth)) {
        const agg = totals.byMonth[month] || { usd: 0, count: 0 };
        agg.usd += bucket.usd;
        agg.count += bucket.count;
        totals.byMonth[month] = agg;
      }
    }
    return { rolledAlliances: rolled, totals };
  }, [data, effectiveTiers]);

  const sortedAlliances = useMemo(() => {
    const list = [...rolledAlliances];
    list.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortColumn === 'alliance') {
        av = a.allianceName.toLowerCase();
        bv = b.allianceName.toLowerCase();
      } else if (sortColumn === 'totalUsd') {
        av = a.totalUsd;
        bv = b.totalUsd;
      } else if (sortColumn === 'totalCount') {
        av = a.totalCount;
        bv = b.totalCount;
      } else {
        av = a.byMonth[sortColumn]?.usd ?? 0;
        bv = b.byMonth[sortColumn]?.usd ?? 0;
      }
      if (av < bv) return sortDirection === 'asc' ? -1 : 1;
      if (av > bv) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [rolledAlliances, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection(column === 'alliance' ? 'asc' : 'desc');
    }
  };

  const sortIndicator = (column: SortColumn) => {
    if (sortColumn !== column) return '';
    return sortDirection === 'asc' ? ' ▲' : ' ▼';
  };

  const allianceKey = (a: RolledAlliance) => (a.allianceId !== null ? String(a.allianceId) : 'none');

  return (
    <TableContainer>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-200 mb-2">Estimated Donations</h1>
        <div className="bg-amber-900/30 border border-amber-700/60 rounded-md p-3 mb-3">
          <p className="text-sm text-amber-100">
            <span className="font-semibold">Estimates only.</span> Figures are derived from a heuristic that
            flags one-tick infrastructure / land / technology gains matching known PayPal donation tiers
            ($5, $10, $15, $20, $25, $30). Real donations may go undetected (when stats grow more slowly than
            tier minimums) and stacked aid can occasionally trigger false positives. Treat totals as a lower
            bound, not a precise audit.
          </p>
        </div>

        {data && data.tiers.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <span className="text-sm font-medium text-gray-300">Include tiers:</span>
            {data.tiers.map((tier) => {
              const checked = effectiveTiers.has(tier);
              return (
                <label
                  key={tier}
                  className="inline-flex items-center gap-1.5 text-sm text-gray-200 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleTier(tier)}
                    className="h-4 w-4 rounded border-gray-600 bg-gray-800 accent-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                  <span>${tier}</span>
                </label>
              );
            })}
          </div>
        )}
        <div className="text-xs text-gray-400 italic mt-1">
          <span className="hidden md:inline">
            Tip: hover any month cell for the donation tier and stat gains. Click to keep the popover open.
          </span>
          <span className="md:hidden">
            Tip: tap any month cell to see the donation tier and stat gains.
          </span>
        </div>
      </div>

      {loading && <div className="text-center py-8 text-gray-400">Loading donation summary...</div>}
      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-200 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          <div className="mb-4 flex flex-wrap gap-4 text-sm text-gray-300">
            <div>
              <span className="text-gray-500">Tracked alliances:</span>{' '}
              <span className="font-semibold text-gray-100">{rolledAlliances.length}</span>
            </div>
            <div>
              <span className="text-gray-500">Months covered:</span>{' '}
              <span className="font-semibold text-gray-100">{data.months.length}</span>
            </div>
            <div>
              <span className="text-gray-500">Total estimated:</span>{' '}
              <span className="font-semibold text-emerald-400">{formatUsd(totals.usd)}</span>
            </div>
            <div>
              <span className="text-gray-500">Donation events:</span>{' '}
              <span className="font-semibold text-gray-100">{totals.count.toLocaleString()}</span>
            </div>
          </div>

          {rolledAlliances.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              {effectiveTiers.size === 0
                ? 'Select at least one tier to see results.'
                : 'No donation events match the selected tiers.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-700 text-sm bg-gray-800">
                <thead>
                  <tr className="bg-gray-700">
                    <th className="p-3 border border-gray-600 text-center text-white font-bold w-10"></th>
                    <th
                      className="p-3 border border-gray-600 text-left text-white font-bold cursor-pointer hover:bg-gray-600"
                      onClick={() => handleSort('alliance')}
                    >
                      Alliance{sortIndicator('alliance')}
                    </th>
                    <th
                      className="p-3 border border-gray-600 text-right text-white font-bold cursor-pointer hover:bg-gray-600"
                      onClick={() => handleSort('totalUsd')}
                    >
                      Total (Est.){sortIndicator('totalUsd')}
                    </th>
                    <th
                      className="p-3 border border-gray-600 text-right text-white font-bold cursor-pointer hover:bg-gray-600"
                      onClick={() => handleSort('totalCount')}
                    >
                      Events{sortIndicator('totalCount')}
                    </th>
                    {data.months.map((month) => (
                      <th
                        key={month}
                        className="p-3 border border-gray-600 text-right text-white font-bold cursor-pointer hover:bg-gray-600 whitespace-nowrap"
                        onClick={() => handleSort(month)}
                      >
                        {formatMonthLabel(month)}
                        {sortIndicator(month)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-gray-900/60 font-semibold">
                    <td className="p-2 border border-gray-700"></td>
                    <td className="p-2 border border-gray-700 text-gray-100">
                      All alliances
                    </td>
                    <td className="p-2 border border-gray-700 text-right text-emerald-400">
                      {formatUsd(totals.usd)}
                    </td>
                    <td className="p-2 border border-gray-700 text-right text-gray-200">
                      {totals.count.toLocaleString()}
                    </td>
                    {data.months.map((month) => {
                      const bucket = totals.byMonth[month];
                      return (
                        <td key={month} className="p-2 border border-gray-700 text-right text-gray-200">
                          {bucket ? formatUsd(bucket.usd) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                  {sortedAlliances.map((alliance) => {
                    const key = allianceKey(alliance);
                    const isExpanded = expandedAlliances.has(key);
                    const hasNations = alliance.nations.length > 0;
                    return (
                      <React.Fragment key={key}>
                        <tr
                          className="bg-gray-800 hover:bg-gray-700 cursor-pointer"
                          onClick={() => hasNations && toggleAllianceExpanded(key)}
                        >
                          <td className="p-2 border border-gray-700 text-center text-gray-400">
                            {hasNations && (
                              <span className="text-xs">{isExpanded ? '▼' : '▶'}</span>
                            )}
                          </td>
                          <td className="p-2 border border-gray-700 font-bold text-gray-200">
                            {alliance.allianceName}
                          </td>
                          <td className="p-2 border border-gray-700 text-right font-semibold text-emerald-400">
                            {formatUsd(alliance.totalUsd)}
                          </td>
                          <td className="p-2 border border-gray-700 text-right text-gray-200">
                            {alliance.totalCount.toLocaleString()}
                          </td>
                          {data.months.map((month) => {
                            const bucket = alliance.byMonth[month];
                            const clickable = !!bucket;
                            const popoverContent = clickable
                              ? buildAlliancePopover(alliance.source, month, effectiveTiers)
                              : null;
                            return (
                              <td
                                key={month}
                                className={`p-2 border border-gray-700 text-right text-gray-200 ${
                                  clickable ? 'cursor-pointer hover:bg-gray-700/70 hover:text-white' : ''
                                }`}
                                onMouseEnter={(e) => clickable && handleCellHoverEnter(e, popoverContent)}
                                onMouseLeave={() => clickable && handleCellHoverLeave()}
                                onClick={(e) => {
                                  if (!clickable) return;
                                  e.stopPropagation();
                                  openPopoverFromEvent(e, popoverContent, true);
                                }}
                              >
                                {bucket ? (
                                  <span className="border-b border-dotted border-gray-500">
                                    {formatUsd(bucket.usd)}
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                            );
                          })}
                        </tr>
                        {isExpanded && alliance.nations.map((nation) => (
                          <tr
                            key={`${key}-${nation.nationId}`}
                            className="bg-gray-900/30 hover:bg-gray-800/40"
                          >
                            <td className="p-2 border border-gray-700 text-center">
                              <span className="text-gray-500 ml-2 text-xs">└</span>
                            </td>
                            <td className="p-2 border border-gray-700 text-left">
                              <div className="min-w-0 pl-4">
                                <a
                                  href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${nation.nationId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary no-underline font-semibold hover:underline truncate block"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {nation.nationName}
                                </a>
                                <div className="text-xs text-gray-500 truncate">{nation.rulerName}</div>
                              </div>
                            </td>
                            <td className="p-2 border border-gray-700 text-right text-emerald-400/90">
                              {formatUsd(nation.totalUsd)}
                            </td>
                            <td className="p-2 border border-gray-700 text-right text-gray-300">
                              {nation.totalCount.toLocaleString()}
                            </td>
                            {data.months.map((month) => {
                              const bucket = nation.byMonth[month];
                              const clickable = !!bucket;
                              const popoverContent = clickable
                                ? buildNationPopover(alliance.source, nation.source, month, effectiveTiers)
                                : null;
                              return (
                                <td
                                  key={month}
                                  className={`p-2 border border-gray-700 text-right text-gray-300 ${
                                    clickable ? 'cursor-pointer hover:bg-gray-800/70 hover:text-white' : ''
                                  }`}
                                  onMouseEnter={(e) => clickable && handleCellHoverEnter(e, popoverContent)}
                                  onMouseLeave={() => clickable && handleCellHoverLeave()}
                                  onClick={(e) => {
                                    if (!clickable) return;
                                    e.stopPropagation();
                                    openPopoverFromEvent(e, popoverContent, true);
                                  }}
                                >
                                  {bucket ? (
                                    <span className="border-b border-dotted border-gray-500">
                                      {formatUsd(bucket.usd)}
                                    </span>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {popover && (() => {
        const pos = computePopoverPosition(popover.anchorRect);
        const c = popover.content;
        return (
          <div
            ref={popoverRef}
            className="fixed z-[2000] bg-gray-900 border border-gray-700 rounded-lg shadow-xl text-sm overflow-y-auto"
            style={{
              top: pos.top,
              left: pos.left,
              width: POPOVER_WIDTH,
              maxHeight: POPOVER_MAX_HEIGHT,
            }}
            onMouseEnter={cancelClose}
            onMouseLeave={popover.locked ? undefined : scheduleClose}
          >
            <div className="flex items-start justify-between gap-3 p-3 border-b border-gray-700">
              <div className="min-w-0">
                <div className="font-bold text-gray-100 truncate">{c.title}</div>
                <div className="text-[11px] text-gray-400 truncate">
                  {c.scope === 'nation'
                    ? `${c.subtitle} • ${c.monthLabel}`
                    : `${c.monthLabel} • ${c.contributingNations} nation${c.contributingNations === 1 ? '' : 's'}`}
                </div>
              </div>
              {popover.locked && (
                <button
                  type="button"
                  onClick={closePopover}
                  className="text-gray-400 hover:text-white text-xl leading-none px-1.5 -mt-0.5"
                  aria-label="Close"
                >
                  ×
                </button>
              )}
            </div>

            <div className="p-3 space-y-3">
              {c.scope === 'nation' ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-emerald-400 font-bold text-base">${c.tier}</span>
                    <span className="text-gray-500 text-xs">tier (estimated)</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-gray-800/60 border border-gray-700 rounded p-2 text-center">
                      <div className="text-[10px] uppercase tracking-wide text-gray-500">Infra</div>
                      <div className="text-emerald-400 font-semibold">+{formatStatGain(c.deltas.infra)}</div>
                    </div>
                    <div className="bg-gray-800/60 border border-gray-700 rounded p-2 text-center">
                      <div className="text-[10px] uppercase tracking-wide text-gray-500">Land</div>
                      <div className="text-emerald-400 font-semibold">+{formatStatGain(c.deltas.land)}</div>
                    </div>
                    <div className="bg-gray-800/60 border border-gray-700 rounded p-2 text-center">
                      <div className="text-[10px] uppercase tracking-wide text-gray-500">Tech</div>
                      <div className="text-emerald-400 font-semibold">+{formatStatGain(c.deltas.tech)}</div>
                    </div>
                  </div>
                  <a
                    href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${c.nationId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-primary no-underline text-xs hover:underline"
                  >
                    View nation →
                  </a>
                </>
              ) : (
                <>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-emerald-400 font-bold text-base">{formatUsd(c.totalUsd)}</span>
                    <span className="text-xs text-gray-400">
                      {c.tiers
                        .map((t) => `$${t.tier}×${t.count}`)
                        .join(' · ')}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-gray-800/60 border border-gray-700 rounded p-2 text-center">
                      <div className="text-[10px] uppercase tracking-wide text-gray-500">Infra</div>
                      <div className="text-emerald-400 font-semibold">+{formatStatGain(c.deltas.infra)}</div>
                    </div>
                    <div className="bg-gray-800/60 border border-gray-700 rounded p-2 text-center">
                      <div className="text-[10px] uppercase tracking-wide text-gray-500">Land</div>
                      <div className="text-emerald-400 font-semibold">+{formatStatGain(c.deltas.land)}</div>
                    </div>
                    <div className="bg-gray-800/60 border border-gray-700 rounded p-2 text-center">
                      <div className="text-[10px] uppercase tracking-wide text-gray-500">Tech</div>
                      <div className="text-emerald-400 font-semibold">+{formatStatGain(c.deltas.tech)}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">
                      Donations
                    </div>
                    <div className="space-y-1">
                      {c.nations.map((n) => (
                        <div
                          key={n.nationId}
                          className="flex items-baseline justify-between gap-2 bg-gray-800/40 border border-gray-700/60 rounded px-2 py-1.5"
                        >
                          <div className="min-w-0 flex-1">
                            <a
                              href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${n.nationId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary no-underline font-medium hover:underline truncate block text-xs"
                            >
                              {n.nationName}
                            </a>
                            <div className="text-[10px] text-gray-500 truncate">{n.rulerName}</div>
                          </div>
                          <span className="text-emerald-400 font-semibold whitespace-nowrap text-xs">
                            ${n.tier}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </TableContainer>
  );
};

export default DonationsPage;
