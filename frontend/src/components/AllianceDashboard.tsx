import React, { useState, useEffect } from 'react';
import SlotCountsSummary from './SlotCountsSummary';
import WarStatusBadge from './WarStatusBadge';
import { apiCall, API_ENDPOINTS } from '../utils/api';

interface Alliance {
  id: number;
  name: string;
  nationCount: number;
}

interface AidOffer {
  aidId: number;
  targetNation: string;
  targetRuler: string;
  targetId: number;
  declaringId: number;
  receivingId: number;
  money: number;
  technology: number;
  soldiers: number;
  reason: string;
  date: string;
  // Calculated fields from backend
  expirationDate?: string;
  daysUntilExpiration?: number;
  isExpired?: boolean;
}

interface AidSlot {
  slotNumber: number;
  isOutgoing: boolean;
  aidOffer: AidOffer | null;
}

interface NationAidSlots {
  nation: {
    id: number;
    rulerName: string;
    nationName: string;
    strength: number;
    activity: string;
    inWarMode: boolean;
  };
  aidSlots: AidSlot[];
}

interface AllianceStats {
  totalNations: number;
  totalOutgoingAid: number;
  totalIncomingAid: number;
  totalMoneyOut: number;
  totalMoneyIn: number;
  totalTechOut: number;
  totalTechIn: number;
  totalSoldiersOut: number;
  totalSoldiersIn: number;
}

interface AllianceAidStats {
  allianceId: number;
  allianceName: string;
  outgoingAid: number;
  incomingAid: number;
  outgoingMoney: number;
  incomingMoney: number;
  outgoingTech: number;
  incomingTech: number;
  outgoingSoldiers: number;
  incomingSoldiers: number;
}

interface AidRecommendation {
  sender: {
    id: number;
    nationName: string;
    rulerName: string;
    discord_handle: string;
    strength: number;
    inWarMode: boolean;
  };
  recipient: {
    id: number;
    nationName: string;
    rulerName: string;
    strength: number;
    inWarMode: boolean;
  };
  type: string;
  priority: number;
  reason: string;
}

// Nation categories removed - replaced with slot-based statistics

interface SlotCounts {
  totalGetCash: number;
  totalGetTech: number;
  totalSendCash: number;
  totalSendTech: number;
  totalSendCashPeaceMode?: number;
  totalSendTechPeaceMode?: number;
  activeGetCash?: number;
  activeGetTech?: number;
  activeSendCash?: number;
  activeSendTech?: number;
}

interface AllianceDashboardProps {
  selectedAllianceId: number | null;
  setSelectedAllianceId: (id: number | null) => void;
  activeTab: 'aid' | 'recommendations' | 'nations' | 'defending-wars';
}

