import React, { useEffect, useMemo, useState } from 'react';
import { apiCallWithErrorHandling, API_ENDPOINTS } from '../utils/api';
import PageContainer from '../components/PageContainer';

type Alliance = {
  id: number;
  name: string;
  nationCount: number;
};

type ByAllianceItem = {
  allianceId: number;
  allianceName: string;
  attacking: number;
  defending: number;
  total: number;
};

type WarCountsResponse = {
  success: boolean;
  allianceId: number;
  counts: {
    attacking: number;
    defending: number;
    activeTotal: number;
    byAlliance: ByAllianceItem[];
  };
};

type AllianceRow = {
  alliance: Alliance;
  activeCounts?: WarCountsResponse['counts'];
  allCounts?: WarCountsResponse['counts'];
  error?: string;
  expanded: boolean;
};

type SortColumn = 'alliance' | 'attacking' | 'defending' | 'total' | 'nations';
type SortDirection = 'asc' | 'desc';

// Same default start date as Damage tab (wars declared after this date)
const DEFAULT_START_DATE = '2026-02-05';

/** Format YYYY-MM-DD to MM/DD/YYYY for API */
function formatStartDateForApi(isoDate: string): string {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${m}/${d}/${y}`;
}

const GlobalWarsPage: React.FC = () => {
  const [rows, setRows] = useState<AllianceRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>(DEFAULT_START_DATE);
  const [includeExpired, setIncludeExpired] = useState<boolean>(false);
  const [avgPerNation, setAvgPerNation] = useState<boolean>(false);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const startDateForApi = formatStartDateForApi(startDate);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const alliancesData = await apiCallWithErrorHandling(API_ENDPOINTS.alliances);
        if (!alliancesData.success) throw new Error(alliancesData.error || 'Failed to load alliances');
        const alliances: Alliance[] = alliancesData.alliances;

        if (cancelled) return;

        // Initialize rows
        setRows(alliances.map(a => ({ alliance: a, expanded: false })));

        const params = (incExp: boolean) => ({ includeExpired: incExp, ...(startDateForApi ? { startDate: startDateForApi } : {}) });

        // Fetch war counts (both active-only and includeExpired) in parallel, chunked to avoid overwhelming server
        const chunkSize = 10;
        for (let i = 0; i < alliances.length; i += chunkSize) {
          const chunk = alliances.slice(i, i + chunkSize);
          const [activeResults, allResults] = await Promise.all([
            Promise.allSettled(chunk.map(a => apiCallWithErrorHandling(API_ENDPOINTS.warCounts(a.id, params(false))))),
            Promise.allSettled(chunk.map(a => apiCallWithErrorHandling(API_ENDPOINTS.warCounts(a.id, params(true)))))
          ]);
          if (cancelled) return;

          setRows(prev => prev.map(r => {
            const indexInChunk = chunk.findIndex(a => a.id === r.alliance.id);
            if (indexInChunk === -1) return r;
            const activeRes = activeResults[indexInChunk];
            const allRes = allResults[indexInChunk];
            const next: AllianceRow = { ...r };
            if (activeRes.status === 'fulfilled') {
              next.activeCounts = (activeRes.value as WarCountsResponse).counts;
            } else {
              next.error = (activeRes as PromiseRejectedResult).reason?.message || 'Failed to load active counts';
            }
            if (allRes.status === 'fulfilled') {
              next.allCounts = (allRes.value as WarCountsResponse).counts;
            } else {
              next.error = next.error || (allRes as PromiseRejectedResult).reason?.message || 'Failed to load all counts';
            }
            return next;
          }));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [startDateForApi]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column and default to descending
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const sortedRows = useMemo(() => {
    if (!sortColumn) return rows;
    
    return [...rows].sort((a, b) => {
      let valueA: number | string;
      let valueB: number | string;
      
      switch (sortColumn) {
        case 'alliance':
          valueA = a.alliance.name.toLowerCase();
          valueB = b.alliance.name.toLowerCase();
          break;
        case 'attacking': {
          const countsA = includeExpired ? a.allCounts : a.activeCounts;
          const countsB = includeExpired ? b.allCounts : b.activeCounts;
          if (avgPerNation) {
            const denomA = a.alliance.nationCount || 0;
            const denomB = b.alliance.nationCount || 0;
            valueA = (!countsA || !denomA) ? -Infinity : countsA.attacking / denomA;
            valueB = (!countsB || !denomB) ? -Infinity : countsB.attacking / denomB;
          } else {
            valueA = countsA?.attacking ?? -Infinity;
            valueB = countsB?.attacking ?? -Infinity;
          }
          break;
        }
        case 'defending': {
          const countsA = includeExpired ? a.allCounts : a.activeCounts;
          const countsB = includeExpired ? b.allCounts : b.activeCounts;
          if (avgPerNation) {
            const denomA = a.alliance.nationCount || 0;
            const denomB = b.alliance.nationCount || 0;
            valueA = (!countsA || !denomA) ? -Infinity : countsA.defending / denomA;
            valueB = (!countsB || !denomB) ? -Infinity : countsB.defending / denomB;
          } else {
            valueA = countsA?.defending ?? -Infinity;
            valueB = countsB?.defending ?? -Infinity;
          }
          break;
        }
        case 'total': {
          const countsA = includeExpired ? a.allCounts : a.activeCounts;
          const countsB = includeExpired ? b.allCounts : b.activeCounts;
          if (avgPerNation) {
            const denomA = a.alliance.nationCount || 0;
            const denomB = b.alliance.nationCount || 0;
            valueA = (!countsA || !denomA) ? -Infinity : countsA.activeTotal / denomA;
            valueB = (!countsB || !denomB) ? -Infinity : countsB.activeTotal / denomB;
          } else {
            valueA = countsA?.activeTotal ?? -Infinity;
            valueB = countsB?.activeTotal ?? -Infinity;
          }
          break;
        }
        case 'nations':
          valueA = a.alliance.nationCount ?? 0;
          valueB = b.alliance.nationCount ?? 0;
          break;
      }
      
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        const comparison = valueA.localeCompare(valueB);
        return sortDirection === 'asc' ? comparison : -comparison;
      } else {
        const comparison = (valueA as number) - (valueB as number);
        return sortDirection === 'asc' ? comparison : -comparison;
      }
    });
  }, [rows, sortColumn, sortDirection, includeExpired, avgPerNation]);

  const totals = useMemo(() => {
    const toOneDecimal = (n: number) => Number(n.toFixed(1));
    if (!avgPerNation) {
      const attacking = rows.reduce((sum, r) => sum + ((includeExpired ? r.allCounts : r.activeCounts)?.attacking || 0), 0);
      const defending = rows.reduce((sum, r) => sum + ((includeExpired ? r.allCounts : r.activeCounts)?.defending || 0), 0);
      const activeTotal = rows.reduce((sum, r) => sum + ((includeExpired ? r.allCounts : r.activeCounts)?.activeTotal || 0), 0);
      return { attacking, defending, activeTotal };
    }
    const attacking = rows.reduce((sum, r) => {
      const counts = includeExpired ? r.allCounts : r.activeCounts;
      const denom = r.alliance.nationCount || 0;
      if (!counts || !denom) return sum;
      return sum + toOneDecimal(counts.attacking / denom);
    }, 0);
    const defending = rows.reduce((sum, r) => {
      const counts = includeExpired ? r.allCounts : r.activeCounts;
      const denom = r.alliance.nationCount || 0;
      if (!counts || !denom) return sum;
      return sum + toOneDecimal(counts.defending / denom);
    }, 0);
    const activeTotal = rows.reduce((sum, r) => {
      const counts = includeExpired ? r.allCounts : r.activeCounts;
      const denom = r.alliance.nationCount || 0;
      if (!counts || !denom) return sum;
      return sum + toOneDecimal(counts.activeTotal / denom);
    }, 0);
    return { attacking: toOneDecimal(attacking), defending: toOneDecimal(defending), activeTotal: toOneDecimal(activeTotal) };
  }, [rows, includeExpired, avgPerNation]);

  const toggleExpand = (id: number) => {
    setRows(prev => prev.map(r => r.alliance.id === id ? { ...r, expanded: !r.expanded } : r));
  };

  const getSortIndicator = (column: SortColumn) => {
    if (sortColumn !== column) return null;
    return (
      <span className="ml-1 text-gray-400">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  return (
    <PageContainer className="px-4 sm:px-6 lg:px-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-white">Global Wars</h1>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <span className="whitespace-nowrap">Start date:</span>
            <input
              type="date"
              className="form-input rounded border border-gray-600 bg-gray-800 text-gray-200 px-2 py-1.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary/30"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              title="Only count wars declared after this date (same as Damage tab default)"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              className="form-checkbox h-4 w-4 text-primary focus:ring-primary/30 border-gray-600 bg-gray-800 rounded"
              checked={includeExpired}
              onChange={(e) => setIncludeExpired(e.target.checked)}
            />
            Include expired
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              className="form-checkbox h-4 w-4 text-primary focus:ring-primary/30 border-gray-600 bg-gray-800 rounded"
              checked={avgPerNation}
              onChange={(e) => setAvgPerNation(e.target.checked)}
            />
            Average per nation (1 decimal)
          </label>
        </div>
      </div>
      <p className="text-gray-400 text-sm mb-2">
        {startDateForApi ? `Wars declared after ${startDateForApi}. ` : ''}
        {includeExpired ? 'Including ended/expired wars.' : 'Only active wars (excluding ended/expired).'}
        {avgPerNation ? ' Showing averages per nation.' : ''}
      </p>

      {error && (
        <div className="mb-3 text-error">{error}</div>
      )}

      <div className="overflow-x-auto border border-gray-700 rounded-lg bg-gray-900">
        <table className="min-w-full divide-y divide-gray-700">
          <thead>
            <tr className="bg-gray-800">
              <th 
                className="px-4 py-3 text-left text-xs font-semibold text-gray-300 cursor-pointer hover:bg-gray-700 select-none"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSort('alliance');
                }}
              >
                Alliance{getSortIndicator('alliance')}
              </th>
              <th 
                className="px-4 py-3 text-right text-xs font-semibold text-gray-300 cursor-pointer hover:bg-gray-700 select-none"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSort('attacking');
                }}
              >
                Attacking{getSortIndicator('attacking')}
              </th>
              <th 
                className="px-4 py-3 text-right text-xs font-semibold text-gray-300 cursor-pointer hover:bg-gray-700 select-none"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSort('defending');
                }}
              >
                Defending{getSortIndicator('defending')}
              </th>
              <th 
                className="px-4 py-3 text-right text-xs font-semibold text-gray-300 cursor-pointer hover:bg-gray-700 select-none"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSort('total');
                }}
              >
                Total{getSortIndicator('total')}
              </th>
              <th 
                className="px-4 py-3 text-right text-xs font-semibold text-gray-300 cursor-pointer hover:bg-gray-700 select-none"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSort('nations');
                }}
              >
                Nations{getSortIndicator('nations')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {sortedRows.map(r => (
              <React.Fragment key={r.alliance.id}>
                <tr className="hover:bg-gray-800/50 cursor-pointer" onClick={() => toggleExpand(r.alliance.id)}>
                  <td className="px-4 py-3 text-sm text-gray-200 flex items-center gap-2">
                    <span className="inline-block w-4 text-gray-400">{r.expanded ? '▾' : '▸'}</span>
                    <span className="font-semibold">{r.alliance.name}</span>
                    {r.error && <span className="text-error text-xs ml-2">(error)</span>}
                    {loading && !r.activeCounts && !r.allCounts && <span className="text-gray-400 text-xs ml-2">loading…</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-200">{
                    (() => {
                      const counts = includeExpired ? r.allCounts : r.activeCounts;
                      if (!counts) return '-';
                      if (!avgPerNation) return counts.attacking;
                      const denom = r.alliance.nationCount || 0;
                      if (!denom) return '-';
                      return (counts.attacking / denom).toFixed(1);
                    })()
                  }</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-200">{
                    (() => {
                      const counts = includeExpired ? r.allCounts : r.activeCounts;
                      if (!counts) return '-';
                      if (!avgPerNation) return counts.defending;
                      const denom = r.alliance.nationCount || 0;
                      if (!denom) return '-';
                      return (counts.defending / denom).toFixed(1);
                    })()
                  }</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-200">{
                    (() => {
                      const counts = includeExpired ? r.allCounts : r.activeCounts;
                      if (!counts) return '-';
                      if (!avgPerNation) return counts.activeTotal;
                      const denom = r.alliance.nationCount || 0;
                      if (!denom) return '-';
                      return (counts.activeTotal / denom).toFixed(1);
                    })()
                  }</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-400">{r.alliance.nationCount}</td>
                </tr>
                {r.expanded && ((includeExpired ? r.allCounts : r.activeCounts)) && (
                  <tr>
                    <td colSpan={5} className="px-0 py-0">
                      <div className="bg-gray-950/60">
                        <div className="px-10 py-3">
                          <div className="text-xs text-gray-400 mb-2">By opposing alliance</div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full">
                              <thead>
                                <tr>
                                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-300">Alliance</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-gray-300">Attacking</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-gray-300">Defending</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-gray-300">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {[...(includeExpired ? r.allCounts : r.activeCounts)!.byAlliance]
                                  .sort((a, b) => {
                                    const aName = (a.allianceName || '').toLowerCase();
                                    const bName = (b.allianceName || '').toLowerCase();
                                    return aName.localeCompare(bName);
                                  })
                                  .map(item => (
                                  <tr key={item.allianceId} className="hover:bg-gray-900/60">
                                    <td className="px-2 py-2 text-sm text-gray-200">{item.allianceName}</td>
                                    <td className="px-2 py-2 text-sm text-right text-gray-200">{
                                      (() => {
                                        if (!avgPerNation) return item.attacking;
                                        const denom = r.alliance.nationCount || 0;
                                        if (!denom) return '-';
                                        return (item.attacking / denom).toFixed(1);
                                      })()
                                    }</td>
                                    <td className="px-2 py-2 text-sm text-right text-gray-200">{
                                      (() => {
                                        if (!avgPerNation) return item.defending;
                                        const denom = r.alliance.nationCount || 0;
                                        if (!denom) return '-';
                                        return (item.defending / denom).toFixed(1);
                                      })()
                                    }</td>
                                    <td className="px-2 py-2 text-sm text-right text-gray-200">{
                                      (() => {
                                        if (!avgPerNation) return item.total;
                                        const denom = r.alliance.nationCount || 0;
                                        if (!denom) return '-';
                                        return (item.total / denom).toFixed(1);
                                      })()
                                    }</td>
                                  </tr>
                                ))}
                                {(includeExpired ? r.allCounts : r.activeCounts)!.byAlliance.length === 0 && (
                                  <tr>
                                    <td colSpan={4} className="px-2 py-2 text-sm text-gray-400">No active wars</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
          <tfoot className="bg-gray-800/60">
            <tr>
              <td className="px-4 py-3 text-sm font-semibold text-gray-200">Totals</td>
              <td className="px-4 py-3 text-sm text-right text-gray-200">{totals.attacking}</td>
              <td className="px-4 py-3 text-sm text-right text-gray-200">{totals.defending}</td>
              <td className="px-4 py-3 text-sm text-right text-gray-200">{totals.activeTotal}</td>
              <td className="px-4 py-3" />
            </tr>
          </tfoot>
        </table>
      </div>
    </PageContainer>
  );
};

export default GlobalWarsPage;


