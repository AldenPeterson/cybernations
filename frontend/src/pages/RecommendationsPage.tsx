import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import SlotCountsSummary from '../components/SlotCountsSummary';
import WarStatusBadge from '../components/WarStatusBadge';
import { apiCall, API_ENDPOINTS } from '../utils/api';
import PageContainer from '../components/PageContainer';

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

interface AvailableSlot {
  nation: {
    id: number;
    nationName: string;
    rulerName: string;
    inWarMode: boolean;
  };
  available: number;
}

interface AvailableSlots {
  sendCash: AvailableSlot[];
  sendTech: AvailableSlot[];
  getCash: AvailableSlot[];
  getTech: AvailableSlot[];
  external: AvailableSlot[];
}

interface MismatchedOffer {
  aidId: number;
  declaringId: number;
  declaringNation: string;
  declaringRuler: string;
  receivingId: number;
  receivingNation: string;
  receivingRuler: string;
  money: number;
  technology: number;
  direction: 'sent' | 'received';
  type: 'cash' | 'tech';
  date: string;
  reason: string;
  mismatchReason?: string;
}

interface MismatchedOffers {
  allianceOffers: {
    sendCash: Array<{ nation: any; offers: MismatchedOffer[] }>;
    sendTech: Array<{ nation: any; offers: MismatchedOffer[] }>;
    getCash: Array<{ nation: any; offers: MismatchedOffer[] }>;
    getTech: Array<{ nation: any; offers: MismatchedOffer[] }>;
  };
  externalMismatches: Array<{ nation: any; offers: MismatchedOffer[] }>;
}

interface UnfilledSlot {
  nation: {
    id: number;
    nationName: string;
    rulerName: string;
    inWarMode: boolean;
  };
  assigned: number;
  used: number;
  unfilled: number;
}

interface UnfilledSlots {
  sendCash: UnfilledSlot[];
  sendTech: UnfilledSlot[];
  getCash: UnfilledSlot[];
  getTech: UnfilledSlot[];
  external: UnfilledSlot[];
}

interface AlertNation {
  nationId: number;
  nationName: string;
  rulerName: string;
  discord_handle?: string;
  daysRemaining?: number;
  daysOld?: number;
  tech?: number;
  offerId: number;
  senderName?: string;
  senderRuler?: string;
  recipientName?: string;
  recipientRuler?: string;
}

interface Alerts {
  nationsNeedingAcceptance: AlertNation[];
  nationsWithUnacceptedTech: AlertNation[];
  nationsWithOldReceivedOffers: AlertNation[];
  nationsWithOldTechOffers: AlertNation[];
}

