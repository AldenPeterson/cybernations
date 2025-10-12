import React, { useEffect, useMemo, useState } from 'react';
import { apiCall, API_ENDPOINTS } from '../utils/api';

// Shared labels and colors for coalitions
const BLUE_LABEL = 'Blue';
const RED_LABEL = 'Red';
const BLUE_COLOR = '#0d6efd';
const RED_COLOR = '#dc3545';

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
  const [alliances, setAlliances] = useState<Alliance[]>([]);
  const [selectedAlliances, setSelectedAlliances] = useState<{ [key in GroupKey]: number[] }>({ A: [], B: [] });
  const [nationsByAlliance, setNationsByAlliance] = useState<Record<number, NationConfig[]>>({});
  // Loading removed (not used in UI)
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAlliances = async () => {
      try {
        const res = await apiCall(API_ENDPOINTS.alliances);
        const data = await res.json();
        if (data.success) {
          const filtered = (data.alliances as Alliance[])
            .filter(a => a.name && a.name.trim() !== '' && a.nationCount >= 10)
            .sort((a, b) => b.nationCount - a.nationCount);
          setAlliances(filtered);
        } else {
          setError(data.error || 'Failed to load alliances');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load alliances');
      }
    };
    loadAlliances();
  }, []);

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
    <div className="mt-20 p-6 text-base text-gray-900">
      {/* Coalition selector table */}
      <div className="bg-white border border-slate-300 rounded-xl p-3.5 mb-4">
        <h3 className="mt-0 text-gray-900 text-lg">Coalitions</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm leading-tight">
            <thead>
              <tr className="bg-slate-100 text-gray-900">
                <th className="text-left px-2.5 py-1.5 border-b border-slate-300 font-semibold">Alliance</th>
                <th className="text-center px-2.5 py-1.5 border-b border-slate-300 font-semibold" style={{ color: BLUE_COLOR }}>{BLUE_LABEL}</th>
                <th className="text-center px-2.5 py-1.5 border-b border-slate-300 font-semibold" style={{ color: RED_COLOR }}>{RED_LABEL}</th>
                <th className="text-right px-2.5 py-1.5 border-b border-slate-300 font-semibold">Nations</th>
              </tr>
            </thead>
            <tbody>
              {alliances.map((a, idx) => {
                const inA = selectedAlliances.A.includes(a.id); // Blue
                const inB = selectedAlliances.B.includes(a.id); // Red
                return (
                  <tr key={a.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="px-2.5 py-1.5 border-b border-slate-200 align-middle">{a.name}</td>
                    <td className="px-2.5 py-1.5 border-b border-slate-200 text-center align-middle">
                      <input
                        type="checkbox"
                        checked={inA}
                        className="scale-90 m-0"
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSelectedAlliances(prev => ({
                            A: checked ? [...prev.A.filter(id => id !== a.id), a.id] : prev.A.filter(id => id !== a.id),
                            B: prev.B.filter(id => id !== a.id) // ensure exclusive membership
                          }));
                        }}
                      />
                    </td>
                    <td className="px-2.5 py-1.5 border-b border-slate-200 text-center align-middle">
                      <input
                        type="checkbox"
                        checked={inB}
                        className="scale-90 m-0"
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSelectedAlliances(prev => ({
                            A: prev.A.filter(id => id !== a.id), // ensure exclusive membership
                            B: checked ? [...prev.B.filter(id => id !== a.id), a.id] : prev.B.filter(id => id !== a.id)
                          }));
                        }}
                      />
                    </td>
                    <td className="px-2.5 py-1.5 border-b border-slate-200 text-right text-gray-700 tabular-nums align-middle">{a.nationCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {error && <div className="text-error mt-2">{error}</div>}
        <div className="mt-2 text-gray-600 text-xs">
          Showing alliances with at least 10 nations.
        </div>
      </div>

      {/* NS Histogram */}
      <div className="overflow-x-auto bg-white border border-slate-300 rounded-lg p-4">
        {/* Legend */}
        <div className="flex gap-4 mb-3">
          <div className="flex items-center gap-2">
            <span className="inline-block w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: BLUE_COLOR }} />
            <span className="text-gray-800">{BLUE_LABEL}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: RED_COLOR }} />
            <span className="text-gray-800">{RED_LABEL}</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: `220px repeat(${buckets.length}, 1fr)`, gap: '10px', alignItems: 'end' }}>
          {/* Header row */}
          <div style={{ fontWeight: 'bold', fontSize: '15px' }}>NS Bucket</div>
          {buckets.map(b => (
            <div key={b.label} style={{ textAlign: 'center', fontWeight: 'bold', color: '#333', fontSize: '15px' }}>{b.label}</div>
          ))}

          {/* Bars row - side-by-side within each bucket */}
          <div style={{ fontWeight: 'bold', color: '#333', fontSize: '15px' }}>Counts (Blue vs Red)</div>
          {buckets.map((_, i) => {
            const a = counts.A[i] || 0;
            const b = counts.B[i] || 0;
            const aHeight = a === 0 ? 2 : Math.max(8, Math.round((a / maxCount) * 140));
            const bHeight = b === 0 ? 2 : Math.max(8, Math.round((b / maxCount) * 140));
            return (
              <div key={`bars-${i}`} style={{ height: '160px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '40%' }}>
                  <div style={{
                    height: `${aHeight}px`,
                    width: '100%',
                    backgroundColor: BLUE_COLOR,
                    borderRadius: '4px'
                  }} />
                  <div style={{ fontSize: '13px', color: '#222', marginTop: '6px' }}>{a}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '40%' }}>
                  <div style={{
                    height: `${bHeight}px`,
                    width: '100%',
                    backgroundColor: RED_COLOR,
                    borderRadius: '4px'
                  }} />
                  <div style={{ fontSize: '13px', color: '#222', marginTop: '6px' }}>{b}</div>
                </div>
              </div>
            );
          })}

          {/* Totals row */}
          <div style={{ fontWeight: 'bold', color: '#333', fontSize: '15px' }}>Totals</div>
          {buckets.map((_, i) => (
            <div key={`T-${i}`} style={{ textAlign: 'center', color: '#222', fontWeight: 600, fontSize: '15px' }}>
              {counts.A[i] + counts.B[i]}
            </div>
          ))}
        </div>
      </div>

      {/* Tech Histogram */}
      <div className="overflow-x-auto bg-white border border-slate-300 rounded-lg p-4 mt-6">
        {/* Legend */}
        <div className="flex gap-4 mb-3">
          <div className="flex items-center gap-2">
            <span className="inline-block w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: BLUE_COLOR }} />
            <span className="text-gray-800">{BLUE_LABEL}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: RED_COLOR }} />
            <span className="text-gray-800">{RED_LABEL}</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: `220px repeat(${techBuckets.length}, 1fr)`, gap: '10px', alignItems: 'end' }}>
          {/* Header row */}
          <div style={{ fontWeight: 'bold', fontSize: '15px' }}>Tech Bucket</div>
          {techBuckets.map(b => (
            <div key={b.label} style={{ textAlign: 'center', fontWeight: 'bold', color: '#333', fontSize: '15px' }}>{b.label}</div>
          ))}

          {/* Bars row - side-by-side within each bucket */}
          <div style={{ fontWeight: 'bold', color: '#333', fontSize: '15px' }}>Counts (Blue vs Red)</div>
          {techBuckets.map((_, i) => {
            const a = countsTech.A[i] || 0;
            const b = countsTech.B[i] || 0;
            const aHeight = a === 0 ? 2 : Math.max(8, Math.round((a / maxCountTech) * 140));
            const bHeight = b === 0 ? 2 : Math.max(8, Math.round((b / maxCountTech) * 140));
            return (
              <div key={`tech-bars-${i}`} style={{ height: '160px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '40%' }}>
                  <div style={{
                    height: `${aHeight}px`,
                    width: '100%',
                    backgroundColor: BLUE_COLOR,
                    borderRadius: '4px'
                  }} />
                  <div style={{ fontSize: '13px', color: '#222', marginTop: '6px' }}>{a}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '40%' }}>
                  <div style={{
                    height: `${bHeight}px`,
                    width: '100%',
                    backgroundColor: RED_COLOR,
                    borderRadius: '4px'
                  }} />
                  <div style={{ fontSize: '13px', color: '#222', marginTop: '6px' }}>{b}</div>
                </div>
              </div>
            );
          })}

          {/* Totals row */}
          <div style={{ fontWeight: 'bold', color: '#333', fontSize: '15px' }}>Totals</div>
          {techBuckets.map((_, i) => (
            <div key={`TT-${i}`} style={{ textAlign: 'center', color: '#222', fontWeight: 600, fontSize: '15px' }}>
              {countsTech.A[i] + countsTech.B[i]}
            </div>
          ))}
        </div>
      </div>

      {/* Scatterplot: Tech (X) vs Strength (Y) */}
      <div className="bg-white border border-slate-300 rounded-lg p-4 mt-6">
        <h3 className="mt-0 text-gray-800">Nation Strength vs Technology</h3>
        <div className="flex gap-4 mb-3">
          <div className="flex items-center gap-2">
            <span className="inline-block w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: BLUE_COLOR }} />
            <span className="text-gray-800">{BLUE_LABEL}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: RED_COLOR }} />
            <span className="text-gray-800">{RED_LABEL}</span>
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
            <svg width={width} height={height} style={{ maxWidth: '100%' }}>
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
                  <circle key={`A-${idx}`} cx={xScale(p.x)} cy={yScale(p.y)} r={r} fill={BLUE_COLOR} fillOpacity={0.7} />
                ))}
                {/* Points - Red */}
                {scatterData.B.map((p, idx) => (
                  <circle key={`B-${idx}`} cx={xScale(p.x)} cy={yScale(p.y)} r={r} fill={RED_COLOR} fillOpacity={0.7} />
                ))}

                {/* Axis labels */}
                <text x={plotW / 2} y={plotH + 36} textAnchor="middle" fontSize={13} fill="#333">Nation Strength</text>
                <text transform={`translate(${-40}, ${plotH / 2}) rotate(-90)`} textAnchor="middle" fontSize={13} fill="#333">Technology</text>
              </g>
            </svg>
          );
        })()}
      </div>
    </div>
  );
};

export default NSComparisonsPage;


