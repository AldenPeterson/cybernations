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
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading alliances...</div>;
  }

  if (error) {
    return <div style={{ padding: '20px', color: 'red' }}>Error: {error}</div>;
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      {/* Alliance Selector */}
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="alliance-select" style={{ marginRight: '10px', fontWeight: 'bold' }}>
          Select Alliance:
        </label>
        <select
          id="alliance-select"
          value={selectedAllianceId || ''}
          onChange={(e) => setSelectedAllianceId(parseInt(e.target.value))}
          style={{
            padding: '8px 12px',
            fontSize: '16px',
            borderRadius: '4px',
            border: '1px solid #ccc',
            minWidth: '300px',
            marginRight: '20px'
          }}
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
            <div style={{ 
              marginBottom: '20px', 
              padding: '15px', 
              backgroundColor: 'transparent', 
              borderRadius: '8px',
              border: '1px solid #ddd'
            }}>
              <h3>Alliance Statistics</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
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
            <div style={{ 
              marginBottom: '20px', 
              padding: '15px', 
              backgroundColor: 'transparent', 
              borderRadius: '8px',
              border: '1px solid #ddd'
            }}>
              <h3>{alliances.find(a => a.id === selectedAllianceId)?.name || 'Selected Alliance'} Aid Offers, by receiving/sending alliance</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ 
                  width: '100%', 
                  borderCollapse: 'collapse', 
                  border: '1px solid #ddd',
                  fontSize: '14px',
                  backgroundColor: 'white'
                }}>
                  <thead>
                    <tr style={{ backgroundColor: '#343a40' }}>
                      <th style={{ 
                        padding: '12px', 
                        border: '1px solid #ddd', 
                        textAlign: 'left',
                        backgroundColor: '#343a40',
                        color: 'white',
                        fontWeight: 'bold'
                      }}>
                        Alliance
                      </th>
                      <th style={{ 
                        padding: '12px', 
                        border: '1px solid #ddd', 
                        textAlign: 'center',
                        backgroundColor: '#343a40',
                        color: 'white',
                        fontWeight: 'bold'
                      }}>
                        Received
                      </th>
                      <th style={{ 
                        padding: '12px', 
                        border: '1px solid #ddd', 
                        textAlign: 'center',
                        backgroundColor: '#343a40',
                        color: 'white',
                        fontWeight: 'bold'
                      }}>
                        Sent
                      </th>
                      <th style={{ 
                        padding: '12px', 
                        border: '1px solid #ddd', 
                        textAlign: 'center',
                        backgroundColor: '#343a40',
                        color: 'white',
                        fontWeight: 'bold'
                      }}>
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {allianceAidStats?.map((stats) => (
                      <tr key={stats.allianceId} style={{ backgroundColor: 'white' }}>
                        <td style={{ 
                          padding: '8px', 
                          border: '1px solid #ddd',
                          fontWeight: 'bold',
                          color: 'black',
                          backgroundColor: 'white'
                        }}>
                          {stats.allianceName}
                        </td>
                        <td style={{ 
                          padding: '8px', 
                          border: '1px solid #ddd', 
                          textAlign: 'center',
                          color: 'black',
                          backgroundColor: 'white',
                          fontWeight: stats.incomingAid > 0 ? 'bold' : 'normal'
                        }}>
                          {stats.incomingAid}
                        </td>
                        <td style={{ 
                          padding: '8px', 
                          border: '1px solid #ddd', 
                          textAlign: 'center',
                          color: 'black',
                          backgroundColor: 'white',
                          fontWeight: stats.outgoingAid > 0 ? 'bold' : 'normal'
                        }}>
                          {stats.outgoingAid}
                        </td>
                        <td style={{ 
                          padding: '8px', 
                          border: '1px solid #ddd', 
                          textAlign: 'center',
                          color: 'black',
                          backgroundColor: 'white',
                          fontWeight: 'bold'
                        }}>
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
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ marginRight: '10px', fontWeight: 'bold' }}>
                  Filter by Aid Expiration:
                </label>
                <button
                  onClick={() => setExpirationFilter(['empty', '1 day', '2 days', '3 days', '4 days', '5 days', '6 days', '7 days', '8 days', '9 days', '10 days'])}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: '#333',
                    fontWeight: '500',
                    marginRight: '8px'
                  }}
                >
                  Check All
                </button>
                <button
                  onClick={() => setExpirationFilter([])}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: '#333',
                    fontWeight: '500'
                  }}
                >
                  Uncheck All
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
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
                  <label key={option.value} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    padding: '4px 8px',
                    backgroundColor: expirationFilter.includes(option.value) ? option.color : '#f8f9fa',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: option.textColor,
                    fontWeight: '500'
                  }}>
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
                      style={{ marginRight: '6px' }}
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
              <div style={{ overflowX: 'auto' }}>
                <table style={{ 
                  width: '100%', 
                  borderCollapse: 'collapse', 
                  border: '1px solid #ddd',
                  fontSize: '14px'
                }}>
                  <thead>
                    <tr style={{ backgroundColor: '#343a40' }}>
                      <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left', color: 'white', fontWeight: 'bold' }}>
                        Nation
                      </th>
                      {[1, 2, 3, 4, 5, 6].map(slotNum => (
                        <th key={slotNum} style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'center', color: 'white', fontWeight: 'bold' }}>
                          Slot {slotNum}
                          <br />
                          <small style={{ color: '#e0e0e0' }}>
                            Aid Offer
                          </small>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredAidSlots().map((nationAidSlots) => (
                      <tr key={nationAidSlots.nation.id}>
                        <td style={{ 
                          padding: '8px', 
                          border: '1px solid #ddd',
                          backgroundColor: getActivityColor(nationAidSlots.nation.activity)
                        }}>
                          <div>
                            <strong>
                              <a 
                                href={`https://www.cybernations.net/search_aid.asp?search=${nationAidSlots.nation.id}&Extended=1`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ 
                                  color: '#007bff', 
                                  textDecoration: 'none'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                              >
                                {nationAidSlots.nation.nationName}
                              </a>
                            </strong>
                            <br />
                            <small style={{ color: '#666' }}>
                              {nationAidSlots.nation.rulerName}
                            </small>
                            <br />
                            <small style={{ 
                              color: getWarStatusColor(nationAidSlots.nation.inWarMode),
                              fontWeight: 'bold'
                            }}>
                              {getWarStatusIcon(nationAidSlots.nation.inWarMode)} {nationAidSlots.nation.inWarMode ? 'War Mode' : 'Peace Mode'}
                            </small>
                          </div>
                        </td>
                        {nationAidSlots.aidSlots.map((slot) => {
                          const isExpired = slot.aidOffer ? slot.aidOffer.isExpired : false;
                          const hasDRA = nationAidSlots.aidSlots.length === 6;
                          const isBlackCell = !hasDRA && slot.slotNumber > 5;
                          
                          return (
                          <td key={slot.slotNumber} style={{ 
                            padding: '8px', 
                            border: '1px solid #ddd', 
                            textAlign: 'center',
                            backgroundColor: isBlackCell ? '#000000' : (slot.aidOffer ? (isExpired ? '#ffebee' : (slot.isOutgoing ? '#e3f2fd' : '#f3e5f5')) : '#ffffff')
                          }}>
                            {isBlackCell ? (
                              <span style={{ color: '#ffffff' }}>N/A</span>
                            ) : slot.aidOffer ? (
                              <div style={{ fontSize: '12px' }}>
                                <div style={{ 
                                  fontWeight: 'bold', 
                                  marginBottom: '4px',
                                  color: isExpired ? '#d32f2f' : (slot.isOutgoing ? '#1976d2' : '#7b1fa2')
                                }}>
                                  {slot.isOutgoing ? '→ ' : '← '}
                                  <a 
                                    href={`https://www.cybernations.net/search_aid.asp?search=${slot.aidOffer.targetId || 'undefined'}&Extended=1`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ 
                                      color: 'inherit', 
                                      textDecoration: 'none' 
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                    onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                                  >
                                    {slot.aidOffer.targetNation}
                                  </a>
                                  <span style={{ color: '#666', fontWeight: 'normal' }}> / {slot.aidOffer.targetRuler}</span>
                                  {isExpired && <span style={{ color: '#d32f2f', fontSize: '10px' }}> (EXPIRED)</span>}
                                </div>
                                <div style={{ marginBottom: '4px', fontSize: '11px' }}>
                                  <span style={{ 
                                    color: '#2c5530', 
                                    fontWeight: 'bold',
                                    backgroundColor: '#e8f5e8',
                                    padding: '2px 4px',
                                    borderRadius: '3px'
                                  }}>
                                    {formatAidValue(slot.aidOffer.money, slot.aidOffer.technology, slot.aidOffer.soldiers)}
                                  </span>
                                  {slot.aidOffer.reason && (
                                    <span style={{ color: '#666', marginLeft: '4px' }}> - {slot.aidOffer.reason}</span>
                                  )}
                                </div>
                                <div style={{ 
                                  fontSize: '10px', 
                                  color: isExpired ? '#d32f2f' : '#666',
                                  fontWeight: isExpired ? 'bold' : 'normal'
                                }}>
                                  Expires: {slot.aidOffer.expirationDate} ({slot.aidOffer.daysUntilExpiration} days)
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: '#999' }}>Empty</span>
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
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
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
            <div style={{ 
              marginBottom: '20px', 
              padding: '15px', 
              backgroundColor: 'transparent', 
              borderRadius: '8px',
              border: '1px solid #ddd'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0 }}>Aid Recommendations</h3>
                <button
                  onClick={copyDiscordText}
                  style={{
                    backgroundColor: '#5865F2',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#4752C4';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#5865F2';
                  }}
                >
                  📋 Copy Discord Text
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ 
                  width: '100%', 
                  borderCollapse: 'collapse', 
                  border: '1px solid #ddd',
                  fontSize: '14px',
                  backgroundColor: 'white'
                }}>
                  <thead>
                    <tr style={{ backgroundColor: '#343a40' }}>
                      <th style={{ 
                        padding: '12px', 
                        border: '1px solid #ddd', 
                        textAlign: 'left',
                        backgroundColor: '#343a40',
                        color: 'white',
                        fontWeight: 'bold'
                      }}>
                        Sender
                      </th>
                      <th style={{ 
                        padding: '12px', 
                        border: '1px solid #ddd', 
                        textAlign: 'left',
                        backgroundColor: '#343a40',
                        color: 'white',
                        fontWeight: 'bold'
                      }}>
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
                        <tr key={groupIndex} style={{ backgroundColor: 'white' }}>
                          <td style={{ 
                            padding: '8px', 
                            border: '1px solid #ddd',
                            color: 'black',
                            backgroundColor: 'white',
                            verticalAlign: 'top',
                            width: '30%'
                          }}>
                            <div>
                              <strong>
                                <a 
                                  href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${group.sender.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ 
                                    color: '#007bff', 
                                    textDecoration: 'none'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                  onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                                >
                                  {group.sender.nationName}
                                </a>
                              </strong>
                              <br />
                              <small style={{ color: '#666' }}>{group.sender.rulerName}</small>
                              <br />
                              <WarStatusBadge inWarMode={group.sender.inWarMode} />
                              {/* Category badge removed */}
                            </div>
                          </td>
                          <td style={{ 
                            padding: '8px', 
                            border: '1px solid #ddd',
                            color: 'black',
                            backgroundColor: 'white',
                            verticalAlign: 'top'
                          }}>
                            {group.recipients.map((rec, recIndex) => (
                              <div key={recIndex} style={{ 
                                marginBottom: recIndex < group.recipients.length - 1 ? '8px' : '0',
                                paddingBottom: recIndex < group.recipients.length - 1 ? '8px' : '0',
                                borderBottom: recIndex < group.recipients.length - 1 ? '1px solid #eee' : 'none'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <span style={{ 
                                      fontSize: '11px', 
                                      padding: '1px 4px', 
                                      borderRadius: '2px',
                                      backgroundColor: rec.priority === 0 ? '#ffebee' : 
                                        (rec.type && rec.type.includes('cross_alliance')) ? '#fff3e0' : '#e8f5e8',
                                      color: rec.priority === 0 ? '#d32f2f' : 
                                        (rec.type && rec.type.includes('cross_alliance')) ? '#f57c00' : '#2e7d32',
                                      fontWeight: 'bold',
                                      marginRight: '6px'
                                    }}>
                                      {rec.type && rec.type.includes('cross_alliance') ? '🌐' : `P${rec.priority}`}
                                    </span>
                                    <span style={{ fontWeight: 'bold', marginRight: '6px', fontSize: '12px' }}>
                                      {rec.type && rec.type.includes('cash') ? '💰' : '🔬'}
                                    </span>
                                    <strong style={{ fontSize: '13px', marginRight: '6px' }}>
                                      <a 
                                        href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${rec.recipient.id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ 
                                          color: '#007bff', 
                                          textDecoration: 'none'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                        onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                                      >
                                        {rec.recipient.nationName}
                                      </a>
                                    </strong>
                                    <span style={{ 
                                      fontSize: '11px', 
                                      color: '#666', 
                                      fontStyle: 'italic',
                                      marginRight: '6px'
                                    }}>
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
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              No aid recommendations available for this alliance.
            </div>
          )}
        </div>
      )}


      {/* Show message when no alliance is selected */}
      {!selectedAllianceId && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          Please select an alliance to view alliance-specific data.
        </div>
      )}
    </div>
  );
};

export default AllianceDashboard;
