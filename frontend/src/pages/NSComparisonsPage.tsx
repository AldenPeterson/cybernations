import React, { useEffect, useMemo, useState } from 'react';
import { apiCall, API_ENDPOINTS } from '../utils/api';

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
  const [selectedAlliances, setSelectedAlliances] = useState<{ [key in GroupKey]: number | null }>({ A: null, B: null });
  const [nationsByAlliance, setNationsByAlliance] = useState<Record<number, NationConfig[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAlliances = async () => {
      try {
        setLoading(true);
        const res = await apiCall(API_ENDPOINTS.alliances);
        const data = await res.json();
        if (data.success) {
          setAlliances(data.alliances);
        } else {
          setError(data.error || 'Failed to load alliances');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load alliances');
      } finally {
        setLoading(false);
      }
    };
    loadAlliances();
  }, []);

  useEffect(() => {
    const idsToFetch = [selectedAlliances.A, selectedAlliances.B]
      .filter((id): id is number => !!id && !(id in nationsByAlliance));
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
    const getCountsForAlliance = (allianceId: number | null) => {
      const arr = allianceId ? nationsByAlliance[allianceId] || [] : [];
      const result = new Array(buckets.length).fill(0) as number[];
      for (const nation of arr) {
        const ns = parseStrength(nation.current_stats?.strength);
        if (ns == null) continue;
        const idx = buckets.findIndex(b => ns >= b.lower && ns < b.upper);
        if (idx >= 0) result[idx] += 1;
      }
      return result;
    };
    return {
      A: getCountsForAlliance(selectedAlliances.A),
      B: getCountsForAlliance(selectedAlliances.B)
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
    const getCountsForAlliance = (allianceId: number | null) => {
      const arr = allianceId ? nationsByAlliance[allianceId] || [] : [];
      const result = new Array(techBuckets.length).fill(0) as number[];
      for (const nation of arr) {
        const tech = parseTech(nation.current_stats?.technology);
        if (tech == null) continue;
        const idx = techBuckets.findIndex(b => tech >= b.lower && tech < b.upper);
        if (idx >= 0) result[idx] += 1;
      }
      return result;
    };
    return {
      A: getCountsForAlliance(selectedAlliances.A),
      B: getCountsForAlliance(selectedAlliances.B)
    };
  }, [techBuckets, nationsByAlliance, selectedAlliances]);

  const maxCountTech = useMemo(() => {
    const all = [...countsTech.A, ...countsTech.B];
    const max = all.length ? Math.max(...all) : 0;
    return Math.max(1, max);
  }, [countsTech]);

  // Scatterplot: Tech (X) vs Strength (Y)
  const scatterData = useMemo(() => {
    const getPoints = (allianceId: number | null) => {
      const arr = allianceId ? nationsByAlliance[allianceId] || [] : [];
      return arr
        .map(n => ({
          x: parseFloat((n.current_stats?.technology || '0').replace(/,/g, '')),
          y: parseFloat((n.current_stats?.strength || '0').replace(/,/g, ''))
        }))
        .filter(p => !isNaN(p.x) && !isNaN(p.y));
    };
    const A = getPoints(selectedAlliances.A);
    const B = getPoints(selectedAlliances.B);
    const xMax = Math.max(1, ...A.map(p => p.x), ...B.map(p => p.x));
    const yMax = Math.max(1, ...A.map(p => p.y), ...B.map(p => p.y));
    return { A, B, xMax, yMax };
  }, [nationsByAlliance, selectedAlliances]);

  const handleSelect = (group: GroupKey, value: string) => {
    const id = value ? parseInt(value, 10) : null;
    setSelectedAlliances(prev => ({ ...prev, [group]: id }));
  };

  return (
    <div style={{ marginTop: '80px', padding: '20px' }}>
      <h2>NS Comparisons</h2>
      <p style={{ color: '#666' }}>Compare nation strength distributions between two alliances.</p>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', alignItems: 'center' }}>
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#333' }}>Group A</label>
          <select
            value={selectedAlliances.A || ''}
            onChange={(e) => handleSelect('A', e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: '4px', minWidth: '280px' }}
            disabled={loading}
          >
            <option value="">Choose an alliance...</option>
            {alliances.map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.nationCount} nations)</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#333' }}>Group B</label>
          <select
            value={selectedAlliances.B || ''}
            onChange={(e) => handleSelect('B', e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: '4px', minWidth: '280px' }}
            disabled={loading}
          >
            <option value="">Choose an alliance...</option>
            {alliances.map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.nationCount} nations)</option>
            ))}
          </select>
        </div>
        {error && <span style={{ color: '#dc3545' }}>{error}</span>}
      </div>

      {/* NS Histogram */}
      <div style={{ overflowX: 'auto', backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '8px', padding: '16px' }}>
        {/* Legend */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-block', width: '14px', height: '14px', backgroundColor: '#0d6efd', borderRadius: '3px' }} />
            <span style={{ color: '#333' }}>Group A</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-block', width: '14px', height: '14px', backgroundColor: '#dc3545', borderRadius: '3px' }} />
            <span style={{ color: '#333' }}>Group B</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: `200px repeat(${buckets.length}, 1fr)`, gap: '8px', alignItems: 'end' }}>
          {/* Header row */}
          <div style={{ fontWeight: 'bold' }}>Bucket</div>
          {buckets.map(b => (
            <div key={b.label} style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{b.label}</div>
          ))}

          {/* Bars row - side-by-side within each bucket */}
          <div style={{ fontWeight: 'bold', color: '#333' }}>Counts</div>
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
                    backgroundColor: '#0d6efd',
                    borderRadius: '4px'
                  }} />
                  <div style={{ fontSize: '12px', color: '#333', marginTop: '6px' }}>{a}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '40%' }}>
                  <div style={{
                    height: `${bHeight}px`,
                    width: '100%',
                    backgroundColor: '#dc3545',
                    borderRadius: '4px'
                  }} />
                  <div style={{ fontSize: '12px', color: '#333', marginTop: '6px' }}>{b}</div>
                </div>
              </div>
            );
          })}

          {/* Totals row */}
          <div style={{ fontWeight: 'bold', color: '#333' }}>Totals</div>
          {buckets.map((_, i) => (
            <div key={`T-${i}`} style={{ textAlign: 'center', color: '#333', fontWeight: 600 }}>
              {counts.A[i] + counts.B[i]}
            </div>
          ))}
        </div>
      </div>

      {/* Tech Histogram */}
      <div style={{ overflowX: 'auto', backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '8px', padding: '16px', marginTop: '24px' }}>
        {/* Legend */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-block', width: '14px', height: '14px', backgroundColor: '#0d6efd', borderRadius: '3px' }} />
            <span style={{ color: '#333' }}>Group A</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-block', width: '14px', height: '14px', backgroundColor: '#dc3545', borderRadius: '3px' }} />
            <span style={{ color: '#333' }}>Group B</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: `200px repeat(${techBuckets.length}, 1fr)`, gap: '8px', alignItems: 'end' }}>
          {/* Header row */}
          <div style={{ fontWeight: 'bold' }}>Tech Bucket</div>
          {techBuckets.map(b => (
            <div key={b.label} style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>{b.label}</div>
          ))}

          {/* Bars row - side-by-side within each bucket */}
          <div style={{ fontWeight: 'bold', color: '#333' }}>Counts</div>
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
                    backgroundColor: '#0d6efd',
                    borderRadius: '4px'
                  }} />
                  <div style={{ fontSize: '12px', color: '#333', marginTop: '6px' }}>{a}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '40%' }}>
                  <div style={{
                    height: `${bHeight}px`,
                    width: '100%',
                    backgroundColor: '#dc3545',
                    borderRadius: '4px'
                  }} />
                  <div style={{ fontSize: '12px', color: '#333', marginTop: '6px' }}>{b}</div>
                </div>
              </div>
            );
          })}

          {/* Totals row */}
          <div style={{ fontWeight: 'bold', color: '#333' }}>Totals</div>
          {techBuckets.map((_, i) => (
            <div key={`TT-${i}`} style={{ textAlign: 'center', color: '#333', fontWeight: 600 }}>
              {countsTech.A[i] + countsTech.B[i]}
            </div>
          ))}
        </div>
      </div>

      {/* Scatterplot: Tech (X) vs Strength (Y) */}
      <div style={{ backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '8px', padding: '16px', marginTop: '24px' }}>
        <h3 style={{ marginTop: 0, color: '#333' }}>Tech vs Nation Strength</h3>
        <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-block', width: '14px', height: '14px', backgroundColor: '#0d6efd', borderRadius: '3px' }} />
            <span style={{ color: '#333' }}>Group A</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-block', width: '14px', height: '14px', backgroundColor: '#dc3545', borderRadius: '3px' }} />
            <span style={{ color: '#333' }}>Group B</span>
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

                {/* Points - Group A */}
                {scatterData.A.map((p, idx) => (
                  <circle key={`A-${idx}`} cx={xScale(p.x)} cy={yScale(p.y)} r={r} fill="#0d6efd" fillOpacity={0.7} />
                ))}
                {/* Points - Group B */}
                {scatterData.B.map((p, idx) => (
                  <circle key={`B-${idx}`} cx={xScale(p.x)} cy={yScale(p.y)} r={r} fill="#dc3545" fillOpacity={0.7} />
                ))}

                {/* Axis labels */}
                <text x={plotW / 2} y={plotH + 36} textAnchor="middle" fontSize={13} fill="#333">Technology</text>
                <text transform={`translate(${-40}, ${plotH / 2}) rotate(-90)`} textAnchor="middle" fontSize={13} fill="#333">Nation Strength</text>
              </g>
            </svg>
          );
        })()}
      </div>
    </div>
  );
};

export default NSComparisonsPage;


