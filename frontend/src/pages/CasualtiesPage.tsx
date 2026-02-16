import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { apiCallWithErrorHandling, API_ENDPOINTS } from '../utils/api';
import { tableClasses } from '../styles/tableClasses';
import TableContainer from '../components/TableContainer';

interface CasualtyStat {
  rank: number;
  nation_id: number;
  nation_name: string;
  ruler_name: string;
  alliance_id: number;
  alliance_name: string;
  attacking_casualties: number;
  defensive_casualties: number;
  total_casualties: number;
}

interface CasualtiesResponse {
  success: boolean;
  data: CasualtyStat[];
}

const CasualtiesPage: React.FC = () => {
  const [data, setData] = useState<CasualtyStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<keyof CasualtyStat>('total_casualties');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [expandedNations, setExpandedNations] = useState<Set<number>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await apiCallWithErrorHandling(API_ENDPOINTS.casualties);
        const res: CasualtiesResponse = response;
        setData(res.data || []);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load casualties stats';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const handleSort = useCallback((columnKey: keyof CasualtyStat) => {
    if (sortColumn === columnKey) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection(columnKey === 'nation_name' || columnKey === 'alliance_name' ? 'asc' : 'desc');
    }
  }, [sortColumn]);

  const toggleExpanded = useCallback((nationId: number) => {
    setExpandedNations(prev => {
      const next = new Set(prev);
      if (next.has(nationId)) {
        next.delete(nationId);
      } else {
        next.add(nationId);
      }
      return next;
    });
  }, []);

  const sortedData = useMemo(() => {
    // Always calculate rank based on total_casualties to ensure it's always present
    // Sort by total_casualties first to get correct ranking
    const sortedByTotal = [...data].sort((a, b) => b.total_casualties - a.total_casualties);
    
    // Ensure rank is present - always recalculate to ensure it's correct
    const dataWithRank = data.map((row) => {
      // Always calculate rank based on total_casualties position
      const rankIndex = sortedByTotal.findIndex(r => r.nation_id === row.nation_id);
      const calculatedRank = rankIndex >= 0 ? rankIndex + 1 : (row.rank || 0);
      return { ...row, rank: calculatedRank };
    });

    const sorted = [...dataWithRank].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comparison = aVal.localeCompare(bVal);
        return sortDirection === 'asc' ? comparison : -comparison;
      }
      
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    });
    
    return sorted;
  }, [data, sortColumn, sortDirection]);

  return (
    <TableContainer>
      <div className={tableClasses.header}>
        <p className="mt-0 mb-3 md:mb-5 text-gray-400 text-sm md:text-base leading-relaxed">
          Top 100 nations by total casualties (offensive and defensive combined).
        </p>
      </div>

      {loading && <div className="text-center py-8 text-gray-400">Loading...</div>}
      {error && <div className="text-center py-8 text-red-400">{error}</div>}
      {!loading && !error && data.length === 0 && (
        <div className="text-center py-8 text-gray-400">No casualties data available</div>
      )}
      {!loading && !error && data.length > 0 && (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block rounded-xl shadow-md bg-gray-800 w-full max-w-full overflow-x-auto">
            <table className="w-full border-collapse min-w-[600px]">
            <thead className="bg-gray-800 sticky top-0 z-10">
              <tr>
                <th
                  className="px-2 py-1 text-center text-xs font-semibold text-gray-200 bg-gray-800"
                  style={{ width: '5%' }}
                >
                  <span className="truncate">Rank</span>
                </th>
                <th
                  className="px-2 py-1 text-left text-xs font-semibold text-gray-200 cursor-pointer hover:bg-gray-700 bg-gray-800"
                  style={{ width: '22%' }}
                  onClick={() => handleSort('nation_name')}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate">Nation</span>
                    {sortColumn === 'nation_name' && (
                      <span className="text-xs flex-shrink-0">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  className="px-2 py-1 text-left text-xs font-semibold text-gray-200 cursor-pointer hover:bg-gray-700 bg-gray-800"
                  style={{ width: '18%' }}
                  onClick={() => handleSort('alliance_name')}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate">Alliance</span>
                    {sortColumn === 'alliance_name' && (
                      <span className="text-xs flex-shrink-0">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  className="px-2 py-1 text-right text-xs font-semibold text-gray-200 cursor-pointer hover:bg-gray-700 bg-gray-800"
                  style={{ width: '18%' }}
                  onClick={() => handleSort('attacking_casualties')}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span className="truncate">Offensive Casualties</span>
                    {sortColumn === 'attacking_casualties' && (
                      <span className="text-xs flex-shrink-0">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  className="px-2 py-1 text-right text-xs font-semibold text-gray-200 cursor-pointer hover:bg-gray-700 bg-gray-800"
                  style={{ width: '18%' }}
                  onClick={() => handleSort('defensive_casualties')}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span className="truncate">Defensive Casualties</span>
                    {sortColumn === 'defensive_casualties' && (
                      <span className="text-xs flex-shrink-0">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  className="px-2 py-1 text-right text-xs font-semibold text-gray-200 cursor-pointer hover:bg-gray-700 bg-gray-800"
                  style={{ width: '19%' }}
                  onClick={() => handleSort('total_casualties')}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span className="truncate">Total Casualties</span>
                    {sortColumn === 'total_casualties' && (
                      <span className="text-xs flex-shrink-0">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {sortedData.map((row) => (
                <tr key={row.nation_id} className="hover:bg-gray-800/60">
                  <td className="px-2 py-1 text-xs text-center font-semibold text-gray-300">
                    {row.rank}
                  </td>
                  <td className="px-2 py-1 text-xs text-left">
                    <div>
                      <a
                        href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${row.nation_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary no-underline font-bold hover:underline"
                      >
                        {row.nation_name}
                      </a>
                      <div className="text-[10px] text-gray-400 leading-tight">{row.ruler_name}</div>
                    </div>
                  </td>
                  <td className="px-2 py-1 text-xs text-left">
                    {row.alliance_name}
                  </td>
                  <td className="px-2 py-1 text-xs text-right">
                    {formatNumber(row.attacking_casualties)}
                  </td>
                  <td className="px-2 py-1 text-xs text-right">
                    {formatNumber(row.defensive_casualties)}
                  </td>
                  <td className="px-2 py-1 text-xs text-right">
                    <span className="font-semibold text-primary">
                      {formatNumber(row.total_casualties)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden">
          <div className="max-h-[65vh] overflow-y-auto space-y-1">
            {sortedData.map((row) => {
              const isExpanded = expandedNations.has(row.nation_id);
              return (
                <div key={`mobile-${row.nation_id}`} className="bg-gray-900/50 rounded-lg overflow-hidden">
                  {/* Main line - always visible */}
                  <div
                    className="p-2 cursor-pointer active:bg-gray-800/70"
                    onClick={() => toggleExpanded(row.nation_id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-xs font-semibold text-gray-300 flex-shrink-0">
                          #{row.rank}
                        </span>
                        <div className="min-w-0 flex-1">
                          <a
                            href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${row.nation_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary no-underline font-bold hover:underline truncate block text-sm"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {row.nation_name}
                          </a>
                          <div className="text-xs text-gray-400 truncate">{row.ruler_name}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-sm font-bold text-primary">
                          {formatNumber(row.total_casualties)}
                        </div>
                        <span className="text-gray-400 text-xs">
                          {isExpanded ? '▼' : '▶'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-2 pb-2 pt-1 border-t border-gray-700/30 bg-gray-900/30">
                      <div className="text-xs text-gray-400 mb-1">
                        <span className="text-gray-300">Alliance: {row.alliance_name}</span>
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-x-4">
                        <span>Offensive: <span className="text-gray-300">{formatNumber(row.attacking_casualties)}</span></span>
                        <span>Defensive: <span className="text-gray-300">{formatNumber(row.defensive_casualties)}</span></span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        </>
      )}
    </TableContainer>
  );
};

export default CasualtiesPage;

