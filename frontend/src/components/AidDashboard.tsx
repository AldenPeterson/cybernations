import React, { useState, useEffect } from 'react';

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

const AidDashboard: React.FC = () => {
  const [alliances, setAlliances] = useState<Alliance[]>([]);
  const [selectedAllianceId, setSelectedAllianceId] = useState<number | null>(null);
  const [aidSlots, setAidSlots] = useState<NationAidSlots[]>([]);
  const [allianceStats, setAllianceStats] = useState<AllianceStats | null>(null);
  const [allianceAidStats, setAllianceAidStats] = useState<AllianceAidStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expirationFilter, setExpirationFilter] = useState<string[]>(['empty', '1 day', '2 days', '3 days', '4 days', '5 days', '6 days', '7 days', '8 days', '9 days', '10 days']);

  useEffect(() => {
    fetchAlliances();
  }, []);

  useEffect(() => {
    if (selectedAllianceId) {
      fetchAidSlots(selectedAllianceId);
      fetchAllianceStats(selectedAllianceId);
      fetchAllianceAidStats(selectedAllianceId);
    }
  }, [selectedAllianceId]);

  const fetchAlliances = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/alliances');
      const data = await response.json();
      
      if (data.success) {
        setAlliances(data.alliances);
        // Set Doombrella as default if it exists
        const doombrella = data.alliances.find(alliance => 
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
      const response = await fetch(`/api/alliances/${allianceId}/aid-slots`);
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
      const response = await fetch(`/api/alliances/${allianceId}/stats`);
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
      const response = await fetch(`/api/alliances/${allianceId}/alliance-aid-stats`);
      const data = await response.json();
      
      if (data.success) {
        setAllianceAidStats(data.allianceAidStats);
      }
    } catch (err) {
      console.error('Failed to fetch alliance aid stats:', err);
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

  const calculateExpirationDate = (offerDate: string): string => {
    const offerDateObj = new Date(offerDate);
    const expirationDate = new Date(offerDateObj.getTime() + (10 * 24 * 60 * 60 * 1000)); // Add 10 days
    const daysUntilExpiration = getDaysUntilExpiration(offerDate);
    return `${expirationDate.toLocaleDateString()} (${daysUntilExpiration} days)`;
  };

  const isOfferExpired = (offerDate: string): boolean => {
    const offerDateObj = new Date(offerDate);
    const expirationDate = new Date(offerDateObj.getTime() + (10 * 24 * 60 * 60 * 1000));
    return new Date() > expirationDate;
  };

  const getDaysUntilExpiration = (offerDate: string): number => {
    const offerDateObj = new Date(offerDate);
    const expirationDate = new Date(offerDateObj.getTime() + (10 * 24 * 60 * 60 * 1000));
    const now = new Date();
    const daysUntilExpiration = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    // If the offer was made today, it should show as 10 days remaining
    // If made yesterday, it should show as 9 days remaining, etc.
    const daysSinceOffer = Math.floor((now.getTime() - offerDateObj.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, 10 - daysSinceOffer);
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

  const getFilteredAidSlots = (): NationAidSlots[] => {
    if (expirationFilter.length === 0) return []; // Show no nations when no filters selected

    return aidSlots.filter(nationAidSlots => {
      // Check if any aid slot matches the filter criteria
      return nationAidSlots.aidSlots.some(slot => {
        if (!slot.aidOffer) {
          return expirationFilter.includes('empty');
        }
        
        const days = getDaysUntilExpiration(slot.aidOffer.date);
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

  if (loading && alliances.length === 0) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading alliances...</div>;
  }

  if (error) {
    return <div style={{ padding: '20px', color: 'red' }}>Error: {error}</div>;
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>CyberNations Aid Slot Dashboard</h1>
      
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
            <div><strong>Outgoing Aid:</strong> {allianceStats.totalOutgoingAid}</div>
            <div><strong>Incoming Aid:</strong> {allianceStats.totalIncomingAid}</div>
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
      {allianceAidStats.length > 0 && (
        <div style={{ 
          marginBottom: '20px', 
          padding: '15px', 
          backgroundColor: 'transparent', 
          borderRadius: '8px',
          border: '1px solid #ddd'
        }}>
          <h3>Alliance-to-Alliance Aid Statistics</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse', 
              border: '1px solid #ddd',
              fontSize: '14px',
              backgroundColor: 'white'
            }}>
              <thead>
                <tr style={{ backgroundColor: 'white' }}>
                  <th style={{ 
                    padding: '12px', 
                    border: '1px solid #ddd', 
                    textAlign: 'left',
                    backgroundColor: 'white',
                    color: 'black',
                    fontWeight: 'bold'
                  }}>
                    Alliance
                  </th>
                  <th style={{ 
                    padding: '12px', 
                    border: '1px solid #ddd', 
                    textAlign: 'center',
                    backgroundColor: 'white',
                    color: 'black',
                    fontWeight: 'bold'
                  }}>
                    Incoming
                  </th>
                  <th style={{ 
                    padding: '12px', 
                    border: '1px solid #ddd', 
                    textAlign: 'center',
                    backgroundColor: 'white',
                    color: 'black',
                    fontWeight: 'bold'
                  }}>
                    Outgoing
                  </th>
                  <th style={{ 
                    padding: '12px', 
                    border: '1px solid #ddd', 
                    textAlign: 'center',
                    backgroundColor: 'white',
                    color: 'black',
                    fontWeight: 'bold'
                  }}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {allianceAidStats.map((stats) => (
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
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>
                    Nation
                  </th>
                  {[1, 2, 3, 4, 5, 6].map(slotNum => (
                    <th key={slotNum} style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'center' }}>
                      Slot {slotNum}
                      <br />
                      <small style={{ color: '#666' }}>
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
                            href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${nationAidSlots.nation.id}`}
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
                      </div>
                    </td>
                    {nationAidSlots.aidSlots.map((slot) => {
                      const isExpired = slot.aidOffer ? isOfferExpired(slot.aidOffer.date) : false;
                      return (
                      <td key={slot.slotNumber} style={{ 
                        padding: '8px', 
                        border: '1px solid #ddd', 
                        textAlign: 'center',
                        backgroundColor: slot.aidOffer ? (isExpired ? '#ffebee' : (slot.isOutgoing ? '#e3f2fd' : '#f3e5f5')) : '#fafafa'
                      }}>
                        {slot.aidOffer ? (
                          <div style={{ fontSize: '12px' }}>
                            <div style={{ 
                              fontWeight: 'bold', 
                              marginBottom: '4px',
                              color: isExpired ? '#d32f2f' : (slot.isOutgoing ? '#1976d2' : '#7b1fa2')
                            }}>
                              {slot.isOutgoing ? '→ ' : '← '}
                              <a 
                                href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${slot.aidOffer.targetId || 'undefined'}`}
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
                              Expires: {calculateExpirationDate(slot.aidOffer.date)}
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
    </div>
  );
};

export default AidDashboard;
