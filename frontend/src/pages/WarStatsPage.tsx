import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { apiCallWithErrorHandling, API_ENDPOINTS } from '../utils/api';
import type { TableColumn } from '../components/ReusableTable';
import { tableClasses } from '../styles/tableClasses';
import TableContainer from '../components/TableContainer';

interface AllianceTotal {
  alliance_id: number;
  alliance_name: string;
  total_damage_dealt: number;
  total_damage_received: number;
  net_damage: number;
  offensive_wars: number;
  defensive_wars: number;
}

interface NationBreakdown {
  alliance_id: number;
  alliance_name: string;
  nation_id: number;
  nation_name: string;
  ruler_name: string;
  opponent_alliance_id: number | null;
  opponent_alliance_name: string | null;
  damage_dealt: number;
  damage_received: number;
  net_damage: number;
  offensive_wars: number;
  defensive_wars: number;
}

interface WarRecord {
  war_id: number;
  nation_id: number;
  alliance_id: number;
  opponent_nation_id: number;
  opponent_alliance_id: number | null;
  nation_name: string;
  ruler_name: string;
  opponent_nation_name: string;
  opponent_ruler_name: string;
  alliance_name: string;
  opponent_alliance_name: string | null;
  war_type: 'offensive' | 'defensive';
  status: string;
  date: string;
  end_date: string;
  destruction: string | null;
  damage_dealt: number;
  damage_received: number;
  net_damage: number;
  attack_percent: number | null;
  defend_percent: number | null;
}

// Optimized: Pre-computed opponent breakdown structure
interface OpponentBreakdown {
  opponent_alliance_id: number | null;
  opponent_alliance_name: string | null;
  damage_dealt: number;
  damage_received: number;
  net_damage: number;
  nations_involved: number;
  offensive_wars: number;
  defensive_wars: number;
}

