import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiCallWithErrorHandling, API_ENDPOINTS } from '../utils/api';
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

interface AllianceCasualtyStat {
  rank: number;
  alliance_id: number;
  alliance_name: string;
  total_attacking_casualties: number;
  total_defensive_casualties: number;
  total_casualties: number;
  total_members: number;
  average_casualties_per_member: number;
}

interface CasualtiesResponse {
  success: boolean;
  data: CasualtyStat[];
}

interface AllianceCasualtiesResponse {
  success: boolean;
  data: AllianceCasualtyStat[];
}

interface CasualtiesPageProps {
  selectedAllianceId: number | null;
}

const CasualtiesPage: React.FC<CasualtiesPageProps> = ({ selectedAllianceId }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'top100' | 'alliance' | 'alliance-filtered'>('top100');
  const [data, setData] = useState<CasualtyStat[]>([]);
  const [allianceData, setAllianceData] = useState<AllianceCasualtyStat[]>([]);
  const [allianceMembersData, setAllianceMembersData] = useState<CasualtyStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [allianceLoading, setAllianceLoading] = useState(false);
  const [allianceMembersLoading, setAllianceMembersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allianceError, setAllianceError] = useState<string | null>(null);
  const [allianceMembersError, setAllianceMembersError] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<keyof CasualtyStat>('total_casualties');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [allianceSortColumn, setAllianceSortColumn] = useState<keyof AllianceCasualtyStat>('total_casualties');
  const [allianceSortDirection, setAllianceSortDirection] = useState<'asc' | 'desc'>('desc');
  const [expandedNations, setExpandedNations] = useState<Set<number>>(new Set());
  const [expandedAlliances, setExpandedAlliances] = useState<Set<number>>(new Set());

  // Initialize activeTab from URL parameter
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'alliance') {
      setActiveTab('alliance');
    } else if (tabParam === 'alliance-filtered') {
      setActiveTab('alliance-filtered');
    } else {
      setActiveTab('top100');
    }
  }, [searchParams]);

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

  useEffect(() => {
    const fetchAllianceData = async () => {
      try {
        setAllianceLoading(true);
        setAllianceError(null);

        const response = await apiCallWithErrorHandling(API_ENDPOINTS.casualtiesAlliances);
        const res: AllianceCasualtiesResponse = response;
        setAllianceData(res.data || []);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load alliance casualties stats';
        setAllianceError(msg);
      } finally {
        setAllianceLoading(false);
      }
    };
    fetchAllianceData();
  }, []);

  useEffect(() => {
    const fetchAllianceMembersData = async () => {
      if (!selectedAllianceId) {
        setAllianceMembersData([]);
        return;
      }

      try {
        setAllianceMembersLoading(true);
        setAllianceMembersError(null);

        const response = await apiCallWithErrorHandling(API_ENDPOINTS.casualtiesAllianceMembers(selectedAllianceId));
        const res: CasualtiesResponse = response;
        setAllianceMembersData(res.data || []);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load alliance members casualties stats';
        setAllianceMembersError(msg);
      } finally {
        setAllianceMembersLoading(false);
      }
    };
    fetchAllianceMembersData();
  }, [selectedAllianceId]);

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatNumberWithDecimals = (num: number): string => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const handleSort = useCallback((columnKey: keyof CasualtyStat) => {
    if (sortColumn === columnKey) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection(columnKey === 'nation_name' || columnKey === 'alliance_name' ? 'asc' : 'desc');
    }
  }, [sortColumn]);

  const handleAllianceSort = useCallback((columnKey: keyof AllianceCasualtyStat) => {
    if (allianceSortColumn === columnKey) {
      setAllianceSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setAllianceSortColumn(columnKey);
      setAllianceSortDirection(columnKey === 'alliance_name' ? 'asc' : 'desc');
    }
  }, [allianceSortColumn]);

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

  const sortedData = useMemo(() => {
    // Use alliance members data if we're on the alliance-filtered tab, otherwise use top 100 data
    const sourceData = activeTab === 'alliance-filtered' && selectedAllianceId
      ? allianceMembersData
      : data;
    
    // Always calculate rank based on total_casualties to ensure it's always present
    // Sort by total_casualties first to get correct ranking
    const sortedByTotal = [...sourceData].sort((a, b) => b.total_casualties - a.total_casualties);
    
    // Ensure rank is present - always recalculate to ensure it's correct
    const dataWithRank = sourceData.map((row) => {
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
  }, [data, allianceMembersData, sortColumn, sortDirection, activeTab, selectedAllianceId]);

  const sortedAllianceData = useMemo(() => {
    // Always calculate rank based on total_casualties to ensure it's always present
    // Sort by total_casualties first to get correct ranking
    const sortedByTotal = [...allianceData].sort((a, b) => b.total_casualties - a.total_casualties);
    
    // Ensure rank is present - always recalculate to ensure it's correct
    const dataWithRank = allianceData.map((row) => {
      // Always calculate rank based on total_casualties position
      const rankIndex = sortedByTotal.findIndex(r => r.alliance_id === row.alliance_id);
      const calculatedRank = rankIndex >= 0 ? rankIndex + 1 : (row.rank || 0);
      return { ...row, rank: calculatedRank };
    });

    const sorted = [...dataWithRank].sort((a, b) => {
      const aVal = a[allianceSortColumn];
      const bVal = b[allianceSortColumn];
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comparison = aVal.localeCompare(bVal);
        return allianceSortDirection === 'asc' ? comparison : -comparison;
      }
      
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      return allianceSortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    });
    
    return sorted;
  }, [allianceData, allianceSortColumn, allianceSortDirection]);

  return (
    <TableContainer>
      {/* Tabs */}
      <div className="mb-6 border-b border-gray-700">
        <div className="flex gap-4">
          <button
            onClick={() => {
              setActiveTab('top100');
              const newSearchParams = new URLSearchParams(searchParams);
              newSearchParams.set('tab', 'top100');
              setSearchParams(newSearchParams, { replace: true });
            }}
            className={`px-4 py-2 font-semibold transition-colors ${
              activeTab === 'top100'
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Top 100
          </button>
          <button
            onClick={() => {
              setActiveTab('alliance');
              const newSearchParams = new URLSearchParams(searchParams);
              newSearchParams.set('tab', 'alliance');
              setSearchParams(newSearchParams, { replace: true });
            }}
            className={`px-4 py-2 font-semibold transition-colors ${
              activeTab === 'alliance'
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Alliance Totals
          </button>
          <button
            onClick={() => {
              setActiveTab('alliance-filtered');
              const newSearchParams = new URLSearchParams(searchParams);
              newSearchParams.set('tab', 'alliance-filtered');
              setSearchParams(newSearchParams, { replace: true });
            }}
            className={`px-4 py-2 font-semibold transition-colors ${
              activeTab === 'alliance-filtered'
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-400 hover:text-gray-200'
            }`}
            disabled={!selectedAllianceId}
          >
            {selectedAllianceId ? 'Alliance Members' : 'Select Alliance'}
          </button>
        </div>
      </div>

      {(activeTab === 'top100' || activeTab === 'alliance-filtered') && (
        <>
          {(loading || (activeTab === 'alliance-filtered' && allianceMembersLoading)) && (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          )}
          {(error || (activeTab === 'alliance-filtered' && allianceMembersError)) && (
            <div className="text-center py-8 text-red-400">
              {activeTab === 'alliance-filtered' ? allianceMembersError : error}
            </div>
          )}
          {activeTab === 'alliance-filtered' && !selectedAllianceId && (
            <div className="text-center py-8 text-gray-400">Please select an alliance from the dropdown in the top right</div>
          )}
          {!loading && !error && sortedData.length === 0 && activeTab === 'top100' && (
            <div className="text-center py-8 text-gray-400">No casualties data available</div>
          )}
          {!allianceMembersLoading && !allianceMembersError && sortedData.length === 0 && activeTab === 'alliance-filtered' && selectedAllianceId && (
            <div className="text-center py-8 text-gray-400">No casualties data available for the selected alliance</div>
          )}
          {((!loading && !error && sortedData.length > 0 && activeTab === 'top100') || 
            (!allianceMembersLoading && !allianceMembersError && sortedData.length > 0 && activeTab === 'alliance-filtered')) && (
            <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse border border-gray-700 text-sm bg-gray-800">
              <thead>
                <tr className="bg-gray-700">
                  <th 
                    className="p-3 border border-gray-600 text-center text-white font-bold cursor-pointer hover:bg-gray-600 transition-colors select-none"
                    onClick={() => handleSort('rank')}
                  >
                    <div className="flex items-center justify-center gap-2">
                      Rank
                      <span className="text-xs text-gray-400">
                        {sortColumn === 'rank' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th 
                    className="p-3 border border-gray-600 text-left text-white font-bold cursor-pointer hover:bg-gray-600 transition-colors select-none"
                    onClick={() => handleSort('nation_name')}
                  >
                    <div className="flex items-center gap-2">
                      Nation
                      <span className="text-xs text-gray-400">
                        {sortColumn === 'nation_name' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th 
                    className="p-3 border border-gray-600 text-left text-white font-bold cursor-pointer hover:bg-gray-600 transition-colors select-none"
                    onClick={() => handleSort('alliance_name')}
                  >
                    <div className="flex items-center gap-2">
                      Alliance
                      <span className="text-xs text-gray-400">
                        {sortColumn === 'alliance_name' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th 
                    className="p-3 border border-gray-600 text-right text-white font-bold cursor-pointer hover:bg-gray-600 transition-colors select-none"
                    onClick={() => handleSort('attacking_casualties')}
                  >
                    <div className="flex items-center justify-end gap-2">
                      Offensive Casualties
                      <span className="text-xs text-gray-400">
                        {sortColumn === 'attacking_casualties' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th 
                    className="p-3 border border-gray-600 text-right text-white font-bold cursor-pointer hover:bg-gray-600 transition-colors select-none"
                    onClick={() => handleSort('defensive_casualties')}
                  >
                    <div className="flex items-center justify-end gap-2">
                      Defensive Casualties
                      <span className="text-xs text-gray-400">
                        {sortColumn === 'defensive_casualties' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th 
                    className="p-3 border border-gray-600 text-right text-white font-bold cursor-pointer hover:bg-gray-600 transition-colors select-none"
                    onClick={() => handleSort('total_casualties')}
                  >
                    <div className="flex items-center justify-end gap-2">
                      Total Casualties
                      <span className="text-xs text-gray-400">
                        {sortColumn === 'total_casualties' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedData.map((row) => (
                  <tr key={row.nation_id} className="bg-gray-800 hover:bg-gray-700">
                    <td className="p-2 border border-gray-700 text-center font-semibold text-gray-200">
                      {row.rank}
                    </td>
                    <td className="p-2 border border-gray-700 font-bold text-gray-200">
                      <div>
                        <a
                          href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${row.nation_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary no-underline hover:underline"
                        >
                          {row.nation_name}
                        </a>
                        <div className="text-xs text-gray-400">{row.ruler_name}</div>
                      </div>
                    </td>
                    <td className="p-2 border border-gray-700 text-gray-200">
                      {row.alliance_name}
                    </td>
                    <td className="p-2 border border-gray-700 text-right text-gray-200">
                      {formatNumber(row.attacking_casualties)}
                    </td>
                    <td className="p-2 border border-gray-700 text-right text-gray-200">
                      {formatNumber(row.defensive_casualties)}
                    </td>
                    <td className="p-2 border border-gray-700 text-right font-semibold text-primary">
                      {formatNumber(row.total_casualties)}
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
        </>
      )}

      {activeTab === 'alliance' && (
        <>
          {allianceLoading && <div className="text-center py-8 text-gray-400">Loading...</div>}
          {allianceError && <div className="text-center py-8 text-red-400">{allianceError}</div>}
          {!allianceLoading && !allianceError && allianceData.length === 0 && (
            <div className="text-center py-8 text-gray-400">No alliance casualties data available</div>
          )}
          {!allianceLoading && !allianceError && allianceData.length > 0 && (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full border-collapse border border-gray-700 text-sm bg-gray-800">
                  <thead>
                    <tr className="bg-gray-700">
                      <th 
                        className="p-3 border border-gray-600 text-center text-white font-bold cursor-pointer hover:bg-gray-600 transition-colors select-none"
                        onClick={() => handleAllianceSort('rank')}
                      >
                        <div className="flex items-center justify-center gap-2">
                          Rank
                          <span className="text-xs text-gray-400">
                            {allianceSortColumn === 'rank' ? (allianceSortDirection === 'asc' ? '↑' : '↓') : '↕'}
                          </span>
                        </div>
                      </th>
                      <th 
                        className="p-3 border border-gray-600 text-left text-white font-bold cursor-pointer hover:bg-gray-600 transition-colors select-none"
                        onClick={() => handleAllianceSort('alliance_name')}
                      >
                        <div className="flex items-center gap-2">
                          Alliance
                          <span className="text-xs text-gray-400">
                            {allianceSortColumn === 'alliance_name' ? (allianceSortDirection === 'asc' ? '↑' : '↓') : '↕'}
                          </span>
                        </div>
                      </th>
                      <th 
                        className="p-3 border border-gray-600 text-right text-white font-bold cursor-pointer hover:bg-gray-600 transition-colors select-none"
                        onClick={() => handleAllianceSort('total_attacking_casualties')}
                      >
                        <div className="flex items-center justify-end gap-2">
                          Total Offensive Casualties
                          <span className="text-xs text-gray-400">
                            {allianceSortColumn === 'total_attacking_casualties' ? (allianceSortDirection === 'asc' ? '↑' : '↓') : '↕'}
                          </span>
                        </div>
                      </th>
                      <th 
                        className="p-3 border border-gray-600 text-right text-white font-bold cursor-pointer hover:bg-gray-600 transition-colors select-none"
                        onClick={() => handleAllianceSort('total_defensive_casualties')}
                      >
                        <div className="flex items-center justify-end gap-2">
                          Total Defensive Casualties
                          <span className="text-xs text-gray-400">
                            {allianceSortColumn === 'total_defensive_casualties' ? (allianceSortDirection === 'asc' ? '↑' : '↓') : '↕'}
                          </span>
                        </div>
                      </th>
                      <th 
                        className="p-3 border border-gray-600 text-right text-white font-bold cursor-pointer hover:bg-gray-600 transition-colors select-none"
                        onClick={() => handleAllianceSort('total_casualties')}
                      >
                        <div className="flex items-center justify-end gap-2">
                          Total Casualties
                          <span className="text-xs text-gray-400">
                            {allianceSortColumn === 'total_casualties' ? (allianceSortDirection === 'asc' ? '↑' : '↓') : '↕'}
                          </span>
                        </div>
                      </th>
                      <th 
                        className="p-3 border border-gray-600 text-right text-white font-bold cursor-pointer hover:bg-gray-600 transition-colors select-none"
                        onClick={() => handleAllianceSort('total_members')}
                      >
                        <div className="flex items-center justify-end gap-2">
                          Total Members
                          <span className="text-xs text-gray-400">
                            {allianceSortColumn === 'total_members' ? (allianceSortDirection === 'asc' ? '↑' : '↓') : '↕'}
                          </span>
                        </div>
                      </th>
                      <th 
                        className="p-3 border border-gray-600 text-right text-white font-bold cursor-pointer hover:bg-gray-600 transition-colors select-none"
                        onClick={() => handleAllianceSort('average_casualties_per_member')}
                      >
                        <div className="flex items-center justify-end gap-2">
                          Avg Casualties per Member
                          <span className="text-xs text-gray-400">
                            {allianceSortColumn === 'average_casualties_per_member' ? (allianceSortDirection === 'asc' ? '↑' : '↓') : '↕'}
                          </span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAllianceData.map((row) => (
                      <tr key={row.alliance_id} className="bg-gray-800 hover:bg-gray-700">
                        <td className="p-2 border border-gray-700 text-center font-semibold text-gray-200">
                          {row.rank}
                        </td>
                        <td className="p-2 border border-gray-700 font-bold text-gray-200">
                          {row.alliance_name}
                        </td>
                        <td className="p-2 border border-gray-700 text-right text-gray-200">
                          {formatNumber(row.total_attacking_casualties)}
                        </td>
                        <td className="p-2 border border-gray-700 text-right text-gray-200">
                          {formatNumber(row.total_defensive_casualties)}
                        </td>
                        <td className="p-2 border border-gray-700 text-right font-semibold text-primary">
                          {formatNumber(row.total_casualties)}
                        </td>
                        <td className="p-2 border border-gray-700 text-right text-gray-200">
                          {formatNumber(row.total_members)}
                        </td>
                        <td className="p-2 border border-gray-700 text-right text-gray-200">
                          {formatNumberWithDecimals(row.average_casualties_per_member)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden">
                <div className="max-h-[65vh] overflow-y-auto space-y-1">
                  {sortedAllianceData.map((row) => {
                    const isExpanded = expandedAlliances.has(row.alliance_id);
                    return (
                      <div key={`mobile-alliance-${row.alliance_id}`} className="bg-gray-900/50 rounded-lg overflow-hidden">
                        {/* Main line - always visible */}
                        <div
                          className="p-2 cursor-pointer active:bg-gray-800/70"
                          onClick={() => toggleAllianceExpanded(row.alliance_id)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-xs font-semibold text-gray-300 flex-shrink-0">
                                #{row.rank}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="text-primary no-underline font-bold truncate block text-sm">
                                  {row.alliance_name}
                                </div>
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
                            <div className="text-xs text-gray-400 flex items-center justify-between mb-1">
                              <span>Offensive: <span className="text-gray-300">{formatNumber(row.total_attacking_casualties)}</span></span>
                              <span>Defensive: <span className="text-gray-300">{formatNumber(row.total_defensive_casualties)}</span></span>
                            </div>
                            <div className="text-xs text-gray-400 flex items-center justify-between">
                              <span>Members: <span className="text-gray-300">{formatNumber(row.total_members)}</span></span>
                              <span>Avg/Member: <span className="text-gray-300">{formatNumberWithDecimals(row.average_casualties_per_member)}</span></span>
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
        </>
      )}
    </TableContainer>
  );
};

export default CasualtiesPage;

