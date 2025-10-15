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

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const res: NuclearStatsResponse = await apiCallWithErrorHandling(API_ENDPOINTS.nuclearStats);
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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load nuclear stats');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
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

  return (
    <TableContainer>
      <div className={tableClasses.header}>
        <h1 className={tableClasses.title}>Nuclear Stats</h1>
        <p className={tableClasses.subtitle}>Distribution of thwarted attempts.</p>
      </div>

      <div className="mb-2">
        <h2 className="text-xl font-bold mb-2 text-slate-800">Summary</h2>
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
        <h2 className="text-xl font-bold mb-2 text-slate-800">Details by Pair</h2>
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


