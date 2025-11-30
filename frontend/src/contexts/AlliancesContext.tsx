import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiCall, API_ENDPOINTS } from '../utils/api';

interface Alliance {
  id: number;
  name: string;
  nationCount: number;
}

interface AlliancesContextType {
  alliances: Alliance[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const AlliancesContext = createContext<AlliancesContextType | undefined>(undefined);

// Request deduplication - only one request in flight at a time
let loadingPromise: Promise<Alliance[]> | null = null;
let cachedAlliances: Alliance[] | null = null;
const CACHE_TTL_MS = 300000; // 5 minutes
let cacheTimestamp: number = 0;

export function AlliancesProvider({ children }: { children: ReactNode }) {
  const [alliances, setAlliances] = useState<Alliance[]>(cachedAlliances || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAlliances = async (): Promise<Alliance[]> => {
    // Check cache first
    const now = Date.now();
    if (cachedAlliances && (now - cacheTimestamp) < CACHE_TTL_MS) {
      return cachedAlliances;
    }

    // If a request is already in flight, wait for it
    if (loadingPromise) {
      return await loadingPromise;
    }

    // Start new request
    loadingPromise = (async () => {
      try {
        const response = await apiCall(API_ENDPOINTS.alliances);
        const data = await response.json();
        
        if (data.success) {
          const alliancesData = data.alliances || [];
          cachedAlliances = alliancesData;
          cacheTimestamp = now;
          return alliancesData;
        } else {
          throw new Error(data.error || 'Failed to fetch alliances');
        }
      } catch (err) {
        throw err;
      } finally {
        loadingPromise = null;
      }
    })();

    return await loadingPromise;
  };

  const refresh = async () => {
    // Invalidate cache
    cachedAlliances = null;
    cacheTimestamp = 0;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await fetchAlliances();
      setAlliances(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch alliances';
      setError(errorMessage);
      console.error('Error fetching alliances:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load alliances on mount
    refresh();
  }, []);

  return (
    <AlliancesContext.Provider value={{ alliances, loading, error, refresh }}>
      {children}
    </AlliancesContext.Provider>
  );
}

export function useAlliances() {
  const context = useContext(AlliancesContext);
  if (context === undefined) {
    throw new Error('useAlliances must be used within an AlliancesProvider');
  }
  return context;
}

