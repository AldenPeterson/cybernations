import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiCallWithErrorHandling, API_ENDPOINTS } from '../utils/api';
import TableContainer from '../components/TableContainer';

interface TopStrengthNationStat {
  rank: number;
  nation_id: number;
  nation_name: string;
  ruler_name: string;
  alliance_id: number;
  alliance_name: string;
  strength: number;
}

interface TopStrengthAllianceStat {
  rank: number;
  alliance_id: number;
  alliance_name: string;
  total_strength: number;
  average_strength: number;
  nation_count: number;
}

interface TopStrengthResponse {
  success: boolean;
  data: {
    nations: TopStrengthNationStat[];
    alliances: TopStrengthAllianceStat[];
  };
}

const DEFAULT_LIMIT = 250;

const TopStrengthPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [limit, setLimit] = useState<number>(DEFAULT_LIMIT);
  const [alliances, setAlliances] = useState<TopStrengthAllianceStat[]>([]);
  const [nations, setNations] = useState<TopStrengthNationStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedAlliances, setExpandedAlliances] = useState<Set<number>>(new Set());

  useEffect(() => {
    const limitParam = searchParams.get('limit');
    if (limitParam) {
      const parsed = parseInt(limitParam, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 1000) {
        setLimit(parsed);
        return;
      }
    }
    setLimit(DEFAULT_LIMIT);
  }, [searchParams]);

  const fetchData = useCallback(async (currentLimit: number) => {
    try {
      setLoading(true);
      setError(null);
      setExpandedAlliances(new Set());

      const response = await apiCallWithErrorHandling(API_ENDPOINTS.topStrength(currentLimit));
      const res: TopStrengthResponse = response;

      setAlliances(res.data?.alliances || []);
      setNations(res.data?.nations || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load top strength stats';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(limit);
  }, [limit, fetchData]);

  const handleLimitChange = (newLimit: number) => {
    const clamped = Math.min(Math.max(newLimit, 1), 1000);
    setLimit(clamped);
    const params = new URLSearchParams(searchParams);
    params.set('limit', clamped.toString());
    setSearchParams(params, { replace: true });
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const nationsByAlliance = useMemo(() => {
    const map = new Map<number, TopStrengthNationStat[]>();
    for (const nation of nations) {
      const existing = map.get(nation.alliance_id);
      if (existing) {
        existing.push(nation);
      } else {
        map.set(nation.alliance_id, [nation]);
      }
    }
    return map;
  }, [nations]);

  const toggleAllianceExpanded = useCallback((allianceId: number) => {
    setExpandedAlliances(prev => {
      const next = new Set(prev);
      if (next.has(allianceId)) {
        next.delete(allianceId);
      } else {
        next.add(allianceId);
      }
      return next;
    });
  }, []);

  return (
    <TableContainer>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-200 mb-2">Top Nations by Strength</h1>
        <p className="text-sm text-gray-400 mb-3">
          Shows the top nations by nation strength (default {DEFAULT_LIMIT}) and aggregates their strength by alliance. Click a row to expand and see individual nations and their global ranks.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-gray-300">
            Top&nbsp;
            <input
              type="number"
              min={1}
              max={1000}
              value={limit}
              onChange={(e) => {
                const value = parseInt(e.target.value || '0', 10);
                if (!isNaN(value)) {
                  handleLimitChange(value);
                }
              }}
              className="w-24 px-2 py-1 rounded-md border border-gray-600 bg-gray-900 text-gray-100 text-sm focus:outline-none focus:border-secondary"
            />
            &nbsp;nations
          </label>
        </div>
      </div>

      {loading && <div className="text-center py-8 text-gray-400">Loading...</div>}
      {error && <div className="text-center py-8 text-red-400">{error}</div>}
      {!loading && !error && alliances.length === 0 && (
        <div className="text-center py-8 text-gray-400">No strength statistics available</div>
      )}

      {!loading && !error && alliances.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse border border-gray-700 text-sm bg-gray-800">
              <thead>
                <tr className="bg-gray-700">
                  <th className="p-3 border border-gray-600 text-center text-white font-bold w-10"></th>
                  <th className="p-3 border border-gray-600 text-left text-white font-bold">
                    Alliance
                  </th>
                  <th className="p-3 border border-gray-600 text-right text-white font-bold">
                    Nations in Top {limit}
                  </th>
                  <th className="p-3 border border-gray-600 text-right text-white font-bold">
                    Total Strength
                  </th>
                  <th className="p-3 border border-gray-600 text-right text-white font-bold">
                    Avg Strength
                  </th>
                </tr>
              </thead>
              <tbody>
                {alliances.map((row) => {
                  const isExpanded = expandedAlliances.has(row.alliance_id);
                  const allianceNations = nationsByAlliance.get(row.alliance_id) || [];
                  return (
                    <React.Fragment key={row.alliance_id}>
                      <tr
                        className="bg-gray-800 hover:bg-gray-700 cursor-pointer"
                        onClick={() => toggleAllianceExpanded(row.alliance_id)}
                      >
                        <td className="p-2 border border-gray-700 text-center text-gray-300">
                          {allianceNations.length > 0 && (
                            <span className="text-xs">{isExpanded ? '▼' : '▶'}</span>
                          )}
                        </td>
                        <td className="p-2 border border-gray-700 font-bold text-gray-200">
                          {row.alliance_name}
                        </td>
                        <td className="p-2 border border-gray-700 text-right text-gray-200">
                          {row.nation_count}
                        </td>
                        <td className="p-2 border border-gray-700 text-right font-semibold text-primary">
                          {formatNumber(row.total_strength)}
                        </td>
                        <td className="p-2 border border-gray-700 text-right text-gray-200">
                          {formatNumber(row.average_strength)}
                        </td>
                      </tr>
                      {isExpanded && allianceNations.length > 0 && (
                        <tr className="bg-gray-900/30">
                          <td colSpan={5} className="p-0 border border-gray-700">
                            <div className="overflow-x-auto">
                              <table className="w-full border-collapse text-xs bg-gray-900">
                                <thead>
                                  <tr className="bg-gray-800">
                                    <th className="p-2 border border-gray-700 text-center text-gray-200 font-semibold">
                                      Global Rank
                                    </th>
                                    <th className="p-2 border border-gray-700 text-left text-gray-200 font-semibold">
                                      Nation
                                    </th>
                                    <th className="p-2 border border-gray-700 text-left text-gray-200 font-semibold">
                                      Ruler
                                    </th>
                                    <th className="p-2 border border-gray-700 text-right text-gray-200 font-semibold">
                                      Strength
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {allianceNations.map((nation) => (
                                    <tr key={nation.nation_id} className="hover:bg-gray-800/70">
                                      <td className="p-2 border border-gray-800 text-center text-gray-300">
                                        {nation.rank}
                                      </td>
                                      <td className="p-2 border border-gray-800 text-gray-200">
                                        <a
                                          href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${nation.nation_id}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-primary no-underline hover:underline"
                                        >
                                          {nation.nation_name}
                                        </a>
                                      </td>
                                      <td className="p-2 border border-gray-800 text-gray-300">
                                        {nation.ruler_name}
                                      </td>
                                      <td className="p-2 border border-gray-800 text-right text-gray-200">
                                        {formatNumber(nation.strength)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden">
            <div className="max-h-[65vh] overflow-y-auto space-y-1">
              {alliances.map((row) => {
                const isExpanded = expandedAlliances.has(row.alliance_id);
                const allianceNations = nationsByAlliance.get(row.alliance_id) || [];
                return (
                  <div
                    key={`mobile-alliance-${row.alliance_id}`}
                    className="bg-gray-900/50 rounded-lg overflow-hidden"
                  >
                    <div
                      className="p-2 cursor-pointer active:bg-gray-800/70"
                      onClick={() => toggleAllianceExpanded(row.alliance_id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="min-w-0 flex-1">
                            <div className="text-primary font-bold truncate text-sm">
                              {row.alliance_name}
                            </div>
                            <div className="text-xs text-gray-400">
                              {row.nation_count} nation{row.nation_count !== 1 ? 's' : ''} in top {limit}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="text-sm font-bold text-primary">
                            {formatNumber(row.total_strength)}
                          </div>
                          {allianceNations.length > 0 && (
                            <span className="text-gray-400 text-xs">
                              {isExpanded ? '▼' : '▶'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isExpanded && allianceNations.length > 0 && (
                      <div className="px-2 pb-2 pt-1 border-t border-gray-700/30 bg-gray-900/30 space-y-1">
                        {allianceNations.map((nation) => (
                          <div
                            key={`mobile-nation-${nation.nation_id}`}
                            className="bg-gray-900/60 rounded-md px-2 py-1.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="text-[11px] font-semibold text-gray-400 flex-shrink-0">
                                  #{nation.rank}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <a
                                    href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${nation.nation_id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary no-underline font-bold hover:underline truncate block text-xs"
                                  >
                                    {nation.nation_name}
                                  </a>
                                  <div className="text-[11px] text-gray-400 truncate">
                                    {nation.ruler_name}
                                  </div>
                                </div>
                              </div>
                              <div className="text-xs font-semibold text-gray-200 flex-shrink-0">
                                {formatNumber(nation.strength)}
                              </div>
                            </div>
                          </div>
                        ))}
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

export default TopStrengthPage;

