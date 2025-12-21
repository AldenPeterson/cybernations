import React, { useEffect, useMemo, useState } from 'react';
import { apiCallWithErrorHandling, API_ENDPOINTS } from '../utils/api';
import ReusableTable from '../components/ReusableTable';
import type { TableColumn } from '../components/ReusableTable';
import { tableClasses } from '../styles/tableClasses';
import TableContainer from '../components/TableContainer';

interface ByPairRow {
  attackingNation: string;
  defenderNation?: string; // backward compat guard
  defendingNation: string;
  date: string;
  thwartedBeforeHit: number;
  hitAchieved: boolean;
  firstEventAt?: string;
  firstHitAt?: string;
  attackerId?: number;
  attackerNationName?: string;
  attackerRulerName?: string;
  defenderId?: number;
  defenderNationName?: string;
  defenderRulerName?: string;
}

interface NuclearStatsResponse {
  byPair: ByPairRow[];
  distribution: Record<string, number>;
  distributionNoHit: Record<string, number>;
  onlyThwartedPairs: number;
}

interface NuclearTimelineBucket {
  start: string;
  end: string;
  thwarted: number;
  hit: number;
  unknown: number;
}

interface NuclearTimelineResponse {
  intervalMinutes: number;
  buckets: NuclearTimelineBucket[];
  totalEvents: number;
  firstEvent?: string;
  lastEvent?: string;
}

interface SummaryRow {
  thwartedCount: number;
  hitsAfter: number;
  noHit: number;
}

