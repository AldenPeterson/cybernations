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
    credentials: 'include', // Always include cookies
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
  const response = await apiCall(endpoint, {
    ...options,
    credentials: 'include', // Always include cookies
  });
  
  if (!response.ok) {
    // Handle 401 (Unauthorized) - user needs to login
    if (response.status === 401) {
      // Clear any auth state if needed
      // The AuthContext will handle redirecting to login
      throw new Error('Authentication required');
    }
    
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
  activeAidByAlliance: (id: number) => `/api/alliances/${id}/active-aid-by-alliance`,
  allianceAidSlots: (id: number) => `/api/alliances/${id}/aid-slots`,
  allianceRecommendations: (id: number) => `/api/alliances/${id}/recommendations`,
  nationsConfig: (id: number) => `/api/alliances/${id}/nations-config`,
  aidSlots: (id: number) => `/api/alliances/${id}/aid-slots`,
  updateNationSlots: (allianceId: number, nationId: number) => `/api/alliances/${allianceId}/nations/${nationId}`,
  nationWars: (id: number) => `/api/alliances/${id}/nation-wars`,
  defendingWarsStats: (id: number) => `/api/alliances/${id}/defending-wars-stats`,
  warCounts: (id: number, params?: { includeExpired?: boolean; startDate?: string }) => {
    const search = new URLSearchParams();
    if (params?.includeExpired !== undefined) search.set('includeExpired', String(params.includeExpired));
    if (params?.startDate) search.set('startDate', params.startDate);
    const q = search.toString();
    return `/api/alliances/${id}/war-counts${q ? `?${q}` : ''}`;
  },
  warAssignments: (id: number) => `/api/alliances/${id}/war-assignments`,
  staggerEligibility: '/api/stagger-eligibility',
  smallAidOffers: '/api/small-aid-offers',
  statsDecode: '/api/stats/decode',
  nuclearStats: '/api/nuclear/stats',
  nuclearTimeline: (intervalMinutes: number = 5) => `/api/nuclear/timeline?intervalMinutes=${intervalMinutes}`,
  aidEfficiency: '/api/aid-efficiency',
  nationAidEfficiency: (allianceId: number, startDate: string, endDate: string) => `/api/alliances/${allianceId}/nation-aid-efficiency?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
  allianceAidTotals: (startDate: string, endDate: string) => `/api/alliance-aid-totals?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
  events: (params?: { type?: string; eventType?: string; limit?: number; offset?: number; nationId?: number; allianceId?: number; minStrength?: number; search?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.type) queryParams.set('type', params.type);
    if (params?.eventType) queryParams.set('eventType', params.eventType);
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.offset) queryParams.set('offset', params.offset.toString());
    if (params?.nationId) queryParams.set('nationId', params.nationId.toString());
    if (params?.allianceId) queryParams.set('allianceId', params.allianceId.toString());
    if (params?.minStrength !== undefined) queryParams.set('minStrength', params.minStrength.toString());
    if (params?.search) queryParams.set('search', params.search);
    const query = queryParams.toString();
    return `/api/events${query ? `?${query}` : ''}`;
  },
  warStatisticsAllianceTotals: (filter?: string) => {
    const query = filter ? `?filter=${encodeURIComponent(filter)}` : '';
    return `/api/war-statistics/alliance-totals${query}`;
  },
  warStatisticsNationBreakdown: (filter?: string) => {
    const query = filter ? `?filter=${encodeURIComponent(filter)}` : '';
    return `/api/war-statistics/nation-breakdown${query}`;
  },
  warStatisticsWarRecords: (filter?: string) => {
    const query = filter ? `?filter=${encodeURIComponent(filter)}` : '';
    return `/api/war-statistics/war-records${query}`;
  },
  warStatisticsInvalidateCache: '/api/war-statistics/invalidate-cache',
  casualties: '/api/casualties',
  casualtiesAlliances: '/api/casualties/alliances',
  casualtiesAllianceMembers: (allianceId: number) => `/api/casualties/alliance/${allianceId}`,
  warchestSubmissions: (nationId?: number) => {
    const query = nationId ? `?nationId=${nationId}` : '';
    return `/api/warchest-submissions${query}`;
  },
  interallianceAid: (alliance1Id: number, alliance2Id: number, startDate?: string, endDate?: string) => {
    let url = `/api/interalliance-aid/${alliance1Id}/${alliance2Id}`;
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const query = params.toString();
    return query ? `${url}?${query}` : url;
  },
  // Auth endpoints
  authMe: '/api/auth/me',
  authLogout: '/api/auth/logout',
  authVerify: '/api/auth/verify',
  authGoogle: '/api/auth/google',
  // User management endpoints (ADMIN only)
  users: '/api/users',
  updateUser: (id: number) => `/api/users/${id}`,
  // Admin endpoints (ADMIN only)
  adminAlliances: '/api/admin/alliances',
  adminSearchNations: (query: string, limit?: number) => {
    const params = new URLSearchParams();
    params.set('q', query);
    if (limit) params.set('limit', limit.toString());
    return `/api/admin/nations/search?${params.toString()}`;
  },
  adminSetNationTargetingAlliance: (nationId: number) => `/api/admin/nations/${nationId}/targeting-alliance`,
  adminSearchWars: (query: string, limit?: number, activeOnly?: boolean) => {
    const params = new URLSearchParams();
    params.set('q', query);
    if (limit) params.set('limit', limit.toString());
    if (activeOnly !== undefined) params.set('activeOnly', activeOnly.toString());
    return `/api/admin/wars/search?${params.toString()}`;
  },
  adminUpdateWarAllianceIds: (warId: number) => `/api/admin/wars/${warId}/alliance-ids`,
  // Role capabilities (manage_users)
  adminCapabilities: '/api/admin/capabilities',
  adminRoleCapabilities: (role: string) => `/api/admin/roles/${role}/capabilities`,
} as const;
