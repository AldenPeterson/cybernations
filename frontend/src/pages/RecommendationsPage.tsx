import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import SlotCountsSummary from '../components/SlotCountsSummary';
import WarStatusBadge from '../components/WarStatusBadge';
import { apiCall, API_ENDPOINTS } from '../utils/api';

interface Alliance {
  id: number;
  name: string;
  nationCount: number;
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

const RecommendationsPage: React.FC = () => {
  const { allianceId } = useParams<{ allianceId: string }>();
  const [alliance, setAlliance] = useState<Alliance | null>(null);
  const [recommendations, setRecommendations] = useState<AidRecommendation[]>([]);
  const [slotCounts, setSlotCounts] = useState<SlotCounts | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [crossAllianceEnabled, setCrossAllianceEnabled] = useState<boolean>(true);

  useEffect(() => {
    if (allianceId) {
      fetchAllianceData(parseInt(allianceId));
    }
  }, [allianceId, crossAllianceEnabled]);

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

      // Fetch recommendations
      try {
        const recommendationsResponse = await apiCall(`${API_ENDPOINTS.allianceRecommendations(id)}?crossAlliance=${crossAllianceEnabled}`);
        const recommendationsData = await recommendationsResponse.json();
        
        if (recommendationsData.success) {
          setRecommendations(recommendationsData.recommendations);
          setSlotCounts(recommendationsData.slotCounts);
        }
      } catch (err) {
        console.error('Failed to fetch recommendations:', err);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch alliance data');
    } finally {
      setLoading(false);
    }
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

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', marginTop: '80px' }}>
        Loading recommendations...
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
        Please select an alliance to view aid recommendations.
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
      <h1>{alliance.name} - Aid Recommendations</h1>

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
  );
};

export default RecommendationsPage;
