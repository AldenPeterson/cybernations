import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiCallWithErrorHandling, API_ENDPOINTS } from '../utils/api';
import { tableClasses } from '../styles/tableClasses';
import TableContainer from '../components/TableContainer';

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
  avg10Days: number | null;
  avg30Days: number | null;
  avg60Days: number | null;
  avg90Days: number | null;
  timeSeries: AidEfficiencyDataPoint[];
}

interface AidEfficiencyResponse {
  success: boolean;
  data: AllianceEfficiencyData[];
}

interface AllianceAidTotalsData {
  allianceId: number;
  allianceName: string;
  totalNations: number;
  efficiency: number;
  totalTechSent: number;
  totalTechReceived: number;
  totalCashSent: number;
  totalCashReceived: number;
  pricePer100Tech: number;
  totalOffersSent: number;
  totalOffersReceived: number;
  techSentPercent: number;
  techReceivedPercent: number;
  daysAnalyzed: number;
}

interface AllianceAidTotalsResponse {
  success: boolean;
  startDate: string;
  endDate: string;
  data: AllianceAidTotalsData[];
}

// Helper functions for date calculations (return YYYY-MM-DD format for date inputs)
const getYesterdayCentralTime = (): string => {
  const now = new Date();
  const centralTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const yesterday = new Date(centralTime);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const month = (yesterday.getMonth() + 1).toString().padStart(2, '0');
  const day = yesterday.getDate().toString().padStart(2, '0');
  const year = yesterday.getFullYear().toString();
  return `${year}-${month}-${day}`;
};

const getDate30DaysBefore = (dateStr: string): string => {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  date.setDate(date.getDate() - 30);
  
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear().toString();
  return `${year}-${month}-${day}`;
};

const getDefaultDates = (): { startDate: string; endDate: string } => {
  const endDate = getYesterdayCentralTime();
  const startDate = getDate30DaysBefore(endDate);
  return { startDate, endDate };
};

// Calculate default dates once outside component to avoid calling on every render
// Wrap in try-catch to handle any potential errors during module initialization
let DEFAULT_DATES: { startDate: string; endDate: string };
try {
  DEFAULT_DATES = getDefaultDates();
} catch (error) {
  console.error('Error calculating default dates:', error);
  // Fallback to a safe default
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const month = (yesterday.getMonth() + 1).toString().padStart(2, '0');
  const day = yesterday.getDate().toString().padStart(2, '0');
  const year = yesterday.getFullYear().toString();
  const endDate = `${year}-${month}-${day}`;
  const startDate = getDate30DaysBefore(endDate);
  DEFAULT_DATES = { startDate, endDate };
}

const AidEfficiencyPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'efficiency' | 'totals'>('efficiency');
  const [data, setData] = useState<AllianceEfficiencyData[]>([]);
  const [totalsData, setTotalsData] = useState<AllianceAidTotalsData[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalsLoading, setTotalsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalsError, setTotalsError] = useState<string | null>(null);
  const [selectedAlliances, setSelectedAlliances] = useState<Set<number>>(new Set());
  const [minMemberThreshold, setMinMemberThreshold] = useState<number>(10);
  const [efficiencyThreshold, setEfficiencyThreshold] = useState<number | null>(20);
  const hasInitializedFromUrl = useRef(false);
  const hasInitializedThresholds = useRef(false);
  const hasFetchedData = useRef(false);
  const isUpdatingTotalsDatesFromUser = useRef(false);
  
  // Date state for Alliance Aid Totals tab - initialize with defaults, sync from URL in useEffect
  // Use safe fallback in case DEFAULT_DATES is undefined
  const defaultStartDate = DEFAULT_DATES?.startDate || '2024-01-01';
  const defaultEndDate = DEFAULT_DATES?.endDate || '2024-01-31';
  const [totalsStartDate, setTotalsStartDate] = useState<string>(defaultStartDate);
  const [totalsEndDate, setTotalsEndDate] = useState<string>(defaultEndDate);
  const [debouncedTotalsStartDate, setDebouncedTotalsStartDate] = useState<string>(defaultStartDate);
  const [debouncedTotalsEndDate, setDebouncedTotalsEndDate] = useState<string>(defaultEndDate);
  const [totalsSortColumn, setTotalsSortColumn] = useState<'alliance' | 'efficiency' | 'totalTechSent' | 'totalTechReceived' | 'techSentPercent' | 'techReceivedPercent' | 'totalCashSent' | 'totalCashReceived' | 'pricePer100Tech' | 'totalOffersSent' | 'totalOffersReceived' | 'totalNations'>('totalTechReceived');
  const [totalsSortDirection, setTotalsSortDirection] = useState<'asc' | 'desc'>('desc');
  const [sortColumn, setSortColumn] = useState<'alliance' | 'efficiency' | 'totalNations' | 'avg10' | 'avg30' | 'avg60' | 'avg90'>('efficiency');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

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

  // Format date from input (YYYY-MM-DD) to MM/DD/YYYY for API
  const formatDateForApi = (dateStr: string): string => {
    if (!dateStr || dateStr.trim() === '') {
      return '';
    }
    if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
      return dateStr;
    }
    const parts = dateStr.split('-');
    if (parts.length !== 3) {
      console.error('Invalid date format:', dateStr);
      return '';
    }
    const [year, month, day] = parts;
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);
    const yearNum = parseInt(year, 10);
    if (isNaN(monthNum) || isNaN(dayNum) || isNaN(yearNum)) {
      console.error('Invalid date values:', { year, month, day });
      return '';
    }
    return `${monthNum}/${dayNum}/${yearNum}`;
  };

  // Debounce totals date changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTotalsStartDate(totalsStartDate);
      setDebouncedTotalsEndDate(totalsEndDate);
      
      isUpdatingTotalsDatesFromUser.current = true;
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set('totalsStartDate', totalsStartDate);
      newSearchParams.set('totalsEndDate', totalsEndDate);
      setSearchParams(newSearchParams, { replace: true });
      setTimeout(() => {
        isUpdatingTotalsDatesFromUser.current = false;
      }, 100);
    }, 500);

    return () => clearTimeout(timer);
  }, [totalsStartDate, totalsEndDate, searchParams, setSearchParams]);

  // Fetch totals data
  const fetchTotalsData = useCallback(async () => {
    try {
      setTotalsLoading(true);
      setTotalsError(null);

      const formattedStartDate = formatDateForApi(debouncedTotalsStartDate);
      const formattedEndDate = formatDateForApi(debouncedTotalsEndDate);

      if (!formattedStartDate || !formattedEndDate) {
        setTotalsError('Please select valid start and end dates');
        setTotalsLoading(false);
        return;
      }

      const response: AllianceAidTotalsResponse = await apiCallWithErrorHandling(
        API_ENDPOINTS.allianceAidTotals(formattedStartDate, formattedEndDate)
      );
      if (response.success && response.data) {
        setTotalsData(response.data);
      } else {
        setTotalsError('Failed to load data: Unknown error');
      }
    } catch (err) {
      console.error('Error fetching alliance aid totals:', err);
      const msg = err instanceof Error ? err.message : 'Failed to load alliance aid totals data';
      setTotalsError(msg);
    } finally {
      setTotalsLoading(false);
    }
  }, [debouncedTotalsStartDate, debouncedTotalsEndDate]);

  // Initialize activeTab from URL parameter on mount and sync when URL changes
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    // Support both 'efficiency' and 'totals' for direct linking, default to 'efficiency'
    const newTab = tabParam === 'totals' ? 'totals' : 'efficiency';
    
    // Only update if different from current state to avoid unnecessary re-renders
    setActiveTab(prevTab => {
      if (prevTab !== newTab) {
        return newTab;
      }
      return prevTab;
    });
  }, [searchParams.toString()]); // Sync when URL changes (e.g., browser back/forward)

  // Fetch totals data when debounced dates change or tab changes to totals
  useEffect(() => {
    if (activeTab === 'totals') {
      fetchTotalsData();
    }
  }, [activeTab, fetchTotalsData]);

  // Note: Totals dates are initialized with defaults. URL sync happens via the debounce effect below.

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
      const timeSeriesNations = alliance.timeSeries?.map(point => point.totalNations) || [];
      const maxNations = Math.max(
        alliance.currentTotalNations || 0,
        ...timeSeriesNations
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
        case 'avg10': {
          const avgA = a.avg10Days ?? -1;
          const avgB = b.avg10Days ?? -1;
          comparison = avgA - avgB;
          break;
        }
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

  const handleSort = (column: 'alliance' | 'efficiency' | 'totalNations' | 'avg10' | 'avg30' | 'avg60' | 'avg90') => {
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
  const mostRecentDate = useMemo((): string | null => {
    if (data.length === 0) return null;
    
    let latestDateStr: string | null = null;
    data.forEach(alliance => {
      if (alliance.timeSeries && Array.isArray(alliance.timeSeries)) {
        alliance.timeSeries.forEach(point => {
          // Compare date strings directly (YYYY-MM-DD format)
          if (latestDateStr === null || point.date > latestDateStr) {
            latestDateStr = point.date;
          }
        });
      }
    });
    
    if (!latestDateStr) return null;
    
    // Parse date string (YYYY-MM-DD) and format as M/D
    // The date string represents a Central Time date, so we parse it as such
    const dateStr: string = latestDateStr;
    const dateParts = dateStr.split('-');
    if (dateParts.length !== 3) return null;
    const year = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10);
    const day = parseInt(dateParts[2], 10);
    
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    
    // Create date in Central Time by using the date components directly
    // Format as M/D (month/day)
    return `${month}/${day}`;
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
      if (alliance.timeSeries && Array.isArray(alliance.timeSeries)) {
        alliance.timeSeries.forEach(point => {
          allDates.add(point.date);
        });
      }
    });

    const sortedDates = Array.from(allDates).sort();

    // Build data for each selected alliance
    const series = sortedData
      .filter(alliance => selectedAlliances.has(alliance.allianceId))
      .map(alliance => {
        const timeSeries = alliance.timeSeries || [];
        const points = sortedDates.map(date => {
          const point = timeSeries.find(p => p.date === date);
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

  // Helper function to get cell class based on value and threshold
  const getCellClass = (value: number | null): string => {
    if (efficiencyThreshold === null || value === null) {
      return 'text-black';
    }
    
    const threshold = efficiencyThreshold;
    const lowerBound = threshold - 5;
    const upperBound = threshold + 5;
    
    if (value < threshold) {
      return 'bg-red-900/30 text-red-400 font-bold';
    } else if (value >= lowerBound && value <= upperBound) {
      return 'bg-yellow-900/30 text-yellow-400 font-bold';
    }
    return 'text-gray-200';
  };

  // Calculate days analyzed for totals
  const calculateTotalsDaysAnalyzed = (): number => {
    try {
      const start = new Date(totalsStartDate);
      const end = new Date(totalsEndDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return 0;
      }
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return Math.max(0, diffDays);
    } catch {
      return 0;
    }
  };

  const totalsDaysAnalyzed = calculateTotalsDaysAnalyzed();

  // Helper function to format numbers in millions (XX.X million) or billions (XX.X billion)
  const formatMillions = (value: number): string => {
    if (value === 0) return '0M';
    const millions = value / 1000000;
    if (millions >= 1000) {
      const billions = millions / 1000;
      return `${billions.toFixed(1)}B`;
    }
    const formatted = millions.toFixed(1);
    return formatted.endsWith('.0') ? `${millions.toFixed(0)}M` : `${formatted}M`;
  };

  // Filter and sort totals data
  const sortedTotalsData = useMemo(() => {
    // First filter by minimum member threshold
    const filtered = totalsData.filter(alliance => 
      alliance.totalNations >= minMemberThreshold
    );
    
    // Then sort
    const sorted = [...filtered];
    
    sorted.sort((a, b) => {
      let comparison = 0;
      
      switch (totalsSortColumn) {
        case 'alliance':
          comparison = a.allianceName.localeCompare(b.allianceName);
          break;
        case 'efficiency':
          comparison = a.efficiency - b.efficiency;
          break;
        case 'totalTechSent':
          comparison = a.totalTechSent - b.totalTechSent;
          break;
        case 'totalTechReceived':
          comparison = a.totalTechReceived - b.totalTechReceived;
          break;
        case 'techSentPercent':
          comparison = a.techSentPercent - b.techSentPercent;
          break;
        case 'techReceivedPercent':
          comparison = a.techReceivedPercent - b.techReceivedPercent;
          break;
        case 'totalCashSent':
          comparison = a.totalCashSent - b.totalCashSent;
          break;
        case 'totalCashReceived':
          comparison = a.totalCashReceived - b.totalCashReceived;
          break;
        case 'pricePer100Tech':
          comparison = a.pricePer100Tech - b.pricePer100Tech;
          break;
        case 'totalOffersSent':
          comparison = a.totalOffersSent - b.totalOffersSent;
          break;
        case 'totalOffersReceived':
          comparison = a.totalOffersReceived - b.totalOffersReceived;
          break;
        case 'totalNations':
          comparison = a.totalNations - b.totalNations;
          break;
      }
      
      return totalsSortDirection === 'asc' ? comparison : -comparison;
    });
    
      return sorted;
  }, [totalsData, totalsSortColumn, totalsSortDirection, minMemberThreshold]);

  const handleTotalsSort = (column: 'alliance' | 'efficiency' | 'totalTechSent' | 'totalTechReceived' | 'techSentPercent' | 'techReceivedPercent' | 'totalCashSent' | 'totalCashReceived' | 'pricePer100Tech' | 'totalOffersSent' | 'totalOffersReceived' | 'totalNations') => {
    if (totalsSortColumn === column) {
      setTotalsSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setTotalsSortColumn(column);
      setTotalsSortDirection('desc');
    }
  };

  return (
    <TableContainer>
      <h1 className={tableClasses.title}>Aid Efficiency</h1>
      
      {/* Show loading/error states inside the container instead of early return */}
      {loading && (
        <div className="p-5 text-center">
          Loading aid efficiency data...
        </div>
      )}
      
      {error && (
        <div className="p-5 text-error">
          Error: {error}
        </div>
      )}
      
      {!loading && !error && (
        <>
      
      {/* Tabs */}
      <div className="mb-6 border-b border-gray-700">
        <div className="flex gap-4">
          <button
            onClick={() => {
              setActiveTab('efficiency');
              const newSearchParams = new URLSearchParams(searchParams);
              newSearchParams.set('tab', 'efficiency');
              setSearchParams(newSearchParams, { replace: true });
            }}
            className={`px-4 py-2 font-semibold transition-colors ${
              activeTab === 'efficiency'
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Alliance Efficiency
          </button>
          <button
            onClick={() => {
              setActiveTab('totals');
              const newSearchParams = new URLSearchParams(searchParams);
              newSearchParams.set('tab', 'totals');
              setSearchParams(newSearchParams, { replace: true });
            }}
            className={`px-4 py-2 font-semibold transition-colors ${
              activeTab === 'totals'
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Alliance Aid Totals
          </button>
        </div>
      </div>

      {activeTab === 'efficiency' && (
        <>
          <p className="text-gray-400 mb-6">
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
              className="px-3 py-2 border-2 border-gray-600 rounded-lg text-base font-medium w-24 bg-gray-800 text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
            <span className="text-sm text-gray-400">
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
                className="px-3 py-2 pr-7 border-2 border-gray-600 rounded-lg text-base font-medium w-24 bg-gray-800 text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
              <span className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-base font-medium text-gray-400 pointer-events-none">
                %
              </span>
            </div>
            <span className="text-sm text-gray-400">
              Legacy Alliance Aid % Threshold
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 text-gray-200">Alliance Efficiency Table</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-700 text-sm bg-gray-800">
              <thead>
                <tr className="bg-gray-700">
                  <th 
                    className="p-3 border border-gray-600 text-left text-white font-bold cursor-pointer hover:bg-gray-600 transition-colors select-none"
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
                    className="p-3 border border-gray-600 text-center text-white font-bold cursor-pointer hover:bg-gray-600 transition-colors select-none"
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
                    className="p-3 border border-gray-600 text-center text-white font-bold cursor-pointer hover:bg-gray-600 transition-colors select-none"
                    onClick={() => handleSort('efficiency')}
                  >
                    <div className="flex items-center justify-center gap-2">
                      Most Recent {mostRecentDate ? `(${mostRecentDate})` : ''}
                      <span className="text-xs text-gray-400">
                        {sortColumn === 'efficiency' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th 
                    className="p-3 border border-gray-600 text-center text-white font-bold cursor-pointer hover:bg-gray-600 transition-colors select-none"
                    onClick={() => handleSort('avg10')}
                  >
                    <div className="flex items-center justify-center gap-2">
                      10 Day Avg
                      <span className="text-xs text-gray-400">
                        {sortColumn === 'avg10' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th 
                    className="p-3 border border-gray-600 text-center text-white font-bold cursor-pointer hover:bg-gray-600 transition-colors select-none"
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
                    className="p-3 border border-gray-600 text-center text-white font-bold cursor-pointer hover:bg-gray-600 transition-colors select-none"
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
                    className="p-3 border border-gray-600 text-center text-white font-bold cursor-pointer hover:bg-gray-600 transition-colors select-none"
                    onClick={() => handleSort('avg90')}
                  >
                    <div className="flex items-center justify-center gap-2">
                      90 Day Avg
                      <span className="text-xs text-gray-400">
                        {sortColumn === 'avg90' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className="p-3 border border-gray-600 text-center text-white font-bold">
                    Show in Chart
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedData.map((alliance) => (
                  <tr 
                    key={alliance.allianceId} 
                    className="bg-gray-800 hover:bg-gray-700 cursor-pointer"
                    onClick={() => toggleAllianceSelection(alliance.allianceId)}
                  >
                    <td className="p-2 border border-gray-700 font-bold text-gray-200">
                      {alliance.allianceName}
                    </td>
                    <td className="p-2 border border-gray-700 text-center text-gray-200">
                      {alliance.currentTotalNations}
                    </td>
                    <td 
                      className={`p-2 border border-gray-700 text-center font-semibold ${getCellClass(alliance.currentEfficiency)}`}
                    >
                      {alliance.currentEfficiency.toFixed(2)}%
                    </td>
                    <td 
                      className={`p-2 border border-gray-700 text-center ${getCellClass(alliance.avg10Days)}`}
                    >
                      {alliance.avg10Days !== null ? `${alliance.avg10Days.toFixed(2)}%` : 'N/A'}
                    </td>
                    <td 
                      className={`p-2 border border-gray-700 text-center ${getCellClass(alliance.avg30Days)}`}
                    >
                      {alliance.avg30Days !== null ? `${alliance.avg30Days.toFixed(2)}%` : 'N/A'}
                    </td>
                    <td 
                      className={`p-2 border border-gray-700 text-center ${getCellClass(alliance.avg60Days)}`}
                    >
                      {alliance.avg60Days !== null ? `${alliance.avg60Days.toFixed(2)}%` : 'N/A'}
                    </td>
                    <td 
                      className={`p-2 border border-gray-700 text-center ${getCellClass(alliance.avg90Days)}`}
                    >
                      {alliance.avg90Days !== null ? `${alliance.avg90Days.toFixed(2)}%` : 'N/A'}
                    </td>
                    <td className="p-2 border border-gray-700 text-center">
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
              <h2 className="text-xl font-bold text-gray-200">Aid Efficiency Over Time</h2>
              <button
                onClick={clearAllSelections}
                className="px-4 py-2 text-sm font-medium text-gray-200 bg-gray-800 border-2 border-gray-600 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
              >
                Clear All Selections
              </button>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 overflow-x-auto">
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
          <div className="text-center p-10 text-gray-400">
            Select alliances from the table above to display them in the chart.
          </div>
        )}
        </>
      )}

      {activeTab === 'totals' && (
        <>
          <p className="text-gray-400 mb-6">
            Alliance aid totals count offers originated between the start date and end date. Efficiency represents the average alliance aid slot utilization.
          </p>

          {/* Filters */}
          <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Minimum Member Filter */}
            <div className="flex items-center gap-3">
              <input
                id="totals-min-member-threshold"
                type="number"
                min="1"
                value={minMemberThreshold}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  if (!isNaN(value) && value >= 1) {
                    setMinMemberThreshold(value);
                  }
                }}
                className="px-3 py-2 border-2 border-gray-600 rounded-lg text-base font-medium w-24 bg-gray-800 text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
              <span className="text-sm text-gray-400">
                Alliances with at least this many members.
              </span>
            </div>
          </div>

          {/* Date Filters */}
          <div className="mb-6 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <label htmlFor="totals-start-date" className="text-sm font-semibold text-gray-300 whitespace-nowrap w-24">
                Start Date:
              </label>
              <input
                id="totals-start-date"
                type="date"
                value={totalsStartDate}
                onChange={(e) => setTotalsStartDate(e.target.value)}
                className="px-3 py-2 border-2 border-gray-600 rounded-lg text-base font-medium bg-gray-800 text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>

            <div className="flex items-center gap-3">
              <label htmlFor="totals-end-date" className="text-sm font-semibold text-gray-300 whitespace-nowrap w-24">
                End Date:
              </label>
              <input
                id="totals-end-date"
                type="date"
                value={totalsEndDate}
                onChange={(e) => setTotalsEndDate(e.target.value)}
                className="px-3 py-2 border-2 border-gray-600 rounded-lg text-base font-medium bg-gray-800 text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-300 whitespace-nowrap w-24">
                Days Analyzed:
              </span>
              <span className="px-3 py-2 border-2 border-gray-700 rounded-lg text-base font-medium bg-gray-800 text-gray-200">
                {totalsDaysAnalyzed}
              </span>
            </div>
          </div>

          {totalsLoading && (
            <div className="text-center p-5 text-gray-300">
              Loading alliance aid totals data...
            </div>
          )}

          {totalsError && (
            <div className="p-5 text-error">
              Error: {totalsError}
            </div>
          )}

          {!totalsLoading && !totalsError && totalsData.length === 0 && (
            <div className="text-center p-10 text-gray-400">
              No data available for the selected date range.
            </div>
          )}

          {!totalsLoading && !totalsError && totalsData.length > 0 && (
            <div className="mb-8">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-700 text-sm bg-gray-800">
                  <thead>
                    <tr className="bg-gray-700">
                      <th 
                        className="p-3 border border-gray-600 text-left text-white font-bold cursor-pointer hover:bg-gray-600 transition-colors select-none"
                        onClick={() => handleTotalsSort('alliance')}
                      >
                        <div className="flex items-center gap-2">
                          Alliance
                          <span className="text-xs text-gray-400">
                            {totalsSortColumn === 'alliance' ? (totalsSortDirection === 'asc' ? '↑' : '↓') : '↕'}
                          </span>
                        </div>
                      </th>
                      <th 
                        className="p-3 border border-gray-600 text-center text-white font-bold cursor-pointer hover:bg-gray-600 transition-colors select-none"
                        onClick={() => handleTotalsSort('efficiency')}
                      >
                        <div className="flex items-center justify-center gap-2">
                          Efficiency %
                          <span className="text-xs text-gray-400">
                            {totalsSortColumn === 'efficiency' ? (totalsSortDirection === 'asc' ? '↑' : '↓') : '↕'}
                          </span>
                        </div>
                      </th>
                      <th 
                        className="p-3 border border-gray-600 text-center text-white font-bold cursor-pointer hover:bg-gray-600 transition-colors select-none"
                        onClick={() => handleTotalsSort('totalTechSent')}
                      >
                        <div className="flex items-center justify-center gap-2">
                          Tech Sent
                          <span className="text-xs text-gray-400">
                            {totalsSortColumn === 'totalTechSent' ? (totalsSortDirection === 'asc' ? '↑' : '↓') : '↕'}
                          </span>
                        </div>
                      </th>
                      <th 
                        className="p-3 border border-gray-600 text-center text-white font-bold cursor-pointer hover:bg-gray-600 transition-colors select-none"
                        onClick={() => handleTotalsSort('totalTechReceived')}
                      >
                        <div className="flex items-center justify-center gap-2">
                          Tech Received
                          <span className="text-xs text-gray-400">
                            {totalsSortColumn === 'totalTechReceived' ? (totalsSortDirection === 'asc' ? '↑' : '↓') : '↕'}
                          </span>
                        </div>
                      </th>
                      <th 
                        className="p-3 border border-gray-600 text-center text-white font-bold cursor-pointer hover:bg-gray-600 transition-colors select-none"
                        onClick={() => handleTotalsSort('totalCashSent')}
                      >
                        <div className="flex items-center justify-center gap-2">
                          Cash Sent
                          <span className="text-xs text-gray-400">
                            {totalsSortColumn === 'totalCashSent' ? (totalsSortDirection === 'asc' ? '↑' : '↓') : '↕'}
                          </span>
                        </div>
                      </th>
                      <th 
                        className="p-3 border border-gray-600 text-center text-white font-bold cursor-pointer hover:bg-gray-600 transition-colors select-none"
                        onClick={() => handleTotalsSort('totalCashReceived')}
                      >
                        <div className="flex items-center justify-center gap-2">
                          Cash Received
                          <span className="text-xs text-gray-400">
                            {totalsSortColumn === 'totalCashReceived' ? (totalsSortDirection === 'asc' ? '↑' : '↓') : '↕'}
                          </span>
                        </div>
                      </th>
                      <th 
                        className="p-3 border border-gray-600 text-center text-white font-bold cursor-pointer hover:bg-gray-600 transition-colors select-none"
                        onClick={() => handleTotalsSort('pricePer100Tech')}
                      >
                        <div className="flex items-center justify-center gap-2">
                          Price/100 Tech
                          <span className="text-xs text-gray-400">
                            {totalsSortColumn === 'pricePer100Tech' ? (totalsSortDirection === 'asc' ? '↑' : '↓') : '↕'}
                          </span>
                        </div>
                      </th>
                      <th 
                        className="p-3 border border-gray-600 text-center text-white font-bold cursor-pointer hover:bg-gray-600 transition-colors select-none"
                        onClick={() => handleTotalsSort('totalOffersSent')}
                      >
                        <div className="flex items-center justify-center gap-2">
                          Offers Sent
                          <span className="text-xs text-gray-400">
                            {totalsSortColumn === 'totalOffersSent' ? (totalsSortDirection === 'asc' ? '↑' : '↓') : '↕'}
                          </span>
                        </div>
                      </th>
                      <th 
                        className="p-3 border border-gray-600 text-center text-white font-bold cursor-pointer hover:bg-gray-600 transition-colors select-none"
                        onClick={() => handleTotalsSort('techSentPercent')}
                      >
                        <div className="flex items-center justify-center gap-2">
                          Tech Sent %
                          <span className="text-xs text-gray-400">
                            {totalsSortColumn === 'techSentPercent' ? (totalsSortDirection === 'asc' ? '↑' : '↓') : '↕'}
                          </span>
                        </div>
                      </th>
                      <th 
                        className="p-3 border border-gray-600 text-center text-white font-bold cursor-pointer hover:bg-gray-600 transition-colors select-none"
                        onClick={() => handleTotalsSort('totalOffersReceived')}
                      >
                        <div className="flex items-center justify-center gap-2">
                          Offers Received
                          <span className="text-xs text-gray-400">
                            {totalsSortColumn === 'totalOffersReceived' ? (totalsSortDirection === 'asc' ? '↑' : '↓') : '↕'}
                          </span>
                        </div>
                      </th>
                      <th 
                        className="p-3 border border-gray-600 text-center text-white font-bold cursor-pointer hover:bg-gray-600 transition-colors select-none"
                        onClick={() => handleTotalsSort('techReceivedPercent')}
                      >
                        <div className="flex items-center justify-center gap-2">
                          Tech Received %
                          <span className="text-xs text-gray-400">
                            {totalsSortColumn === 'techReceivedPercent' ? (totalsSortDirection === 'asc' ? '↑' : '↓') : '↕'}
                          </span>
                        </div>
                      </th>
                      <th 
                        className="p-3 border border-gray-600 text-center text-white font-bold cursor-pointer hover:bg-gray-600 transition-colors select-none"
                        onClick={() => handleTotalsSort('totalNations')}
                      >
                        <div className="flex items-center justify-center gap-2">
                          Total Nations
                          <span className="text-xs text-gray-400">
                            {totalsSortColumn === 'totalNations' ? (totalsSortDirection === 'asc' ? '↑' : '↓') : '↕'}
                          </span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTotalsData.map((alliance) => (
                      <tr 
                        key={alliance.allianceId} 
                        className="bg-gray-800 hover:bg-gray-700"
                      >
                        <td className="p-2 border border-gray-700 font-bold text-gray-200">
                          {alliance.allianceName}
                        </td>
                        <td className="p-2 border border-gray-700 text-center font-semibold text-gray-200">
                          {alliance.efficiency.toFixed(1)}%
                        </td>
                        <td className="p-2 border border-gray-700 text-center text-gray-200">
                          {alliance.totalTechSent.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td className="p-2 border border-gray-700 text-center text-gray-200">
                          {alliance.totalTechReceived.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td className="p-2 border border-gray-700 text-center text-gray-200">
                          ${formatMillions(alliance.totalCashSent)}
                        </td>
                        <td className="p-2 border border-gray-700 text-center text-gray-200">
                          ${formatMillions(alliance.totalCashReceived)}
                        </td>
                        <td className="p-2 border border-gray-700 text-center text-gray-200">
                          ${formatMillions(alliance.pricePer100Tech)}
                        </td>
                        <td className="p-2 border border-gray-700 text-center text-gray-200">
                          {alliance.totalOffersSent.toLocaleString()}
                        </td>
                        <td className="p-2 border border-gray-700 text-center text-gray-200">
                          {alliance.techSentPercent.toFixed(1)}%
                        </td>
                        <td className="p-2 border border-gray-700 text-center text-gray-200">
                          {alliance.totalOffersReceived.toLocaleString()}
                        </td>
                        <td className="p-2 border border-gray-700 text-center text-gray-200">
                          {alliance.techReceivedPercent.toFixed(1)}%
                        </td>
                        <td className="p-2 border border-gray-700 text-center text-gray-200">
                          {alliance.totalNations}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
        </>
      )}
    </TableContainer>
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
  const [hoveredAllianceId, setHoveredAllianceId] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const width = 1000;
  const height = 500;
  const margin = { top: 20, right: 150, bottom: 80, left: 60 };
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

  // Format date for display (treats date string as Central Time date)
  const formatDate = (dateStr: string) => {
    // Parse YYYY-MM-DD format and treat as Central Time date
    const [, month, day] = dateStr.split('-').map(Number);
    return `${month}/${day}`;
  };

  // Generate x-axis ticks (show dates at regular intervals, ensuring we show at least a few)
  // Aim for about 8-12 ticks, but always show first, last, and a few in between
  const maxTicks = 12;
  const minTicks = 5;
  const numTicks = Math.min(maxTicks, Math.max(minTicks, data.dates.length));
  const xTicks: string[] = [];
  
  if (data.dates.length === 0) {
    // No dates to show
  } else if (data.dates.length <= numTicks) {
    // Show all dates if we have few enough
    xTicks.push(...data.dates);
  } else {
    // Show evenly spaced dates
    const tickInterval = Math.floor((data.dates.length - 1) / (numTicks - 1));
    
    // Always include first date
    xTicks.push(data.dates[0]);
    
    // Add intermediate dates
    for (let i = tickInterval; i < data.dates.length - 1; i += tickInterval) {
      if (!xTicks.includes(data.dates[i])) {
        xTicks.push(data.dates[i]);
      }
    }
    
    // Always include last date if it's not already included
    const lastDate = data.dates[data.dates.length - 1];
    if (!xTicks.includes(lastDate)) {
      xTicks.push(lastDate);
    }
  }

  // Generate y-axis ticks
  const yTicks = [0, 20, 40, 60, 80, 100];

  return (
    <>
      <svg ref={svgRef} width={width} height={height} className="overflow-visible">
      <g transform={`translate(${margin.left},${margin.top})`}>
        {/* Axes */}
        <line x1={0} y1={plotHeight} x2={plotWidth} y2={plotHeight} stroke="#9ca3af" strokeWidth={2} />
        <line x1={0} y1={0} x2={0} y2={plotHeight} stroke="#9ca3af" strokeWidth={2} />

        {/* X-axis ticks and labels */}
        {xTicks.map((date, i) => {
          const dateIndex = data.dates.indexOf(date);
          const x = xScale(dateIndex);
          return (
            <g key={`xtick-${i}`} transform={`translate(${x},0)`}>
              <line x1={0} y1={plotHeight} x2={0} y2={plotHeight + 6} stroke="#9ca3af" />
              <text
                x={0}
                y={plotHeight + 20}
                textAnchor="middle"
                fontSize={10}
                fill="#e5e7eb"
                transform={`rotate(-45, 0, ${plotHeight + 20})`}
                style={{ dominantBaseline: 'hanging' }}
              >
                {formatDate(date)}
              </text>
            </g>
          );
        })}

        {/* Y-axis ticks and labels */}
        {yTicks.map((tick, i) => {
          const y = yScale(tick);
          return (
            <g key={`ytick-${i}`} transform={`translate(0,${y})`}>
              <line x1={-6} y1={0} x2={0} y2={0} stroke="#9ca3af" />
              <text x={-10} y={4} textAnchor="end" fontSize={12} fill="#e5e7eb">
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
              stroke="#4b5563"
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
              Legacy Threshold
            </text>
          </>
        )}

        {/* Plot lines for each alliance */}
        {data.series.map((series, seriesIndex) => {
          const color = getColorForAlliance(seriesIndex);
          const isHovered = hoveredAllianceId === series.allianceId;
          const isDimmed = hoveredAllianceId !== null && hoveredAllianceId !== series.allianceId;
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
                  strokeWidth={isHovered ? 4 : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={isDimmed ? 0.3 : 1}
                  className="transition-all duration-200 ease-in-out"
                />
                {/* Invisible hover areas for tooltips */}
                {points.map((point, pointIndex) => {
                  const handleMouseEnter = () => {
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
                        y: svgRect.top + pointY - 80
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
                    <circle
                      key={`hover-${pointIndex}`}
                      cx={point.x}
                      cy={point.y}
                      r={8}
                      fill="transparent"
                      stroke="none"
                      pointerEvents="all"
                      onMouseEnter={handleMouseEnter}
                      onMouseLeave={handleMouseLeave}
                      className="cursor-pointer"
                    />
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
          fill="#e5e7eb"
          fontWeight="bold"
        >
          Date
        </text>
        <text
          transform={`translate(${-45}, ${plotHeight / 2}) rotate(-90)`}
          textAnchor="middle"
          fontSize={14}
          fill="#e5e7eb"
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
          const isLegendHovered = hoveredAllianceId === series.allianceId;
          const isLegendDimmed = hoveredAllianceId !== null && hoveredAllianceId !== series.allianceId;
          
          return (
            <g 
              key={`legend-${series.allianceId}`}
              onMouseEnter={() => setHoveredAllianceId(series.allianceId)}
              onMouseLeave={() => setHoveredAllianceId(null)}
              className="cursor-pointer"
            >
              <line
                x1={0}
                y1={y + 5}
                x2={20}
                y2={y + 5}
                stroke={color}
                strokeWidth={isLegendHovered ? 4 : 2}
                opacity={isLegendDimmed ? 0.3 : 1}
                className="transition-all duration-200 ease-in-out"
              />
              <text
                x={25}
                y={y + 9}
                fontSize={12}
                fill={isLegendHovered ? "#fff" : "#e5e7eb"}
                fontWeight={isLegendHovered ? "bold" : "normal"}
                opacity={isLegendDimmed ? 0.3 : 1}
                className="transition-all duration-200 ease-in-out"
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