const NuclearStatsPage: React.FC = () => {
  const [data, setData] = useState<ByPairRow[]>([]);
  const [summaryRows, setSummaryRows] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameQuery, setNameQuery] = useState<string>('');
  const [missesFilter, setMissesFilter] = useState<string>('all'); // 'all' or a number as string
  const [timeline, setTimeline] = useState<NuclearTimelineResponse | null>(null);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        setError(null);
        setTimelineError(null);

        const [statsRes, timelineRes] = await Promise.all([
          apiCallWithErrorHandling(API_ENDPOINTS.nuclearStats),
          apiCallWithErrorHandling(API_ENDPOINTS.nuclearTimeline(5)),
        ]);

        const res: NuclearStatsResponse = statsRes;
        setData(res.byPair || []);

        const dist = res.distribution || {};
        const distNoHit = res.distributionNoHit || {};
        const keys = new Set<number>();
        Object.keys(dist).forEach(k => keys.add(parseInt(k)));
        Object.keys(distNoHit).forEach(k => keys.add(parseInt(k)));
        const max = Math.max(0, ...Array.from(keys.values()));
        const rows: SummaryRow[] = [];
        for (let i = 0; i <= max; i++) {
          rows.push({
            thwartedCount: i,
            hitsAfter: dist[String(i)] || 0,
            noHit: distNoHit[String(i)] || 0,
          });
        }
        setSummaryRows(rows);

        setTimeline(timelineRes as NuclearTimelineResponse);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load nuclear stats';
        setError(msg);
        setTimelineError(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const summaryColumns: TableColumn<SummaryRow>[] = useMemo(() => [
    { key: 'thwartedCount', header: 'Thwarted Count', align: 'center', width: '25%', sortable: true },
    { key: 'hitsAfter', header: 'Hits After', align: 'center', width: '25%', sortable: true },
    { key: 'noHit', header: 'No Hit', align: 'center', width: '25%', sortable: true },
  ], []);

  const detailColumns: TableColumn<ByPairRow>[] = useMemo(() => [
    { 
      key: 'attackingNation', 
      header: 'Attacker', 
      width: '24%',
      render: (_v, row) => (
        row.attackerId ? (
          <div>
            <a
              href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${row.attackerId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary no-underline font-bold hover:underline"
            >
              {row.attackerNationName || row.attackingNation}
            </a>
            {row.attackerRulerName && (
              <div className="text-xs text-gray-400">{row.attackerRulerName}</div>
            )}
          </div>
        ) : (
          String(row.attackingNation)
        )
      )
    },
    { 
      key: 'defendingNation', 
      header: 'Defender', 
      width: '24%',
      render: (_v, row) => (
        row.defenderId ? (
          <div>
            <a
              href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${row.defenderId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary no-underline font-bold hover:underline"
            >
              {row.defenderNationName || row.defendingNation}
            </a>
            {row.defenderRulerName && (
              <div className="text-xs text-gray-400">{row.defenderRulerName}</div>
            )}
          </div>
        ) : (
          String(row.defendingNation)
        )
      )
    },
    { key: 'date', header: 'Date', width: '12%', align: 'center' },
    { key: 'thwartedBeforeHit', header: 'Thwarted Before First Hit', align: 'center', width: '20%', sortable: true },
    { key: 'hitAchieved', header: 'Hit Achieved', align: 'center', width: '15%', render: (v) => v ? 'Yes' : 'No' },
    { key: 'firstEventAt', header: 'First Attempt Time', width: '12%' },
    { key: 'firstHitAt', header: 'First Hit Time', width: '12%' },
  ], []);

  const uniqueMisses = useMemo(() => {
    const set = new Set<number>();
    data.forEach(r => set.add(r.thwartedBeforeHit));
    return Array.from(set.values()).sort((a, b) => a - b);
  }, [data]);

  const filteredDetails = useMemo(() => {
    const q = nameQuery.trim().toLowerCase();
    return data.filter(row => {
      const matchesName = q
        ? [
            row.attackerNationName, row.attackerRulerName,
            row.defenderNationName, row.defenderRulerName
          ]
            .map(v => (v || '').toLowerCase())
            .some(v => v.includes(q))
        : true;
      const matchesMisses = missesFilter === 'all' 
        ? true 
        : row.thwartedBeforeHit === parseInt(missesFilter);
      return matchesName && matchesMisses;
    });
  }, [data, nameQuery, missesFilter]);

  const sortedDetails = useMemo(() => {
    const toMs = (row: ByPairRow): number => {
      // date is YYYY-MM-DD; firstEventAt may contain time
      const dt = row.firstEventAt ? new Date(row.firstEventAt) : new Date(`${row.date}T00:00:00`);
      const t = dt.getTime();
      return Number.isNaN(t) ? 0 : t;
    };
    return [...filteredDetails].sort((a, b) => toMs(b) - toMs(a));
  }, [filteredDetails]);

  const hitPercentages = useMemo(() => {
    if (!timeline || !timeline.buckets || timeline.buckets.length === 0) return [];
    return timeline.buckets.map((b) => {
      const total = b.thwarted + b.hit;
      if (total === 0) return { percentage: 0, hit: 0, thwarted: 0, total: 0, time: b.start };
      const percentage = (b.hit / total) * 100;
      return { percentage, hit: b.hit, thwarted: b.thwarted, total, time: b.start };
    });
  }, [timeline]);

  const formatTimeTick = (timeStr: string) => {
    // timeStr is in format "HH:MM" (24-hour)
    const [hours, minutes] = timeStr.split(':').map(Number);
    const h12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const period = hours < 12 ? 'AM' : 'PM';
    return `${h12}:${String(minutes).padStart(2, '0')} ${period}`;
  };

  return (
    <TableContainer>
      <div className={tableClasses.header}>
        <h1 className={tableClasses.title}>Nuclear Stats</h1>
        <p className={tableClasses.subtitle}>Distribution of thwarted attempts.</p>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-bold mb-2 text-gray-200">Time of Day Analysis (5-minute intervals)</h2>
        <p className="text-sm text-gray-600 mb-3">Hit rate percentage by time of day - aggregated across all days</p>
        {timelineError && (
          <div className="text-red-600 text-sm mb-2">{timelineError}</div>
        )}
        {!timeline || !timeline.buckets || timeline.buckets.length === 0 || hitPercentages.length === 0 ? (
          <div className="text-sm text-gray-500">No timeline data available</div>
        ) : (
          <div className="overflow-x-auto">
            {(() => {
              // Data should start at 12:00 AM (00:00) - buckets are already ordered from 00:00 by backend
              // Use a more compact width - aim for ~1200px max, but ensure minimum spacing for readability
              const minWidth = 800;
              const maxWidth = 1400;
              const targetWidth = Math.min(maxWidth, Math.max(minWidth, hitPercentages.length * 3));
              const chartWidth = targetWidth;
              const pointSpacing = (chartWidth - 80) / (hitPercentages.length - 1 || 1);
              const points = hitPercentages.map((p, i) => {
                const x = 40 + i * pointSpacing;
                const y = 280 - (p.percentage / 100) * 260;
                return { x, y, ...p };
              });

              // Create path for the line
              const pathData = points.map((p, i) => {
                return `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`;
              }).join(' ');

              // Create area path for gradient fill
              const areaPath = `${pathData} L ${points[points.length - 1].x} 280 L ${points[0].x} 280 Z`;

              return (
                <div className="relative w-full h-80 pt-5 pb-15">
                  <svg width={chartWidth} height="320" className="overflow-visible min-w-full">
                    <defs>
                      <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="rgb(34, 197, 94)" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="rgb(34, 197, 94)" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    
                    {/* Y-axis grid lines and labels */}
                    {[0, 25, 50, 75, 100].map((val) => {
                      const y = 280 - (val / 100) * 260;
                      return (
                        <g key={`grid-${val}`}>
                          <line
                            x1="40"
                            y1={y}
                            x2={chartWidth}
                            y2={y}
                            stroke="#e5e7eb"
                            strokeWidth="1"
                            strokeDasharray="2,2"
                          />
                          <text
                            x="35"
                            y={y + 4}
                            textAnchor="end"
                            fontSize="11"
                            fill="#6b7280"
                          >
                            {val}%
                          </text>
                        </g>
                      );
                    })}

                    {/* X-axis (time) */}
                    <line
                      x1="40"
                      y1="280"
                      x2={chartWidth}
                      y2="280"
                      stroke="#d1d5db"
                      strokeWidth="2"
                    />

                    {/* Gradient fill area */}
                    <path
                      d={areaPath}
                      fill="url(#lineGradient)"
                    />
                    
                    {/* Line */}
                    <path
                      d={pathData}
                      fill="none"
                      stroke="rgb(34, 197, 94)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    
                    {/* X-axis time labels - show every 3 hours for better spacing */}
                    {(() => {
                      const intervalsPerHour = 60 / (timeline.intervalMinutes || 5);
                      const labelInterval = intervalsPerHour * 3; // Every 3 hours for better readability
                      const labels: React.ReactElement[] = [];
                      // Ensure we show midnight (12:00 AM)
                      if (points.length > 0) {
                        const firstPoint = points[0];
                        labels.push(
                          <g key={`label-0`}>
                            <line
                              x1={firstPoint.x}
                              y1="280"
                              x2={firstPoint.x}
                              y2="285"
                              stroke="#d1d5db"
                              strokeWidth="1"
                            />
                            <text
                              x={firstPoint.x}
                              y="310"
                              textAnchor="middle"
                              fontSize="11"
                              fill="#374151"
                              fontWeight="500"
                            >
                              {formatTimeTick(firstPoint.time)}
                            </text>
                          </g>
                        );
                      }
                      // Show labels every 3 hours
                      for (let i = labelInterval; i < points.length; i += labelInterval) {
                        const p = points[i];
                        const timeLabel = formatTimeTick(p.time);
                        labels.push(
                          <g key={`label-${i}`}>
                            <line
                              x1={p.x}
                              y1="280"
                              x2={p.x}
                              y2="285"
                              stroke="#d1d5db"
                              strokeWidth="1"
                            />
                            <text
                              x={p.x}
                              y="310"
                              textAnchor="middle"
                              fontSize="11"
                              fill="#374151"
                              fontWeight="500"
                            >
                              {timeLabel}
                            </text>
                          </g>
                        );
                      }
                      return labels;
                    })()}
                    
                    {/* Data points - only show circles on hover or when sparse */}
                    {points.map((p, i) => {
                      const timeLabel = formatTimeTick(p.time);
                      // Make points smaller and less visible when chart is dense
                      const pointRadius = chartWidth > 1200 ? 2.5 : 2;
                      return (
                        <g key={`point-${i}`}>
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={pointRadius}
                            fill="rgb(34, 197, 94)"
                            opacity="0.6"
                            className="hover:opacity-100 hover:r-4 transition-all cursor-pointer"
                          >
                            <title>
                              {`${timeLabel}\nHit Rate: ${p.percentage.toFixed(1)}%\nHits: ${p.hit}, Thwarted: ${p.thwarted}\nTotal: ${p.total}`}
                            </title>
                          </circle>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              );
            })()}
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
              <div className="ml-auto">Total events: {timeline.totalEvents}</div>
            </div>
          </div>
        )}
      </div>

      <div className="mb-2">
        <h2 className="text-xl font-bold mb-2 text-gray-200">Summary</h2>
        <ReusableTable<SummaryRow>
          data={summaryRows}
          columns={summaryColumns}
          loading={loading}
          error={error}
          emptyMessage="No distribution data available"
          className={tableClasses.tableWrapper}
          rowKey={(row) => `summary-${row.thwartedCount}`}
        />
      </div>

      <div>
        <h2 className="text-xl font-bold mb-2 text-gray-200">Details by Pair</h2>
        {/* Filters */}
        <div className={tableClasses.filterContainer}>
          <input 
            type="text" 
            value={nameQuery}
            placeholder="Filter by nation or ruler name"
            onChange={(e) => setNameQuery(e.target.value)}
            className={tableClasses.filterInput}
          />
          <select 
            value={missesFilter}
            onChange={(e) => setMissesFilter(e.target.value)}
            className={tableClasses.filterSelect}
          >
            <option value="all">All misses</option>
            {uniqueMisses.map(m => (
              <option key={m} value={String(m)}>{m} misses</option>
            ))}
          </select>
        </div>
        <ReusableTable<ByPairRow>
          data={sortedDetails}
          columns={detailColumns}
          loading={loading}
          error={error}
          emptyMessage="No nuclear attempt data available"
          className={tableClasses.tableWrapper}
          rowKey={(row, i) => `${row.attackingNation}→${row.defendingNation}-${i}`}
        />
      </div>
    </TableContainer>
  );
};

export default NuclearStatsPage;


