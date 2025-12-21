import React, { useEffect, useMemo, useState } from 'react';
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

interface NationConfig {
  nation_id: number;
  ruler_name: string;
  nation_name: string;
  current_stats?: {
    strength?: string; // backend uses string numbers with commas
    technology?: string;
  };
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
  return `${n}`;
}

function formatBucketLabel(lower: number, upper: number): string {
  return `${formatCompact(lower)}-${formatCompact(upper)}`;
}

function parseStrength(str?: string): number | null {
  if (!str) return null;
  const num = parseFloat(str.replace(/,/g, ''));
  return isNaN(num) ? null : num;
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

const NSComparisonsPage: React.FC = () => {
  const { alliances: allAlliances } = useAlliances();
  const [selectedAlliances, setSelectedAlliances] = useState<{ [key in GroupKey]: number[] }>({ A: [], B: [] });
  const [nationsByAlliance, setNationsByAlliance] = useState<Record<number, NationConfig[]>>({});

  // Filter and sort alliances
  const alliances = React.useMemo(() => {
    return allAlliances
      .filter((a: Alliance) => a.name && a.name.trim() !== '' && a.nationCount >= 10)
      .sort((a: Alliance, b: Alliance) => b.nationCount - a.nationCount);
  }, [allAlliances]);

  useEffect(() => {
    const allIds = [...selectedAlliances.A, ...selectedAlliances.B];
    const idsToFetch = allIds.filter((id) => !(id in nationsByAlliance));
    if (idsToFetch.length === 0) return;

    const fetchNations = async (id: number) => {
      const res = await apiCall(API_ENDPOINTS.nationsConfig(id));
      const data = await res.json();
      if (data && Array.isArray(data.nations)) {
        setNationsByAlliance(prev => ({ ...prev, [id]: data.nations }));
      }
    };

    idsToFetch.forEach(id => {
      fetchNations(id).catch(() => {});
    });
  }, [selectedAlliances, nationsByAlliance]);

  const buckets = useMemo(() => {
    return BUCKET_BOUNDS.slice(0, -1).map((lower, i) => {
      const upper = BUCKET_BOUNDS[i + 1];
      return { lower, upper, label: formatBucketLabel(lower, upper) };
    });
  }, []);

  const counts = useMemo(() => {
    const sumCountsForAlliances = (ids: number[]) => {
      const result = new Array(buckets.length).fill(0) as number[];
      ids.forEach((id) => {
        const arr = nationsByAlliance[id] || [];
        for (const nation of arr) {
          const ns = parseStrength(nation.current_stats?.strength);
          if (ns == null) continue;
          const idx = buckets.findIndex(b => ns >= b.lower && ns < b.upper);
          if (idx >= 0) result[idx] += 1;
        }
      });
      return result;
    };
    return {
      A: sumCountsForAlliances(selectedAlliances.A),
      B: sumCountsForAlliances(selectedAlliances.B)
    };
  }, [buckets, nationsByAlliance, selectedAlliances]);

  const maxCount = useMemo(() => {
    const all = [...counts.A, ...counts.B];
    const max = all.length ? Math.max(...all) : 0;
    return Math.max(1, max);
  }, [counts]);

  // Tech buckets setup and counts
  const techBuckets = useMemo(() => {
    return TECH_BUCKET_BOUNDS.slice(0, -1).map((lower, i) => {
      const upper = TECH_BUCKET_BOUNDS[i + 1];
      return { lower, upper, label: formatTechBucketLabel(lower, upper) };
    });
  }, []);

  function parseTech(str?: string): number | null {
    if (!str) return null;
    const num = parseFloat(str.replace(/,/g, ''));
    return isNaN(num) ? null : num;
  }

  const countsTech = useMemo(() => {
    const sumCountsForAlliances = (ids: number[]) => {
      const result = new Array(techBuckets.length).fill(0) as number[];
      ids.forEach((id) => {
        const arr = nationsByAlliance[id] || [];
        for (const nation of arr) {
          const tech = parseTech(nation.current_stats?.technology);
          if (tech == null) continue;
          const idx = techBuckets.findIndex(b => tech >= b.lower && tech < b.upper);
          if (idx >= 0) result[idx] += 1;
        }
      });
      return result;
    };
    return {
      A: sumCountsForAlliances(selectedAlliances.A),
      B: sumCountsForAlliances(selectedAlliances.B)
    };
  }, [techBuckets, nationsByAlliance, selectedAlliances]);

  const maxCountTech = useMemo(() => {
    const all = [...countsTech.A, ...countsTech.B];
    const max = all.length ? Math.max(...all) : 0;
    return Math.max(1, max);
  }, [countsTech]);

  // Scatterplot: Tech (X) vs Strength (Y)
  const scatterData = useMemo(() => {
    const getPointsForAlliances = (ids: number[]) => {
      const points: { x: number; y: number }[] = [];
      ids.forEach((id) => {
        const arr = nationsByAlliance[id] || [];
        arr.forEach(n => {
          // Switched axes: X = Strength, Y = Technology
          const x = parseFloat((n.current_stats?.strength || '0').replace(/,/g, ''));
          const y = parseFloat((n.current_stats?.technology || '0').replace(/,/g, ''));
          if (!isNaN(x) && !isNaN(y)) points.push({ x, y });
        });
      });
      return points;
    };
    const A = getPointsForAlliances(selectedAlliances.A);
    const B = getPointsForAlliances(selectedAlliances.B);
    const xMax = Math.max(1, ...A.map(p => p.x), ...B.map(p => p.x));
    const yMax = Math.max(1, ...A.map(p => p.y), ...B.map(p => p.y));
    return { A, B, xMax, yMax };
  }, [nationsByAlliance, selectedAlliances]);

  // No single-select handlers; coalition selection is managed via table checkboxes

  return (
    <PageContainer className="p-6 text-base">
      {/* Coalition selector table */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-3.5 mb-4">
        <h3 className="mt-0 text-gray-200 text-lg">Coalitions</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm leading-tight">
            <thead>
              <tr className="bg-gray-700 text-gray-200">
                <th className="text-left px-2.5 py-1.5 border-b border-gray-600 font-semibold">Alliance</th>
                <th className="text-center px-2.5 py-1.5 border-b border-gray-600 font-semibold text-coalition-blue">{BLUE_LABEL}</th>
                <th className="text-center px-2.5 py-1.5 border-b border-gray-600 font-semibold text-coalition-red">{RED_LABEL}</th>
                <th className="text-right px-2.5 py-1.5 border-b border-gray-600 font-semibold">Nations</th>
              </tr>
            </thead>
            <tbody>
              {alliances.map((a, idx) => {
                const inA = selectedAlliances.A.includes(a.id); // Blue
                const inB = selectedAlliances.B.includes(a.id); // Red
                return (
                  <tr key={a.id} className={`${idx % 2 === 0 ? 'bg-gray-800' : 'bg-gray-800/50'} hover:bg-gray-700 transition-colors`}>
                    <td className="px-2.5 py-1.5 border-b border-gray-700 align-middle text-gray-200">{a.name}</td>
                    <td className="px-2.5 py-1.5 border-b border-gray-700 text-center align-middle">
                      <input
                        type="checkbox"
                        checked={inA}
                        className="scale-90 m-0 accent-coalition-blue"
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSelectedAlliances(prev => ({
                            A: checked ? [...prev.A.filter(id => id !== a.id), a.id] : prev.A.filter(id => id !== a.id),
                            B: prev.B.filter(id => id !== a.id) // ensure exclusive membership
                          }));
                        }}
                      />
                    </td>
                    <td className="px-2.5 py-1.5 border-b border-gray-700 text-center align-middle">
                      <input
                        type="checkbox"
                        checked={inB}
                        className="scale-90 m-0 accent-coalition-red"
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSelectedAlliances(prev => ({
                            A: prev.A.filter(id => id !== a.id), // ensure exclusive membership
                            B: checked ? [...prev.B.filter(id => id !== a.id), a.id] : prev.B.filter(id => id !== a.id)
                          }));
                        }}
                      />
                    </td>
                    <td className="px-2.5 py-1.5 border-b border-gray-700 text-right text-gray-300 tabular-nums align-middle">{a.nationCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-gray-400 text-xs">
          Showing alliances with at least 10 nations.
        </div>
      </div>

      {/* NS Histogram */}
      <div className="overflow-x-auto bg-gray-800 border border-gray-700 rounded-lg p-4">
        {/* Legend */}
        <div className="flex gap-4 mb-3">
          <div className="flex items-center gap-2">
            <span className="inline-block w-3.5 h-3.5 rounded-sm bg-coalition-blue" />
            <span className="text-gray-200">{BLUE_LABEL}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3.5 h-3.5 rounded-sm bg-coalition-red" />
            <span className="text-gray-200">{RED_LABEL}</span>
          </div>
        </div>

        <div className="grid gap-2.5 items-end" style={{ gridTemplateColumns: `220px repeat(${buckets.length}, 1fr)` }}>
          {/* Header row */}
          <div className="font-bold text-[15px] text-gray-200">NS Bucket</div>
          {buckets.map(b => (
            <div key={b.label} className="text-center font-bold text-gray-200 text-[15px]">{b.label}</div>
          ))}

          {/* Bars row - side-by-side within each bucket */}
          <div className="font-bold text-gray-200 text-[15px]">Counts (Blue vs Red)</div>
          {buckets.map((_, i) => {
            const a = counts.A[i] || 0;
            const b = counts.B[i] || 0;
            const aHeight = a === 0 ? 2 : Math.max(8, Math.round((a / maxCount) * 140));
            const bHeight = b === 0 ? 2 : Math.max(8, Math.round((b / maxCount) * 140));
            return (
              <div key={`bars-${i}`} className="h-40 flex items-end justify-center gap-2.5">
                <div className="flex flex-col items-center w-[40%]">
                  <div 
                    className="w-full bg-coalition-blue rounded"
                    style={{ height: `${aHeight}px` }}
                  />
                  <div className="text-[13px] text-gray-200 mt-1.5">{a}</div>
                </div>
                <div className="flex flex-col items-center w-[40%]">
                  <div 
                    className="w-full bg-coalition-red rounded"
                    style={{ height: `${bHeight}px` }}
                  />
                  <div className="text-[13px] text-gray-200 mt-1.5">{b}</div>
                </div>
              </div>
            );
          })}

          {/* Totals row */}
          <div className="font-bold text-gray-200 text-[15px]">Totals</div>
          {buckets.map((_, i) => (
            <div key={`T-${i}`} className="text-center text-gray-200 font-semibold text-[15px]">
              {counts.A[i] + counts.B[i]}
            </div>
          ))}
        </div>
      </div>

      {/* Tech Histogram */}
      <div className="overflow-x-auto bg-gray-800 border border-gray-700 rounded-lg p-4 mt-6">
        {/* Legend */}
        <div className="flex gap-4 mb-3">
          <div className="flex items-center gap-2">
            <span className="inline-block w-3.5 h-3.5 rounded-sm bg-coalition-blue" />
            <span className="text-gray-200">{BLUE_LABEL}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3.5 h-3.5 rounded-sm bg-coalition-red" />
            <span className="text-gray-200">{RED_LABEL}</span>
          </div>
        </div>

        <div className="grid gap-2.5 items-end" style={{ gridTemplateColumns: `220px repeat(${techBuckets.length}, 1fr)` }}>
          {/* Header row */}
          <div className="font-bold text-[15px] text-gray-200">Tech Bucket</div>
          {techBuckets.map(b => (
            <div key={b.label} className="text-center font-bold text-gray-200 text-[15px]">{b.label}</div>
          ))}

          {/* Bars row - side-by-side within each bucket */}
          <div className="font-bold text-gray-200 text-[15px]">Counts (Blue vs Red)</div>
          {techBuckets.map((_, i) => {
            const a = countsTech.A[i] || 0;
            const b = countsTech.B[i] || 0;
            const aHeight = a === 0 ? 2 : Math.max(8, Math.round((a / maxCountTech) * 140));
            const bHeight = b === 0 ? 2 : Math.max(8, Math.round((b / maxCountTech) * 140));
            return (
              <div key={`tech-bars-${i}`} className="h-40 flex items-end justify-center gap-2.5">
                <div className="flex flex-col items-center w-[40%]">
                  <div 
                    className="w-full bg-coalition-blue rounded"
                    style={{ height: `${aHeight}px` }}
                  />
                  <div className="text-[13px] text-gray-200 mt-1.5">{a}</div>
                </div>
                <div className="flex flex-col items-center w-[40%]">
                  <div 
                    className="w-full bg-coalition-red rounded"
                    style={{ height: `${bHeight}px` }}
                  />
                  <div className="text-[13px] text-gray-200 mt-1.5">{b}</div>
                </div>
              </div>
            );
          })}

          {/* Totals row */}
          <div className="font-bold text-gray-200 text-[15px]">Totals</div>
          {techBuckets.map((_, i) => (
            <div key={`TT-${i}`} className="text-center text-gray-200 font-semibold text-[15px]">
              {countsTech.A[i] + countsTech.B[i]}
            </div>
          ))}
        </div>
      </div>

      {/* Scatterplot: Tech (X) vs Strength (Y) */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mt-6">
        <h3 className="mt-0 text-gray-200">Nation Strength vs Technology</h3>
        <div className="flex gap-4 mb-3">
          <div className="flex items-center gap-2">
            <span className="inline-block w-3.5 h-3.5 rounded-sm bg-coalition-blue" />
            <span className="text-gray-200">{BLUE_LABEL}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3.5 h-3.5 rounded-sm bg-coalition-red" />
            <span className="text-gray-200">{RED_LABEL}</span>
          </div>
        </div>

        {(() => {
          const width = 900;
          const height = 420;
          const margin = { top: 10, right: 20, bottom: 40, left: 50 };
          const plotW = width - margin.left - margin.right;
          const plotH = height - margin.top - margin.bottom;
          const r = 3;
          const xScale = (x: number) => (x / scatterData.xMax) * plotW;
          const yScale = (y: number) => plotH - (y / scatterData.yMax) * plotH;

          // Simple axis ticks (5 ticks)
          const ticks = 5;
          const xTicks = Array.from({ length: ticks + 1 }, (_, i) => Math.round((i / ticks) * scatterData.xMax));
          const yTicks = Array.from({ length: ticks + 1 }, (_, i) => Math.round((i / ticks) * scatterData.yMax));

          return (
            <svg width={width} height={height} className="max-w-full">
              <g transform={`translate(${margin.left},${margin.top})`}>
                {/* Axes */}
                <line x1={0} y1={plotH} x2={plotW} y2={plotH} stroke="#999" />
                <line x1={0} y1={0} x2={0} y2={plotH} stroke="#999" />

                {/* X ticks */}
                {xTicks.map((t, i) => (
                  <g key={`xt-${i}`} transform={`translate(${xScale(t)},0)`}>
                    <line x1={0} y1={plotH} x2={0} y2={plotH + 6} stroke="#999" />
                    <text x={0} y={plotH + 20} textAnchor="middle" fontSize={12} fill="#333">{formatCompact(t)}</text>
                  </g>
                ))}

                {/* Y ticks */}
                {yTicks.map((t, i) => (
                  <g key={`yt-${i}`} transform={`translate(0,${yScale(t)})`}>
                    <line x1={-6} y1={0} x2={0} y2={0} stroke="#999" />
                    <text x={-10} y={4} textAnchor="end" fontSize={12} fill="#333">{formatCompact(t)}</text>
                  </g>
                ))}

                {/* Points - Blue */}
                {scatterData.A.map((p, idx) => (
                  <circle key={`A-${idx}`} cx={xScale(p.x)} cy={yScale(p.y)} r={r} className="fill-coalition-blue" fillOpacity={0.7} />
                ))}
                {/* Points - Red */}
                {scatterData.B.map((p, idx) => (
                  <circle key={`B-${idx}`} cx={xScale(p.x)} cy={yScale(p.y)} r={r} className="fill-coalition-red" fillOpacity={0.7} />
                ))}

                {/* Axis labels */}
                <text x={plotW / 2} y={plotH + 36} textAnchor="middle" fontSize={13} fill="#333">Nation Strength</text>
                <text transform={`translate(${-40}, ${plotH / 2}) rotate(-90)`} textAnchor="middle" fontSize={13} fill="#333">Technology</text>
              </g>
            </svg>
          );
        })()}
      </div>
    </PageContainer>
  );
};

export default NSComparisonsPage;


