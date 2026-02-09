import React, { useEffect, useMemo, useState } from 'react';
import { apiCallWithErrorHandling, API_ENDPOINTS } from '../utils/api';
import ReusableTable from '../components/ReusableTable';
import type { TableColumn } from '../components/ReusableTable';
import { tableClasses } from '../styles/tableClasses';
import TableContainer from '../components/TableContainer';

interface AllianceOpponentBreakdown {
  alliance_id: number;
  alliance_name: string;
  opponent_alliance_id: number | null;
  opponent_alliance_name: string | null;
  total_damage: number;
  nations_involved: number;
}

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

const WarStatsPage: React.FC = () => {
  const [allianceTotals, setAllianceTotals] = useState<AllianceTotal[]>([]);
  const [opponentBreakdown, setOpponentBreakdown] = useState<AllianceOpponentBreakdown[]>([]);
  const [nationBreakdown, setNationBreakdown] = useState<NationBreakdown[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allianceFilter, setAllianceFilter] = useState<string>('');
  const [expandedAlliances, setExpandedAlliances] = useState<Set<number>>(new Set());
  const [expandedOpponents, setExpandedOpponents] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [totalsRes, opponentsRes, nationsRes] = await Promise.all([
          apiCallWithErrorHandling(API_ENDPOINTS.warStatisticsAllianceTotals),
          apiCallWithErrorHandling(API_ENDPOINTS.warStatistics),
          apiCallWithErrorHandling(API_ENDPOINTS.warStatisticsNationBreakdown),
        ]);

        setAllianceTotals(totalsRes || []);
        setOpponentBreakdown(opponentsRes || []);
        setNationBreakdown(nationsRes || []);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load war statistics';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

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
  ], []);


  const nationBreakdownColumns: TableColumn<NationBreakdown>[] = useMemo(() => [
    { 
      key: 'alliance_name', 
      header: 'Alliance', 
      width: '15%',
      sortable: true,
    },
    { 
      key: 'nation_name', 
      header: 'Nation', 
      width: '18%',
      sortable: true,
      render: (_v, row) => (
        <div>
          <a
            href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${row.nation_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary no-underline font-bold hover:underline"
          >
            {row.nation_name}
          </a>
          <div className="text-xs text-gray-400">{row.ruler_name}</div>
        </div>
      ),
    },
    { 
      key: 'opponent_alliance_name', 
      header: 'Opponent Alliance', 
      width: '18%',
      sortable: true,
      render: (v) => v || 'Unknown',
    },
    { 
      key: 'damage_dealt', 
      header: 'Damage Dealt', 
      align: 'right',
      width: '12%',
      sortable: true,
      render: (v) => formatNumber(v),
    },
    { 
      key: 'damage_received', 
      header: 'Damage Received', 
      align: 'right',
      width: '12%',
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
  ], []);

  const filteredAllianceTotals = useMemo(() => {
    if (!allianceFilter.trim()) return allianceTotals;
    const filter = allianceFilter.trim().toLowerCase();
    return allianceTotals.filter(row => 
      row.alliance_name.toLowerCase().includes(filter)
    );
  }, [allianceTotals, allianceFilter]);

  // Aggregate opponent breakdown by alliance from nation breakdown
  // Query 3 now includes all opponent alliances that have wars (even if damage is 0)
  const opponentBreakdownByAlliance = useMemo(() => {
    const grouped = new Map<number, Array<{
      opponent_alliance_id: number | null;
      opponent_alliance_name: string | null;
      damage_dealt: number;
      damage_received: number;
      net_damage: number;
      nations_involved: number;
      offensive_wars: number;
      defensive_wars: number;
    }>>();
    
    // Aggregate from nation breakdown by alliance_id and opponent_alliance_id
    const aggregation = new Map<string, {
      alliance_id: number;
      opponent_alliance_id: number | null;
      opponent_alliance_name: string | null;
      damage_dealt: number;
      damage_received: number;
      offensive_wars: number;
      defensive_wars: number;
      nations: Set<number>;
    }>();
    
    nationBreakdown.forEach(row => {
      const key = `${row.alliance_id}-${row.opponent_alliance_id || 'null'}`;
      const existing = aggregation.get(key);
      
      if (existing) {
        existing.damage_dealt += row.damage_dealt;
        existing.damage_received += row.damage_received;
        existing.offensive_wars += row.offensive_wars;
        existing.defensive_wars += row.defensive_wars;
        existing.nations.add(row.nation_id);
      } else {
        aggregation.set(key, {
          alliance_id: row.alliance_id,
          opponent_alliance_id: row.opponent_alliance_id,
          opponent_alliance_name: row.opponent_alliance_name,
          damage_dealt: row.damage_dealt,
          damage_received: row.damage_received,
          offensive_wars: row.offensive_wars,
          defensive_wars: row.defensive_wars,
          nations: new Set([row.nation_id]),
        });
      }
    });
    
    // Group by alliance_id
    aggregation.forEach((value) => {
      if (!grouped.has(value.alliance_id)) {
        grouped.set(value.alliance_id, []);
      }
      grouped.get(value.alliance_id)!.push({
        opponent_alliance_id: value.opponent_alliance_id,
        opponent_alliance_name: value.opponent_alliance_name,
        damage_dealt: value.damage_dealt,
        damage_received: value.damage_received,
        net_damage: value.damage_dealt - value.damage_received,
        nations_involved: value.nations.size,
        offensive_wars: value.offensive_wars,
        defensive_wars: value.defensive_wars,
      });
    });
    
    // Sort each group by net damage descending
    grouped.forEach((rows) => {
      rows.sort((a, b) => b.net_damage - a.net_damage);
    });
    
    return grouped;
  }, [nationBreakdown]);

  const toggleExpanded = (allianceId: number) => {
    setExpandedAlliances(prev => {
      const next = new Set(prev);
      if (next.has(allianceId)) {
        next.delete(allianceId);
        // Also collapse all opponent rows for this alliance
        const opponentKeys = Array.from(expandedOpponents).filter(key => key.startsWith(`${allianceId}-`));
        opponentKeys.forEach(key => expandedOpponents.delete(key));
      } else {
        next.add(allianceId);
      }
      return next;
    });
  };

  const toggleOpponentExpanded = (allianceId: number, opponentAllianceId: number | null) => {
    const key = `${allianceId}-${opponentAllianceId || 'null'}`;
    setExpandedOpponents(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Group nation breakdown by alliance_id and opponent_alliance_id
  const nationBreakdownByAllianceAndOpponent = useMemo(() => {
    const grouped = new Map<string, NationBreakdown[]>();
    nationBreakdown.forEach(row => {
      const key = `${row.alliance_id}-${row.opponent_alliance_id || 'null'}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(row);
    });
    // Sort each group by net damage descending
    grouped.forEach((rows) => {
      rows.sort((a, b) => b.net_damage - a.net_damage);
    });
    return grouped;
  }, [nationBreakdown]);

  return (
    <TableContainer>
      <div className={tableClasses.header}>
        <h1 className={tableClasses.title}>War Stats</h1>
        <p className={tableClasses.subtitle}>
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
          className={tableClasses.filterInput}
        />
      </div>

      {/* Alliance Totals View */}
      {(
        <div className={tableClasses.tableWrapper}>
          {loading && <div className="text-center py-8 text-gray-400">Loading...</div>}
          {error && <div className="text-center py-8 text-red-400">{error}</div>}
          {!loading && !error && filteredAllianceTotals.length === 0 && (
            <div className="text-center py-8 text-gray-400">No war statistics available</div>
          )}
          {!loading && !error && filteredAllianceTotals.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200 w-8"></th>
                    {allianceTotalsColumns.map(col => (
                      <th
                        key={col.key}
                        className={`px-4 py-3 text-sm font-semibold text-gray-200 ${
                          col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                        }`}
                        style={{ width: col.width }}
                      >
                        {col.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filteredAllianceTotals.map(row => {
                    const isExpanded = expandedAlliances.has(row.alliance_id);
                    const opponentRows = opponentBreakdownByAlliance.get(row.alliance_id) || [];
                    
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
                          <td className="px-4 py-3">
                            {(opponentRows.length > 0 || hasDiscrepancy) && (
                              <span className="text-gray-400">
                                {isExpanded ? '▼' : '▶'}
                              </span>
                            )}
                          </td>
                          {allianceTotalsColumns.map(col => (
                            <td
                              key={col.key}
                              className={`px-4 py-3 text-sm ${
                                col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                              }`}
                            >
                              {col.render ? col.render((row as any)[col.key], row) : String((row as any)[col.key] || '')}
                            </td>
                          ))}
                        </tr>
                        {isExpanded && (
                          <>
                            {opponentRows.map((oppRow, idx) => {
                          const opponentKey = `${row.alliance_id}-${oppRow.opponent_alliance_id || 'null'}`;
                          const isOpponentExpanded = expandedOpponents.has(opponentKey);
                          const nationRows = nationBreakdownByAllianceAndOpponent.get(opponentKey) || [];
                          return (
                            <React.Fragment key={`opponent-${row.alliance_id}-${oppRow.opponent_alliance_id}-${idx}`}>
                              <tr 
                                className="bg-gray-900/30 hover:bg-gray-800/40 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleOpponentExpanded(row.alliance_id, oppRow.opponent_alliance_id);
                                }}
                              >
                                <td className="px-4 py-3">
                                  <span className="text-gray-500 ml-4">
                                    {nationRows.length > 0 ? (isOpponentExpanded ? '▼' : '▶') : '└'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-left">
                                  <span className="text-gray-400">{oppRow.opponent_alliance_name || 'Unknown'}</span>
                                </td>
                                <td className="px-4 py-3 text-sm text-right">
                                  {formatNumber(oppRow.damage_dealt)}
                                </td>
                                <td className="px-4 py-3 text-sm text-right">
                                  {formatNumber(oppRow.damage_received)}
                                </td>
                                <td className="px-4 py-3 text-sm text-right">
                                  <span className={oppRow.net_damage >= 0 ? 'text-green-400' : 'text-red-400'}>
                                    {formatNumber(oppRow.net_damage)}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-center">
                                  {oppRow.offensive_wars}
                                </td>
                                <td className="px-4 py-3 text-sm text-center">
                                  {oppRow.defensive_wars}
                                </td>
                              </tr>
                              {isOpponentExpanded && nationRows.length > 0 && nationRows.map((nationRow, nationIdx) => (
                                <tr 
                                  key={`nation-${nationRow.nation_id}-${nationRow.opponent_alliance_id}-${nationIdx}`}
                                  className="bg-gray-900/50 hover:bg-gray-800/30"
                                >
                                  <td className="px-4 py-3">
                                    <span className="text-gray-600 ml-8">└</span>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-left">
                                    <div>
                                      <a
                                        href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${nationRow.nation_id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary no-underline font-bold hover:underline"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {nationRow.nation_name}
                                      </a>
                                      <div className="text-xs text-gray-500">{nationRow.ruler_name}</div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right">
                                    {formatNumber(nationRow.damage_dealt)}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right">
                                    {formatNumber(nationRow.damage_received)}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right">
                                    <span className={nationRow.net_damage >= 0 ? 'text-green-400' : 'text-red-400'}>
                                      {formatNumber(nationRow.net_damage)}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-center">
                                    {nationRow.offensive_wars}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-center">
                                    {nationRow.defensive_wars}
                                  </td>
                                </tr>
                              ))}
                            </React.Fragment>
                          );
                        })}
                            {hasDiscrepancy && (
                              <tr className="bg-gray-900/40 hover:bg-gray-800/30">
                                <td className="px-4 py-3">
                                  <span className="text-gray-500 ml-4">└</span>
                                </td>
                                <td className="px-4 py-3 text-sm text-left">
                                  <span className="text-gray-400 italic">Unknown/No Alliance</span>
                                </td>
                                <td className="px-4 py-3 text-sm text-right">
                                  {formatNumber(row.total_damage_dealt - breakdownSum.damage_dealt)}
                                </td>
                                <td className="px-4 py-3 text-sm text-right">
                                  {formatNumber(row.total_damage_received - breakdownSum.damage_received)}
                                </td>
                                <td className="px-4 py-3 text-sm text-right">
                                  <span className={(row.total_damage_dealt - breakdownSum.damage_dealt) - (row.total_damage_received - breakdownSum.damage_received) >= 0 ? 'text-green-400' : 'text-red-400'}>
                                    {formatNumber((row.total_damage_dealt - breakdownSum.damage_dealt) - (row.total_damage_received - breakdownSum.damage_received))}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-center">
                                  -
                                </td>
                                <td className="px-4 py-3 text-sm text-center">
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
      )}

    </TableContainer>
  );
};

export default WarStatsPage;