const WarStatsPage: React.FC = () => {
  const [allianceTotals, setAllianceTotals] = useState<AllianceTotal[]>([]);
  const [nationBreakdown, setNationBreakdown] = useState<NationBreakdown[]>([]);
  const [warRecords, setWarRecords] = useState<WarRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allianceFilter, setAllianceFilter] = useState<string>('');
  const [expandedAlliances, setExpandedAlliances] = useState<Set<number>>(new Set());
  const [expandedOpponents, setExpandedOpponents] = useState<Set<string>>(new Set());
  const [expandedNations, setExpandedNations] = useState<Set<string>>(new Set());

  // Sorting state
  const [sortColumn, setSortColumn] = useState<keyof AllianceTotal>('net_damage');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Optimized: Debounced filter to reduce re-renders and API calls
  const [debouncedFilter, setDebouncedFilter] = useState<string>('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilter(allianceFilter);
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [allianceFilter]);

  // Optimized: Fetch data only when debounced filter changes
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Optimized: Removed unused warStatistics call, only fetch what we need
        const [totalsRes, nationsRes, warsRes] = await Promise.all([
          apiCallWithErrorHandling(API_ENDPOINTS.warStatisticsAllianceTotals()),
          apiCallWithErrorHandling(API_ENDPOINTS.warStatisticsNationBreakdown()),
          apiCallWithErrorHandling(API_ENDPOINTS.warStatisticsWarRecords()),
        ]);

        // Handle new response format with { data, meta }
        setAllianceTotals(totalsRes.data || totalsRes || []);
        setNationBreakdown(nationsRes.data || nationsRes || []);
        setWarRecords(warsRes.data || warsRes || []);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load war statistics';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []); // Only fetch once on mount

  const formatNumber = useCallback((num: number): string => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  }, []);

  const allianceTotalsColumns: TableColumn<AllianceTotal>[] = useMemo(() => [
    { 
      key: 'alliance_name', 
      header: 'Alliance', 
      width: '25%',
      sortable: true,
    },
    { 
      key: 'total_damage_dealt', 
      header: 'Damage Dealt', 
      align: 'right',
      width: '15%',
      sortable: true,
      render: (v) => formatNumber(v),
    },
    { 
      key: 'total_damage_received', 
      header: 'Damage Received', 
      align: 'right',
      width: '15%',
      sortable: true,
      render: (v) => formatNumber(v),
    },
    { 
      key: 'net_damage', 
      header: 'Net Damage', 
      align: 'right',
      width: '12%',
      sortable: true,
      render: (v) => (
        <span className={v >= 0 ? 'text-green-400' : 'text-red-400'}>
          {formatNumber(v)}
        </span>
      ),
    },
    { 
      key: 'offensive_wars', 
      header: 'Offensive Wars', 
      align: 'center',
      width: '9%',
      sortable: true,
    },
    { 
      key: 'defensive_wars', 
      header: 'Defensive Wars', 
      align: 'center',
      width: '9%',
      sortable: true,
    },
  ], [formatNumber]);

  // Optimized: Client-side filtering on pre-loaded data
  // Now supports filtering by alliance name, nation name, or ruler name
  const filteredAllianceTotals = useMemo(() => {
    let filtered = allianceTotals;
    
    // Apply filter
    if (debouncedFilter.trim()) {
      const filter = debouncedFilter.trim().toLowerCase();
      filtered = allianceTotals.filter(row => {
        // Check if alliance name matches
        if (row.alliance_name.toLowerCase().includes(filter)) {
          return true;
        }
        // Check if any nation in this alliance matches
        return nationBreakdown.some(nation => 
          nation.alliance_id === row.alliance_id && (
            nation.nation_name.toLowerCase().includes(filter) ||
            nation.ruler_name.toLowerCase().includes(filter)
          )
        );
      });
    }
    
    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      
      // Handle string vs number comparison
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comparison = aVal.localeCompare(bVal);
        return sortDirection === 'asc' ? comparison : -comparison;
      }
      
      // Handle numeric comparison
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    });
    
    return sorted;
  }, [allianceTotals, debouncedFilter, nationBreakdown, sortColumn, sortDirection]);

  // Optimized: More efficient opponent breakdown aggregation
  const opponentBreakdownByAlliance = useMemo(() => {
    const grouped = new Map<number, OpponentBreakdown[]>();
    
    // Group by alliance and opponent
    const aggregation = new Map<string, OpponentBreakdown & { nations: Set<number> }>();
    
    nationBreakdown.forEach(row => {
      const key = `${row.alliance_id}-${row.opponent_alliance_id || 'null'}`;
      const existing = aggregation.get(key);
      
      if (existing) {
        existing.damage_dealt += row.damage_dealt;
        existing.damage_received += row.damage_received;
        existing.net_damage += row.net_damage;
        existing.offensive_wars += row.offensive_wars;
        existing.defensive_wars += row.defensive_wars;
        existing.nations.add(row.nation_id);
      } else {
        aggregation.set(key, {
          opponent_alliance_id: row.opponent_alliance_id,
          opponent_alliance_name: row.opponent_alliance_name,
          damage_dealt: row.damage_dealt,
          damage_received: row.damage_received,
          net_damage: row.net_damage,
          offensive_wars: row.offensive_wars,
          defensive_wars: row.defensive_wars,
          nations_involved: 1,
          nations: new Set([row.nation_id]),
        });
      }
    });
    
    // Group by alliance_id
    aggregation.forEach((value, key) => {
      const allianceId = parseInt(key.split('-')[0]);
      if (!grouped.has(allianceId)) {
        grouped.set(allianceId, []);
      }
      const { nations, ...rest } = value;
      grouped.get(allianceId)!.push({
        ...rest,
        nations_involved: nations.size,
      });
    });
    
    // Sort each group alphabetically by opponent alliance name
    grouped.forEach((rows) => {
      rows.sort((a, b) => {
        const aName = (a.opponent_alliance_name || '').toLowerCase();
        const bName = (b.opponent_alliance_name || '').toLowerCase();
        return aName.localeCompare(bName);
      });
    });
    
    return grouped;
  }, [nationBreakdown]);

  // Optimized: Group nation breakdown by alliance and opponent (memoized)
  const nationBreakdownByAllianceAndOpponent = useMemo(() => {
    const grouped = new Map<string, NationBreakdown[]>();
    nationBreakdown.forEach(row => {
      const key = `${row.alliance_id}-${row.opponent_alliance_id || 'null'}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(row);
    });
    // Sort each group alphabetically by nation name
    grouped.forEach((rows) => {
      rows.sort((a, b) => {
        const aName = (a.nation_name || '').toLowerCase();
        const bName = (b.nation_name || '').toLowerCase();
        return aName.localeCompare(bName);
      });
    });
    return grouped;
  }, [nationBreakdown]);

  // Auto-expand rows when filter matches nations/rulers
  useEffect(() => {
    if (!debouncedFilter.trim()) {
      // Clear expansions when filter is cleared
      setExpandedAlliances(new Set());
      setExpandedOpponents(new Set());
      return;
    }

    const filter = debouncedFilter.trim().toLowerCase();
    const newExpandedAlliances = new Set<number>();
    const newExpandedOpponents = new Set<string>();

    // Find all matching nations and expand their alliance and opponent rows
    nationBreakdown.forEach(nation => {
      const matchesNation = nation.nation_name.toLowerCase().includes(filter);
      const matchesRuler = nation.ruler_name.toLowerCase().includes(filter);
      
      if (matchesNation || matchesRuler) {
        // Expand the alliance row
        newExpandedAlliances.add(nation.alliance_id);
        // Expand the opponent alliance row
        const opponentKey = `${nation.alliance_id}-${nation.opponent_alliance_id || 'null'}`;
        newExpandedOpponents.add(opponentKey);
      }
    });

    // Only update if there are matches (to avoid collapsing everything on alliance name searches)
    if (newExpandedAlliances.size > 0) {
      setExpandedAlliances(newExpandedAlliances);
      setExpandedOpponents(newExpandedOpponents);
    }
  }, [debouncedFilter, nationBreakdown]);

  // Helper to check if filter is searching for nation/ruler (not alliance)
  const isSearchingForNation = useCallback((allianceName: string): boolean => {
    if (!debouncedFilter.trim()) return false;
    const filter = debouncedFilter.trim().toLowerCase();
    // If alliance name matches, show everything
    if (allianceName.toLowerCase().includes(filter)) return false;
    // Otherwise, we're filtering by nation/ruler
    return true;
  }, [debouncedFilter]);

  // Filter opponent breakdown to only show matching opponents
  const getFilteredOpponentBreakdown = useCallback((allianceId: number, allianceName: string, opponentRows: OpponentBreakdown[]): OpponentBreakdown[] => {
    if (!isSearchingForNation(allianceName)) return opponentRows;
    
    const filter = debouncedFilter.trim().toLowerCase();
    // Only show opponent alliances that have matching nations
    return opponentRows.filter(oppRow => {
      const opponentKey = `${allianceId}-${oppRow.opponent_alliance_id || 'null'}`;
      const nations = nationBreakdownByAllianceAndOpponent.get(opponentKey) || [];
      return nations.some(nation => 
        nation.nation_name.toLowerCase().includes(filter) ||
        nation.ruler_name.toLowerCase().includes(filter)
      );
    });
  }, [isSearchingForNation, debouncedFilter, nationBreakdownByAllianceAndOpponent]);

  // Filter nation breakdown to only show matching nations
  const getFilteredNationBreakdown = useCallback((allianceName: string, nationRows: NationBreakdown[]): NationBreakdown[] => {
    if (!isSearchingForNation(allianceName)) return nationRows;
    
    const filter = debouncedFilter.trim().toLowerCase();
    return nationRows.filter(nation => 
      nation.nation_name.toLowerCase().includes(filter) ||
      nation.ruler_name.toLowerCase().includes(filter)
    );
  }, [isSearchingForNation, debouncedFilter]);

  const toggleExpanded = useCallback((allianceId: number) => {
    setExpandedAlliances(prev => {
      const next = new Set(prev);
      if (next.has(allianceId)) {
        next.delete(allianceId);
        // Also collapse all opponent rows for this alliance
        setExpandedOpponents(prevOpp => {
          const nextOpp = new Set(prevOpp);
          Array.from(nextOpp).forEach(key => {
            if (key.startsWith(`${allianceId}-`)) {
              nextOpp.delete(key);
            }
          });
          return nextOpp;
        });
      } else {
        next.add(allianceId);
      }
      return next;
    });
  }, []);

  const toggleOpponentExpanded = useCallback((allianceId: number, opponentAllianceId: number | null) => {
    const key = `${allianceId}-${opponentAllianceId || 'null'}`;
    setExpandedOpponents(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        // Also collapse all nations under this opponent
        setExpandedNations(prevNations => {
          const nextNations = new Set(prevNations);
          Array.from(nextNations).forEach(nKey => {
            if (nKey.startsWith(`${key}-`)) {
              nextNations.delete(nKey);
            }
          });
          return nextNations;
        });
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const toggleNationExpanded = useCallback((allianceId: number, opponentAllianceId: number | null, nationId: number) => {
    const key = `${allianceId}-${opponentAllianceId || 'null'}-${nationId}`;
    setExpandedNations(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleSort = useCallback((columnKey: keyof AllianceTotal) => {
    if (sortColumn === columnKey) {
      // Toggle direction if same column
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      // New column: default to descending for numbers, ascending for strings
      setSortColumn(columnKey);
      setSortDirection(columnKey === 'alliance_name' ? 'asc' : 'desc');
    }
  }, [sortColumn]);

  // Helper function to parse date string (handles MM/DD/YYYY format)
  const parseDateString = useCallback((dateStr: string): number => {
    if (!dateStr) return 0;
    // Extract date part if there's a time component (e.g., "MM/DD/YYYY HH:MM:SS AM")
    const datePart = dateStr.split(' ')[0];
    // Parse MM/DD/YYYY format
    const parts = datePart.split('/');
    if (parts.length === 3) {
      const month = parseInt(parts[0], 10) - 1; // Month is 0-indexed
      const day = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day).getTime();
    }
    // Fallback to standard Date parsing
    return new Date(dateStr).getTime();
  }, []);

  // Optimized: Group war records by nation (memoized)
  const warRecordsByNation = useMemo(() => {
    const grouped = new Map<string, WarRecord[]>();
    warRecords.forEach(war => {
      const key = `${war.alliance_id}-${war.opponent_alliance_id || 'null'}-${war.nation_id}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(war);
    });
    // Sort each group: separate by war type, then sort by end_date (oldest/earliest expiration first) within each type
    grouped.forEach((wars) => {
      // Separate into offensive and defensive wars
      const offensiveWars = wars.filter(w => w.war_type === 'offensive');
      const defensiveWars = wars.filter(w => w.war_type === 'defensive');
      
      // Sort each group by end_date (earliest expiration first = oldest wars first)
      offensiveWars.sort((a, b) => {
        const dateA = parseDateString(a.end_date);
        const dateB = parseDateString(b.end_date);
        return dateA - dateB;
      });
      
      defensiveWars.sort((a, b) => {
        const dateA = parseDateString(a.end_date);
        const dateB = parseDateString(b.end_date);
        return dateA - dateB;
      });
      
      // Combine: offensive wars first, then defensive wars
      wars.length = 0;
      wars.push(...offensiveWars, ...defensiveWars);
    });
    return grouped;
  }, [warRecords, parseDateString]);

  return (
    <TableContainer>
      <div className={tableClasses.header}>
        <p className="mt-0 mb-3 md:mb-5 text-gray-400 text-sm md:text-base leading-relaxed">
          War statistics for wars declared after 2/5/2026. Shows total damages and net damage by alliance.
        </p>
      </div>

      {/* Filter */}
      <div className={tableClasses.filterContainer}>
        <input 
          type="text" 
          value={allianceFilter}
          placeholder="Filter by alliance, nation, or ruler name"
          onChange={(e) => setAllianceFilter(e.target.value)}
          className="px-3 md:px-4 py-2 md:py-3 border-2 border-gray-600 rounded-lg text-sm md:text-base font-medium min-w-[200px] bg-gray-800 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 hover:border-gray-500 w-full md:w-auto"
        />
      </div>

      {/* Alliance Totals View - Desktop Table */}
      <div className="hidden md:block rounded-xl shadow-md bg-gray-800 w-full max-w-full">
        {loading && <div className="text-center py-8 text-gray-400">Loading...</div>}
        {error && <div className="text-center py-8 text-red-400">{error}</div>}
        {!loading && !error && filteredAllianceTotals.length === 0 && (
          <div className="text-center py-8 text-gray-400">No war statistics available</div>
        )}
        {!loading && !error && filteredAllianceTotals.length > 0 && (
          <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
            <table className="w-full border-collapse relative min-w-[600px]">
              <thead className="bg-gray-800 sticky top-0 z-10">
                <tr>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs md:text-sm font-semibold text-gray-200 w-6 md:w-8 bg-gray-800"></th>
                  {allianceTotalsColumns.map(col => (
                    <th
                      key={col.key}
                      className={`px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-semibold text-gray-200 cursor-pointer hover:bg-gray-700 bg-gray-800 ${
                        col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                      }`}
                      style={{ width: col.width }}
                      onClick={() => handleSort(col.key as keyof AllianceTotal)}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate">{col.header}</span>
                        {sortColumn === col.key && (
                          <span className="text-xs flex-shrink-0">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredAllianceTotals.map(row => {
                  const isExpanded = expandedAlliances.has(row.alliance_id);
                  const opponentRows = opponentBreakdownByAlliance.get(row.alliance_id) || [];
                  const filteredOpponentRows = getFilteredOpponentBreakdown(row.alliance_id, row.alliance_name, opponentRows);
                  
                  // Calculate sum of opponent breakdown to verify against totals
                  const breakdownSum = opponentRows.reduce((acc, opp) => ({
                    damage_dealt: acc.damage_dealt + opp.damage_dealt,
                    damage_received: acc.damage_received + opp.damage_received,
                  }), { damage_dealt: 0, damage_received: 0 });
                  
                  // Check if there's a discrepancy (wars with null opponent alliances)
                  const hasDiscrepancy = Math.abs(breakdownSum.damage_dealt - row.total_damage_dealt) > 0.01 ||
                                       Math.abs(breakdownSum.damage_received - row.total_damage_received) > 0.01;
                  
                  return (
                    <React.Fragment key={`total-${row.alliance_id}`}>
                      <tr 
                        className="hover:bg-gray-800/60 cursor-pointer"
                        onClick={() => toggleExpanded(row.alliance_id)}
                      >
                        <td className="px-2 md:px-4 py-2 md:py-3">
                          {(filteredOpponentRows.length > 0 || hasDiscrepancy) && (
                            <span className="text-gray-400 text-xs md:text-base">
                              {isExpanded ? '▼' : '▶'}
                            </span>
                          )}
                        </td>
                        {allianceTotalsColumns.map((col, colIndex) => (
                          <td
                            key={col.key}
                            className={`px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm ${
                              col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                            }`}
                          >
                            {col.render ? col.render((row as any)[col.key], row, colIndex) : String((row as any)[col.key] || '')}
                          </td>
                        ))}
                      </tr>
                      {isExpanded && (
                        <>
                          {filteredOpponentRows.map((oppRow, idx) => {
                            const opponentKey = `${row.alliance_id}-${oppRow.opponent_alliance_id || 'null'}`;
                            const isOpponentExpanded = expandedOpponents.has(opponentKey);
                            const nationRows = nationBreakdownByAllianceAndOpponent.get(opponentKey) || [];
                            const filteredNationRows = getFilteredNationBreakdown(row.alliance_name, nationRows);
                            return (
                              <React.Fragment key={`opponent-${row.alliance_id}-${oppRow.opponent_alliance_id}-${idx}`}>
                                <tr 
                                  className="bg-gray-900/30 hover:bg-gray-800/40 cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleOpponentExpanded(row.alliance_id, oppRow.opponent_alliance_id);
                                  }}
                                >
                                  <td className="px-2 md:px-4 py-2 md:py-3">
                                    <span className="text-gray-500 ml-2 md:ml-4 text-xs md:text-base">
                                      {filteredNationRows.length > 0 ? (isOpponentExpanded ? '▼' : '▶') : '└'}
                                    </span>
                                  </td>
                                  <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-left">
                                    <span className="text-gray-400 truncate block">{oppRow.opponent_alliance_name || 'Unknown'}</span>
                                  </td>
                                  <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-right">
                                    {formatNumber(oppRow.damage_dealt)}
                                  </td>
                                  <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-right">
                                    {formatNumber(oppRow.damage_received)}
                                  </td>
                                  <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-right">
                                    <span className={oppRow.net_damage >= 0 ? 'text-green-400' : 'text-red-400'}>
                                      {formatNumber(oppRow.net_damage)}
                                    </span>
                                  </td>
                                  <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-center">
                                    {oppRow.offensive_wars}
                                  </td>
                                  <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-center">
                                    {oppRow.defensive_wars}
                                  </td>
                                </tr>
                                {isOpponentExpanded && filteredNationRows.length > 0 && filteredNationRows.map((nationRow, nationIdx) => {
                                  const nationKey = `${row.alliance_id}-${oppRow.opponent_alliance_id || 'null'}-${nationRow.nation_id}`;
                                  const isNationExpanded = expandedNations.has(nationKey);
                                  const warRows = warRecordsByNation.get(nationKey) || [];
                                  return (
                                    <React.Fragment key={`nation-${nationRow.nation_id}-${nationRow.opponent_alliance_id}-${nationIdx}`}>
                                      <tr 
                                        className="bg-gray-900/50 hover:bg-gray-800/30 cursor-pointer"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleNationExpanded(row.alliance_id, oppRow.opponent_alliance_id, nationRow.nation_id);
                                        }}
                                      >
                                        <td className="px-2 md:px-4 py-2 md:py-3">
                                          <span className="text-gray-600 ml-4 md:ml-8 text-xs md:text-base">
                                            {warRows.length > 0 ? (isNationExpanded ? '▼' : '▶') : '└'}
                                          </span>
                                        </td>
                                        <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-left">
                                          <div className="min-w-0">
                                            <a
                                              href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${nationRow.nation_id}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-primary no-underline font-bold hover:underline truncate block"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              {nationRow.nation_name}
                                            </a>
                                            <div className="text-[10px] md:text-xs text-gray-500 truncate">{nationRow.ruler_name}</div>
                                          </div>
                                        </td>
                                        <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-right">
                                          {formatNumber(nationRow.damage_dealt)}
                                        </td>
                                        <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-right">
                                          {formatNumber(nationRow.damage_received)}
                                        </td>
                                        <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-right">
                                          <span className={nationRow.net_damage >= 0 ? 'text-green-400' : 'text-red-400'}>
                                            {formatNumber(nationRow.net_damage)}
                                          </span>
                                        </td>
                                        <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-center">
                                          {nationRow.offensive_wars}
                                        </td>
                                        <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-center">
                                          {nationRow.defensive_wars}
                                        </td>
                                      </tr>
                                      {isNationExpanded && warRows.length > 0 && warRows.map((war, warIdx) => (
                                        <tr 
                                          key={`war-${war.war_id}-${warIdx}`}
                                          className="bg-gray-900/70 hover:bg-gray-800/20"
                                        >
                                          <td className="px-2 md:px-4 py-2 md:py-3">
                                            <span className="text-gray-700 ml-6 md:ml-12 text-xs md:text-base">└</span>
                                          </td>
                                          <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-left">
                                            <div className="min-w-0">
                                              <a
                                                href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${war.opponent_nation_id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-400 no-underline hover:underline text-[10px] md:text-xs truncate block"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                vs {war.opponent_nation_name}
                                              </a>
                                              <div className="text-[9px] md:text-xs text-gray-600 truncate">
                                                {war.opponent_ruler_name} • {war.war_type} • {war.status}
                                              </div>
                                            </div>
                                          </td>
                                          <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-right text-gray-300">
                                            {formatNumber(war.damage_dealt)}
                                          </td>
                                          <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-right text-gray-300">
                                            {formatNumber(war.damage_received)}
                                          </td>
                                          <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-right">
                                            <span className={war.net_damage >= 0 ? 'text-green-400' : 'text-red-400'}>
                                              {formatNumber(war.net_damage)}
                                            </span>
                                          </td>
                                          <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-center text-gray-500" colSpan={2}>
                                            <a
                                              href={`https://www.cybernations.net/war_information.asp?ID=${war.war_id}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-gray-500 hover:text-gray-300 text-[10px] md:text-xs no-underline hover:underline"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              War #{war.war_id}
                                            </a>
                                          </td>
                                        </tr>
                                      ))}
                                    </React.Fragment>
                                  );
                                })}
                              </React.Fragment>
                            );
                          })}
                          {hasDiscrepancy && (
                            <tr className="bg-gray-900/40 hover:bg-gray-800/30">
                              <td className="px-2 md:px-4 py-2 md:py-3">
                                <span className="text-gray-500 ml-2 md:ml-4 text-xs md:text-base">└</span>
                              </td>
                              <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-left">
                                <span className="text-gray-400 italic">Unknown/No Alliance</span>
                              </td>
                              <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-right">
                                {formatNumber(row.total_damage_dealt - breakdownSum.damage_dealt)}
                              </td>
                              <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-right">
                                {formatNumber(row.total_damage_received - breakdownSum.damage_received)}
                              </td>
                              <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-right">
                                <span className={(row.total_damage_dealt - breakdownSum.damage_dealt) - (row.total_damage_received - breakdownSum.damage_received) >= 0 ? 'text-green-400' : 'text-red-400'}>
                                  {formatNumber((row.total_damage_dealt - breakdownSum.damage_dealt) - (row.total_damage_received - breakdownSum.damage_received))}
                                </span>
                              </td>
                              <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-center">
                                -
                              </td>
                              <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-center">
                                -
                              </td>
                            </tr>
                          )}
                        </>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Alliance Totals View - Mobile Cards */}
      <div className="md:hidden">
        {loading && <div className="text-center py-8 text-gray-400">Loading...</div>}
        {error && <div className="text-center py-8 text-red-400">{error}</div>}
        {!loading && !error && filteredAllianceTotals.length === 0 && (
          <div className="text-center py-8 text-gray-400">No war statistics available</div>
        )}
        {!loading && !error && filteredAllianceTotals.length > 0 && (
          <div className="max-h-[65vh] overflow-y-auto space-y-2">
            {filteredAllianceTotals.map(row => {
              const isExpanded = expandedAlliances.has(row.alliance_id);
              const opponentRows = opponentBreakdownByAlliance.get(row.alliance_id) || [];
              const filteredOpponentRows = getFilteredOpponentBreakdown(row.alliance_id, row.alliance_name, opponentRows);
              
              const breakdownSum = opponentRows.reduce((acc, opp) => ({
                damage_dealt: acc.damage_dealt + opp.damage_dealt,
                damage_received: acc.damage_received + opp.damage_received,
              }), { damage_dealt: 0, damage_received: 0 });
              
              const hasDiscrepancy = Math.abs(breakdownSum.damage_dealt - row.total_damage_dealt) > 0.01 ||
                                   Math.abs(breakdownSum.damage_received - row.total_damage_received) > 0.01;
              
              return (
                <div key={`mobile-${row.alliance_id}`} className="bg-gray-900/50 rounded-lg overflow-hidden">
                  {/* Alliance Card */}
                  <div
                    className="p-3 cursor-pointer active:bg-gray-800/70"
                    onClick={() => toggleExpanded(row.alliance_id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {(filteredOpponentRows.length > 0 || hasDiscrepancy) && (
                          <span className="text-gray-400 text-sm flex-shrink-0">
                            {isExpanded ? '▼' : '▶'}
                          </span>
                        )}
                        <h3 className="text-sm font-semibold text-gray-200 truncate">{row.alliance_name}</h3>
                      </div>
                      <div className={`text-base font-bold ml-2 flex-shrink-0 ${row.net_damage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatNumber(row.net_damage)}
                      </div>
                    </div>

                    <div className="text-xs text-gray-400 flex items-center gap-x-4">
                      <span>Dealt: <span className="text-gray-300">{formatNumber(row.total_damage_dealt)}</span></span>
                      <span>Received: <span className="text-gray-300">{formatNumber(row.total_damage_received)}</span></span>
                    </div>
                    <div className="text-xs text-gray-400 flex items-center gap-x-4 mt-1">
                      <span>Off: <span className="text-gray-300">{row.offensive_wars}</span></span>
                      <span>Def: <span className="text-gray-300">{row.defensive_wars}</span></span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="bg-gray-900/30 border-t border-gray-700/30">
                      {filteredOpponentRows.map((oppRow, idx) => {
                        const opponentKey = `${row.alliance_id}-${oppRow.opponent_alliance_id || 'null'}`;
                        const isOpponentExpanded = expandedOpponents.has(opponentKey);
                        const nationRows = nationBreakdownByAllianceAndOpponent.get(opponentKey) || [];
                        const filteredNationRows = getFilteredNationBreakdown(row.alliance_name, nationRows);
                        
                        return (
                          <div key={`mobile-opp-${opponentKey}-${idx}`}>
                            {/* Opponent Card */}
                            <div
                              className="p-3 pl-8 cursor-pointer active:bg-gray-800/50 border-b border-gray-700/20 last:border-b-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleOpponentExpanded(row.alliance_id, oppRow.opponent_alliance_id);
                              }}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className="text-gray-500 text-sm flex-shrink-0">
                                    {filteredNationRows.length > 0 ? (isOpponentExpanded ? '▼' : '▶') : '└'}
                                  </span>
                                  <span className="text-xs text-gray-400 truncate">{oppRow.opponent_alliance_name || 'Unknown'}</span>
                                </div>
                                <div className={`text-sm font-semibold ml-2 flex-shrink-0 ${oppRow.net_damage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {formatNumber(oppRow.net_damage)}
                                </div>
                              </div>
                              <div className="text-xs text-gray-500 flex items-center gap-x-3">
                                <span>D: {formatNumber(oppRow.damage_dealt)}</span>
                                <span>R: {formatNumber(oppRow.damage_received)}</span>
                                <span>Off: {oppRow.offensive_wars}</span>
                                <span>Def: {oppRow.defensive_wars}</span>
                              </div>
                            </div>

                            {isOpponentExpanded && filteredNationRows.length > 0 && filteredNationRows.map((nationRow, nationIdx) => {
                              const nationKey = `${row.alliance_id}-${oppRow.opponent_alliance_id || 'null'}-${nationRow.nation_id}`;
                              const isNationExpanded = expandedNations.has(nationKey);
                              const warRows = warRecordsByNation.get(nationKey) || [];
                              
                              return (
                                <div key={`mobile-nation-${nationKey}-${nationIdx}`}>
                                  {/* Nation Card */}
                                  <div
                                    className="p-3 pl-12 cursor-pointer active:bg-gray-800/40 border-b border-gray-700/20"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleNationExpanded(row.alliance_id, oppRow.opponent_alliance_id, nationRow.nation_id);
                                    }}
                                  >
                                    <div className="flex items-center justify-between mb-1">
                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <span className="text-gray-600 text-sm flex-shrink-0">
                                          {warRows.length > 0 ? (isNationExpanded ? '▼' : '▶') : '└'}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                          <a
                                            href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${nationRow.nation_id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary no-underline font-bold hover:underline truncate block text-xs"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            {nationRow.nation_name}
                                          </a>
                                          <div className="text-xs text-gray-500 truncate">{nationRow.ruler_name}</div>
                                        </div>
                                      </div>
                                      <div className={`text-sm font-semibold ml-2 flex-shrink-0 ${nationRow.net_damage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {formatNumber(nationRow.net_damage)}
                                      </div>
                                    </div>
                                    <div className="text-xs text-gray-500 flex items-center gap-x-3">
                                      <span>D: {formatNumber(nationRow.damage_dealt)}</span>
                                      <span>R: {formatNumber(nationRow.damage_received)}</span>
                                      <span>Off: {nationRow.offensive_wars}</span>
                                      <span>Def: {nationRow.defensive_wars}</span>
                                    </div>
                                  </div>

                                  {isNationExpanded && warRows.length > 0 && warRows.map((war, warIdx) => (
                                    <div
                                      key={`mobile-war-${war.war_id}-${warIdx}`}
                                      className="p-3 pl-16 bg-gray-900/70 border-b border-gray-700/20 last:border-b-0"
                                    >
                                      <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                          <span className="text-gray-700 text-sm flex-shrink-0">└</span>
                                          <div className="min-w-0 flex-1">
                                            <a
                                              href={`https://www.cybernations.net/war_information.asp?ID=${war.war_id}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-blue-400 no-underline hover:underline text-xs truncate block"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              vs {war.opponent_nation_name}
                                            </a>
                                            <div className="text-xs text-gray-600 truncate">War #{war.war_id}</div>
                                          </div>
                                        </div>
                                        <div className={`text-sm font-semibold ml-2 flex-shrink-0 ${war.net_damage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                          {formatNumber(war.net_damage)}
                                        </div>
                                      </div>
                                      <div className="text-xs text-gray-600 flex items-center gap-x-3">
                                        <span>D: {formatNumber(war.damage_dealt)}</span>
                                        <span>R: {formatNumber(war.damage_received)}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}

                      {/* Unknown/No Alliance row for mobile */}
                      {hasDiscrepancy && (
                        <div className="p-3 pl-8 border-b border-gray-700/20">
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-xs text-gray-400 italic">Unknown/No Alliance</div>
                            <div className={`text-sm font-semibold ${(row.total_damage_dealt - breakdownSum.damage_dealt) - (row.total_damage_received - breakdownSum.damage_received) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {formatNumber((row.total_damage_dealt - breakdownSum.damage_dealt) - (row.total_damage_received - breakdownSum.damage_received))}
                            </div>
                          </div>
                          <div className="text-xs text-gray-400 flex items-center gap-x-3">
                            <span>D: {formatNumber(row.total_damage_dealt - breakdownSum.damage_dealt)}</span>
                            <span>R: {formatNumber(row.total_damage_received - breakdownSum.damage_received)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </TableContainer>
  );
};

export default WarStatsPage;
