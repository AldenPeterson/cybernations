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
      <div className="p-5 text-center mt-20">
        Loading recommendations...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5 text-error mt-20">
        Error: {error}
      </div>
    );
  }

  if (!allianceId) {
    return (
      <div className="text-center p-10 text-gray-600 mt-20">
        Please select an alliance to view aid recommendations.
      </div>
    );
  }

  if (!alliance) {
    return (
      <div className="text-center p-10 text-gray-600 mt-20">
        Alliance not found.
      </div>
    );
  }

  return (
    <div className="p-5 font-sans mt-20">
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
  );
};

export default RecommendationsPage;
