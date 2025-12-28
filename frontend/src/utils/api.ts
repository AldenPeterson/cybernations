// API configuration and utility functions
declare const __API_BASE_URL__: string;

// Get the base URL for API calls
export const getApiBaseUrl = (): string => {
  // In development, use relative URLs (proxy handles routing)
  // In production, use the environment variable
  if (import.meta.env.DEV) {
    return '';
  }
  return __API_BASE_URL__ || 'https://cybernations-backend.vercel.app';
};

// Helper function to make API calls
export const apiCall = async (endpoint: string, options: RequestInit = {}): Promise<Response> => {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;
  
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
};

// Helper function to safely parse JSON from response
export const safeJsonParse = async (response: Response): Promise<any> => {
  const text = await response.text();
  
  if (!text.trim()) {
    throw new Error('Empty response from server');
  }
  
  try {
    return JSON.parse(text);
  } catch (error) {
    console.error('Failed to parse JSON response:', text);
    throw new Error(`Invalid JSON response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Helper function to make API calls with better error handling
export const apiCallWithErrorHandling = async (endpoint: string, options: RequestInit = {}): Promise<any> => {
  const response = await apiCall(endpoint, options);
  
  if (!response.ok) {
    // Try to parse error message from response
    const text = await response.text();
    if (text.trim()) {
      try {
        const errorData = JSON.parse(text);
        if (errorData && errorData.error) {
          throw new Error(errorData.error);
        }
      } catch (parseError) {
        // If JSON parsing fails or error property doesn't exist, fall through to generic error
      }
    }
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return await safeJsonParse(response);
};

// API endpoints
export const API_ENDPOINTS = {
  health: '/health',
  alliances: '/api/alliances',
  allianceStats: (id: number) => `/api/alliances/${id}/stats`,
  allianceAidStats: (id: number) => `/api/alliances/${id}/aid-stats`,
  allianceAidSlots: (id: number) => `/api/alliances/${id}/aid-slots`,
  allianceRecommendations: (id: number) => `/api/alliances/${id}/recommendations`,
  nationsConfig: (id: number) => `/api/alliances/${id}/nations-config`,
  aidSlots: (id: number) => `/api/alliances/${id}/aid-slots`,
  updateNationSlots: (allianceId: number, nationId: number) => `/api/alliances/${allianceId}/nations/${nationId}`,
  nationWars: (id: number) => `/api/alliances/${id}/nation-wars`,
  defendingWarsStats: (id: number) => `/api/alliances/${id}/defending-wars-stats`,
  warCounts: (id: number) => `/api/alliances/${id}/war-counts`,
  staggerEligibility: '/api/stagger-eligibility',
  smallAidOffers: '/api/small-aid-offers',
  statsDecode: '/api/stats/decode',
  nuclearStats: '/api/nuclear/stats',
  nuclearTimeline: (intervalMinutes: number = 5) => `/api/nuclear/timeline?intervalMinutes=${intervalMinutes}`,
  aidEfficiency: '/api/aid-efficiency',
  nationAidEfficiency: (allianceId: number, startDate: string, endDate: string) => `/api/alliances/${allianceId}/nation-aid-efficiency?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
  allianceAidTotals: (startDate: string, endDate: string) => `/api/alliance-aid-totals?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
  events: (params?: { type?: string; eventType?: string; limit?: number; offset?: number; nationId?: number; allianceId?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.type) queryParams.set('type', params.type);
    if (params?.eventType) queryParams.set('eventType', params.eventType);
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.offset) queryParams.set('offset', params.offset.toString());
    if (params?.nationId) queryParams.set('nationId', params.nationId.toString());
    if (params?.allianceId) queryParams.set('allianceId', params.allianceId.toString());
    const query = queryParams.toString();
    return `/api/events${query ? `?${query}` : ''}`;
  },
} as const;
