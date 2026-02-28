import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiCallWithErrorHandling, API_ENDPOINTS } from '../utils/api';
import PageContainer from '../components/PageContainer';
import { useAuth } from '../contexts/AuthContext';
import { useAlliances } from '../contexts/AlliancesContext';

const AdminPage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading, hasCapability } = useAuth();
  const { alliances: defaultAlliances } = useAlliances();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [allAlliances, setAllAlliances] = useState<any[]>([]);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'nations' | 'wars'>('nations');
  const [nationSearchQuery, setNationSearchQuery] = useState<string>('');
  const [nationSearchResults, setNationSearchResults] = useState<any[]>([]);
  const [nationSearchLoading, setNationSearchLoading] = useState<boolean>(false);
  const [selectedNation, setSelectedNation] = useState<any | null>(null);
  const [targetingAllianceId, setTargetingAllianceId] = useState<string>('');
  const [nationSaving, setNationSaving] = useState<boolean>(false);
  
  // War editing state
  const [warSearchQuery, setWarSearchQuery] = useState<string>('');
  const [warSearchResults, setWarSearchResults] = useState<any[]>([]);
  const [warSearchLoading, setWarSearchLoading] = useState<boolean>(false);
  const [warSearchActiveOnly, setWarSearchActiveOnly] = useState<boolean>(true);
  const [selectedWar, setSelectedWar] = useState<any | null>(null);
  const [warDeclaringAllianceId, setWarDeclaringAllianceId] = useState<string>('');
  const [warReceivingAllianceId, setWarReceivingAllianceId] = useState<string>('');
  const [warSaving, setWarSaving] = useState<boolean>(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !hasCapability('manage_all_alliance')) {
      navigate('/aid');
    }
  }, [isAuthenticated, hasCapability, authLoading, navigate]);

  useEffect(() => {
    const fetchAllAlliances = async () => {
      if (!isAuthenticated || !hasCapability('manage_all_alliance')) return;

      try {
        const response = await apiCallWithErrorHandling(API_ENDPOINTS.adminAlliances);
        if (response.success) {
          setAllAlliances(response.alliances);
        }
      } catch (err) {
        console.error('Failed to fetch all alliances:', err);
        // Fallback to default alliances if admin endpoint fails
        setAllAlliances(defaultAlliances);
      }
    };

    fetchAllAlliances();
  }, [isAuthenticated, hasCapability, defaultAlliances]);

  // Use allAlliances if available, otherwise fallback to defaultAlliances
  const alliances = allAlliances.length > 0 ? allAlliances : defaultAlliances;

  // Nation search handler
  const handleNationSearch = async () => {
    if (!nationSearchQuery.trim()) {
      setNationSearchResults([]);
      return;
    }

    try {
      setNationSearchLoading(true);
        setError(null);
      const response = await apiCallWithErrorHandling(API_ENDPOINTS.adminSearchNations(nationSearchQuery.trim(), 20));
        if (response.success) {
        setNationSearchResults(response.nations);
        } else {
        throw new Error(response.error || 'Failed to search nations');
        }
      } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to search nations';
        setError(msg);
      setNationSearchResults([]);
      } finally {
      setNationSearchLoading(false);
    }
  };

  // Set nation targeting alliance
  const handleSetNationTargetingAlliance = async () => {
    if (!selectedNation) return;

    try {
      setNationSaving(true);
      setError(null);
      const allianceId = targetingAllianceId.trim() === '' ? null : parseInt(targetingAllianceId.trim(), 10);
      if (allianceId !== null && isNaN(allianceId)) {
        throw new Error('Invalid alliance ID');
      }

      const response = await apiCallWithErrorHandling(
        API_ENDPOINTS.adminSetNationTargetingAlliance(selectedNation.id),
        {
          method: 'PUT',
          body: JSON.stringify({ targetingAllianceId: allianceId }),
        }
      );

      if (response.success) {
        setSelectedNation(response.nation);
        setTargetingAllianceId(response.nation.targetingAllianceId ? String(response.nation.targetingAllianceId) : '');
        // Refresh search results
        await handleNationSearch();
      } else {
        throw new Error(response.error || 'Failed to set targeting alliance');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to set targeting alliance';
      setError(msg);
    } finally {
      setNationSaving(false);
    }
  };

  // War search handler
  const handleWarSearch = async () => {
    if (!warSearchQuery.trim()) {
      setWarSearchResults([]);
      return;
    }

    try {
      setWarSearchLoading(true);
      setError(null);
      const response = await apiCallWithErrorHandling(API_ENDPOINTS.adminSearchWars(warSearchQuery.trim(), 20, warSearchActiveOnly));
      if (response.success) {
        setWarSearchResults(response.wars);
      } else {
        throw new Error(response.error || 'Failed to search wars');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to search wars';
      setError(msg);
      setWarSearchResults([]);
    } finally {
      setWarSearchLoading(false);
    }
  };

  // Update war alliance IDs
  const handleUpdateWarAllianceIds = async () => {
    if (!selectedWar) return;

    try {
      setWarSaving(true);
      setError(null);

      const updateData: any = {};

      // Handle declaring alliance ID
      const declaringId = warDeclaringAllianceId.trim() === '' 
        ? null 
        : parseInt(warDeclaringAllianceId.trim(), 10);
      if (declaringId !== null && isNaN(declaringId)) {
        throw new Error('Invalid declaring alliance ID');
      }
      // Only include if it's different from current value
      if (declaringId !== selectedWar.declaringAllianceId) {
        updateData.declaringAllianceId = declaringId;
      }

      // Handle receiving alliance ID
      const receivingId = warReceivingAllianceId.trim() === '' 
        ? null 
        : parseInt(warReceivingAllianceId.trim(), 10);
      if (receivingId !== null && isNaN(receivingId)) {
        throw new Error('Invalid receiving alliance ID');
      }
      // Only include if it's different from current value
      if (receivingId !== selectedWar.receivingAllianceId) {
        updateData.receivingAllianceId = receivingId;
      }

      if (Object.keys(updateData).length === 0) {
        throw new Error('No changes to save');
      }

      const response = await apiCallWithErrorHandling(
        API_ENDPOINTS.adminUpdateWarAllianceIds(selectedWar.warId),
        {
        method: 'PUT',
        body: JSON.stringify(updateData),
        }
      );

      if (response.success) {
        setSelectedWar(response.war);
        setWarDeclaringAllianceId(response.war.declaringAllianceId ? String(response.war.declaringAllianceId) : '');
        setWarReceivingAllianceId(response.war.receivingAllianceId ? String(response.war.receivingAllianceId) : '');
        // Refresh search results
        await handleWarSearch();
      } else {
        throw new Error(response.error || 'Failed to update war alliance IDs');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update war alliance IDs';
      setError(msg);
    } finally {
      setWarSaving(false);
    }
  };

  // Show loading state while auth is being checked
  if (authLoading) {
    return (
      <PageContainer>
        <div className="text-center p-10 text-gray-600 mt-20">
          Loading...
        </div>
      </PageContainer>
    );
  }

  if (!isAuthenticated || !hasCapability('manage_all_alliance')) {
    return null;
  }

  return (
    <PageContainer>
      <div className="max-w-7xl mx-auto">
        {error && (
          <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
            {error}
          </div>
        )}

        <h1 className="text-2xl font-bold text-gray-100 mb-6">Nation & War Management</h1>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-gray-700">
          <button
            onClick={() => setActiveTab('nations')}
            className={`px-4 py-2 font-semibold transition-colors ${
              activeTab === 'nations'
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Nation Alliance Override
          </button>
          <button
            onClick={() => setActiveTab('wars')}
            className={`px-4 py-2 font-semibold transition-colors ${
              activeTab === 'wars'
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            War Alliance IDs
          </button>
        </div>

        {activeTab === 'nations' && (
          <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden p-6">
            <h2 className="text-xl font-semibold text-gray-100 mb-4">Nation Alliance Override</h2>
            <p className="text-sm text-gray-400 mb-4">
              Search for nations and set an alliance override for targeting purposes. Nations with an override will appear in the war management view for that alliance even if they're not actually in it.
            </p>

            {/* Search */}
            <div className="mb-4">
              <div className="flex gap-2">
                            <input
                              type="text"
                  placeholder="Search by nation name or ruler name..."
                  value={nationSearchQuery}
                  onChange={(e) => setNationSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleNationSearch()}
                  className="flex-1 px-3 py-2 bg-gray-700 text-gray-200 border border-gray-600 rounded focus:outline-none focus:border-primary"
                />
                <button
                  onClick={handleNationSearch}
                  disabled={nationSearchLoading}
                  className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {nationSearchLoading ? 'Searching...' : 'Search'}
                </button>
              </div>
            </div>

            {/* Search Results */}
            {nationSearchResults.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-2">Search Results</h3>
                <div className="border border-gray-600 rounded bg-gray-700 max-h-64 overflow-y-auto">
                  {nationSearchResults.map((nation) => (
                    <div
                      key={nation.id}
                      onClick={() => {
                        setSelectedNation(nation);
                        setTargetingAllianceId(nation.targetingAllianceId ? String(nation.targetingAllianceId) : '');
                      }}
                      className={`p-3 cursor-pointer hover:bg-gray-600 transition-colors ${
                        selectedNation?.id === nation.id ? 'bg-gray-600' : ''
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-gray-200 font-medium">
                            {nation.nationName} ({nation.rulerName})
                          </div>
                          <div className="text-xs text-gray-400">
                            Alliance: {nation.allianceName} (ID: {nation.allianceId})
                            {nation.targetingAllianceId && (
                              <span className="ml-2 text-yellow-400">
                                → Override: {nation.targetingAllianceName} (ID: {nation.targetingAllianceId})
                                  </span>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-gray-400">
                          NS: {nation.strength.toLocaleString()} | Rank: {nation.rank || 'N/A'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Selected Nation Editor */}
            {selectedNation && (
              <div className="border border-gray-600 rounded bg-gray-700 p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">
                  Set Targeting Alliance Override for {selectedNation.nationName}
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Current Alliance: {selectedNation.allianceName} (ID: {selectedNation.allianceId})
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Targeting Alliance Override
                    </label>
                    <select
                      value={targetingAllianceId}
                      onChange={(e) => setTargetingAllianceId(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-600 text-gray-200 border border-gray-500 rounded focus:outline-none focus:border-primary"
                    >
                      <option value="">None (clear override)</option>
                      {alliances.map((alliance) => (
                        <option key={alliance.id} value={String(alliance.id)}>
                          {alliance.name} (ID: {alliance.id})
                        </option>
                      ))}
                    </select>
                  </div>
                            <div className="flex gap-2">
                              <button
                      onClick={handleSetNationTargetingAlliance}
                      disabled={nationSaving}
                      className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {nationSaving ? 'Saving...' : 'Save'}
                              </button>
                              <button
                      onClick={() => {
                        setSelectedNation(null);
                        setTargetingAllianceId('');
                      }}
                      className="px-4 py-2 bg-gray-600 text-gray-200 rounded hover:bg-gray-500"
                              >
                                Cancel
                              </button>
                            </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'wars' && (
          <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden p-6">
            <h2 className="text-xl font-semibold text-gray-100 mb-4">War Alliance ID Editor</h2>
            <p className="text-sm text-gray-400 mb-4">
              Search for wars and edit the declaring or receiving alliance IDs. Select an alliance from the dropdown to set it, or select "None" to clear.
            </p>

            {/* Search */}
            <div className="mb-4">
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Search by war ID, nation name, or ruler name..."
                  value={warSearchQuery}
                  onChange={(e) => setWarSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleWarSearch()}
                  className="flex-1 px-3 py-2 bg-gray-700 text-gray-200 border border-gray-600 rounded focus:outline-none focus:border-primary"
                />
                <button
                  onClick={handleWarSearch}
                  disabled={warSearchLoading}
                  className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {warSearchLoading ? 'Searching...' : 'Search'}
                </button>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={warSearchActiveOnly}
                  onChange={(e) => setWarSearchActiveOnly(e.target.checked)}
                  className="rounded border-gray-500 text-primary focus:ring-primary w-4 h-4"
                />
                Active only
              </label>
            </div>

            {/* Search Results */}
            {warSearchResults.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-2">Search Results</h3>
                <div className="border border-gray-600 rounded bg-gray-700 max-h-[600px] overflow-y-auto">
                  {warSearchResults.map((war) => (
                    <div
                      key={war.warId}
                      onClick={() => {
                        setSelectedWar(war);
                        setWarDeclaringAllianceId(war.declaringAllianceId ? String(war.declaringAllianceId) : '');
                        setWarReceivingAllianceId(war.receivingAllianceId ? String(war.receivingAllianceId) : '');
                      }}
                      className={`p-3 cursor-pointer hover:bg-gray-600 transition-colors ${
                        selectedWar?.warId === war.warId ? 'bg-gray-600' : ''
                      }`}
                    >
                      <div className="text-sm text-gray-200">
                        <div className="font-medium">War ID: {war.warId}</div>
                        <div className="text-xs text-gray-400 mt-1">
                          {war.declaringNationName} ({war.declaringRulerName}) → {war.receivingNationName} ({war.receivingRulerName})
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          Declaring Alliance: {war.declaringAllianceName || 'None'} (ID: {war.declaringAllianceId || 'None'}) | 
                          Receiving Alliance: {war.receivingAllianceName || 'None'} (ID: {war.receivingAllianceId || 'None'})
                        </div>
                        <div className="text-xs text-gray-400">Status: {war.status} | Date: {war.date}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Selected War Editor */}
            {selectedWar && (
              <div className="border border-gray-600 rounded bg-gray-700 p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">
                  Edit Alliance IDs for War {selectedWar.warId}
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-gray-400 mb-2">
                      {selectedWar.declaringNationName} ({selectedWar.declaringRulerName}) → {selectedWar.receivingNationName} ({selectedWar.receivingRulerName})
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Declaring Alliance ID
                    </label>
                    <select
                      value={warDeclaringAllianceId}
                      onChange={(e) => setWarDeclaringAllianceId(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-600 text-gray-200 border border-gray-500 rounded focus:outline-none focus:border-primary"
                    >
                      <option value="">None (clear)</option>
                      {alliances.map((alliance) => (
                        <option key={alliance.id} value={String(alliance.id)}>
                          {alliance.name} (ID: {alliance.id})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Receiving Alliance ID
                    </label>
                    <select
                      value={warReceivingAllianceId}
                      onChange={(e) => setWarReceivingAllianceId(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-600 text-gray-200 border border-gray-500 rounded focus:outline-none focus:border-primary"
                    >
                      <option value="">None (clear)</option>
                      {alliances.map((alliance) => (
                        <option key={alliance.id} value={String(alliance.id)}>
                          {alliance.name} (ID: {alliance.id})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleUpdateWarAllianceIds}
                      disabled={warSaving}
                      className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {warSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedWar(null);
                        setWarDeclaringAllianceId('');
                        setWarReceivingAllianceId('');
                      }}
                      className="px-4 py-2 bg-gray-600 text-gray-200 rounded hover:bg-gray-500"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
};

export default AdminPage;

