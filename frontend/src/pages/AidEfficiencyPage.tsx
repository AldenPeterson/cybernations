import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiCallWithErrorHandling, API_ENDPOINTS } from '../utils/api';
import { tableClasses } from '../styles/tableClasses';

interface AidEfficiencyDataPoint {
  date: string;
  efficiency: number;
  totalAidOffers: number;
  totalNations: number;
}

interface AllianceEfficiencyData {
  allianceId: number;
  allianceName: string;
  currentEfficiency: number;
  currentTotalAidOffers: number;
  currentTotalNations: number;
  avg30Days: number | null;
  avg60Days: number | null;
  avg90Days: number | null;
  timeSeries: AidEfficiencyDataPoint[];
}

interface AidEfficiencyResponse {
  success: boolean;
  data: AllianceEfficiencyData[];
}

const AidEfficiencyPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<AllianceEfficiencyData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAlliances, setSelectedAlliances] = useState<Set<number>>(new Set());
  const [minMemberThreshold, setMinMemberThreshold] = useState<number>(10);
  const [efficiencyThreshold, setEfficiencyThreshold] = useState<number | null>(20);
  const hasInitializedFromUrl = useRef(false);
  const hasInitializedThresholds = useRef(false);
  const hasFetchedData = useRef(false);

  // Helper function to parse number array from URL parameter
  const parseNumberArrayParam = (value: string | null): number[] => {
    if (!value) return [];
    return value.split(',').map(v => parseInt(v, 10)).filter(v => !isNaN(v));
  };

  // Helper function to update URL parameters
  const updateUrlParams = useCallback((updates: Record<string, string | null>) => {
    const newSearchParams = new URLSearchParams(searchParams);
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') {
        newSearchParams.delete(key);
      } else {
        newSearchParams.set(key, value);
      }
    });
    
    setSearchParams(newSearchParams, { replace: true });
  }, [searchParams, setSearchParams]);
  const [sortColumn, setSortColumn] = useState<'alliance' | 'efficiency' | 'totalNations' | 'avg30' | 'avg60' | 'avg90'>('efficiency');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    // Prevent duplicate calls in React StrictMode
    if (hasFetchedData.current) return;
    hasFetchedData.current = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response: AidEfficiencyResponse = await apiCallWithErrorHandling(API_ENDPOINTS.aidEfficiency);
        
        if (response.success && response.data) {
          setData(response.data);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load aid efficiency data';
        setError(msg);
        hasFetchedData.current = false; // Allow retry on error
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const toggleAllianceSelection = (allianceId: number) => {
    setSelectedAlliances(prev => {
      const newSet = new Set(prev);
      if (newSet.has(allianceId)) {
        newSet.delete(allianceId);
      } else {
        newSet.add(allianceId);
      }
      
      // Update URL with new selections
      const allianceIds = Array.from(newSet);
      updateUrlParams({
        selectedAlliances: allianceIds.length > 0 ? allianceIds.join(',') : null
      });
      
      return newSet;
    });
  };

  const clearAllSelections = () => {
    setSelectedAlliances(new Set());
    updateUrlParams({ selectedAlliances: null });
  };


  // Filter data based on minimum member threshold
  // Include alliance if it ever had >= threshold members (check max across all time points)
  const filteredData = useMemo(() => {
    return data.filter(alliance => {
      const maxNations = Math.max(
        alliance.currentTotalNations,
        ...alliance.timeSeries.map(point => point.totalNations)
      );
      return maxNations >= minMemberThreshold;
    });
  }, [data, minMemberThreshold]);

  // Sort filtered data
  const sortedData = useMemo(() => {
    const sorted = [...filteredData];
    
    sorted.sort((a, b) => {
      let comparison = 0;
      
      switch (sortColumn) {
        case 'alliance':
          comparison = a.allianceName.localeCompare(b.allianceName);
          break;
        case 'efficiency':
          comparison = a.currentEfficiency - b.currentEfficiency;
          break;
        case 'totalNations':
          comparison = a.currentTotalNations - b.currentTotalNations;
          break;
        case 'avg30': {
          const avgA = a.avg30Days ?? -1;
          const avgB = b.avg30Days ?? -1;
          comparison = avgA - avgB;
          break;
        }
        case 'avg60': {
          const avgA = a.avg60Days ?? -1;
          const avgB = b.avg60Days ?? -1;
          comparison = avgA - avgB;
          break;
        }
        case 'avg90': {
          const avgA = a.avg90Days ?? -1;
          const avgB = b.avg90Days ?? -1;
          comparison = avgA - avgB;
          break;
        }
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }, [filteredData, sortColumn, sortDirection]);

  const handleSort = (column: 'alliance' | 'efficiency' | 'totalNations' | 'avg30' | 'avg60' | 'avg90') => {
    if (sortColumn === column) {
      // Toggle direction if clicking the same column
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column and default to descending
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // Find the most recent date across all alliances
  const mostRecentDate = useMemo(() => {
    if (data.length === 0) return null;
    
    let latestDate: Date | null = null;
    data.forEach(alliance => {
      alliance.timeSeries.forEach(point => {
        const pointDate = new Date(point.date);
        if (!isNaN(pointDate.getTime())) {
          if (!latestDate || pointDate > latestDate) {
            latestDate = pointDate;
          }
        }
      });
    });
    
    if (!latestDate) return null;
    
    // Format as M/D
    return `${latestDate.getMonth() + 1}/${latestDate.getDate()}`;
  }, [data]);


  // Load thresholds from URL on mount
  useEffect(() => {
    if (hasInitializedThresholds.current) return;
    
    const minMembersParam = searchParams.get('minMembers');
    if (minMembersParam) {
      const value = parseInt(minMembersParam, 10);
      if (!isNaN(value) && value >= 1) {
        setMinMemberThreshold(value);
      }
    }
    
    const legacyThresholdParam = searchParams.get('legacyThreshold');
    if (legacyThresholdParam !== null) {
      if (legacyThresholdParam === '') {
        // Empty string means explicitly cleared
        setEfficiencyThreshold(null);
      } else {
        const value = parseFloat(legacyThresholdParam);
        if (!isNaN(value) && value >= 0 && value <= 100) {
          setEfficiencyThreshold(value);
        }
      }
    }
    
    hasInitializedThresholds.current = true;
  }, [searchParams]);

  // Update URL when thresholds change (but skip if we just loaded from URL)
  useEffect(() => {
    if (!hasInitializedThresholds.current) return;
    
    const currentMinMembers = searchParams.get('minMembers');
    const currentLegacyThreshold = searchParams.get('legacyThreshold');
    
    const updates: Record<string, string | null> = {};
    
    if (currentMinMembers !== minMemberThreshold.toString()) {
      updates.minMembers = minMemberThreshold.toString();
    }
    
    const newLegacyThreshold = efficiencyThreshold !== null ? efficiencyThreshold.toString() : '';
    if (currentLegacyThreshold !== newLegacyThreshold) {
      updates.legacyThreshold = newLegacyThreshold;
    }
    
    if (Object.keys(updates).length > 0) {
      updateUrlParams(updates);
    }
  }, [minMemberThreshold, efficiencyThreshold, searchParams, updateUrlParams]);

  // Load selected alliances from URL when data is available (only once)
  useEffect(() => {
    if (sortedData.length === 0 || hasInitializedFromUrl.current) return;
    
    const selectedAlliancesParam = parseNumberArrayParam(searchParams.get('selectedAlliances'));
    const filteredIds = new Set(sortedData.map(a => a.allianceId));
    
    // If URL has selections, use them (filtered to only valid alliances)
    if (selectedAlliancesParam.length > 0) {
      const validSelections = selectedAlliancesParam.filter(id => filteredIds.has(id));
      if (validSelections.length > 0) {
        setSelectedAlliances(new Set(validSelections));
        hasInitializedFromUrl.current = true;
        // Update URL to remove any invalid selections
        if (validSelections.length !== selectedAlliancesParam.length) {
          updateUrlParams({
            selectedAlliances: validSelections.join(',')
          });
        }
        return;
      }
    }
    
    // If no URL param, select top 10 by nation count by default
    const sortedByNationCount = [...sortedData].sort((a, b) => b.currentTotalNations - a.currentTotalNations);
    const top10 = sortedByNationCount.slice(0, 10).map(a => a.allianceId);
    setSelectedAlliances(new Set(top10));
    updateUrlParams({
      selectedAlliances: top10.join(',')
    });
    hasInitializedFromUrl.current = true;
  }, [sortedData, searchParams, updateUrlParams]);

  // Update URL when selections change (but skip if we just loaded from URL)
  useEffect(() => {
    if (!hasInitializedFromUrl.current) return; // Wait for initial load
    
    const allianceIds = Array.from(selectedAlliances);
    const currentParam = searchParams.get('selectedAlliances');
    const newParam = allianceIds.length > 0 ? allianceIds.join(',') : null;
    
    // Only update if different to avoid unnecessary updates
    if (currentParam !== newParam) {
      updateUrlParams({
        selectedAlliances: newParam
      });
    }
  }, [selectedAlliances, searchParams, updateUrlParams]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (filteredData.length === 0) return null;

    // Get all unique dates across all alliances
    const allDates = new Set<string>();
    sortedData.forEach(alliance => {
      alliance.timeSeries.forEach(point => {
        allDates.add(point.date);
      });
    });

    const sortedDates = Array.from(allDates).sort();

    // Build data for each selected alliance
    const series = sortedData
      .filter(alliance => selectedAlliances.has(alliance.allianceId))
      .map(alliance => {
        const points = sortedDates.map(date => {
          const point = alliance.timeSeries.find(p => p.date === date);
          return point ? point.efficiency : null;
        });

        return {
          name: alliance.allianceName,
          allianceId: alliance.allianceId,
          data: points,
          dates: sortedDates
        };
      });

    return {
      dates: sortedDates,
      series
    };
  }, [sortedData, selectedAlliances]);

  // Generate colors for alliances
  const getColorForAlliance = (index: number): string => {
    const colors = [
      '#3b82f6', // blue
      '#ef4444', // red
      '#10b981', // green
      '#f59e0b', // amber
      '#8b5cf6', // purple
      '#ec4899', // pink
      '#06b6d4', // cyan
      '#f97316', // orange
      '#84cc16', // lime
      '#6366f1', // indigo
    ];
    return colors[index % colors.length];
  };

  if (loading) {
    return (
      <div className="p-5 text-center mt-20">
        Loading aid efficiency data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5 text-error mt-20">
        Error: {error}
      </div>
    );
  }

  return (
    <div className={`${tableClasses.container} mt-20`}>
      <div className={tableClasses.card}>
        <h1 className={tableClasses.title}>Aid Efficiency</h1>
        <p className="text-gray-600 mb-6">
          Aid efficiency percentage represents the percentage of available aid slots that are being utilized by each alliance.
        </p>

        {/* Filters */}
        <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Minimum Member Filter */}
          <div className="flex items-center gap-3">
            <input
              id="min-member-threshold"
              type="number"
              min="1"
              value={minMemberThreshold}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (!isNaN(value) && value >= 1) {
                  setMinMemberThreshold(value);
                }
              }}
              className="px-3 py-2 border-2 border-slate-400 rounded-lg text-base font-medium w-24 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
            <span className="text-sm text-gray-600">
              Alliances with at least this many members in last data update.
            </span>
          </div>

          {/* Efficiency Threshold Filter */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                id="efficiency-threshold"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={efficiencyThreshold ?? ''}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  if (!isNaN(value) && value >= 0 && value <= 100) {
                    setEfficiencyThreshold(value);
                  } else if (e.target.value === '') {
                    setEfficiencyThreshold(null);
                  }
                }}
                placeholder="e.g. 30"
                className="px-3 py-2 pr-7 border-2 border-slate-400 rounded-lg text-base font-medium w-24 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
              <span className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-base font-medium text-gray-700 pointer-events-none">
                %
              </span>
            </div>
            <span className="text-sm text-gray-600">
              Legacy Alliance Aid % Threshold
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 text-gray-800">Alliance Efficiency Table</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-300 text-sm bg-white">
              <thead>
                <tr className="bg-gray-800">
                  <th 
                    className="p-3 border border-slate-300 text-left text-white font-bold cursor-pointer hover:bg-gray-700 transition-colors select-none"
                    onClick={() => handleSort('alliance')}
                  >
                    <div className="flex items-center gap-2">
                      Alliance
                      <span className="text-xs text-gray-400">
                        {sortColumn === 'alliance' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th 
                    className="p-3 border border-slate-300 text-center text-white font-bold cursor-pointer hover:bg-gray-700 transition-colors select-none"
                    onClick={() => handleSort('efficiency')}
                  >
                    <div className="flex items-center justify-center gap-2">
                      Efficiency {mostRecentDate ? `(${mostRecentDate})` : ''}
                      <span className="text-xs text-gray-400">
                        {sortColumn === 'efficiency' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th 
                    className="p-3 border border-slate-300 text-center text-white font-bold cursor-pointer hover:bg-gray-700 transition-colors select-none"
                    onClick={() => handleSort('totalNations')}
                  >
                    <div className="flex items-center justify-center gap-2">
                      Nation Count {mostRecentDate ? `(${mostRecentDate})` : ''}
                      <span className="text-xs text-gray-400">
                        {sortColumn === 'totalNations' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th 
                    className="p-3 border border-slate-300 text-center text-white font-bold cursor-pointer hover:bg-gray-700 transition-colors select-none"
                    onClick={() => handleSort('avg30')}
                  >
                    <div className="flex items-center justify-center gap-2">
                      30 Day Avg
                      <span className="text-xs text-gray-400">
                        {sortColumn === 'avg30' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th 
                    className="p-3 border border-slate-300 text-center text-white font-bold cursor-pointer hover:bg-gray-700 transition-colors select-none"
                    onClick={() => handleSort('avg60')}
                  >
                    <div className="flex items-center justify-center gap-2">
                      60 Day Avg
                      <span className="text-xs text-gray-400">
                        {sortColumn === 'avg60' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th 
                    className="p-3 border border-slate-300 text-center text-white font-bold cursor-pointer hover:bg-gray-700 transition-colors select-none"
                    onClick={() => handleSort('avg90')}
                  >
                    <div className="flex items-center justify-center gap-2">
                      90 Day Avg
                      <span className="text-xs text-gray-400">
                        {sortColumn === 'avg90' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className="p-3 border border-slate-300 text-center text-white font-bold">
                    Show in Chart
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedData.map((alliance) => (
                  <tr 
                    key={alliance.allianceId} 
                    className="bg-white hover:bg-slate-50 cursor-pointer"
                    onClick={() => toggleAllianceSelection(alliance.allianceId)}
                  >
                    <td className="p-2 border border-slate-300 font-bold text-black">
                      {alliance.allianceName}
                    </td>
                    <td 
                      className={`p-2 border border-slate-300 text-center font-semibold ${
                        efficiencyThreshold !== null && alliance.currentEfficiency < efficiencyThreshold
                          ? 'bg-red-100 text-red-900 font-bold'
                          : 'text-black'
                      }`}
                    >
                      {alliance.currentEfficiency.toFixed(2)}%
                    </td>
                    <td className="p-2 border border-slate-300 text-center text-black">
                      {alliance.currentTotalNations}
                    </td>
                    <td 
                      className={`p-2 border border-slate-300 text-center ${
                        efficiencyThreshold !== null && alliance.avg30Days !== null && alliance.avg30Days < efficiencyThreshold
                          ? 'bg-red-100 text-red-900 font-bold'
                          : 'text-black'
                      }`}
                    >
                      {alliance.avg30Days !== null ? `${alliance.avg30Days.toFixed(2)}%` : 'N/A'}
                    </td>
                    <td 
                      className={`p-2 border border-slate-300 text-center ${
                        efficiencyThreshold !== null && alliance.avg60Days !== null && alliance.avg60Days < efficiencyThreshold
                          ? 'bg-red-100 text-red-900 font-bold'
                          : 'text-black'
                      }`}
                    >
                      {alliance.avg60Days !== null ? `${alliance.avg60Days.toFixed(2)}%` : 'N/A'}
                    </td>
                    <td 
                      className={`p-2 border border-slate-300 text-center ${
                        efficiencyThreshold !== null && alliance.avg90Days !== null && alliance.avg90Days < efficiencyThreshold
                          ? 'bg-red-100 text-red-900 font-bold'
                          : 'text-black'
                      }`}
                    >
                      {alliance.avg90Days !== null ? `${alliance.avg90Days.toFixed(2)}%` : 'N/A'}
                    </td>
                    <td className="p-2 border border-slate-300 text-center">
                      <input
                        type="checkbox"
                        checked={selectedAlliances.has(alliance.allianceId)}
                        onChange={() => toggleAllianceSelection(alliance.allianceId)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Line Chart */}
        {chartData && chartData.series.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">Aid Efficiency Over Time</h2>
              <button
                onClick={clearAllSelections}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border-2 border-slate-400 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
              >
                Clear All Selections
              </button>
            </div>
            <div className="bg-white p-6 rounded-lg border border-slate-300 overflow-x-auto">
              <div className="min-w-[1000px]">
                <AidEfficiencyChart 
                  data={chartData} 
                  getColorForAlliance={getColorForAlliance}
                  efficiencyThreshold={efficiencyThreshold}
                />
              </div>
            </div>
          </div>
        )}

        {chartData && chartData.series.length === 0 && (
          <div className="text-center p-10 text-gray-600">
            Select alliances from the table above to display them in the chart.
          </div>
        )}
      </div>
    </div>
  );
};

interface ChartProps {
  data: {
    dates: string[];
    series: Array<{
      name: string;
      allianceId: number;
      data: (number | null)[];
      dates: string[];
    }>;
  };
  getColorForAlliance: (index: number) => string;
  efficiencyThreshold: number | null;
}

const AidEfficiencyChart: React.FC<ChartProps> = ({ data, getColorForAlliance, efficiencyThreshold }) => {
  const [hoveredPoint, setHoveredPoint] = useState<{
    allianceName: string;
    value: number;
    date: string;
    x: number;
    y: number;
  } | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const width = 1000;
  const height = 500;
  const margin = { top: 20, right: 150, bottom: 60, left: 60 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  // Find min and max efficiency values
  const allValues = data.series.flatMap(s => s.data.filter(d => d !== null) as number[]);
  const minEfficiency = Math.min(0, ...allValues);
  const maxEfficiency = Math.max(100, ...allValues);
  const efficiencyRange = maxEfficiency - minEfficiency || 1;

  // Scale functions
  const xScale = (index: number) => (index / (data.dates.length - 1 || 1)) * plotWidth;
  const yScale = (value: number) => plotHeight - ((value - minEfficiency) / efficiencyRange) * plotHeight;

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // Format date with year for full date labels
  const formatDateFull = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  };

  // Generate x-axis ticks (show every nth date to avoid crowding)
  const tickInterval = Math.max(1, Math.floor(data.dates.length / 10));
  const xTicks = data.dates.filter((_, i) => i % tickInterval === 0 || i === data.dates.length - 1);

  // Generate y-axis ticks
  const yTicks = [0, 20, 40, 60, 80, 100];

  return (
    <>
      <svg ref={svgRef} width={width} height={height} className="overflow-visible">
      <g transform={`translate(${margin.left},${margin.top})`}>
        {/* Axes */}
        <line x1={0} y1={plotHeight} x2={plotWidth} y2={plotHeight} stroke="#999" strokeWidth={2} />
        <line x1={0} y1={0} x2={0} y2={plotHeight} stroke="#999" strokeWidth={2} />

        {/* X-axis ticks and labels */}
        {xTicks.map((date, i) => {
          const dateIndex = data.dates.indexOf(date);
          const x = xScale(dateIndex);
          return (
            <g key={`xtick-${i}`} transform={`translate(${x},0)`}>
              <line x1={0} y1={plotHeight} x2={0} y2={plotHeight + 6} stroke="#999" />
              <text
                x={0}
                y={plotHeight + 20}
                textAnchor="middle"
                fontSize={11}
                fill="#333"
                transform={`rotate(-45, ${x}, ${plotHeight + 20})`}
                style={{ transformOrigin: `${x}px ${plotHeight + 20}px` }}
              >
                {formatDateFull(date)}
              </text>
            </g>
          );
        })}

        {/* Y-axis ticks and labels */}
        {yTicks.map((tick, i) => {
          const y = yScale(tick);
          return (
            <g key={`ytick-${i}`} transform={`translate(0,${y})`}>
              <line x1={-6} y1={0} x2={0} y2={0} stroke="#999" />
              <text x={-10} y={4} textAnchor="end" fontSize={12} fill="#333">
                {tick}%
              </text>
            </g>
          );
        })}

        {/* Grid lines */}
        {yTicks.map((tick, i) => {
          if (i === 0) return null;
          const y = yScale(tick);
          return (
            <line
              key={`grid-${i}`}
              x1={0}
              y1={y}
              x2={plotWidth}
              y2={y}
              stroke="#e5e7eb"
              strokeWidth={1}
              strokeDasharray="2,2"
            />
          );
        })}

        {/* Legacy threshold line */}
        {efficiencyThreshold !== null && (
          <>
            <line
              x1={0}
              y1={yScale(efficiencyThreshold)}
              x2={plotWidth}
              y2={yScale(efficiencyThreshold)}
              stroke="#ef4444"
              strokeWidth={2}
              strokeDasharray="4,4"
            />
            <text
              x={plotWidth + 5}
              y={yScale(efficiencyThreshold) + 4}
              fontSize={11}
              fill="#ef4444"
              fontWeight="bold"
            >
              {efficiencyThreshold}% Threshold
            </text>
          </>
        )}

        {/* Plot lines for each alliance */}
        {data.series.map((series, seriesIndex) => {
          const color = getColorForAlliance(seriesIndex);
          const points: Array<{ x: number; y: number; value: number; date: string }> = [];

          // Build path data with value and date info
          series.data.forEach((value, index) => {
            if (value !== null) {
              points.push({
                x: xScale(index),
                y: yScale(value),
                value: value,
                date: series.dates[index]
              });
            }
          });

          // Draw line
          if (points.length > 1) {
            let pathData = `M ${points[0].x} ${points[0].y}`;
            for (let i = 1; i < points.length; i++) {
              pathData += ` L ${points[i].x} ${points[i].y}`;
            }

            return (
              <g key={`line-${series.allianceId}`}>
                <path
                  d={pathData}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Data points */}
                {points.map((point, pointIndex) => {
                  const isHovered = hoveredPoint?.allianceName === series.name && 
                                    hoveredPoint?.date === point.date;
                  
                  const handleMouseEnter = (e: React.MouseEvent) => {
                    if (svgRef.current) {
                      const svgRect = svgRef.current.getBoundingClientRect();
                      const pointX = point.x + margin.left;
                      const pointY = point.y + margin.top;
                      
                      setHoveredPoint({
                        allianceName: series.name,
                        value: point.value,
                        date: point.date,
                        x: pointX,
                        y: pointY
                      });
                      
                      // Calculate tooltip position relative to viewport
                      setTooltipPosition({
                        x: svgRect.left + pointX,
                        y: svgRect.top + pointY - 60
                      });
                    }
                  };

                  const handleMouseLeave = () => {
                    // Only clear if we're leaving this specific point
                    if (hoveredPoint?.allianceName === series.name && 
                        hoveredPoint?.date === point.date) {
                      setHoveredPoint(null);
                      setTooltipPosition(null);
                    }
                  };

                  return (
                    <g 
                      key={`point-${pointIndex}`}
                      onMouseEnter={handleMouseEnter}
                      onMouseLeave={handleMouseLeave}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Invisible larger circle for easier hovering */}
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={8}
                        fill="transparent"
                        stroke="none"
                        pointerEvents="all"
                      />
                      {/* Visible data point */}
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={isHovered ? 6 : 4}
                        fill={color}
                        stroke="white"
                        strokeWidth={isHovered ? 2 : 1}
                        pointerEvents="none"
                        style={{ 
                          transition: 'r 0.2s, stroke-width 0.2s'
                        }}
                      />
                    </g>
                  );
                })}
              </g>
            );
          }
          return null;
        })}

        {/* Axis labels */}
        <text
          x={plotWidth / 2}
          y={plotHeight + 50}
          textAnchor="middle"
          fontSize={14}
          fill="#333"
          fontWeight="bold"
        >
          Date
        </text>
        <text
          transform={`translate(${-45}, ${plotHeight / 2}) rotate(-90)`}
          textAnchor="middle"
          fontSize={14}
          fill="#333"
          fontWeight="bold"
        >
          Aid Efficiency (%)
        </text>
      </g>

      {/* Legend */}
      <g transform={`translate(${width - margin.right + 10}, ${margin.top})`}>
        {data.series.map((series, index) => {
          const color = getColorForAlliance(index);
          const y = index * 25;
          return (
            <g key={`legend-${series.allianceId}`}>
              <line
                x1={0}
                y1={y + 5}
                x2={20}
                y2={y + 5}
                stroke={color}
                strokeWidth={2}
              />
              <text
                x={25}
                y={y + 9}
                fontSize={12}
                fill="#333"
              >
                {series.name}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
    
    {/* Tooltip rendered outside SVG */}
    {hoveredPoint && tooltipPosition && (
      <div
        className="fixed z-50 pointer-events-none"
        style={{
          left: `${tooltipPosition.x}px`,
          top: `${tooltipPosition.y}px`,
          transform: 'translate(-50%, 0)'
        }}
      >
        <div className="bg-black bg-opacity-90 text-white rounded-lg px-3 py-2 shadow-lg border border-gray-600 min-w-[140px] relative">
          <div className="text-xs font-bold text-center mb-1">
            {hoveredPoint.allianceName}
          </div>
          <div className="text-xs text-gray-300 text-center mb-1">
            {formatDate(hoveredPoint.date)}
          </div>
          <div className="text-sm font-bold text-center">
            {hoveredPoint.value.toFixed(2)}%
          </div>
          {/* Arrow pointing down */}
          <div className="absolute left-1/2 top-full transform -translate-x-1/2">
            <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-black border-t-opacity-90"></div>
          </div>
        </div>
      </div>
    )}
  </>
  );
};

export default AidEfficiencyPage;

