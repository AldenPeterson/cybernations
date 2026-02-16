import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiCallWithErrorHandling, API_ENDPOINTS } from '../utils/api';
import PageContainer from '../components/PageContainer';
import { useAlliances } from '../contexts/AlliancesContext';

// Custom hook for debouncing values
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

type Event = {
  id: number;
  type: string;
  eventType: string;
  nationId: number | null;
  allianceId: number | null;
  description: string;
  metadata: any;
  createdAt: string;
  nation: {
    id: number;
    rulerName: string;
    nationName: string;
    allianceId: number;
    alliance: {
      id: number;
      name: string;
    };
  } | null;
  alliance: {
    id: number;
    name: string;
  } | null;
};

type EventsResponse = {
  success: boolean;
  events: Event[];
  total: number;
  limit: number;
  offset: number;
};

type FilterType = 'all' | 'nation' | 'alliance' | 'stats';
type EventTypeFilter = 'all' | 'new_nation' | 'nation_inactive' | 'alliance_change' | 'casualty_ranking_entered' | 'casualty_ranking_exited' | 'casualty_ranking_changed';

const EventsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { alliances = [] } = useAlliances();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState<number>(0);
  const [limit] = useState<number>(100);
  
  // Initialize state from URL query parameters
  const getFilterFromUrl = (key: string, defaultValue: string): string => {
    return searchParams.get(key) || defaultValue;
  };
  
  const [offset, setOffset] = useState<number>(parseInt(searchParams.get('offset') || '0'));
  const [filterType, setFilterType] = useState<FilterType>(getFilterFromUrl('type', 'all') as FilterType);
  const [eventTypeFilter, setEventTypeFilter] = useState<EventTypeFilter>(getFilterFromUrl('eventType', 'all') as EventTypeFilter);
  const [selectedAllianceId, setSelectedAllianceId] = useState<number | null>(
    searchParams.get('allianceId') ? parseInt(searchParams.get('allianceId')!) : null
  );
  const [minStrength, setMinStrength] = useState<number | null>(
    searchParams.get('minStrength') ? parseInt(searchParams.get('minStrength')!) : 2000
  );
  const [searchQuery, setSearchQuery] = useState<string>(
    searchParams.get('search') || ''
  );
  
  // Debounce search query with 300ms delay
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Get valid event types based on the selected filter type
  const getValidEventTypes = (type: FilterType): EventTypeFilter[] => {
    switch (type) {
      case 'nation':
        return ['all', 'new_nation', 'nation_inactive', 'alliance_change'];
      case 'stats':
        return ['all', 'casualty_ranking_entered', 'casualty_ranking_exited', 'casualty_ranking_changed'];
      case 'alliance':
        return ['all']; // Alliance events would go here if we add them
      case 'all':
      default:
        return ['all', 'new_nation', 'nation_inactive', 'alliance_change', 'casualty_ranking_entered', 'casualty_ranking_exited', 'casualty_ranking_changed'];
    }
  };

  // Reset eventTypeFilter if it's invalid for the current filterType
  useEffect(() => {
    const validEventTypes = getValidEventTypes(filterType);
    if (eventTypeFilter !== 'all' && !validEventTypes.includes(eventTypeFilter)) {
      setEventTypeFilter('all');
      updateUrlParams({ eventType: 'all', offset: 0 });
    }
  }, [filterType]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Update URL when filters change
  const updateUrlParams = (updates: { type?: FilterType; eventType?: EventTypeFilter; allianceId?: number | null; minStrength?: number | null; offset?: number; search?: string }) => {
    const newParams = new URLSearchParams(searchParams);
    
    if (updates.type !== undefined) {
      if (updates.type === 'all') {
        newParams.delete('type');
      } else {
        newParams.set('type', updates.type);
      }
    }
    
    if (updates.eventType !== undefined) {
      if (updates.eventType === 'all') {
        newParams.delete('eventType');
      } else {
        newParams.set('eventType', updates.eventType);
      }
    }
    
    if (updates.allianceId !== undefined) {
      if (updates.allianceId === null) {
        newParams.delete('allianceId');
      } else {
        newParams.set('allianceId', updates.allianceId.toString());
      }
    }
    
    if (updates.minStrength !== undefined) {
      // If minStrength is 2000 (the default), remove it from URL to keep URLs clean
      if (updates.minStrength === null || updates.minStrength === 2000) {
        newParams.delete('minStrength');
      } else {
        newParams.set('minStrength', updates.minStrength.toString());
      }
    }
    
    if (updates.offset !== undefined) {
      if (updates.offset === 0) {
        newParams.delete('offset');
      } else {
        newParams.set('offset', updates.offset.toString());
      }
    }
    
    if (updates.search !== undefined) {
      if (updates.search === '') {
        newParams.delete('search');
      } else {
        newParams.set('search', updates.search);
      }
    }
    
    setSearchParams(newParams, { replace: true });
  };

  // Sync state from URL params when they change externally (e.g., browser back/forward)
  // Only update if URL params differ from current state to avoid loops
  useEffect(() => {
    const urlFilterType = getFilterFromUrl('type', 'all') as FilterType;
    const urlEventTypeFilter = getFilterFromUrl('eventType', 'all') as EventTypeFilter;
    const urlAllianceId = searchParams.get('allianceId') ? parseInt(searchParams.get('allianceId')!) : null;
    const urlMinStrength = searchParams.get('minStrength') ? parseInt(searchParams.get('minStrength')!) : 2000;
    const urlOffset = parseInt(searchParams.get('offset') || '0');
    const urlSearch = searchParams.get('search') || '';
    
    // Only update state if URL params differ from current state
    if (urlFilterType !== filterType) {
      setFilterType(urlFilterType);
    }
    if (urlEventTypeFilter !== eventTypeFilter) {
      setEventTypeFilter(urlEventTypeFilter);
    }
    if (urlAllianceId !== selectedAllianceId) {
      setSelectedAllianceId(urlAllianceId);
    }
    if (urlMinStrength !== minStrength) {
      setMinStrength(urlMinStrength);
    }
    if (urlOffset !== offset) {
      setOffset(urlOffset);
    }
    if (urlSearch !== searchQuery) {
      setSearchQuery(urlSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]); // Only run when searchParams change externally

  useEffect(() => {
    let cancelled = false;
    const loadEvents = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const params: any = {
          limit,
          offset,
        };
        
        if (filterType !== 'all') {
          params.type = filterType;
        }
        
        if (eventTypeFilter !== 'all') {
          params.eventType = eventTypeFilter;
        }
        
        // Apply alliance filter if selected
        if (selectedAllianceId !== null) {
          params.allianceId = selectedAllianceId;
        }
        
        // Always include minStrength (defaults to 2000)
        params.minStrength = minStrength ?? 2000;
        
        // Include search query if provided and at least 3 characters
        if (debouncedSearchQuery.trim().length >= 3) {
          params.search = debouncedSearchQuery.trim();
        }
        
        const response = await apiCallWithErrorHandling(API_ENDPOINTS.events(params)) as EventsResponse;
        
        if (!cancelled) {
          if (response.success) {
            setEvents(response.events);
            setTotal(response.total);
          } else {
            setError('Failed to load events');
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load events');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    
    loadEvents();
    
    return () => {
      cancelled = true;
    };
  }, [limit, offset, filterType, eventTypeFilter, selectedAllianceId, minStrength, debouncedSearchQuery]);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Helper function to format NS values - values >= 1000 shown as X.Xk format
  const formatNSValue = (value: number): string => {
    if (value >= 1000) {
      const thousands = value / 1000;
      return `${thousands.toFixed(1)}k`;
    }
    return value.toString();
  };

  // Helper function to format NS values in descriptions
  const formatNSInDescription = (description: string): string => {
    // Match patterns like "1,234.56 NS" or "1234 NS" - any number before "NS"
    // This regex matches: digits (with optional commas), optional decimal point and digits, optional whitespace, then "NS"
    return description.replace(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*NS/gi, (_match, numStr) => {
      // Remove commas, parse as number
      const num = parseFloat(numStr.replace(/,/g, ''));
      return `${formatNSValue(num)} NS`;
    });
  };

  const getEventTypeLabel = (eventType: string): string => {
    switch (eventType) {
      case 'new_nation':
        return 'New Nation';
      case 'nation_inactive':
        return 'Nation Inactive';
      case 'alliance_change':
        return 'Alliance Change';
      case 'casualty_ranking_entered':
        return 'Casualty Ranking Entered';
      case 'casualty_ranking_exited':
        return 'Casualty Ranking Exited';
      case 'casualty_ranking_changed':
        return 'Casualty Ranking Changed';
      default:
        return eventType;
    }
  };

  const getEventTypeColor = (eventType: string): string => {
    switch (eventType) {
      case 'new_nation':
        return 'bg-green-600';
      case 'nation_inactive':
        return 'bg-red-600';
      case 'alliance_change':
        return 'bg-blue-600';
      case 'casualty_ranking_entered':
        return 'bg-purple-600';
      case 'casualty_ranking_exited':
        return 'bg-orange-600';
      case 'casualty_ranking_changed':
        return 'bg-yellow-600';
      default:
        return 'bg-gray-600';
    }
  };

  const renderDescription = (event: Event): React.ReactNode => {
    // Handle alliance change events
    if (event.eventType === 'alliance_change' && event.metadata) {
      const oldAllianceName = event.metadata.oldAllianceName || 'Unknown';
      const newAllianceName = event.metadata.newAllianceName || 'Unknown';
      
      // Parse the description: "RulerName (NationName) changed from OldAlliance to NewAlliance"
      const fromIndex = event.description.indexOf('changed from');
      const toIndex = event.description.indexOf(' to ', fromIndex);
      
      if (fromIndex !== -1 && toIndex !== -1) {
        const before = event.description.substring(0, fromIndex + 'changed from'.length);
        const after = event.description.substring(toIndex + ' to '.length);
        
        return (
          <>
            {before}{' '}
            <span className="text-red-400 font-semibold">{oldAllianceName}</span>
            {' to '}
            <span className="text-green-400 font-semibold">{newAllianceName}</span>
            {after !== newAllianceName ? ` ${formatNSInDescription(after)}` : ''}
          </>
        );
      }
    }
    
    // Handle new nation events - color alliance name green
    if (event.eventType === 'new_nation' && event.metadata) {
      const allianceName = event.metadata.allianceName || (event.nation?.alliance?.name);
      
      if (allianceName) {
        // Parse the description: "RulerName (NationName) from AllianceName appeared with X NS"
        const fromIndex = event.description.indexOf(' from ');
        const appearedIndex = event.description.indexOf(' appeared', fromIndex);
        
        if (fromIndex !== -1 && appearedIndex !== -1) {
          const before = event.description.substring(0, fromIndex + ' from '.length);
          const after = event.description.substring(appearedIndex);
          
          return (
            <>
              {before}
              <span className="text-green-400 font-semibold">{allianceName}</span>
              {formatNSInDescription(after)}
            </>
          );
        }
      }
    }
    
    // Handle nation inactive events - color alliance name red
    if (event.eventType === 'nation_inactive' && event.metadata) {
      const allianceName = event.metadata.allianceName || (event.nation?.alliance?.name);
      
      if (allianceName) {
        // Parse the description: "RulerName (NationName) from AllianceName is no longer active (was X NS)"
        const fromIndex = event.description.indexOf(' from ');
        const isIndex = event.description.indexOf(' is no longer active', fromIndex);
        
        if (fromIndex !== -1 && isIndex !== -1) {
          const before = event.description.substring(0, fromIndex + ' from '.length);
          const after = event.description.substring(isIndex);
          
          return (
            <>
              {before}
              <span className="text-red-400 font-semibold">{allianceName}</span>
              {formatNSInDescription(after)}
            </>
          );
        }
      }
    }
    
    return formatNSInDescription(event.description);
  };

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  const handlePreviousPage = () => {
    if (offset > 0) {
      const newOffset = Math.max(0, offset - limit);
      setOffset(newOffset);
      updateUrlParams({ offset: newOffset });
    }
  };

  const handleNextPage = () => {
    if (offset + limit < total) {
      const newOffset = offset + limit;
      setOffset(newOffset);
      updateUrlParams({ offset: newOffset });
    }
  };

  return (
    <PageContainer className="px-4 sm:px-6 lg:px-8">
      <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-300">Type:</label>
            <select
              value={filterType}
              onChange={(e) => {
                const newFilterType = e.target.value as FilterType;
                setFilterType(newFilterType);
                setOffset(0);
                updateUrlParams({ type: newFilterType, offset: 0 });
              }}
              className="px-3 py-1.5 bg-gray-800 text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
            >
              <option value="all">All</option>
              <option value="nation">Nation</option>
              <option value="alliance">Alliance</option>
              <option value="stats">Stats</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-300">Event:</label>
            <select
              value={eventTypeFilter}
              onChange={(e) => {
                const newEventTypeFilter = e.target.value as EventTypeFilter;
                setEventTypeFilter(newEventTypeFilter);
                setOffset(0);
                updateUrlParams({ eventType: newEventTypeFilter, offset: 0 });
              }}
              className="px-3 py-1.5 bg-gray-800 text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
            >
              {getValidEventTypes(filterType).map((eventType) => (
                <option key={eventType} value={eventType}>
                  {eventType === 'all' ? 'All' : getEventTypeLabel(eventType)}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-300">Min NS:</label>
            <input
              type="number"
              value={minStrength ?? ''}
              onChange={(e) => {
                const value = e.target.value === '' ? 2000 : parseInt(e.target.value);
                setMinStrength(value);
                setOffset(0);
                updateUrlParams({ minStrength: value, offset: 0 });
              }}
              placeholder="2000"
              min="0"
              className="px-3 py-1.5 bg-gray-800 text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm w-24"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-300">Search:</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                const newSearch = e.target.value;
                setSearchQuery(newSearch);
                setOffset(0);
                updateUrlParams({ search: newSearch, offset: 0 });
              }}
              placeholder="Ruler or nation name (min 3 chars)..."
              className="px-3 py-1.5 bg-gray-800 text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm w-48"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-300">Alliance:</label>
            <select
              value={selectedAllianceId || ''}
              onChange={(e) => {
                const newAllianceId = e.target.value === '' ? null : parseInt(e.target.value);
                setSelectedAllianceId(newAllianceId);
                setOffset(0);
                updateUrlParams({ allianceId: newAllianceId, offset: 0 });
              }}
              className="px-3 py-1.5 bg-gray-800 text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
            >
              <option value="">All</option>
              {alliances.map(alliance => (
                <option key={alliance.id} value={alliance.id}>
                  {alliance.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading && (
        <div className="text-center py-8 text-gray-400">Loading events...</div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-200 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="mb-4 text-sm text-gray-400">
            Showing {events.length > 0 ? offset + 1 : 0} - {Math.min(offset + limit, total)} of {total} events
          </div>

          <div className="space-y-3">
            {events.length === 0 ? (
              <div className="text-center py-8 text-gray-400">No events found</div>
            ) : (
              events.map((event) => (
                <div
                  key={event.id}
                  className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:bg-gray-750 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold text-white ${getEventTypeColor(
                            event.eventType
                          )}`}
                        >
                          {getEventTypeLabel(event.eventType)}
                        </span>
                        <span className="text-sm text-gray-400">
                          {formatDate(event.createdAt)}
                        </span>
                      </div>
                      
                      <p className="text-white mb-2">{renderDescription(event)}</p>
                      
                      {event.nation && (
                        <div className="text-sm text-gray-400">
                          Nation: {event.nation.rulerName} ({event.nation.nationName}) [ID: {event.nation.id}] - {event.nation.alliance.name}
                        </div>
                      )}
                      
                      {event.alliance && !event.nation && (
                        <div className="text-sm text-gray-400">
                          Alliance: {event.alliance.name}
                        </div>
                      )}
                      
                      {event.eventType === 'alliance_change' && event.metadata && (
                        <div className="text-sm text-gray-400">
                          Changed from <span className="text-red-400 font-semibold">{event.metadata.oldAllianceName || 'Unknown'}</span> to <span className="text-green-400 font-semibold">{event.metadata.newAllianceName || 'Unknown'}</span>
                          {event.metadata.strength && (
                            <span className="ml-2">({formatNSValue(event.metadata.strength)} NS)</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between gap-4">
              <button
                onClick={handlePreviousPage}
                disabled={offset === 0}
                className="px-4 py-2 bg-gray-800 text-white border border-gray-600 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              
              <div className="text-sm text-gray-400">
                Page {currentPage} of {totalPages}
              </div>
              
              <button
                onClick={handleNextPage}
                disabled={offset + limit >= total}
                className="px-4 py-2 bg-gray-800 text-white border border-gray-600 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
};

export default EventsPage;

