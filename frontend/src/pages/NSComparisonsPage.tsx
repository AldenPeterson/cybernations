import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiCall, API_ENDPOINTS } from '../utils/api';
import { useAlliances } from '../contexts/AlliancesContext';
import PageContainer from '../components/PageContainer';

// Shared labels for coalitions
const BLUE_LABEL = 'Blue';
const RED_LABEL = 'Red';

interface Alliance {
  id: number;
  name: string;
  nationCount: number;
}

interface NationStat {
  nation_id: number;
  ruler_name: string;
  nation_name: string;
  strength: number;
  technology: number;
  in_war_mode: boolean;
}

type GroupKey = 'A' | 'B';

const BUCKET_BOUNDS = [
  0,
  10_000,
  25_000,
  50_000,
  100_000,
  200_000,
  300_000,
  500_000,
  1_000_000
];

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k`;
  return `${Math.round(n)}`;
}

function formatNumber(n: number): string {
  return Math.round(n).toLocaleString();
}

function formatBucketLabel(lower: number, upper: number): string {
  return `${formatCompact(lower)}-${formatCompact(upper)}`;
}

// Tech buckets
const TECH_BUCKET_BOUNDS = [
  0,
  1_000,
  5_000,
  10_000,
  15_000,
  20_000,
  25_000,
  30_000,
  40_000,
  60_000,
  100_000,
  Infinity
];

function formatTechBucketLabel(lower: number, upper: number): string {
  if (!isFinite(upper)) return `${formatCompact(lower)}+`;
  return `${formatCompact(lower)}-${formatCompact(upper)}`;
}

function parseIdList(s: string | null): number[] {
  if (!s) return [];
  return s
    .split(',')
    .map(p => parseInt(p.trim(), 10))
    .filter(n => Number.isFinite(n) && n > 0);
}

interface SummaryStats {
  count: number;
  totalNS: number;
  avgNS: number;
  totalTech: number;
  avgTech: number;
  inWar: number;
}

function computeSummary(nations: NationStat[]): SummaryStats {
  const count = nations.length;
  let totalNS = 0;
  let totalTech = 0;
  let inWar = 0;
  for (const n of nations) {
    if (Number.isFinite(n.strength)) totalNS += n.strength;
    if (Number.isFinite(n.technology)) totalTech += n.technology;
    if (n.in_war_mode) inWar += 1;
  }
  return {
    count,
    totalNS,
    avgNS: count ? totalNS / count : 0,
    totalTech,
    avgTech: count ? totalTech / count : 0,
    inWar,
  };
}

const NSComparisonsPage: React.FC = () => {
  const { alliances: allAlliances } = useAlliances();
  const [searchParams, setSearchParams] = useSearchParams();
  const [nationsByAlliance, setNationsByAlliance] = useState<Record<number, NationStat[]>>({});
  const [search, setSearch] = useState('');
  const [showSmallAlliances, setShowSmallAlliances] = useState(false);
  const [logScale, setLogScale] = useState(false);
  const [hoverPoint, setHoverPoint] = useState<{
    side: GroupKey;
    nation: NationStat;
    allianceId: number;
    allianceName: string;
    cx: number;
    cy: number;
  } | null>(null);

  // Selection lives in the URL so it's shareable.
  const selectedAlliances = useMemo<{ [key in GroupKey]: number[] }>(() => ({
    A: parseIdList(searchParams.get('blue')),
    B: parseIdList(searchParams.get('red')),
  }), [searchParams]);

  const updateSelection = (next: { [key in GroupKey]: number[] }) => {
    const params = new URLSearchParams(searchParams);
    if (next.A.length) params.set('blue', next.A.join(','));
    else params.delete('blue');
    if (next.B.length) params.set('red', next.B.join(','));
    else params.delete('red');
    setSearchParams(params, { replace: true });
  };

  // Build a quick lookup for alliance metadata.
  const allianceById = useMemo(() => {
    const map = new Map<number, Alliance>();
    for (const a of allAlliances) map.set(a.id, a);
    return map;
  }, [allAlliances]);

  // Filter and sort alliances for the selector
  const alliances = useMemo(() => {
    const minNations = showSmallAlliances ? 1 : 10;
    const q = search.trim().toLowerCase();
    return allAlliances
      .filter((a: Alliance) => a.name && a.name.trim() !== '' && a.nationCount >= minNations)
      .filter((a: Alliance) => !q || a.name.toLowerCase().includes(q))
      .sort((a: Alliance, b: Alliance) => b.nationCount - a.nationCount);
  }, [allAlliances, search, showSmallAlliances]);

  // Selected alliances always visible regardless of filter
  const selectedSet = useMemo(() => new Set([...selectedAlliances.A, ...selectedAlliances.B]), [selectedAlliances]);
  const visibleAlliances = useMemo(() => {
    const visible = new Set(alliances.map(a => a.id));
    const extra: Alliance[] = [];
    for (const id of selectedSet) {
      if (!visible.has(id)) {
        const a = allianceById.get(id);
        if (a) extra.push(a);
      }
    }
    return [...extra, ...alliances];
  }, [alliances, selectedSet, allianceById]);

  useEffect(() => {
    const allIds = [...selectedAlliances.A, ...selectedAlliances.B];
    const idsToFetch = allIds.filter((id) => !(id in nationsByAlliance));
    if (idsToFetch.length === 0) return;

    const fetchNations = async () => {
      const res = await apiCall(API_ENDPOINTS.allianceNationStats(idsToFetch));
      const data = await res.json();
      if (data && data.success && data.alliances) {
        setNationsByAlliance(prev => {
          const next = { ...prev };
          for (const id of idsToFetch) {
            next[id] = data.alliances[id] || [];
          }
          return next;
        });
      }
    };

    fetchNations().catch(() => {});
  }, [selectedAlliances, nationsByAlliance]);

  // Combined nations per side, with alliance context attached.
  const sideNations = useMemo(() => {
    const collect = (ids: number[]) => {
      const result: Array<NationStat & { alliance_id: number; alliance_name: string }> = [];
      for (const id of ids) {
        const arr = nationsByAlliance[id] || [];
        const allianceName = allianceById.get(id)?.name ?? `Alliance ${id}`;
        for (const n of arr) {
          result.push({ ...n, alliance_id: id, alliance_name: allianceName });
        }
      }
      return result;
    };
    return {
      A: collect(selectedAlliances.A),
      B: collect(selectedAlliances.B),
    };
  }, [selectedAlliances, nationsByAlliance, allianceById]);

  const summary = useMemo(() => ({
    A: computeSummary(sideNations.A),
    B: computeSummary(sideNations.B),
  }), [sideNations]);

  const buckets = useMemo(() => {
    return BUCKET_BOUNDS.slice(0, -1).map((lower, i) => {
      const upper = BUCKET_BOUNDS[i + 1];
      return { lower, upper, label: formatBucketLabel(lower, upper) };
    });
  }, []);

  const counts = useMemo(() => {
    const sumCountsForNations = (nations: NationStat[]) => {
      const result = new Array(buckets.length).fill(0) as number[];
      for (const nation of nations) {
        const ns = nation.strength;
        if (ns == null || !Number.isFinite(ns)) continue;
        const idx = buckets.findIndex(b => ns >= b.lower && ns < b.upper);
        if (idx >= 0) result[idx] += 1;
      }
      return result;
    };
    return {
      A: sumCountsForNations(sideNations.A),
      B: sumCountsForNations(sideNations.B),
    };
  }, [buckets, sideNations]);

  const maxCount = useMemo(() => {
    const all = [...counts.A, ...counts.B];
    const max = all.length ? Math.max(...all) : 0;
    return Math.max(1, max);
  }, [counts]);

  const techBuckets = useMemo(() => {
    return TECH_BUCKET_BOUNDS.slice(0, -1).map((lower, i) => {
      const upper = TECH_BUCKET_BOUNDS[i + 1];
      return { lower, upper, label: formatTechBucketLabel(lower, upper) };
    });
  }, []);

  const countsTech = useMemo(() => {
    const sumCountsForNations = (nations: NationStat[]) => {
      const result = new Array(techBuckets.length).fill(0) as number[];
      for (const nation of nations) {
        const tech = nation.technology;
        if (tech == null || !Number.isFinite(tech)) continue;
        const idx = techBuckets.findIndex(b => tech >= b.lower && tech < b.upper);
        if (idx >= 0) result[idx] += 1;
      }
      return result;
    };
    return {
      A: sumCountsForNations(sideNations.A),
      B: sumCountsForNations(sideNations.B),
    };
  }, [techBuckets, sideNations]);

  const maxCountTech = useMemo(() => {
    const all = [...countsTech.A, ...countsTech.B];
    const max = all.length ? Math.max(...all) : 0;
    return Math.max(1, max);
  }, [countsTech]);

  // Scatterplot data with full nation context for tooltips
  const scatterPoints = useMemo(() => {
    const all = [...sideNations.A.map(n => ({ ...n, side: 'A' as GroupKey })), ...sideNations.B.map(n => ({ ...n, side: 'B' as GroupKey }))];
    let xMax = 1;
    let yMax = 1;
    for (const p of all) {
      if (p.strength > xMax) xMax = p.strength;
      if (p.technology > yMax) yMax = p.technology;
    }
    return { points: all, xMax, yMax };
  }, [sideNations]);

  const toggleSelection = (allianceId: number, side: GroupKey, checked: boolean) => {
    const other: GroupKey = side === 'A' ? 'B' : 'A';
    const next = {
      [side]: checked
        ? [...selectedAlliances[side].filter(id => id !== allianceId), allianceId]
        : selectedAlliances[side].filter(id => id !== allianceId),
      [other]: selectedAlliances[other].filter(id => id !== allianceId),
    } as { [key in GroupKey]: number[] };
    updateSelection(next);
  };

  const clearSide = (side: GroupKey) => {
    const other: GroupKey = side === 'A' ? 'B' : 'A';
    updateSelection({ [side]: [], [other]: selectedAlliances[other] } as { [key in GroupKey]: number[] });
  };

  const clearAll = () => updateSelection({ A: [], B: [] });

  const swapSides = () => updateSelection({ A: selectedAlliances.B, B: selectedAlliances.A });

  return (
    <PageContainer className="p-6 text-base">
      {/* Summary panel */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="m-0 text-gray-200 text-lg">Coalition Summary</h3>
          <div className="flex gap-2">
            <button
              className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-40"
              onClick={swapSides}
              disabled={selectedAlliances.A.length === 0 && selectedAlliances.B.length === 0}
            >
              Swap Blue ↔ Red
            </button>
            <button
              className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-40"
              onClick={clearAll}
              disabled={selectedAlliances.A.length === 0 && selectedAlliances.B.length === 0}
            >
              Clear all
            </button>
          </div>
        </div>
        <SummaryTable summaryA={summary.A} summaryB={summary.B} />
      </div>

      {/* Coalition selector table */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-3.5 mb-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="m-0 text-gray-200 text-lg">Coalitions</h3>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="text"
              placeholder="Search alliances..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-2 py-1 rounded bg-gray-700 text-gray-200 placeholder-gray-400 border border-gray-600 text-sm w-48 focus:outline-none focus:border-coalition-blue"
            />
            <label className="flex items-center gap-1.5 text-gray-300 text-xs">
              <input
                type="checkbox"
                checked={showSmallAlliances}
                onChange={(e) => setShowSmallAlliances(e.target.checked)}
                className="accent-gray-400"
              />
              Show small alliances (&lt;10 nations)
            </label>
            <button
              className="text-xs px-2 py-1 rounded bg-gray-700 text-coalition-blue hover:bg-gray-600 disabled:opacity-40"
              onClick={() => clearSide('A')}
              disabled={selectedAlliances.A.length === 0}
            >
              Clear {BLUE_LABEL} ({selectedAlliances.A.length})
            </button>
            <button
              className="text-xs px-2 py-1 rounded bg-gray-700 text-coalition-red hover:bg-gray-600 disabled:opacity-40"
              onClick={() => clearSide('B')}
              disabled={selectedAlliances.B.length === 0}
            >
              Clear {RED_LABEL} ({selectedAlliances.B.length})
            </button>
          </div>
        </div>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full border-collapse text-sm leading-tight">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-700 text-gray-200">
                <th className="text-left px-2.5 py-1.5 border-b border-gray-600 font-semibold">Alliance</th>
                <th className="text-center px-2.5 py-1.5 border-b border-gray-600 font-semibold text-coalition-blue">{BLUE_LABEL}</th>
                <th className="text-center px-2.5 py-1.5 border-b border-gray-600 font-semibold text-coalition-red">{RED_LABEL}</th>
                <th className="text-right px-2.5 py-1.5 border-b border-gray-600 font-semibold">Nations</th>
              </tr>
            </thead>
            <tbody>
              {visibleAlliances.map((a, idx) => {
                const inA = selectedAlliances.A.includes(a.id);
                const inB = selectedAlliances.B.includes(a.id);
                const rowBg = inA
                  ? 'bg-coalition-blue/15'
                  : inB
                  ? 'bg-coalition-red/15'
                  : (idx % 2 === 0 ? 'bg-gray-800' : 'bg-gray-800/50');
                return (
                  <tr key={a.id} className={`${rowBg} hover:bg-gray-700 transition-colors`}>
                    <td className="px-2.5 py-1.5 border-b border-gray-700 align-middle text-gray-200">{a.name}</td>
                    <td className="px-2.5 py-1.5 border-b border-gray-700 text-center align-middle">
                      <input
                        type="checkbox"
                        checked={inA}
                        className="scale-90 m-0 accent-coalition-blue"
                        onChange={(e) => toggleSelection(a.id, 'A', e.target.checked)}
                      />
                    </td>
                    <td className="px-2.5 py-1.5 border-b border-gray-700 text-center align-middle">
                      <input
                        type="checkbox"
                        checked={inB}
                        className="scale-90 m-0 accent-coalition-red"
                        onChange={(e) => toggleSelection(a.id, 'B', e.target.checked)}
                      />
                    </td>
                    <td className="px-2.5 py-1.5 border-b border-gray-700 text-right text-gray-300 tabular-nums align-middle">{a.nationCount}</td>
                  </tr>
                );
              })}
              {visibleAlliances.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-2.5 py-6 text-center text-gray-400">
                    No alliances match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* NS Histogram */}
      <Histogram
        title="Nation Strength Distribution"
        buckets={buckets}
        nationsA={sideNations.A}
        nationsB={sideNations.B}
        countsA={counts.A}
        countsB={counts.B}
        maxCount={maxCount}
        bucketLabelHeader="NS Bucket"
        metricKey="strength"
        metricLabel="NS"
      />

      {/* Tech Histogram */}
      <Histogram
        title="Technology Distribution"
        buckets={techBuckets}
        nationsA={sideNations.A}
        nationsB={sideNations.B}
        countsA={countsTech.A}
        countsB={countsTech.B}
        maxCount={maxCountTech}
        bucketLabelHeader="Tech Bucket"
        metricKey="technology"
        metricLabel="Tech"
      />

      {/* Scatterplot */}
      <Scatterplot
        points={scatterPoints.points}
        xMax={scatterPoints.xMax}
        yMax={scatterPoints.yMax}
        logScale={logScale}
        onToggleLogScale={() => setLogScale(v => !v)}
        hoverPoint={hoverPoint}
        setHoverPoint={setHoverPoint}
      />
    </PageContainer>
  );
};

const SummaryTable: React.FC<{ summaryA: SummaryStats; summaryB: SummaryStats }> = ({ summaryA, summaryB }) => {
  const rows: { label: string; a: string; b: string; delta: string }[] = [
    {
      label: 'Nations',
      a: formatNumber(summaryA.count),
      b: formatNumber(summaryB.count),
      delta: formatDelta(summaryA.count - summaryB.count, formatNumber),
    },
    {
      label: 'Total NS',
      a: formatNumber(summaryA.totalNS),
      b: formatNumber(summaryB.totalNS),
      delta: formatDelta(summaryA.totalNS - summaryB.totalNS, formatNumber),
    },
    {
      label: 'Avg NS',
      a: formatNumber(summaryA.avgNS),
      b: formatNumber(summaryB.avgNS),
      delta: formatDelta(summaryA.avgNS - summaryB.avgNS, formatNumber),
    },
    {
      label: 'Total Tech',
      a: formatNumber(summaryA.totalTech),
      b: formatNumber(summaryB.totalTech),
      delta: formatDelta(summaryA.totalTech - summaryB.totalTech, formatNumber),
    },
    {
      label: 'Avg Tech',
      a: formatNumber(summaryA.avgTech),
      b: formatNumber(summaryB.avgTech),
      delta: formatDelta(summaryA.avgTech - summaryB.avgTech, formatNumber),
    },
    {
      label: 'In war mode',
      a: formatNumber(summaryA.inWar),
      b: formatNumber(summaryB.inWar),
      delta: formatDelta(summaryA.inWar - summaryB.inWar, formatNumber),
    },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-700 text-gray-200">
            <th className="text-left px-2.5 py-1.5 border-b border-gray-600 font-semibold">Metric</th>
            <th className="text-right px-2.5 py-1.5 border-b border-gray-600 font-semibold text-coalition-blue">{BLUE_LABEL}</th>
            <th className="text-right px-2.5 py-1.5 border-b border-gray-600 font-semibold text-coalition-red">{RED_LABEL}</th>
            <th className="text-right px-2.5 py-1.5 border-b border-gray-600 font-semibold">Δ (Blue − Red)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.label} className="hover:bg-gray-700/50">
              <td className="px-2.5 py-1.5 border-b border-gray-700 text-gray-200">{r.label}</td>
              <td className="px-2.5 py-1.5 border-b border-gray-700 text-right tabular-nums text-gray-200">{r.a}</td>
              <td className="px-2.5 py-1.5 border-b border-gray-700 text-right tabular-nums text-gray-200">{r.b}</td>
              <td className="px-2.5 py-1.5 border-b border-gray-700 text-right tabular-nums text-gray-300">{r.delta}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

function formatDelta(diff: number, fmt: (n: number) => string): string {
  if (diff === 0) return '0';
  const sign = diff > 0 ? '+' : '−';
  return `${sign}${fmt(Math.abs(diff))}`;
}

interface BucketDef { lower: number; upper: number; label: string }

type SideNation = NationStat & { alliance_id: number; alliance_name: string };

interface BarHover {
  side: GroupKey;
  bucketIndex: number;
  mouseX: number;
  mouseY: number;
}

const TOOLTIP_NATION_LIMIT = 25;

const Histogram: React.FC<{
  title: string;
  buckets: BucketDef[];
  nationsA: SideNation[];
  nationsB: SideNation[];
  countsA: number[];
  countsB: number[];
  maxCount: number;
  bucketLabelHeader: string;
  metricKey: 'strength' | 'technology';
  metricLabel: string;
}> = ({ title, buckets, nationsA, nationsB, countsA, countsB, maxCount, bucketLabelHeader, metricKey, metricLabel }) => {
  const [hover, setHover] = useState<BarHover | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Pre-bucket nations per side for fast tooltip rendering
  const bucketed = useMemo(() => {
    const place = (nations: SideNation[]) => {
      const out: SideNation[][] = buckets.map(() => []);
      for (const n of nations) {
        const v = n[metricKey];
        if (v == null || !Number.isFinite(v)) continue;
        const idx = buckets.findIndex(b => v >= b.lower && v < b.upper);
        if (idx >= 0) out[idx].push(n);
      }
      // Sort each bucket by metric descending for the tooltip
      for (const arr of out) arr.sort((a, b) => b[metricKey] - a[metricKey]);
      return out;
    };
    return { A: place(nationsA), B: place(nationsB) };
  }, [buckets, nationsA, nationsB, metricKey]);

  const hoverNations = hover ? (hover.side === 'A' ? bucketed.A : bucketed.B)[hover.bucketIndex] : null;
  const hoverBucket = hover ? buckets[hover.bucketIndex] : null;

  const handleEnter = (side: GroupKey, bucketIndex: number) => (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({
      side,
      bucketIndex,
      mouseX: e.clientX - rect.left,
      mouseY: e.clientY - rect.top,
    });
  };
  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!hover) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({ ...hover, mouseX: e.clientX - rect.left, mouseY: e.clientY - rect.top });
  };
  const handleLeave = () => setHover(null);

  // Click toggle for touch devices: tap a bar to show, tap again (or tap outside) to dismiss.
  // On desktop, hover already drives the tooltip — clicking a bar momentarily clears it
  // until the user moves the mouse out and back in, which is acceptable.
  const handleClick = (side: GroupKey, bucketIndex: number) => (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (hover && hover.side === side && hover.bucketIndex === bucketIndex) {
      setHover(null);
      return;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({
      side,
      bucketIndex,
      mouseX: e.clientX - rect.left,
      mouseY: e.clientY - rect.top,
    });
  };

  // Dismiss tooltip on outside click (mobile primarily).
  useEffect(() => {
    if (!hover) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target || !containerRef.current?.contains(target)) {
        setHover(null);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [hover]);

  return (
    <div ref={containerRef} className="bg-gray-800 border border-gray-700 rounded-lg p-4 mt-6 relative">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="m-0 text-gray-200 text-lg">{title}</h3>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <span className="inline-block w-3.5 h-3.5 rounded-sm bg-coalition-blue" />
            <span className="text-gray-200 text-sm">{BLUE_LABEL}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3.5 h-3.5 rounded-sm bg-coalition-red" />
            <span className="text-gray-200 text-sm">{RED_LABEL}</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto -mx-1 px-1">
        <div className="grid gap-2.5 items-end" style={{ gridTemplateColumns: `minmax(120px, 220px) repeat(${buckets.length}, minmax(80px, 1fr))` }}>
          <div className="font-bold text-[15px] text-gray-200">{bucketLabelHeader}</div>
          {buckets.map(b => (
            <div key={b.label} className="text-center font-bold text-gray-200 text-[15px]">{b.label}</div>
          ))}

          <div className="font-bold text-gray-200 text-[15px]">Counts (Blue vs Red)</div>
          {buckets.map((_, i) => {
            const a = countsA[i] || 0;
            const b = countsB[i] || 0;
            const aHeight = a === 0 ? 2 : Math.max(8, Math.round((a / maxCount) * 140));
            const bHeight = b === 0 ? 2 : Math.max(8, Math.round((b / maxCount) * 140));
            const aActive = hover && hover.side === 'A' && hover.bucketIndex === i;
            const bActive = hover && hover.side === 'B' && hover.bucketIndex === i;
            return (
              <div key={`bars-${i}`} className="h-40 flex items-end justify-center gap-2.5">
                <div
                  className="flex flex-col items-center w-[40%] cursor-pointer"
                  onMouseEnter={a > 0 ? handleEnter('A', i) : undefined}
                  onMouseMove={a > 0 ? handleMove : undefined}
                  onMouseLeave={a > 0 ? handleLeave : undefined}
                  onClick={a > 0 ? handleClick('A', i) : undefined}
                >
                  <div
                    className={`w-full bg-coalition-blue rounded transition-opacity ${aActive ? 'ring-2 ring-coalition-blue/60' : a > 0 ? 'hover:opacity-80' : ''}`}
                    style={{ height: `${aHeight}px` }}
                  />
                  <div className="text-[13px] text-gray-200 mt-1.5">{a}</div>
                </div>
                <div
                  className="flex flex-col items-center w-[40%] cursor-pointer"
                  onMouseEnter={b > 0 ? handleEnter('B', i) : undefined}
                  onMouseMove={b > 0 ? handleMove : undefined}
                  onMouseLeave={b > 0 ? handleLeave : undefined}
                  onClick={b > 0 ? handleClick('B', i) : undefined}
                >
                  <div
                    className={`w-full bg-coalition-red rounded transition-opacity ${bActive ? 'ring-2 ring-coalition-red/60' : b > 0 ? 'hover:opacity-80' : ''}`}
                    style={{ height: `${bHeight}px` }}
                  />
                  <div className="text-[13px] text-gray-200 mt-1.5">{b}</div>
                </div>
              </div>
            );
          })}

          <div className="font-bold text-gray-200 text-[15px]">Totals</div>
          {buckets.map((_, i) => (
            <div key={`T-${i}`} className="text-center text-gray-200 font-semibold text-[15px]">
              {countsA[i] + countsB[i]}
            </div>
          ))}
        </div>
      </div>

      {/* Bar tooltip */}
      {hover && hoverNations && hoverBucket && hoverNations.length > 0 && (
        <BarTooltip
          side={hover.side}
          mouseX={hover.mouseX}
          mouseY={hover.mouseY}
          containerWidth={containerRef.current?.clientWidth ?? 0}
          bucket={hoverBucket}
          metricLabel={metricLabel}
          nations={hoverNations}
        />
      )}
    </div>
  );
};

const BarTooltip: React.FC<{
  side: GroupKey;
  mouseX: number;
  mouseY: number;
  containerWidth: number;
  bucket: BucketDef;
  metricLabel: string;
  nations: SideNation[];
}> = ({ side, mouseX, mouseY, containerWidth, bucket, metricLabel, nations }) => {
  const TOOLTIP_W = 340;
  const offsetX = 12;
  // Flip to the left of cursor if it would clip the right edge.
  const left = mouseX + offsetX + TOOLTIP_W > containerWidth
    ? Math.max(8, mouseX - offsetX - TOOLTIP_W)
    : mouseX + offsetX;
  const top = Math.max(8, mouseY - 24);
  const sideLabel = side === 'A' ? BLUE_LABEL : RED_LABEL;
  const sideColor = side === 'A' ? 'text-coalition-blue' : 'text-coalition-red';
  const shown = nations.slice(0, TOOLTIP_NATION_LIMIT);
  const more = nations.length - shown.length;

  const allianceBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of nations) {
      map.set(n.alliance_name, (map.get(n.alliance_name) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [nations]);

  return (
    <div
      className="pointer-events-none absolute bg-gray-900 border border-gray-600 rounded shadow-lg p-2.5 text-xs text-gray-100 z-20"
      style={{ left, top, width: TOOLTIP_W }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className={`font-semibold ${sideColor}`}>{sideLabel} · {metricLabel} {bucket.label}</span>
        <span className="text-gray-400 tabular-nums">{nations.length} nation{nations.length === 1 ? '' : 's'}</span>
      </div>
      {allianceBreakdown.length > 1 && (
        <div className="flex flex-wrap gap-1 mb-1.5 pb-1.5 border-b border-gray-700">
          {allianceBreakdown.map(([name, count]) => (
            <span key={name} className="px-1.5 py-0.5 bg-gray-800 text-gray-300 rounded text-[11px]">
              {name} <span className="text-gray-500 tabular-nums">{count}</span>
            </span>
          ))}
        </div>
      )}
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 gap-y-0.5">
        <span className="text-gray-400">Ruler / Alliance</span>
        <span className="text-gray-400 text-right">NS</span>
        <span className="text-gray-400 text-right">Tech</span>
        {shown.map(n => (
          <React.Fragment key={n.nation_id}>
            <span className="truncate">
              <span className="text-gray-100">{n.ruler_name}</span>
              <span className="text-gray-500"> · {n.alliance_name}</span>
            </span>
            <span className="text-right tabular-nums">{formatNumber(n.strength)}</span>
            <span className="text-right tabular-nums">{formatNumber(n.technology)}</span>
          </React.Fragment>
        ))}
      </div>
      {more > 0 && (
        <div className="text-gray-400 text-[11px] mt-1.5">+{more} more</div>
      )}
    </div>
  );
};

interface ScatterPointFull extends NationStat {
  alliance_id: number;
  alliance_name: string;
  side: GroupKey;
}
const Scatterplot: React.FC<{
  points: ScatterPointFull[];
  xMax: number;
  yMax: number;
  logScale: boolean;
  onToggleLogScale: () => void;
  hoverPoint: { side: GroupKey; nation: NationStat; allianceId: number; allianceName: string; cx: number; cy: number } | null;
  setHoverPoint: React.Dispatch<React.SetStateAction<{ side: GroupKey; nation: NationStat; allianceId: number; allianceName: string; cx: number; cy: number } | null>>;
}> = ({ points, xMax, yMax, logScale, onToggleLogScale, hoverPoint, setHoverPoint }) => {
  const width = 900;
  const height = 460;
  const margin = { top: 16, right: 24, bottom: 56, left: 70 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const r = 3.5;

  // Count nations per alliance across the full selection so the tooltip can show
  // "X of Y in this alliance" context for the hovered point.
  const allianceCounts = useMemo(() => {
    const map = new Map<number, number>();
    for (const p of points) {
      map.set(p.alliance_id, (map.get(p.alliance_id) ?? 0) + 1);
    }
    return map;
  }, [points]);

  // Compute log-friendly bounds (avoid log(0)).
  const xLogMin = 1;
  const yLogMin = 1;
  const xLogMax = Math.max(xLogMin * 10, xMax);
  const yLogMax = Math.max(yLogMin * 10, yMax);

  const xScale = (x: number) => {
    if (logScale) {
      const v = Math.max(xLogMin, x);
      return (Math.log10(v) - Math.log10(xLogMin)) / (Math.log10(xLogMax) - Math.log10(xLogMin)) * plotW;
    }
    return (x / Math.max(1, xMax)) * plotW;
  };
  const yScale = (y: number) => {
    if (logScale) {
      const v = Math.max(yLogMin, y);
      return plotH - (Math.log10(v) - Math.log10(yLogMin)) / (Math.log10(yLogMax) - Math.log10(yLogMin)) * plotH;
    }
    return plotH - (y / Math.max(1, yMax)) * plotH;
  };

  // Tick generation
  const linearTicks = (max: number, count = 5) => {
    return Array.from({ length: count + 1 }, (_, i) => Math.round((i / count) * max));
  };
  const logTicks = (min: number, max: number) => {
    const ticks: number[] = [];
    const startExp = Math.floor(Math.log10(min));
    const endExp = Math.ceil(Math.log10(max));
    for (let e = startExp; e <= endExp; e++) ticks.push(Math.pow(10, e));
    return ticks;
  };

  const xTicks = logScale ? logTicks(xLogMin, xLogMax) : linearTicks(Math.max(1, xMax));
  const yTicks = logScale ? logTicks(yLogMin, yLogMax) : linearTicks(Math.max(1, yMax));

  const TEXT_COLOR = '#cbd5e1'; // slate-300, readable on dark bg
  const AXIS_COLOR = '#475569'; // slate-600
  const GRID_COLOR = '#334155'; // slate-700

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mt-6 relative">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="m-0 text-gray-200 text-lg">Nation Strength vs Technology</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="inline-block w-3.5 h-3.5 rounded-sm bg-coalition-blue" />
            <span className="text-gray-200 text-sm">{BLUE_LABEL}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3.5 h-3.5 rounded-sm bg-coalition-red" />
            <span className="text-gray-200 text-sm">{RED_LABEL}</span>
          </div>
          <label className="flex items-center gap-1.5 text-gray-300 text-xs">
            <input
              type="checkbox"
              checked={logScale}
              onChange={onToggleLogScale}
              className="accent-gray-400"
            />
            Log scale
          </label>
        </div>
      </div>

      <div className="relative">
        <svg width={width} height={height} className="max-w-full">
          <g transform={`translate(${margin.left},${margin.top})`}>
            {/* Gridlines */}
            {xTicks.map((t, i) => (
              <line
                key={`xg-${i}`}
                x1={xScale(t)} y1={0}
                x2={xScale(t)} y2={plotH}
                stroke={GRID_COLOR}
                strokeDasharray="2,3"
              />
            ))}
            {yTicks.map((t, i) => (
              <line
                key={`yg-${i}`}
                x1={0} y1={yScale(t)}
                x2={plotW} y2={yScale(t)}
                stroke={GRID_COLOR}
                strokeDasharray="2,3"
              />
            ))}

            {/* Axes */}
            <line x1={0} y1={plotH} x2={plotW} y2={plotH} stroke={AXIS_COLOR} />
            <line x1={0} y1={0} x2={0} y2={plotH} stroke={AXIS_COLOR} />

            {/* X ticks */}
            {xTicks.map((t, i) => (
              <g key={`xt-${i}`} transform={`translate(${xScale(t)},0)`}>
                <line x1={0} y1={plotH} x2={0} y2={plotH + 6} stroke={AXIS_COLOR} />
                <text x={0} y={plotH + 22} textAnchor="middle" fontSize={12} fill={TEXT_COLOR}>{formatCompact(t)}</text>
              </g>
            ))}

            {/* Y ticks */}
            {yTicks.map((t, i) => (
              <g key={`yt-${i}`} transform={`translate(0,${yScale(t)})`}>
                <line x1={-6} y1={0} x2={0} y2={0} stroke={AXIS_COLOR} />
                <text x={-10} y={4} textAnchor="end" fontSize={12} fill={TEXT_COLOR}>{formatCompact(t)}</text>
              </g>
            ))}

            {/* Points */}
            {points.map((p, idx) => {
              const cx = xScale(p.strength);
              const cy = yScale(p.technology);
              const colorClass = p.side === 'A' ? 'fill-coalition-blue' : 'fill-coalition-red';
              return (
                <a
                  key={`pt-${idx}`}
                  href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${p.nation_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r={hoverPoint && hoverPoint.nation.nation_id === p.nation_id ? r * 2 : r}
                    className={colorClass}
                    fillOpacity={0.75}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => {
                      const target = e.currentTarget.ownerSVGElement?.parentElement;
                      const rect = target?.getBoundingClientRect();
                      setHoverPoint({
                        side: p.side,
                        nation: p,
                        allianceId: p.alliance_id,
                        allianceName: p.alliance_name,
                        cx: rect ? e.clientX - rect.left : cx,
                        cy: rect ? e.clientY - rect.top : cy,
                      });
                    }}
                    onMouseLeave={() => setHoverPoint(null)}
                  />
                </a>
              );
            })}

            {/* Axis labels */}
            <text x={plotW / 2} y={plotH + 46} textAnchor="middle" fontSize={13} fill={TEXT_COLOR}>Nation Strength</text>
            <text transform={`translate(${-54}, ${plotH / 2}) rotate(-90)`} textAnchor="middle" fontSize={13} fill={TEXT_COLOR}>Technology</text>
          </g>
        </svg>

        {/* Tooltip */}
        {hoverPoint && (
          <div
            className="pointer-events-none absolute bg-gray-900 border border-gray-600 rounded shadow-lg p-2 text-xs text-gray-100 z-10"
            style={{
              left: Math.min(hoverPoint.cx + 10, width - 220),
              top: Math.max(hoverPoint.cy - 70, 0),
              maxWidth: 220,
            }}
          >
            <div className="font-semibold text-gray-100">{hoverPoint.nation.nation_name}</div>
            <div className="text-gray-400">{hoverPoint.nation.ruler_name}</div>
            <div className="text-gray-400 mt-0.5">
              {hoverPoint.allianceName}
              <span className="text-gray-500"> · {allianceCounts.get(hoverPoint.allianceId) ?? 0} in selection</span>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-x-3">
              <span className="text-gray-400">NS</span>
              <span className="text-right tabular-nums">{formatNumber(hoverPoint.nation.strength)}</span>
              <span className="text-gray-400">Tech</span>
              <span className="text-right tabular-nums">{formatNumber(hoverPoint.nation.technology)}</span>
              {hoverPoint.nation.in_war_mode && (
                <span className="col-span-2 text-amber-400 mt-0.5">In war mode</span>
              )}
            </div>
          </div>
        )}
      </div>

      {points.length === 0 && (
        <div className="text-center text-gray-400 text-sm mt-4">
          Select alliances above to see nation distribution.
        </div>
      )}
    </div>
  );
};

export default NSComparisonsPage;
