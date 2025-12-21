import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiCallWithErrorHandling, API_ENDPOINTS } from '../utils/api';
import { tableClasses } from '../styles/tableClasses';

interface NationEfficiencyData {
  nationId: number;
  nationName: string;
  rulerName: string;
  maxSlots: number;
  averageActiveSlots: number;
  efficiency: number;
  averageSendingSlots: number;
  averageReceivingSlots: number;
  daysAnalyzed: number;
}

interface NationAidEfficiencyResponse {
  success: boolean;
  allianceId: number;
  startDate: string;
  endDate: string;
  data: NationEfficiencyData[];
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
  // Accept YYYY-MM-DD format
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

const NationAidEfficiencyPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  
  // Get alliance ID from URL query params (set by navigation bar)
  const allianceIdParam = searchParams.get('allianceId');
  const selectedAllianceId = allianceIdParam ? parseInt(allianceIdParam, 10) : null;
  
  // Initialize default dates (last 30 days, ending yesterday in Central Time)
  // Store dates in YYYY-MM-DD format for the date input
  const defaultDates = getDefaultDates();
  const [startDate, setStartDate] = useState<string>(defaultDates.startDate);
  const [endDate, setEndDate] = useState<string>(defaultDates.endDate);
  const [data, setData] = useState<NationEfficiencyData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<'nation' | 'efficiency' | 'averageActiveSlots' | 'averageSendingSlots' | 'averageReceivingSlots'>('efficiency');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Format date from input (YYYY-MM-DD) to MM/DD/YYYY for API
  const formatDateForApi = (dateStr: string): string => {
    // If already in MM/DD/YYYY format, return as-is
    if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
      return dateStr;
    }
    // Convert from YYYY-MM-DD to MM/DD/YYYY
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts;
    return `${parseInt(month)}/${parseInt(day)}/${year}`;
  };

  // Calculate days analyzed from date range
  const calculateDaysAnalyzed = (): number => {
    try {
      // Dates are stored in YYYY-MM-DD format
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return 0;
      }
      
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates
      return Math.max(0, diffDays);
    } catch {
      return 0;
    }
  };

  const daysAnalyzed = calculateDaysAnalyzed();

  const fetchData = async () => {
    if (!selectedAllianceId) {
      setData([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const formattedStartDate = formatDateForApi(startDate);
      const formattedEndDate = formatDateForApi(endDate);

      const response: NationAidEfficiencyResponse = await apiCallWithErrorHandling(
        API_ENDPOINTS.nationAidEfficiency(selectedAllianceId, formattedStartDate, formattedEndDate)
      );
      
      if (response.success && response.data) {
        setData(response.data);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load nation aid efficiency data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedAllianceId) {
      fetchData();
    }
  }, [selectedAllianceId, startDate, endDate]);

  const handleSort = (column: 'nation' | 'efficiency' | 'averageActiveSlots' | 'averageSendingSlots' | 'averageReceivingSlots') => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    let comparison = 0;
    
    switch (sortColumn) {
      case 'nation':
        comparison = a.nationName.localeCompare(b.nationName);
        break;
      case 'efficiency':
        comparison = a.efficiency - b.efficiency;
        break;
      case 'averageActiveSlots':
        comparison = a.averageActiveSlots - b.averageActiveSlots;
        break;
      case 'averageSendingSlots':
        comparison = a.averageSendingSlots - b.averageSendingSlots;
        break;
      case 'averageReceivingSlots':
        comparison = a.averageReceivingSlots - b.averageReceivingSlots;
        break;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  return (
    <div className={`${tableClasses.container} mt-20`}>
      <div className={tableClasses.card}>
        <p className="text-gray-600 mb-6">
          Aid slot efficiency for nations in a selected alliance over a custom date range. 
          Efficiency represents the percentage of available aid slots (using 6) that were active each day.
        </p>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          {/* Start Date */}
          <div className="flex items-center gap-3">
            <label htmlFor="start-date" className="text-sm font-semibold text-gray-700 whitespace-nowrap w-24">
              Start Date:
            </label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border-2 border-slate-400 rounded-lg text-base font-medium bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>

          {/* End Date */}
          <div className="flex items-center gap-3">
            <label htmlFor="end-date" className="text-sm font-semibold text-gray-700 whitespace-nowrap w-24">
              End Date:
            </label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border-2 border-slate-400 rounded-lg text-base font-medium bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>

          {/* Days Analyzed */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-700 whitespace-nowrap w-24">
              Days Analyzed:
            </span>
            <span className="px-3 py-2 border-2 border-slate-300 rounded-lg text-base font-medium bg-slate-50 text-gray-700">
              {daysAnalyzed}
            </span>
          </div>
        </div>

        {loading && (
          <div className="text-center p-5">
            Loading nation aid efficiency data...
          </div>
        )}

        {error && (
          <div className="p-5 text-error">
            Error: {error}
          </div>
        )}

        {!loading && !error && !selectedAllianceId && (
          <div className="text-center p-10 text-gray-600">
            Please select an alliance from the navigation bar to view nation aid efficiency data.
          </div>
        )}

        {!loading && !error && selectedAllianceId && data.length === 0 && (
          <div className="text-center p-10 text-gray-600">
            No data available for the selected alliance and date range.
          </div>
        )}

        {!loading && !error && data.length > 0 && (
          <div className="mb-8">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-slate-300 text-sm bg-white">
                <thead>
                  <tr className="bg-gray-800">
                    <th 
                      className="p-3 border border-slate-300 text-left text-white font-bold cursor-pointer hover:bg-gray-700 transition-colors select-none"
                      onClick={() => handleSort('nation')}
                    >
                      <div className="flex items-center gap-2">
                        Nation
                        <span className="text-xs text-gray-400">
                          {sortColumn === 'nation' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      </div>
                    </th>
                    <th 
                      className="p-3 border border-slate-300 text-center text-white font-bold cursor-pointer hover:bg-gray-700 transition-colors select-none"
                      onClick={() => handleSort('efficiency')}
                    >
                      <div className="flex items-center justify-center gap-2">
                        Efficiency %
                        <span className="text-xs text-gray-400">
                          {sortColumn === 'efficiency' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      </div>
                    </th>
                    <th 
                      className="p-3 border border-slate-300 text-center text-white font-bold cursor-pointer hover:bg-gray-700 transition-colors select-none"
                      onClick={() => handleSort('averageActiveSlots')}
                    >
                      <div className="flex items-center justify-center gap-2">
                        Avg Active Slots
                        <span className="text-xs text-gray-400">
                          {sortColumn === 'averageActiveSlots' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      </div>
                    </th>
                    <th 
                      className="p-3 border border-slate-300 text-center text-white font-bold cursor-pointer hover:bg-gray-700 transition-colors select-none"
                      onClick={() => handleSort('averageSendingSlots')}
                    >
                      <div className="flex items-center justify-center gap-2">
                        Avg Sending
                        <span className="text-xs text-gray-400">
                          {sortColumn === 'averageSendingSlots' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      </div>
                    </th>
                    <th 
                      className="p-3 border border-slate-300 text-center text-white font-bold cursor-pointer hover:bg-gray-700 transition-colors select-none"
                      onClick={() => handleSort('averageReceivingSlots')}
                    >
                      <div className="flex items-center justify-center gap-2">
                        Avg Receiving
                        <span className="text-xs text-gray-400">
                          {sortColumn === 'averageReceivingSlots' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedData.map((nation) => (
                    <tr 
                      key={nation.nationId} 
                      className="bg-white hover:bg-slate-50"
                    >
                      <td className="p-2 border border-slate-300 font-bold text-black">
                        <a 
                          href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${nation.nationId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary no-underline hover:underline"
                        >
                          {nation.rulerName} / {nation.nationName}
                        </a>
                      </td>
                      <td className="p-2 border border-slate-300 text-center font-semibold text-black">
                        {nation.efficiency.toFixed(1)}%
                      </td>
                      <td className="p-2 border border-slate-300 text-center text-black">
                        {nation.averageActiveSlots.toFixed(2)}
                      </td>
                      <td className="p-2 border border-slate-300 text-center text-black">
                        {nation.averageSendingSlots.toFixed(2)}
                      </td>
                      <td className="p-2 border border-slate-300 text-center text-black">
                        {nation.averageReceivingSlots.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NationAidEfficiencyPage;