const AllianceDashboard: React.FC<AllianceDashboardProps> = ({ 
  selectedAllianceId, 
  setSelectedAllianceId, 
  activeTab 
}) => {
  const [alliances, setAlliances] = useState<Alliance[]>([]);
  const [aidSlots, setAidSlots] = useState<NationAidSlots[]>([]);
  const [allianceStats, setAllianceStats] = useState<AllianceStats | null>(null);
  const [allianceAidStats, setAllianceAidStats] = useState<AllianceAidStats[]>([]);
  const [recommendations, setRecommendations] = useState<AidRecommendation[]>([]);
  // Nation categories removed - using slot-based statistics instead
  const [slotCounts, setSlotCounts] = useState<SlotCounts | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expirationFilter, setExpirationFilter] = useState<string[]>(['empty', '1 day', '2 days', '3 days', '4 days', '5 days', '6 days', '7 days', '8 days', '9 days', '10 days']);
  const [crossAllianceEnabled, setCrossAllianceEnabled] = useState<boolean>(true);

  useEffect(() => {
    fetchAlliances();
  }, []);

  useEffect(() => {
    if (selectedAllianceId) {
      fetchAidSlots(selectedAllianceId);
      fetchAllianceStats(selectedAllianceId);
      fetchAllianceAidStats(selectedAllianceId);
      fetchRecommendations(selectedAllianceId);
    }
  }, [selectedAllianceId, crossAllianceEnabled]);

  const fetchAlliances = async () => {
    try {
      setLoading(true);
      const response = await apiCall(API_ENDPOINTS.alliances);
      const data = await response.json();
      
      if (data.success) {
        setAlliances(data.alliances);
        // Set Doombrella as default if it exists
        const doombrella = data.alliances.find((alliance: any) => 
          alliance.name.toLowerCase().includes('doombrella')
        );
        if (doombrella) {
          setSelectedAllianceId(doombrella.id);
        }
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch alliances');
    } finally {
      setLoading(false);
    }
  };

  const fetchAidSlots = async (allianceId: number) => {
    try {
      setLoading(true);
      const response = await apiCall(API_ENDPOINTS.allianceAidSlots(allianceId));
      const data = await response.json();
      
      if (data.success) {
        setAidSlots(data.aidSlots);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch aid slots');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllianceStats = async (allianceId: number) => {
    try {
      const response = await apiCall(API_ENDPOINTS.allianceStats(allianceId));
      const data = await response.json();
      
      if (data.success) {
        setAllianceStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch alliance stats:', err);
    }
  };

  const fetchAllianceAidStats = async (allianceId: number) => {
    try {
      const response = await apiCall(API_ENDPOINTS.allianceAidStats(allianceId));
      const data = await response.json();
      
      if (data.success) {
        setAllianceAidStats(data.allianceAidStats || []);
      } else {
        console.error('Failed to fetch alliance aid stats:', data.error);
        setAllianceAidStats([]);
      }
    } catch (err) {
      console.error('Failed to fetch alliance aid stats:', err);
      setAllianceAidStats([]);
    }
  };

  const fetchRecommendations = async (allianceId: number) => {
    try {
      const response = await apiCall(`${API_ENDPOINTS.allianceRecommendations(allianceId)}?crossAlliance=${crossAllianceEnabled}`);
      const data = await response.json();
      
      if (data.success) {
        setRecommendations(data.recommendations);
        // Nation categories removed
        setSlotCounts(data.slotCounts);
      }
    } catch (err) {
      console.error('Failed to fetch recommendations:', err);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const formatAidValue = (money: number, tech: number, soldiers: number): string => {
    const parts = [];
    if (money > 0) parts.push(`$${formatNumber(money)}`);
    if (tech > 0) parts.push(`${tech}T`);
    if (soldiers > 0) parts.push(`${formatNumber(soldiers)}S`);
    return parts.join(' / ') || 'Empty';
  };

  const getExpirationCategory = (days: number): string => {
    if (days < 0) return 'expired'; // Still track expired internally but don't show in filter
    if (days === 0) return 'today';
    if (days === 1) return '1 day';
    if (days === 2) return '2 days';
    if (days === 3) return '3 days';
    if (days === 4) return '4 days';
    if (days === 5) return '5 days';
    if (days === 6) return '6 days';
    if (days === 7) return '7 days';
    if (days === 8) return '8 days';
    if (days === 9) return '9 days';
    if (days === 10) return '10 days';
    return 'expired'; // Anything beyond 10 days is expired
  };

  const generateDiscordText = (): string => {
    if (recommendations.length === 0) {
      return 'No aid recommendations available.';
    }

    // Group recommendations by sender
    const groupedBySender = recommendations.reduce((acc, rec) => {
      const senderId = rec.sender.id;
      if (!acc[senderId]) {
        acc[senderId] = {
          sender: rec.sender,
          recipients: []
        };
      }
      acc[senderId].recipients.push(rec);
      return acc;
    }, {} as Record<number, { sender: any, recipients: any[] }>);

    const discordLines: string[] = [];
    
    Object.values(groupedBySender).forEach(group => {
      // Use discord_handle if available, otherwise fall back to rulerName
      const handle = group.sender.discord_handle || group.sender.rulerName;
      discordLines.push(`@${handle}`);
      group.recipients.forEach(rec => {
        // Map the type field to the appropriate aid type
        let aidType = 'UNKNOWN';
        if (rec.type) {
          if (rec.type.includes('cash')) {
            aidType = 'CASH';
          } else if (rec.type.includes('tech')) {
            aidType = 'TECH';
          }
        }
        
        // Add cross-alliance indicator
        const crossAllianceIndicator = rec.type && rec.type.includes('cross_alliance') ? ' (Cross-Alliance)' : '';
        discordLines.push(`send ${aidType} to ${rec.recipient.rulerName}${crossAllianceIndicator} https://www.cybernations.net/aid_form.asp?Nation_ID=${rec.recipient.id}&bynation=${rec.sender.id}`)
      });
      discordLines.push('');
    });

    return discordLines.join('\n');
  };

  const copyDiscordText = async () => {
    const text = generateDiscordText();
    
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      alert('Failed to copy text to clipboard');
    }
  };

  const getFilteredAidSlots = (): NationAidSlots[] => {
    if (expirationFilter.length === 0) return []; // Show no nations when no filters selected

    return aidSlots.filter(nationAidSlots => {
      // Check if any aid slot matches the filter criteria
      return nationAidSlots.aidSlots.some(slot => {
        if (!slot.aidOffer) {
          return expirationFilter.includes('empty');
        }
        
        const days = slot.aidOffer.daysUntilExpiration || 0;
        const category = getExpirationCategory(days);
        return expirationFilter.includes(category);
      });
    });
  };

  const getActivityColor = (activity: string): string => {
    const activityLower = activity.toLowerCase();
    if (activityLower.includes('active in the last 3 days')) {
      return '#d4edda'; // Light green
    } else if (activityLower.includes('active this week')) {
      return '#fff3cd'; // Light yellow
    } else if (activityLower.includes('active last week') || activityLower.includes('active three weeks ago')) {
      return '#ffeaa7'; // Light orange
    } else if (activityLower.includes('active more than three weeks ago')) {
      return '#f8d7da'; // Light red
    }
    return '#f8f9fa'; // Default light gray
  };

  const getWarStatusColor = (inWarMode: boolean): string => {
    return inWarMode ? '#dc3545' : '#28a745'; // Red for war mode, green for peace mode
  };

  const getWarStatusIcon = (inWarMode: boolean): string => {
    return inWarMode ? '⚔️' : '🕊️'; // Sword for war mode, dove for peace mode
  };

  if (loading && alliances.length === 0) {
    return <div className="p-5 text-center">Loading alliances...</div>;
  }

  if (error) {
    return <div className="p-5 text-error">Error: {error}</div>;
  }

  return (
    <div className="p-5 font-sans">
      {/* Alliance Selector */}
      <div className="mb-5">
        <label htmlFor="alliance-select" className="mr-2.5 font-bold">
          Select Alliance:
        </label>
        <select
          id="alliance-select"
          value={selectedAllianceId || ''}
          onChange={(e) => setSelectedAllianceId(parseInt(e.target.value))}
          className="px-3 py-2 text-base rounded border border-gray-300 min-w-[300px] mr-5 focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20"
        >
          <option value="">Choose an alliance...</option>
          {alliances.map(alliance => (
            <option key={alliance.id} value={alliance.id}>
              {alliance.name} ({alliance.nationCount} nations)
            </option>
          ))}
        </select>
      </div>


      {/* Content based on active tab */}
      {activeTab === 'aid' && selectedAllianceId && (
        <>
          {/* Alliance Stats */}
          {allianceStats && allianceStats.totalNations > 0 && (
            <div className="mb-5 p-4 bg-transparent rounded-lg border border-slate-300">
              <h3>Alliance Statistics</h3>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5">
                <div><strong>Total Nations:</strong> {allianceStats.totalNations}</div>
                <div><strong>Sent Aid:</strong> {allianceStats.totalOutgoingAid}</div>
                <div><strong>Received Aid:</strong> {allianceStats.totalIncomingAid}</div>
                <div><strong>Money Out:</strong> ${formatNumber(allianceStats.totalMoneyOut)}</div>
                <div><strong>Money In:</strong> ${formatNumber(allianceStats.totalMoneyIn)}</div>
                <div><strong>Tech Out:</strong> {allianceStats.totalTechOut}</div>
                <div><strong>Tech In:</strong> {allianceStats.totalTechIn}</div>
                <div><strong>Soldiers Out:</strong> {formatNumber(allianceStats.totalSoldiersOut)}</div>
                <div><strong>Soldiers In:</strong> {formatNumber(allianceStats.totalSoldiersIn)}</div>
              </div>
            </div>
          )}

          {/* Alliance-to-Alliance Aid Statistics */}
          {allianceAidStats && allianceAidStats.length > 0 && (
            <div className="mb-5 p-4 bg-transparent rounded-lg border border-slate-300">
              <h3>{alliances.find(a => a.id === selectedAllianceId)?.name || 'Selected Alliance'} Aid Offers, by receiving/sending alliance</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-300 text-sm bg-white">
                  <thead>
                    <tr className="bg-gray-800">
                      <th className="p-3 border border-slate-300 text-left bg-gray-800 text-white font-bold">
                        Alliance
                      </th>
                      <th className="p-3 border border-slate-300 text-center bg-gray-800 text-white font-bold">
                        Received
                      </th>
                      <th className="p-3 border border-slate-300 text-center bg-gray-800 text-white font-bold">
                        Sent
                      </th>
                      <th className="p-3 border border-slate-300 text-center bg-gray-800 text-white font-bold">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {allianceAidStats?.map((stats) => (
                      <tr key={stats.allianceId} className="bg-white hover:bg-slate-50">
                        <td className="p-2 border border-slate-300 font-bold text-black bg-white">
                          {stats.allianceName}
                        </td>
                        <td className={`p-2 border border-slate-300 text-center text-black bg-white ${stats.incomingAid > 0 ? 'font-bold' : 'font-normal'}`}>
                          {stats.incomingAid}
                        </td>
                        <td className={`p-2 border border-slate-300 text-center text-black bg-white ${stats.outgoingAid > 0 ? 'font-bold' : 'font-normal'}`}>
                          {stats.outgoingAid}
                        </td>
                        <td className="p-2 border border-slate-300 text-center text-black bg-white font-bold">
                          {stats.incomingAid + stats.outgoingAid}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Expiration Filter */}
          {selectedAllianceId && (
            <div className="mb-5">
              <div className="flex items-center mb-2">
                <label className="mr-2.5 font-bold">
                  Filter by Aid Expiration:
                </label>
                <button
                  onClick={() => setExpirationFilter(['empty', '1 day', '2 days', '3 days', '4 days', '5 days', '6 days', '7 days', '8 days', '9 days', '10 days'])}
                  className="px-2 py-1 bg-slate-50 border border-slate-300 rounded cursor-pointer text-xs text-gray-800 font-medium mr-2 hover:bg-slate-100"
                >
                  Check All
                </button>
                <button
                  onClick={() => setExpirationFilter([])}
                  className="px-2 py-1 bg-slate-50 border border-slate-300 rounded cursor-pointer text-xs text-gray-800 font-medium hover:bg-slate-100"
                >
                  Uncheck All
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'empty', label: 'Empty', color: '#f8f9fa', textColor: '#333' },
                  { value: '1 day', label: '1 Day', color: '#ffeaa7', textColor: '#333' },
                  { value: '2 days', label: '2 Days', color: '#ffeaa7', textColor: '#333' },
                  { value: '3 days', label: '3 Days', color: '#ffeaa7', textColor: '#333' },
                  { value: '4 days', label: '4 Days', color: '#d4edda', textColor: '#333' },
                  { value: '5 days', label: '5 Days', color: '#d4edda', textColor: '#333' },
                  { value: '6 days', label: '6 Days', color: '#d4edda', textColor: '#333' },
                  { value: '7 days', label: '7 Days', color: '#d4edda', textColor: '#333' },
                  { value: '8 days', label: '8 Days', color: '#d4edda', textColor: '#333' },
                  { value: '9 days', label: '9 Days', color: '#d4edda', textColor: '#333' },
                  { value: '10 days', label: '10 Days', color: '#d4edda', textColor: '#333' }
                ].map(option => (
                  <label 
                    key={option.value}
                    className="flex items-center px-2 py-1 border border-slate-300 rounded cursor-pointer text-sm font-medium"
                    style={{ 
                      backgroundColor: expirationFilter.includes(option.value) ? option.color : '#f8f9fa',
                      color: option.textColor
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={expirationFilter.includes(option.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setExpirationFilter([...expirationFilter, option.value]);
                        } else {
                          setExpirationFilter(expirationFilter.filter(f => f !== option.value));
                        }
                      }}
                      className="mr-1.5"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Aid Slots Table */}
          {selectedAllianceId && getFilteredAidSlots().length > 0 && (
            <div>
              <h2>Aid Slots by Nation</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-300 text-sm">
                  <thead>
                    <tr className="bg-gray-800">
                      <th className="p-3 border border-slate-300 text-left text-white font-bold">
                        Nation
                      </th>
                      {[1, 2, 3, 4, 5, 6].map(slotNum => (
                        <th key={slotNum} className="p-3 border border-slate-300 text-center text-white font-bold">
                          Slot {slotNum}
                          <br />
                          <small className="text-gray-300">
                            Aid Offer
                          </small>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredAidSlots().map((nationAidSlots) => (
                      <tr key={nationAidSlots.nation.id}>
                        <td 
                          className="p-2 border border-slate-300"
                          style={{ backgroundColor: getActivityColor(nationAidSlots.nation.activity) }}
                        >
                          <div>
                            <strong>
                              <a 
                                href={`https://www.cybernations.net/search_aid.asp?search=${nationAidSlots.nation.id}&Extended=1`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary no-underline hover:underline"
                              >
                                {nationAidSlots.nation.nationName}
                              </a>
                            </strong>
                            <br />
                            <small className="text-gray-600">
                              {nationAidSlots.nation.rulerName}
                            </small>
                            <br />
                            <small 
                              className="font-bold"
                              style={{ color: getWarStatusColor(nationAidSlots.nation.inWarMode) }}
                            >
                              {getWarStatusIcon(nationAidSlots.nation.inWarMode)} {nationAidSlots.nation.inWarMode ? 'War Mode' : 'Peace Mode'}
                            </small>
                          </div>
                        </td>
                        {nationAidSlots.aidSlots.map((slot) => {
                          const isExpired = slot.aidOffer ? slot.aidOffer.isExpired : false;
                          const hasDRA = nationAidSlots.aidSlots.length === 6;
                          const isBlackCell = !hasDRA && slot.slotNumber > 5;
                          
                          return (
                          <td 
                            key={slot.slotNumber}
                            className="p-2 border border-slate-300 text-center"
                            style={{ backgroundColor: isBlackCell ? '#000000' : (slot.aidOffer ? (isExpired ? '#ffebee' : (slot.isOutgoing ? '#e3f2fd' : '#f3e5f5')) : '#ffffff') }}
                          >
                            {isBlackCell ? (
                              <span className="text-white">N/A</span>
                            ) : slot.aidOffer ? (
                              <div className="text-xs">
                                <div 
                                  className="font-bold mb-1"
                                  style={{ color: isExpired ? '#d32f2f' : (slot.isOutgoing ? '#1976d2' : '#7b1fa2') }}
                                >
                                  {slot.isOutgoing ? '→ ' : '← '}
                                  <a 
                                    href={`https://www.cybernations.net/search_aid.asp?search=${slot.aidOffer.targetId || 'undefined'}&Extended=1`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="no-underline hover:underline"
                                    style={{ color: 'inherit' }}
                                  >
                                    {slot.aidOffer.targetNation}
                                  </a>
                                  <span className="text-gray-600 font-normal"> / {slot.aidOffer.targetRuler}</span>
                                  {isExpired && <span className="text-red-600 text-[10px]"> (EXPIRED)</span>}
                                </div>
                                <div className="mb-1 text-[11px]">
                                  <span className="text-green-900 font-bold bg-green-50 px-1 py-0.5 rounded-sm">
                                    {formatAidValue(slot.aidOffer.money, slot.aidOffer.technology, slot.aidOffer.soldiers)}
                                  </span>
                                  {slot.aidOffer.reason && (
                                    <span className="text-gray-600 ml-1"> - {slot.aidOffer.reason}</span>
                                  )}
                                </div>
                                <div 
                                  className={`text-[10px] ${isExpired ? 'text-red-600 font-bold' : 'text-gray-600 font-normal'}`}
                                >
                                  Expires: {slot.aidOffer.expirationDate} ({slot.aidOffer.daysUntilExpiration} days)
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400">Empty</span>
                            )}
                          </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selectedAllianceId && getFilteredAidSlots().length === 0 && !loading && (
            <div className="text-center p-10 text-gray-600">
              {expirationFilter.length > 0 
                ? 'No nations match the selected expiration filter.' 
                : 'No aid slot data found for this alliance.'
              }
            </div>
          )}
        </>
      )}

      {/* Recommendations Tab Content */}
      {activeTab === 'recommendations' && selectedAllianceId && (
        <div>
          {/* Nation categories removed - showing slot counts instead */}

          {/* Slot Counts Summary */}
          {slotCounts && (
            <SlotCountsSummary 
              slotCounts={slotCounts} 
              crossAllianceEnabled={crossAllianceEnabled}
              onCrossAllianceToggle={setCrossAllianceEnabled}
            />
          )}

          {/* Recommendations Table */}
          {recommendations.length > 0 && (
            <div className="mb-5 p-4 bg-transparent rounded-lg border border-slate-300">
              <div className="flex justify-between items-center mb-4">
                <h3 className="m-0">Aid Recommendations</h3>
                <button
                  onClick={copyDiscordText}
                  className="bg-[#5865F2] text-white border-none px-4 py-2 rounded-md cursor-pointer text-sm font-bold flex items-center gap-2 hover:bg-[#4752C4] transition-colors"
                >
                  📋 Copy Discord Text
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-300 text-sm bg-white">
                  <thead>
                    <tr className="bg-gray-800">
                      <th className="p-3 border border-slate-300 text-left bg-gray-800 text-white font-bold">
                        Sender
                      </th>
                      <th className="p-3 border border-slate-300 text-left bg-gray-800 text-white font-bold">
                        Recipients
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Group recommendations by sender
                      const groupedBySender = recommendations.reduce((acc, rec) => {
                        const senderId = rec.sender.id;
                        if (!acc[senderId]) {
                          acc[senderId] = {
                            sender: rec.sender,
                            recipients: []
                          };
                        }
                        acc[senderId].recipients.push(rec);
                        return acc;
                      }, {} as Record<number, { sender: any, recipients: any[] }>);

                      return Object.values(groupedBySender).map((group, groupIndex) => (
                        <tr key={groupIndex} className="bg-white hover:bg-slate-50">
                          <td className="p-2 border border-slate-300 text-black bg-white align-top w-[30%]">
                            <div>
                              <strong>
                                <a 
                                  href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${group.sender.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary no-underline hover:underline"
                                >
                                  {group.sender.nationName}
                                </a>
                              </strong>
                              <br />
                              <small className="text-gray-600">{group.sender.rulerName}</small>
                              <br />
                              <WarStatusBadge inWarMode={group.sender.inWarMode} />
                              {/* Category badge removed */}
                            </div>
                          </td>
                          <td className="p-2 border border-slate-300 text-black bg-white align-top">
                            {group.recipients.map((rec, recIndex) => (
                              <div 
                                key={recIndex}
                                className={recIndex < group.recipients.length - 1 ? 'mb-2 pb-2 border-b border-slate-200' : ''}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center flex-wrap">
                                    <span 
                                      className="text-[11px] px-1 py-px rounded-sm font-bold mr-1.5"
                                      style={{ 
                                        backgroundColor: rec.priority === 0 ? '#ffebee' : 
                                          (rec.type && rec.type.includes('cross_alliance')) ? '#fff3e0' : '#e8f5e8',
                                        color: rec.priority === 0 ? '#d32f2f' : 
                                          (rec.type && rec.type.includes('cross_alliance')) ? '#f57c00' : '#2e7d32'
                                      }}
                                    >
                                      {rec.type && rec.type.includes('cross_alliance') ? '🌐' : `P${rec.priority}`}
                                    </span>
                                    <span className="font-bold mr-1.5 text-xs">
                                      {rec.type && rec.type.includes('cash') ? '💰' : '🔬'}
                                    </span>
                                    <strong className="text-xs mr-1.5">
                                      <a 
                                        href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${rec.recipient.id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary no-underline hover:underline"
                                      >
                                        {rec.recipient.nationName}
                                      </a>
                                    </strong>
                                    <span className="text-[11px] text-gray-600 italic mr-1.5">
                                      {rec.recipient.rulerName} • {rec.reason}
                                    </span>
                                    <WarStatusBadge inWarMode={rec.recipient.inWarMode} variant="compact" />
                                  </div>
                                  {/* Category badge removed */}
                                </div>
                              </div>
                            ))}
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {recommendations.length === 0 && !loading && (
            <div className="text-center p-10 text-gray-600">
              No aid recommendations available for this alliance.
            </div>
          )}
        </div>
      )}


      {/* Show message when no alliance is selected */}
      {!selectedAllianceId && (
        <div className="text-center p-10 text-gray-600">
          Please select an alliance to view alliance-specific data.
        </div>
      )}
    </div>
  );
};

export default AllianceDashboard;