const RecommendationsPage: React.FC = () => {
  const { allianceId } = useParams<{ allianceId: string }>();
  const [alliance, setAlliance] = useState<Alliance | null>(null);
  const [recommendations, setRecommendations] = useState<AidRecommendation[]>([]);
  const [slotCounts, setSlotCounts] = useState<SlotCounts | null>(null);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlots | null>(null);
  const [mismatchedOffers, setMismatchedOffers] = useState<MismatchedOffers | null>(null);
  const [unfilledSlots, setUnfilledSlots] = useState<UnfilledSlots | null>(null);
  const [alerts, setAlerts] = useState<Alerts | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [crossAllianceEnabled, setCrossAllianceEnabled] = useState<boolean>(false);

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
          setAvailableSlots(recommendationsData.availableSlots || null);
          setMismatchedOffers(recommendationsData.mismatchedOffers || null);
          setUnfilledSlots(recommendationsData.unfilledSlots || null);
          setAlerts(recommendationsData.alerts || null);
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
    const discordLines: string[] = [];

    // Add alerts section if there are any
    if (alerts) {
      const hasAlerts = alerts.nationsNeedingAcceptance.length > 0 || 
                       alerts.nationsWithUnacceptedTech.length > 0 ||
                       alerts.nationsWithOldReceivedOffers.length > 0 ||
                       alerts.nationsWithOldTechOffers.length > 0;
      
      if (hasAlerts) {
        discordLines.push('⚠️ ALERTS:');
        discordLines.push('');
        
        // Nations needing to accept offers
        if (alerts.nationsNeedingAcceptance.length > 0) {
          alerts.nationsNeedingAcceptance.forEach(nation => {
            const handle = nation.discord_handle || nation.rulerName;
            discordLines.push(`@${handle} - ACCEPT OFFER from ${nation.senderRuler} (${nation.daysRemaining} day${nation.daysRemaining !== 1 ? 's' : ''} remaining)`);
          });
          discordLines.push('');
        }
        
        // Nations with unaccepted tech offers and < 100 tech
        if (alerts.nationsWithUnacceptedTech.length > 0) {
          alerts.nationsWithUnacceptedTech.forEach(nation => {
            const handle = nation.discord_handle || nation.rulerName;
            discordLines.push(`@${handle} - Unaccepted tech offer to ${nation.recipientRuler} (${nation.tech} tech)`);
          });
          discordLines.push('');
        }
        
        // Nations with received offers that are 5+ days old
        if (alerts.nationsWithOldReceivedOffers.length > 0) {
          alerts.nationsWithOldReceivedOffers.forEach(nation => {
            const handle = nation.discord_handle || nation.rulerName;
            discordLines.push(`@${handle} - Received offer from ${nation.senderRuler} is ${nation.daysOld} day${nation.daysOld !== 1 ? 's' : ''} old`);
          });
          discordLines.push('');
        }
        
        // Nations with tech offers that are more than 3 days old but less than 100 tech
        if (alerts.nationsWithOldTechOffers.length > 0) {
          alerts.nationsWithOldTechOffers.forEach(nation => {
            const handle = nation.discord_handle || nation.rulerName;
            discordLines.push(`@${handle} - Tech offer to ${nation.recipientRuler} is ${nation.daysOld} day${nation.daysOld !== 1 ? 's' : ''} old (${nation.tech} tech)`);
          });
          discordLines.push('');
        }
      }
    }

    // Add recommendations section
    if (recommendations.length === 0) {
      if (discordLines.length === 0) {
        return 'No aid recommendations available.';
      }
      return discordLines.join('\n');
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
        const aidUrl = `https://www.cybernations.net/aid_form.asp?Nation_ID=${rec.recipient.id}&bynation=${rec.sender.id}`;
        discordLines.push(`send ${aidType} to [${rec.recipient.rulerName}](${aidUrl})${crossAllianceIndicator}`)
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
      <PageContainer className="p-5 text-center">
        Loading recommendations...
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer className="p-5 text-error">
        Error: {error}
      </PageContainer>
    );
  }

  if (!allianceId) {
    return (
      <PageContainer className="text-center p-10 text-gray-400">
        Please select an alliance to view aid recommendations.
      </PageContainer>
    );
  }

  if (!alliance) {
    return (
      <PageContainer className="text-center p-10 text-gray-400">
        Alliance not found.
      </PageContainer>
    );
  }

  return (
    <PageContainer className="p-5">
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
        <div className="mb-5 p-4 bg-transparent rounded-lg border border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="m-0 text-gray-200">Aid Recommendations</h3>
            <button
              onClick={copyDiscordText}
              className="bg-[#5865F2] text-white border-none px-4 py-2 rounded-md cursor-pointer text-sm font-bold flex items-center gap-2 hover:bg-[#4752C4] transition-colors"
            >
              📋 Copy Discord Text
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-700 text-sm bg-gray-800">
              <thead>
                <tr className="bg-gray-700">
                  <th className="p-3 border border-gray-600 text-left bg-gray-700 text-white font-bold">
                    Sender
                  </th>
                  <th className="p-3 border border-gray-600 text-left bg-gray-700 text-white font-bold">
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
                    <tr key={groupIndex} className="bg-gray-800 hover:bg-gray-700">
                      <td className="p-2 border border-gray-700 text-gray-200 bg-gray-800 align-top w-[30%]">
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
                          <small className="text-gray-400">{group.sender.rulerName}</small>
                        </div>
                      </td>
                      <td className="p-2 border border-gray-700 text-gray-200 bg-gray-800 align-top">
                        {group.recipients.map((rec, recIndex) => (
                          <div 
                            key={recIndex}
                            className={recIndex < group.recipients.length - 1 ? 'mb-2 pb-2 border-b border-gray-700' : ''}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center flex-wrap">
                                <span 
                                  className="text-[11px] px-1 py-px rounded-sm font-bold mr-1.5"
                                  style={{ 
                                    backgroundColor: rec.priority === 0 ? '#7f1d1d' : 
                                      (rec.type && rec.type.includes('cross_alliance')) ? '#78350f' : '#14532d',
                                    color: rec.priority === 0 ? '#fca5a5' : 
                                      (rec.type && rec.type.includes('cross_alliance')) ? '#fbbf24' : '#86efac'
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
                                <span className="text-[11px] text-gray-400 italic mr-1.5">
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
        <div className="text-center p-10 text-gray-400">
          No aid recommendations available for this alliance.
        </div>
      )}

      {/* Alerts Section */}
      {alerts && (
        (alerts.nationsNeedingAcceptance.length > 0 || 
         alerts.nationsWithUnacceptedTech.length > 0) && (
          <div className="mb-5 p-4 bg-transparent rounded-lg border border-orange-600">
            <h3 className="m-0 mb-4 text-lg font-bold text-orange-400">⚠️ Alerts</h3>
            
            {/* Nations needing to accept offers */}
            {alerts.nationsNeedingAcceptance.length > 0 && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded">
                <div className="font-bold text-sm mb-2 text-red-400">Nations needing to accept aid</div>
                <div className="space-y-1">
                  {alerts.nationsNeedingAcceptance.map((nation) => (
                    <div key={nation.offerId} className="text-sm text-gray-200">
                      <a 
                        href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${nation.nationId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 font-medium hover:underline"
                      >
                        {nation.nationName}
                      </a>
                      {' '}({nation.rulerName}) - ACCEPT OFFER from {nation.senderRuler} ({nation.daysRemaining} day{nation.daysRemaining !== 1 ? 's' : ''} remaining)
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Nations with unaccepted tech offers */}
            {alerts.nationsWithUnacceptedTech.length > 0 && (
              <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-700 rounded">
                <div className="font-bold text-sm mb-2 text-yellow-400">Nations with insufficient tech to fill aid offers</div>
                <div className="space-y-1">
                  {alerts.nationsWithUnacceptedTech.map((nation) => (
                    <div key={nation.offerId} className="text-sm text-gray-200">
                      <a 
                        href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${nation.nationId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 font-medium hover:underline"
                      >
                        {nation.nationName}
                      </a>
                      {' '}({nation.rulerName}) - Unaccepted tech offer to {nation.recipientRuler} ({nation.tech} tech)
                    </div>
                  ))}
                </div>
              </div>
            )}
            
          </div>
        )
      )}

      {/* Available Slots Section */}
      {availableSlots && (
        <div className="mb-5 p-4 bg-transparent rounded-lg border border-gray-700">
          <h3 className="m-0 mb-4 text-lg font-bold text-gray-200">Available Unassigned Slots</h3>
          
          {/* Send Types */}
          <div className="mb-4">
            <h4 className="text-sm font-bold mb-2 text-gray-200">Send Types</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Send Cash */}
              {availableSlots.sendCash.length > 0 && (
                <div className="p-3 bg-yellow-900/10 border border-yellow-800 rounded">
                  <div className="font-bold text-sm mb-2 text-yellow-500">💰 Send Cash ({availableSlots.sendCash.reduce((sum, s) => sum + s.available, 0)} total)</div>
                  <div className="space-y-1">
                    {availableSlots.sendCash.map((slot) => (
                      <div key={slot.nation.id} className="text-sm flex items-center justify-between gap-3">
                        <span className="text-gray-200">
                          <a 
                            href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${slot.nation.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 font-medium no-underline hover:underline"
                          >
                            {slot.nation.nationName}
                          </a>
                          {' '}<span className="text-gray-400">({slot.nation.rulerName})</span>
                        </span>
                        <span className="font-bold text-yellow-500 text-base flex-shrink-0">{slot.available}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Send Tech */}
              {availableSlots.sendTech.length > 0 && (
                <div className="p-3 bg-purple-900/20 border border-purple-700 rounded">
                  <div className="font-bold text-sm mb-2 text-purple-400">🔬 Send Tech ({availableSlots.sendTech.reduce((sum, s) => sum + s.available, 0)} total)</div>
                  <div className="space-y-1">
                    {availableSlots.sendTech.map((slot) => (
                      <div key={slot.nation.id} className="text-sm flex items-center justify-between gap-3">
                        <span className="text-gray-200">
                          <a 
                            href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${slot.nation.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 font-medium no-underline hover:underline"
                          >
                            {slot.nation.nationName}
                          </a>
                          {' '}<span className="text-gray-400">({slot.nation.rulerName})</span>
                        </span>
                        <span className="font-bold text-purple-400 text-base flex-shrink-0">{slot.available}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Receive Types */}
          <div className="mb-4">
            <h4 className="text-sm font-bold mb-2 text-gray-200">Receive Types</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Get Cash */}
              {availableSlots.getCash.length > 0 && (
                <div className="p-3 bg-green-900/20 border border-green-700 rounded">
                  <div className="font-bold text-sm mb-2 text-green-400">💰 Get Cash ({availableSlots.getCash.reduce((sum, s) => sum + s.available, 0)} total)</div>
                  <div className="space-y-1">
                    {availableSlots.getCash.map((slot) => (
                      <div key={slot.nation.id} className="text-sm flex items-center justify-between gap-3">
                        <span className="text-gray-200">
                          <a 
                            href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${slot.nation.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 font-medium no-underline hover:underline"
                          >
                            {slot.nation.nationName}
                          </a>
                          {' '}<span className="text-gray-400">({slot.nation.rulerName})</span>
                        </span>
                        <span className="font-bold text-green-400 text-base flex-shrink-0">{slot.available}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Get Tech */}
              {availableSlots.getTech.length > 0 && (
                <div className="p-3 bg-blue-900/20 border border-blue-700 rounded">
                  <div className="font-bold text-sm mb-2 text-blue-400">🔬 Get Tech ({availableSlots.getTech.reduce((sum, s) => sum + s.available, 0)} total)</div>
                  <div className="space-y-1">
                    {availableSlots.getTech.map((slot) => (
                      <div key={slot.nation.id} className="text-sm flex items-center justify-between gap-3">
                        <span className="text-gray-200">
                          <a 
                            href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${slot.nation.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 font-medium no-underline hover:underline"
                          >
                            {slot.nation.nationName}
                          </a>
                          {' '}<span className="text-gray-400">({slot.nation.rulerName})</span>
                        </span>
                        <span className="font-bold text-blue-400 text-base flex-shrink-0">{slot.available}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* External */}
          {availableSlots.external.length > 0 && (
            <div>
              <h4 className="text-sm font-bold mb-2 text-gray-200">External</h4>
              <div className="p-3 bg-orange-900/20 border border-orange-700 rounded">
                <div className="font-bold text-sm mb-2 text-orange-400">🌐 External ({availableSlots.external.reduce((sum, s) => sum + s.available, 0)} total)</div>
                <div className="space-y-1 max-h-96 overflow-y-auto">
                  {availableSlots.external.map((slot) => (
                    <div key={slot.nation.id} className="text-sm flex items-center justify-between gap-3">
                      <span className="text-gray-200">
                        <a 
                          href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${slot.nation.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 font-medium no-underline hover:underline"
                        >
                          {slot.nation.nationName}
                        </a>
                        {' '}<span className="text-gray-400">({slot.nation.rulerName})</span>
                      </span>
                      <span className="font-bold text-orange-400 text-base flex-shrink-0">{slot.available}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Show message if no available slots */}
          {availableSlots.sendCash.length === 0 && 
           availableSlots.sendTech.length === 0 && 
           availableSlots.getCash.length === 0 && 
           availableSlots.getTech.length === 0 && 
           availableSlots.external.length === 0 && (
            <div className="text-center p-3 text-gray-300 text-sm">
              No unassigned available slots found.
            </div>
          )}
        </div>
      )}

      {/* Mismatched Offers Section */}
      {mismatchedOffers && (
        <div className="mb-5 p-4 bg-transparent rounded-lg border border-red-700">
          <h3 className="m-0 mb-4 text-lg font-bold text-red-400">⚠️ Mismatched Offers (Exceed Configured Slots)</h3>
          
          {/* Alliance Offers Mismatches */}
          <div className="mb-4">
            <h4 className="text-sm font-bold mb-2 text-gray-200">Alliance Offers</h4>
            
            {/* Send Cash Mismatches */}
            {mismatchedOffers.allianceOffers.sendCash.length > 0 && (
              <div className="mb-3 p-3 bg-red-900/30 border border-red-700 rounded">
                <div className="font-bold text-sm mb-2 text-red-400">💰 Send Cash</div>
                {mismatchedOffers.allianceOffers.sendCash.map((item) => (
                  <div key={item.nation.id} className="mb-3 last:mb-0">
                    <div className="font-semibold text-sm text-gray-200 mb-1">
                      <a 
                        href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${item.nation.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline"
                      >
                        {item.nation.nationName}
                      </a>
                      {' '}({item.nation.rulerName}) - {item.offers.length} excess offer{item.offers.length > 1 ? 's' : ''}
                    </div>
                    <div className="ml-4 space-y-1">
                      {item.offers.map((offer) => (
                        <div key={offer.aidId} className="text-xs text-gray-300">
                          <span className="font-medium">Sent</span> to{' '}
                          <a 
                            href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${offer.receivingId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline"
                          >
                            {offer.receivingNation}
                          </a>
                          {' '}({offer.receivingRuler}): ${(offer.money / 1000000).toFixed(2)}M
                          {offer.mismatchReason && (
                            <span className="text-red-400 font-semibold ml-1">({offer.mismatchReason})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Send Tech Mismatches */}
            {mismatchedOffers.allianceOffers.sendTech.length > 0 && (
              <div className="mb-3 p-3 bg-red-900/30 border border-red-700 rounded">
                <div className="font-bold text-sm mb-2 text-red-400">🔬 Send Tech</div>
                {mismatchedOffers.allianceOffers.sendTech.map((item) => (
                  <div key={item.nation.id} className="mb-3 last:mb-0">
                    <div className="font-semibold text-sm text-gray-200 mb-1">
                      <a 
                        href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${item.nation.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline"
                      >
                        {item.nation.nationName}
                      </a>
                      {' '}({item.nation.rulerName}) - {item.offers.length} excess offer{item.offers.length > 1 ? 's' : ''}
                    </div>
                    <div className="ml-4 space-y-1">
                      {item.offers.map((offer) => (
                        <div key={offer.aidId} className="text-xs text-gray-300">
                          <span className="font-medium">Sent</span> to{' '}
                          <a 
                            href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${offer.receivingId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline"
                          >
                            {offer.receivingNation}
                          </a>
                          {' '}({offer.receivingRuler}): {offer.technology} tech
                          {offer.mismatchReason && (
                            <span className="text-red-400 font-semibold ml-1">({offer.mismatchReason})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Get Cash Mismatches */}
            {mismatchedOffers.allianceOffers.getCash.length > 0 && (
              <div className="mb-3 p-3 bg-red-900/30 border border-red-700 rounded">
                <div className="font-bold text-sm mb-2 text-red-400">💰 Get Cash</div>
                {mismatchedOffers.allianceOffers.getCash.map((item) => (
                  <div key={item.nation.id} className="mb-3 last:mb-0">
                    <div className="font-semibold text-sm text-gray-200 mb-1">
                      <a 
                        href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${item.nation.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline"
                      >
                        {item.nation.nationName}
                      </a>
                      {' '}({item.nation.rulerName}) - {item.offers.length} excess offer{item.offers.length > 1 ? 's' : ''}
                    </div>
                    <div className="ml-4 space-y-1">
                      {item.offers.map((offer) => (
                        <div key={offer.aidId} className="text-xs text-gray-300">
                          <span className="font-medium">Received</span> from{' '}
                          <a 
                            href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${offer.declaringId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline"
                          >
                            {offer.declaringNation}
                          </a>
                          {' '}({offer.declaringRuler}): ${(offer.money / 1000000).toFixed(2)}M
                          {offer.mismatchReason && (
                            <span className="text-red-400 font-semibold ml-1">({offer.mismatchReason})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Get Tech Mismatches */}
            {mismatchedOffers.allianceOffers.getTech.length > 0 && (
              <div className="mb-3 p-3 bg-red-900/30 border border-red-700 rounded">
                <div className="font-bold text-sm mb-2 text-red-400">🔬 Get Tech</div>
                {mismatchedOffers.allianceOffers.getTech.map((item) => (
                  <div key={item.nation.id} className="mb-3 last:mb-0">
                    <div className="font-semibold text-sm text-gray-200 mb-1">
                      <a 
                        href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${item.nation.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline"
                      >
                        {item.nation.nationName}
                      </a>
                      {' '}({item.nation.rulerName}) - {item.offers.length} excess offer{item.offers.length > 1 ? 's' : ''}
                    </div>
                    <div className="ml-4 space-y-1">
                      {item.offers.map((offer) => (
                        <div key={offer.aidId} className="text-xs text-gray-300">
                          <span className="font-medium">Received</span> from{' '}
                          <a 
                            href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${offer.declaringId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline"
                          >
                            {offer.declaringNation}
                          </a>
                          {' '}({offer.declaringRuler}): {offer.technology} tech
                          {offer.mismatchReason && (
                            <span className="text-red-400 font-semibold ml-1">({offer.mismatchReason})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* External Mismatches */}
          {mismatchedOffers.externalMismatches.length > 0 && (
            <div>
              <h4 className="text-sm font-bold mb-2 text-gray-200">External Slot Mismatches</h4>
              <div className="p-3 bg-orange-900/30 border border-orange-700 rounded">
                <div className="text-sm text-gray-300 mb-2">
                  Nations with external slots configured but have internal (alliance) offers:
                </div>
                {mismatchedOffers.externalMismatches.map((item) => (
                  <div key={item.nation.id} className="mb-3 last:mb-0">
                    <div className="font-semibold text-sm text-gray-200 mb-1">
                      <a 
                        href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${item.nation.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline"
                      >
                        {item.nation.nationName}
                      </a>
                      {' '}({item.nation.rulerName}) - {item.offers.length} internal offer{item.offers.length > 1 ? 's' : ''}
                    </div>
                    <div className="ml-4 space-y-1">
                      {item.offers.map((offer) => (
                        <div key={offer.aidId} className="text-xs text-gray-300">
                          <span className="font-medium">{offer.direction === 'sent' ? 'Sent' : 'Received'}</span>{' '}
                          {offer.direction === 'sent' ? 'to' : 'from'}{' '}
                          <a 
                            href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${offer.direction === 'sent' ? offer.receivingId : offer.declaringId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline"
                          >
                            {offer.direction === 'sent' ? offer.receivingNation : offer.declaringNation}
                          </a>
                          {' '}({offer.direction === 'sent' ? offer.receivingRuler : offer.declaringRuler}):{' '}
                          {offer.type === 'cash' ? `$${(offer.money / 1000000).toFixed(2)}M` : `${offer.technology} tech`}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Show message if no mismatches */}
          {mismatchedOffers.allianceOffers.sendCash.length === 0 && 
           mismatchedOffers.allianceOffers.sendTech.length === 0 && 
           mismatchedOffers.allianceOffers.getCash.length === 0 && 
           mismatchedOffers.allianceOffers.getTech.length === 0 && 
           mismatchedOffers.externalMismatches.length === 0 && (
            <div className="text-center p-3 text-gray-300 text-sm">
              No mismatched offers found. All offers map correctly to configured slots.
            </div>
          )}
        </div>
      )}

      {/* Unfilled/Used Aid Slots Section */}
      {unfilledSlots && (
        <div className="mb-5 p-4 bg-transparent rounded-lg border border-blue-700">
          <h3 className="m-0 mb-4 text-lg font-bold text-blue-400">📊 Unfilled/Used Aid Slots</h3>
          <p className="text-sm text-gray-300 mb-4">
            Comparison of assigned slots (from configuration) vs used slots (from existing aid offers)
          </p>
          
          {/* Send Types */}
          <div className="mb-4">
            <h4 className="text-sm font-bold mb-2 text-slate-900">Send Types</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Send Cash */}
              {unfilledSlots.sendCash.length > 0 && (
                <div className="p-3 bg-yellow-900/10 border border-yellow-800 rounded">
                  <div className="font-bold text-sm mb-2 text-yellow-500">
                    💰 Send Cash
                  </div>
                  <div className="space-y-2">
                    {unfilledSlots.sendCash.map((slot) => (
                      <div key={slot.nation.id} className="text-sm">
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <span className="text-gray-200">
                            <a 
                              href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${slot.nation.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 font-medium no-underline hover:underline"
                            >
                              {slot.nation.nationName}
                            </a>
                            {' '}<span className="text-gray-400">({slot.nation.rulerName})</span>
                          </span>
                        </div>
                        <div className="ml-4 text-xs text-gray-400">
                          Assigned: <span className="font-semibold">{slot.assigned}</span> | 
                          Used: <span className="font-semibold">{slot.used}</span> | 
                          Unfilled: <span className={`font-semibold ${slot.unfilled > 0 ? 'text-green-400' : 'text-gray-300'}`}>{slot.unfilled}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Send Tech */}
              {unfilledSlots.sendTech.length > 0 && (
                <div className="p-3 bg-purple-900/20 border border-purple-700 rounded">
                  <div className="font-bold text-sm mb-2 text-purple-400">
                    🔬 Send Tech
                  </div>
                  <div className="space-y-2">
                    {unfilledSlots.sendTech.map((slot) => (
                      <div key={slot.nation.id} className="text-sm">
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <span className="text-gray-200">
                            <a 
                              href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${slot.nation.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 font-medium no-underline hover:underline"
                            >
                              {slot.nation.nationName}
                            </a>
                            {' '}<span className="text-gray-400">({slot.nation.rulerName})</span>
                          </span>
                        </div>
                        <div className="ml-4 text-xs text-gray-400">
                          Assigned: <span className="font-semibold">{slot.assigned}</span> | 
                          Used: <span className="font-semibold">{slot.used}</span> | 
                          Unfilled: <span className={`font-semibold ${slot.unfilled > 0 ? 'text-green-400' : 'text-gray-300'}`}>{slot.unfilled}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Receive Types */}
          <div className="mb-4">
            <h4 className="text-sm font-bold mb-2 text-gray-200">Receive Types</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Get Cash */}
              {unfilledSlots.getCash.length > 0 && (
                <div className="p-3 bg-green-900/20 border border-green-700 rounded">
                  <div className="font-bold text-sm mb-2 text-green-400">
                    💰 Get Cash
                  </div>
                  <div className="space-y-2">
                    {unfilledSlots.getCash.map((slot) => (
                      <div key={slot.nation.id} className="text-sm">
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <span className="text-gray-200">
                            <a 
                              href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${slot.nation.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 font-medium no-underline hover:underline"
                            >
                              {slot.nation.nationName}
                            </a>
                            {' '}<span className="text-gray-400">({slot.nation.rulerName})</span>
                          </span>
                        </div>
                        <div className="ml-4 text-xs text-gray-400">
                          Assigned: <span className="font-semibold">{slot.assigned}</span> | 
                          Used: <span className="font-semibold">{slot.used}</span> | 
                          Unfilled: <span className={`font-semibold ${slot.unfilled > 0 ? 'text-green-400' : 'text-gray-300'}`}>{slot.unfilled}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Get Tech */}
              {unfilledSlots.getTech.length > 0 && (
                <div className="p-3 bg-blue-900/20 border border-blue-700 rounded">
                  <div className="font-bold text-sm mb-2 text-blue-400">
                    🔬 Get Tech
                  </div>
                  <div className="space-y-2">
                    {unfilledSlots.getTech.map((slot) => (
                      <div key={slot.nation.id} className="text-sm">
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <span className="text-gray-200">
                            <a 
                              href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${slot.nation.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 font-medium no-underline hover:underline"
                            >
                              {slot.nation.nationName}
                            </a>
                            {' '}<span className="text-gray-400">({slot.nation.rulerName})</span>
                          </span>
                        </div>
                        <div className="ml-4 text-xs text-gray-400">
                          Assigned: <span className="font-semibold">{slot.assigned}</span> | 
                          Used: <span className="font-semibold">{slot.used}</span> | 
                          Unfilled: <span className={`font-semibold ${slot.unfilled > 0 ? 'text-green-400' : 'text-gray-300'}`}>{slot.unfilled}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* External */}
          {unfilledSlots.external.length > 0 && (
            <div>
              <h4 className="text-sm font-bold mb-2 text-gray-200">External</h4>
              <div className="p-3 bg-orange-900/20 border border-orange-700 rounded">
                <div className="font-bold text-sm mb-2 text-orange-400">🌐 External</div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {unfilledSlots.external.map((slot) => (
                    <div key={slot.nation.id} className="text-sm">
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <span className="text-gray-200">
                          <a 
                            href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${slot.nation.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 font-medium no-underline hover:underline"
                          >
                            {slot.nation.nationName}
                          </a>
                          {' '}<span className="text-slate-600">({slot.nation.rulerName})</span>
                        </span>
                      </div>
                      <div className="ml-4 text-xs text-slate-600">
                        Assigned: <span className="font-semibold">{slot.assigned}</span> | 
                        Used: <span className="font-semibold">{slot.used}</span> | 
                        Unfilled: <span className={`font-semibold ${slot.unfilled > 0 ? 'text-green-700' : 'text-slate-700'}`}>{slot.unfilled}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Show message if no unfilled slots data */}
          {unfilledSlots.sendCash.length === 0 && 
           unfilledSlots.sendTech.length === 0 && 
           unfilledSlots.getCash.length === 0 && 
           unfilledSlots.getTech.length === 0 && 
           unfilledSlots.external.length === 0 && (
            <div className="text-center p-3 text-gray-300 text-sm">
              No slot data available.
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
};

export default RecommendationsPage;
