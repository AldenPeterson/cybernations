import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
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

const AidPage: React.FC = () => {
  const { allianceId } = useParams<{ allianceId: string }>();
  const [alliance, setAlliance] = useState<Alliance | null>(null);
  const [aidSlots, setAidSlots] = useState<NationAidSlots[]>([]);
  const [allianceStats, setAllianceStats] = useState<AllianceStats | null>(null);
  const [allianceAidStats, setAllianceAidStats] = useState<AllianceAidStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expirationFilter, setExpirationFilter] = useState<string[]>(['empty', '1 day', '2 days', '3 days', '4 days', '5 days', '6 days', '7 days', '8 days', '9 days', '10 days']);

  useEffect(() => {
    if (allianceId) {
      fetchAllianceData(parseInt(allianceId));
    }
  }, [allianceId]);

  const fetchAllianceData = async (id: number) => {
    try {
      setLoading(true);
      setError(null);

      // Fetch alliance info
      const allianceResponse = await apiCall(API_ENDPOINTS.alliances);
      const allianceData = await allianceResponse.json();
      
      if (allianceData.success) {
        const foundAlliance = allianceData.alliances.find((a: Alliance) => a.id === id);
        setAlliance(foundAlliance || null);
      }

      // Fetch aid slots
      const aidSlotsResponse = await apiCall(API_ENDPOINTS.allianceAidSlots(id));
      const aidSlotsData = await aidSlotsResponse.json();
      
      if (aidSlotsData.success) {
        setAidSlots(aidSlotsData.aidSlots);
      } else {
        setError(aidSlotsData.error);
      }

      // Fetch alliance stats
      try {
        const statsResponse = await apiCall(API_ENDPOINTS.allianceStats(id));
        const statsData = await statsResponse.json();
        
        if (statsData.success) {
          setAllianceStats(statsData.stats);
        }
      } catch (err) {
        console.error('Failed to fetch alliance stats:', err);
      }

      // Fetch alliance aid stats
      try {
        const aidStatsResponse = await apiCall(API_ENDPOINTS.allianceAidStats(id));
        const aidStatsData = await aidStatsResponse.json();
        
        if (aidStatsData.success) {
          setAllianceAidStats(aidStatsData.allianceAidStats || []);
        }
      } catch (err) {
        console.error('Failed to fetch alliance aid stats:', err);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch alliance data');
    } finally {
      setLoading(false);
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
    if (days < 0) return 'expired';
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
    return 'expired';
  };

  const getFilteredAidSlots = (): NationAidSlots[] => {
    if (expirationFilter.length === 0) return [];

    return aidSlots.filter(nationAidSlots => {
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
      return '#d4edda';
    } else if (activityLower.includes('active this week')) {
      return '#fff3cd';
    } else if (activityLower.includes('active last week') || activityLower.includes('active three weeks ago')) {
      return '#ffeaa7';
    } else if (activityLower.includes('active more than three weeks ago')) {
      return '#f8d7da';
    }
    return '#f8f9fa';
  };

  const getWarStatusColor = (inWarMode: boolean): string => {
    return inWarMode ? '#dc3545' : '#28a745';
  };

  const getWarStatusIcon = (inWarMode: boolean): string => {
    return inWarMode ? '⚔️' : '🕊️';
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', marginTop: '80px' }}>
        Loading alliance data...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', color: 'red', marginTop: '80px' }}>
        Error: {error}
      </div>
    );
  }

  if (!allianceId) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#666', marginTop: '80px' }}>
        Please select an alliance to view overview data.
      </div>
    );
  }

  if (!alliance) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#666', marginTop: '80px' }}>
        Alliance not found.
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', marginTop: '80px' }}>
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
          <h3>{alliance.name} Aid Offers, by receiving/sending alliance</h3>
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

      {/* Aid Slots Table */}
      {getFilteredAidSlots().length > 0 && (
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

      {getFilteredAidSlots().length === 0 && !loading && (
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

export default AidPage;
