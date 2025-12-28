import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiCallWithErrorHandling, API_ENDPOINTS } from '../utils/api';
import PageContainer from '../components/PageContainer';
import { useAlliances } from '../contexts/AlliancesContext';

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

type FilterType = 'all' | 'nation' | 'alliance';
type EventTypeFilter = 'all' | 'new_nation' | 'nation_inactive' | 'alliance_change';

const EventsPage: React.FC = () => {
  const { alliances } = useAlliances();
  const [searchParams, setSearchParams] = useSearchParams();
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
  
  // Update URL when filters change
  const updateUrlParams = (updates: { type?: FilterType; eventType?: EventTypeFilter; allianceId?: number | null; offset?: number }) => {
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
    
    if (updates.offset !== undefined) {
      if (updates.offset === 0) {
        newParams.delete('offset');
      } else {
        newParams.set('offset', updates.offset.toString());
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
    const urlOffset = parseInt(searchParams.get('offset') || '0');
    
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
    if (urlOffset !== offset) {
      setOffset(urlOffset);
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
        
        if (selectedAllianceId !== null) {
          params.allianceId = selectedAllianceId;
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
  }, [limit, offset, filterType, eventTypeFilter, selectedAllianceId]);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getEventTypeLabel = (eventType: string): string => {
    switch (eventType) {
      case 'new_nation':
        return 'New Nation';
      case 'nation_inactive':
        return 'Nation Inactive';
      case 'alliance_change':
        return 'Alliance Change';
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
      default:
        return 'bg-gray-600';
    }
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
        <h1 className="text-xl sm:text-2xl font-bold text-white">Events</h1>
        
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
              <option value="all">All</option>
              <option value="new_nation">New Nation</option>
              <option value="nation_inactive">Nation Inactive</option>
              <option value="alliance_change">Alliance Change</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-300">Alliance:</label>
            <select
              value={selectedAllianceId || ''}
              onChange={(e) => {
                const newAllianceId = e.target.value ? parseInt(e.target.value) : null;
                setSelectedAllianceId(newAllianceId);
                setOffset(0);
                updateUrlParams({ allianceId: newAllianceId, offset: 0 });
              }}
              className="px-3 py-1.5 bg-gray-800 text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm min-w-[200px]"
            >
              <option value="">All Alliances</option>
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
                      
                      <p className="text-white mb-2">{event.description}</p>
                      
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
                          Changed from <span className="text-gray-300">{event.metadata.oldAllianceName || 'Unknown'}</span> to <span className="text-gray-300">{event.metadata.newAllianceName || 'Unknown'}</span>
                          {event.metadata.strength && (
                            <span className="ml-2">({event.metadata.strength.toLocaleString()} NS)</span>
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

