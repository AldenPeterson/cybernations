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
  updateNationSlots: (allianceId: number, nationId: number) => `/api/alliances/${allianceId}/nations/${nationId}/slots`,
  nationWars: (id: number) => `/api/alliances/${id}/nation-wars`,
  defendingWarsStats: (id: number) => `/api/alliances/${id}/defending-wars-stats`,
  smallAidOffers: '/api/small-aid-offers',
  statsDecode: '/api/stats/decode',
} as const;
