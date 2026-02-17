import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { apiCallWithErrorHandling, API_ENDPOINTS } from '../utils/api';
import { useAlliances } from '../contexts/AlliancesContext';
import PageContainer from '../components/PageContainer';
import { EMPTY_CELL_BG } from '../styles/tableClasses';
import RecommendationsPage from './RecommendationsPage';

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
  missingSlotType?: string; // 'sendCash' | 'sendTech' | 'getCash' | 'getTech'
}

interface NationAidSlots {
  nation: {
    id: number;
    rulerName: string;
    nationName: string;
    strength: number;
    activity: string;
    inWarMode: boolean;
    technology?: string;
    infrastructure?: string;
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

interface ActiveAidByAlliance {
  allianceId: number;
  allianceName: string;
  sentOffers: number;
  receivedOffers: number;
}

interface AidRecommendation {
  sender: {
    id: number;
    nationName: string;
    rulerName: string;
  };
  recipient: {
    id: number;
    nationName: string;
    rulerName: string;
  };
  type: string;
  priority: number;
  reason: string;
  previousOffer?: {
    money: number;
    technology: number;
    soldiers: number;
    reason: string;
  };
}

interface NationSlots {
  sendTech: number;
  sendCash: number;
  getTech: number;
  getCash: number;
  external: number;
  send_priority: number;
  receive_priority: number;
}

interface NationConfig {
  nation_id: number;
  slots: NationSlots;
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

const AidPage: React.FC = () => {
  const { allianceId } = useParams<{ allianceId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { alliances, loading: alliancesLoading } = useAlliances();
  const [alliance, setAlliance] = useState<Alliance | null>(null);
  
  // Tab state - sync with URL parameter
  const [activeTab, setActiveTab] = useState<'overview' | 'recommendations'>('overview');
  const [aidSlots, setAidSlots] = useState<NationAidSlots[]>([]);
  const [allianceStats, setAllianceStats] = useState<AllianceStats | null>(null);
  const [allianceAidStats, setAllianceAidStats] = useState<AllianceAidStats[]>([]);
  const [activeAidByAlliance, setActiveAidByAlliance] = useState<ActiveAidByAlliance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [recommendations, setRecommendations] = useState<AidRecommendation[]>([]);
  const [availableSlots, setAvailableSlots] = useState<{ external?: Array<{ nation: { id: number; nationName: string; rulerName: string; inWarMode: boolean }; available: number }> } | null>(null);
  const [nationsConfig, setNationsConfig] = useState<NationConfig[]>([]);
  const [mismatchedOffers, setMismatchedOffers] = useState<MismatchedOffers | null>(null);
  
  // State for collapsible sections
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const [isActiveAidTableExpanded, setIsActiveAidTableExpanded] = useState(false);
  const [expandedNationCards, setExpandedNationCards] = useState<Set<number>>(new Set());
  
  // Ref to track the last fetched allianceId to prevent duplicate requests
  const lastFetchedAllianceId = useRef<number | null>(null);
  const isFetchingRef = useRef<boolean>(false);

  // Helper function to parse boolean from URL parameter
  const parseBooleanParam = (value: string | null, defaultValue: boolean = false): boolean => {
    if (value === null) return defaultValue;
    return value.toLowerCase() === 'true';
  };

  // Helper function to update URL parameters
  const updateUrlParams = useCallback((updates: Record<string, string | null>) => {
    const newSearchParams = new URLSearchParams(searchParams);
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') {
        newSearchParams.delete(key);
      } else {
        newSearchParams.set(key, value);
      }
    });
    
    setSearchParams(newSearchParams, { replace: true });
  }, [searchParams, setSearchParams]);

  // Initialize showRecommendations from URL parameter (only once on mount)
  useEffect(() => {
    setShowRecommendations(parseBooleanParam(searchParams.get('showRecommendations')));
  }, []); // Empty dependency array - only run on mount

  // Initialize and sync active tab from URL parameter
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'recommendations') {
      setActiveTab('recommendations');
    } else {
      setActiveTab('overview');
    }
  }, [searchParams]);

  // Update alliance when alliances load or allianceId changes
  useEffect(() => {
    if (allianceId && alliances.length > 0) {
      const foundAlliance = alliances.find((a: Alliance) => a.id === parseInt(allianceId));
      setAlliance(foundAlliance || null);
    }
  }, [allianceId, alliances]);

  // Memoize fetchAllianceData to prevent unnecessary re-creations
  const fetchAllianceData = useCallback(async (id: number) => {
    // Prevent duplicate concurrent requests for the same allianceId
    if (isFetchingRef.current && lastFetchedAllianceId.current === id) {
      return;
    }
    
    isFetchingRef.current = true;
    lastFetchedAllianceId.current = id;
    
    try {
      setLoading(true);
      setError(null);

      // Fetch all data in parallel for better performance
      const [aidSlotsData, statsData, aidStatsData, activeAidData] = await Promise.all([
        apiCallWithErrorHandling(API_ENDPOINTS.allianceAidSlots(id)).catch(err => {
          console.error('Failed to fetch aid slots:', err);
          return { success: false, aidSlots: [] };
        }),
        apiCallWithErrorHandling(API_ENDPOINTS.allianceStats(id)).catch(err => {
          console.error('Failed to fetch alliance stats:', err);
          return { success: false, stats: null };
        }),
        apiCallWithErrorHandling(API_ENDPOINTS.allianceAidStats(id)).catch(err => {
          console.error('Failed to fetch alliance aid stats:', err);
          return { success: false, allianceAidStats: [] };
        }),
        apiCallWithErrorHandling(API_ENDPOINTS.activeAidByAlliance(id)).catch(err => {
          console.error('Failed to fetch active aid by alliance:', err);
          return { success: false, allianceAidStats: [] };
        }),
      ]);

      // Process aid slots
      if (aidSlotsData.success) {
        setAidSlots(aidSlotsData.aidSlots);
      } else {
        setError(aidSlotsData.error || 'Failed to fetch aid slots');
      }

      // Process alliance stats
      if (statsData.success) {
        setAllianceStats(statsData.stats);
      }

      // Process alliance aid stats
      // Backend returns 'stats' but frontend expects 'allianceAidStats' array
      // For now, handle both formats
      if (aidStatsData.success) {
        if (Array.isArray(aidStatsData.allianceAidStats)) {
          setAllianceAidStats(aidStatsData.allianceAidStats);
        } else if (aidStatsData.stats) {
          // Backend returns single stats object, convert to array format if needed
          // This is a temporary fix - the endpoint should return per-alliance breakdown
          setAllianceAidStats([]);
        } else {
          setAllianceAidStats([]);
        }
      }

      // Process active aid by alliance
      if (activeAidData.success) {
        if (Array.isArray(activeAidData.allianceAidStats)) {
          setActiveAidByAlliance(activeAidData.allianceAidStats);
        } else {
          setActiveAidByAlliance([]);
        }
      }

    } catch (err) {
      console.error('Error in fetchAllianceData:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch alliance data');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []); // Empty deps - function doesn't depend on any props/state

  const fetchRecommendations = useCallback(async (id: number) => {
    try {
      const recommendationsData = await apiCallWithErrorHandling(API_ENDPOINTS.allianceRecommendations(id));
      
      if (recommendationsData.success) {
        setRecommendations(recommendationsData.recommendations || []);
        setAvailableSlots(recommendationsData.availableSlots || null);
        setMismatchedOffers(recommendationsData.mismatchedOffers || null);
      }
    } catch (err) {
      console.error('Failed to fetch recommendations:', err);
      setRecommendations([]);
      setAvailableSlots(null);
      setMismatchedOffers(null);
    }
  }, []);

  useEffect(() => {
    const parsedAllianceId = allianceId ? parseInt(allianceId) : null;
    
    // Only fetch if:
    // 1. We have an allianceId
    // 2. Alliances have finished loading
    // 3. This is a different allianceId than the last one we fetched
    if (parsedAllianceId && !alliancesLoading && lastFetchedAllianceId.current !== parsedAllianceId) {
      fetchAllianceData(parsedAllianceId);
    }
  }, [allianceId, alliancesLoading, fetchAllianceData]);

  useEffect(() => {
    if (showRecommendations && allianceId) {
      fetchRecommendations(parseInt(allianceId));
    } else {
      setRecommendations([]);
      setAvailableSlots(null);
      setNationsConfig([]);
      setMismatchedOffers(null);
    }
  }, [showRecommendations, allianceId, fetchRecommendations]);

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

  // Decode HTML entities that come from the backend
  // React will automatically escape HTML in JSX, so we just need to decode first
  const decodeHtmlEntities = (text: string): string => {
    if (!text) return '';
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  };

  // Column and header classes (following WarManagementTable pattern)
  const columnClasses = {
    nation: 'p-2 border border-slate-300 min-w-[110px] max-w-[140px] w-[120px] sticky left-0 z-[100] shadow-[2px_0_8px_-2px_rgba(0,0,0,0.3),1px_0_0_0_#999]',
    aidSlot: 'p-2 border border-slate-300 text-center'
  };

  const headerClasses = {
    nation: 'p-3 border border-slate-300 text-left text-white font-bold sticky left-0 z-[200] bg-gray-800 shadow-[2px_0_8px_-2px_rgba(0,0,0,0.3),1px_0_0_0_#999]',
    aidSlot: 'p-3 border border-slate-300 text-center text-white font-bold'
  };

  // Calculate equal width for each of the 6 aid slot columns
  // Nation column is 120px, so each slot gets: (100% - 120px) / 6
  const slotWidth = 'calc((100% - 120px) / 6)';

  // Sort allianceAidStats alphabetically by alliance name
  const sortedAllianceAidStats = useMemo(() => {
    return [...allianceAidStats].sort((a, b) => {
      const aName = (a.allianceName || '').toLowerCase();
      const bName = (b.allianceName || '').toLowerCase();
      return aName.localeCompare(bName);
    });
  }, [allianceAidStats]);

  // Sort activeAidByAlliance alphabetically by alliance name
  const sortedActiveAidByAlliance = useMemo(() => {
    return [...activeAidByAlliance].sort((a, b) => {
      const aName = (a.allianceName || '').toLowerCase();
      const bName = (b.allianceName || '').toLowerCase();
      return aName.localeCompare(bName);
    });
  }, [activeAidByAlliance]);

  // Calculate missing slots for a nation
  const calculateMissingSlots = (nationId: number, nationAidSlots: NationAidSlots): Array<{ type: string; isOutgoing: boolean }> => {
    if (!showRecommendations) return [];
    
    const nationConfig = nationsConfig.find(nc => nc.nation_id === nationId);
    if (!nationConfig) return [];

    const missingSlots: Array<{ type: string; isOutgoing: boolean }> = [];

    // Count actual filled slots by type (only real offers, not recommendations)
    const filledSendCash = nationAidSlots.aidSlots.filter(slot => 
      slot.isOutgoing && slot.aidOffer && slot.aidOffer.aidId > 0 && slot.aidOffer.money > 0 && slot.aidOffer.technology === 0
    ).length;
    const filledSendTech = nationAidSlots.aidSlots.filter(slot => 
      slot.isOutgoing && slot.aidOffer && slot.aidOffer.aidId > 0 && slot.aidOffer.technology > 0
    ).length;
    const filledGetCash = nationAidSlots.aidSlots.filter(slot => 
      !slot.isOutgoing && slot.aidOffer && slot.aidOffer.aidId > 0 && slot.aidOffer.money > 0 && slot.aidOffer.technology === 0
    ).length;
    const filledGetTech = nationAidSlots.aidSlots.filter(slot => 
      !slot.isOutgoing && slot.aidOffer && slot.aidOffer.aidId > 0 && slot.aidOffer.technology > 0
    ).length;

    // Calculate missing slots
    const missingSendCash = Math.max(0, nationConfig.slots.sendCash - filledSendCash);
    const missingSendTech = Math.max(0, nationConfig.slots.sendTech - filledSendTech);
    const missingGetCash = Math.max(0, nationConfig.slots.getCash - filledGetCash);
    const missingGetTech = Math.max(0, nationConfig.slots.getTech - filledGetTech);

    // Add missing slots to array
    for (let i = 0; i < missingSendCash; i++) {
      missingSlots.push({ type: 'sendCash', isOutgoing: true });
    }
    for (let i = 0; i < missingSendTech; i++) {
      missingSlots.push({ type: 'sendTech', isOutgoing: true });
    }
    for (let i = 0; i < missingGetCash; i++) {
      missingSlots.push({ type: 'getCash', isOutgoing: false });
    }
    for (let i = 0; i < missingGetTech; i++) {
      missingSlots.push({ type: 'getTech', isOutgoing: false });
    }

    return missingSlots;
  };

  // Check if an aid offer is mismatched
  const isMismatchedOffer = (offer: AidOffer, nationId: number, isOutgoing: boolean): boolean => {
    if (!showRecommendations || !mismatchedOffers || offer.aidId < 0) return false;

    const nationConfig = nationsConfig.find(nc => nc.nation_id === nationId);
    if (!nationConfig) return false;

    // Check if this offer is in the mismatched offers list
    const isCash = offer.money > 0 && offer.technology === 0;
    const isTech = offer.technology > 0;

    if (isOutgoing) {
      if (isCash) {
        const mismatches = mismatchedOffers.allianceOffers.sendCash.find(m => m.nation.id === nationId);
        return mismatches?.offers.some(m => m.aidId === offer.aidId) || false;
      } else if (isTech) {
        const mismatches = mismatchedOffers.allianceOffers.sendTech.find(m => m.nation.id === nationId);
        return mismatches?.offers.some(m => m.aidId === offer.aidId) || false;
      }
    } else {
      if (isCash) {
        const mismatches = mismatchedOffers.allianceOffers.getCash.find(m => m.nation.id === nationId);
        return mismatches?.offers.some(m => m.aidId === offer.aidId) || false;
      } else if (isTech) {
        const mismatches = mismatchedOffers.allianceOffers.getTech.find(m => m.nation.id === nationId);
        return mismatches?.offers.some(m => m.aidId === offer.aidId) || false;
      }
    }

    return false;
  };

  const mergeRecommendationsIntoSlots = (nationAidSlots: NationAidSlots[]): NationAidSlots[] => {
    if (!showRecommendations) {
      return nationAidSlots;
    }

    // Helper function to create a recommendation offer
    const createRecommendationOffer = (rec: AidRecommendation, nationId: number): AidOffer => {
      const isOutgoingRec = rec.sender.id === nationId;
      
      // Determine aid amounts from recommendation type or previousOffer
      let money = 0;
      let technology = 0;
      let soldiers = 0;

      if (rec.previousOffer) {
        money = rec.previousOffer.money;
        technology = rec.previousOffer.technology;
        soldiers = rec.previousOffer.soldiers;
      } else {
        // For new recommendations, use standard amounts based on type
        if (rec.type === 'new_cash' || rec.type === 'reestablish_cash') {
          money = 9000000; // 9M cash aid amount
        } else if (rec.type === 'new_tech' || rec.type === 'reestablish_tech') {
          technology = 100; // 100 tech aid amount
        }
      }

      return {
        aidId: -1, // Negative ID to indicate it's a recommendation
        targetNation: isOutgoingRec ? rec.recipient.nationName : rec.sender.nationName,
        targetRuler: isOutgoingRec ? rec.recipient.rulerName : rec.sender.rulerName,
        targetId: isOutgoingRec ? rec.recipient.id : rec.sender.id,
        declaringId: rec.sender.id,
        receivingId: rec.recipient.id,
        money,
        technology,
        soldiers,
        reason: rec.reason,
        date: '', // Recommendations don't have dates yet
        isExpired: false,
      };
    };

    // Helper function to create an external slot recommendation offer
    const createExternalSlotOffer = (nationId: number): AidOffer => {
      return {
        aidId: -2, // -2 to indicate it's an external slot recommendation
        targetNation: 'External Aid',
        targetRuler: 'Available',
        targetId: 0,
        declaringId: nationId,
        receivingId: 0,
        money: 0,
        technology: 0,
        soldiers: 0,
        reason: 'External aid slot available',
        date: '',
        isExpired: false,
      };
    };

    // Create a map of nations with external slots available
    const externalSlotsMap = new Map<number, number>();
    if (availableSlots?.external) {
      availableSlots.external.forEach(extSlot => {
        externalSlotsMap.set(extSlot.nation.id, extSlot.available);
      });
    }

    // Deduplicate recommendations array to ensure no duplicates exist
    // Use a Map with key "senderId-recipientId" to keep only the first occurrence
    const deduplicatedRecs = new Map<string, AidRecommendation>();
    (recommendations || []).forEach(rec => {
      if (!rec || !rec.sender || !rec.recipient || !rec.sender.id || !rec.recipient.id) {
        console.warn('Invalid recommendation found:', rec);
        return;
      }
      const recKey = `${rec.sender.id}-${rec.recipient.id}`;
      if (!deduplicatedRecs.has(recKey)) {
        deduplicatedRecs.set(recKey, rec);
      } else {
        console.warn(`Duplicate recommendation detected in API response: ${recKey}`);
      }
    });
    const uniqueRecommendations = Array.from(deduplicatedRecs.values());
    
    // Debug: log if we found duplicates
    if (recommendations && recommendations.length > uniqueRecommendations.length) {
      console.log(`Deduplicated ${recommendations.length} recommendations down to ${uniqueRecommendations.length}`);
    }

    // Create a Set of all alliance nation IDs for checking if offers are external
    // This is used to determine if an offer is external (other party not in alliance)
    const allianceNationIds = new Set(
      nationAidSlots.map(nas => nas.nation.id)
    );

    // Process each nation's slots and add recommendations to empty slots
    // Recommendations can appear in both sender and recipient rows (like real offers)
    // Create deep copy to avoid mutating the original
    return nationAidSlots.map(nationAidSlotsItem => {
      const nationId = nationAidSlotsItem.nation.id;
      // Deep copy slots array to avoid mutating the original
      const updatedSlots = nationAidSlotsItem.aidSlots.map(slot => ({
        ...slot,
        aidOffer: slot.aidOffer ? { ...slot.aidOffer } : null
      }));

      // Calculate how many external slots this nation needs
      const nationConfig = nationsConfig.find(nc => nc.nation_id === nationId);
      const configuredExternal = nationConfig?.slots.external || 0;
      
      // Count actual filled external slots for this specific nation
      let filledExternal = 0;
      nationAidSlotsItem.aidSlots.forEach(slot => {
        if (slot.aidOffer && slot.aidOffer.aidId > 0 && slot.aidOffer.aidId !== -2) {
          const otherPartyId = slot.isOutgoing 
            ? slot.aidOffer.receivingId
            : slot.aidOffer.declaringId;
          if (!allianceNationIds.has(otherPartyId)) {
            filledExternal++;
          }
        }
      });
      
      // Calculate how many external slots are needed
      const neededExternal = Math.max(0, configuredExternal - filledExternal);

      // Track which recommendations have been assigned to THIS nation's slots to prevent duplicates within the row
      // Key format: "senderId-recipientId" to uniquely identify each recommendation pair
      const assignedRecKeys = new Set<string>();

      // Find all recommendations where this nation is involved
      // For outgoing: this nation is the sender
      // For incoming: this nation is the recipient
      const allOutgoingRecs = uniqueRecommendations
        .filter(rec => rec.sender.id === nationId)
        .sort((a, b) => a.priority - b.priority);

      const allIncomingRecs = uniqueRecommendations
        .filter(rec => rec.recipient.id === nationId)
        .sort((a, b) => a.priority - b.priority);

      // Track which recommendations have been assigned using indices
      // This ensures we process each recommendation exactly once
      let outgoingIndex = 0;
      let incomingIndex = 0;
      let externalSlotsNeeded = neededExternal;

      // Fill empty slots with recommendations (prioritize external needs, then outgoing, then incoming)
      // Each recommendation can only be assigned once per nation
      updatedSlots.forEach((slot) => {
        if (!slot.aidOffer) {
          let recToAssign: AidRecommendation | null = null;

          // First, check if this nation needs external slots
          if (externalSlotsNeeded > 0) {
            slot.aidOffer = createExternalSlotOffer(nationId);
            slot.isOutgoing = true; // External slots are typically outgoing
            externalSlotsNeeded--;
          } else {
            // Try outgoing recommendations
            while (outgoingIndex < allOutgoingRecs.length) {
              const candidate = allOutgoingRecs[outgoingIndex];
              const recKey = `${candidate.sender.id}-${candidate.recipient.id}`;
              if (!assignedRecKeys.has(recKey)) {
                recToAssign = candidate;
                assignedRecKeys.add(recKey);
                outgoingIndex++;
                break; // Found one, stop looking
              }
              outgoingIndex++; // Already assigned, skip to next
            }

            // If no outgoing available, try incoming
            if (!recToAssign) {
              while (incomingIndex < allIncomingRecs.length) {
                const candidate = allIncomingRecs[incomingIndex];
                const recKey = `${candidate.sender.id}-${candidate.recipient.id}`;
                if (!assignedRecKeys.has(recKey)) {
                  recToAssign = candidate;
                  assignedRecKeys.add(recKey);
                  incomingIndex++;
                  break; // Found one, stop looking
                }
                incomingIndex++; // Already assigned, skip to next
              }
            }

            if (recToAssign) {
              const isOutgoingRec = recToAssign.sender.id === nationId;
              slot.aidOffer = createRecommendationOffer(recToAssign, nationId);
              slot.isOutgoing = isOutgoingRec;
            }
          }
        }
      });

      // Add missing slot boxes after filling recommendations
      const missingSlots = calculateMissingSlots(nationId, nationAidSlotsItem);
      
      // Group missing slots by direction
      const missingOutgoing = missingSlots.filter(ms => ms.isOutgoing);
      const missingIncoming = missingSlots.filter(ms => !ms.isOutgoing);
      
      let missingOutgoingIndex = 0;
      let missingIncomingIndex = 0;
      
      // Find empty slots and fill them with missing slot indicators
      // For empty slots, we don't rely on slot.isOutgoing (which defaults to false)
      // Instead, we assign missing slots based on their type and set isOutgoing accordingly
      updatedSlots.forEach((slot) => {
        if (!slot.aidOffer) {
          // Try outgoing missing slots first
          if (missingOutgoingIndex < missingOutgoing.length) {
            const missingSlot = missingOutgoing[missingOutgoingIndex];
            slot.aidOffer = {
              aidId: -3, // -3 to indicate it's a missing slot
              targetNation: '',
              targetRuler: '',
              targetId: 0,
              declaringId: nationId,
              receivingId: 0,
              money: 0,
              technology: 0,
              soldiers: 0,
              reason: '',
              date: '',
              isExpired: false,
            };
            slot.isOutgoing = true;
            slot.missingSlotType = missingSlot.type; // Store the type for rendering
            missingOutgoingIndex++;
          } else if (missingIncomingIndex < missingIncoming.length) {
            // Then try incoming missing slots
            const missingSlot = missingIncoming[missingIncomingIndex];
            slot.aidOffer = {
              aidId: -3, // -3 to indicate it's a missing slot
              targetNation: '',
              targetRuler: '',
              targetId: 0,
              declaringId: nationId,
              receivingId: 0,
              money: 0,
              technology: 0,
              soldiers: 0,
              reason: '',
              date: '',
              isExpired: false,
            };
            slot.isOutgoing = false;
            slot.missingSlotType = missingSlot.type; // Store the type for rendering
            missingIncomingIndex++;
          }
        }
      });

      return {
        ...nationAidSlotsItem,
        aidSlots: updatedSlots
      };
    });
  };

  // Memoize merged slots to prevent re-merging on every render
  const mergedSlots = useMemo(() => {
    if (!showRecommendations) {
      return aidSlots;
    }
    return mergeRecommendationsIntoSlots(aidSlots);
  }, [aidSlots, showRecommendations, recommendations, availableSlots]);

  const getFilteredAidSlots = (): NationAidSlots[] => {
    // Return all merged slots, sorted by nation strength (descending - highest first)
    return mergedSlots.sort((a, b) => (b.nation.strength || 0) - (a.nation.strength || 0));
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
      <PageContainer className="p-5 text-center">
        Loading alliance data...
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
        Please select an alliance to view aid data.
      </PageContainer>
    );
  }

  // Wait for alliances to load before showing "not found"
  if (alliancesLoading) {
    return (
      <PageContainer className="text-center p-10 text-gray-400">
        Loading alliances...
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
      {/* Tabs */}
      <div className="mb-6 border-b border-gray-700">
        <div className="flex gap-4">
          <button
            onClick={() => {
              setActiveTab('overview');
              const newSearchParams = new URLSearchParams(searchParams);
              newSearchParams.set('tab', 'overview');
              setSearchParams(newSearchParams, { replace: true });
            }}
            className={`px-4 py-2 font-semibold transition-colors ${
              activeTab === 'overview'
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Aid Overview
          </button>
          <button
            onClick={() => {
              setActiveTab('recommendations');
              const newSearchParams = new URLSearchParams(searchParams);
              newSearchParams.set('tab', 'recommendations');
              setSearchParams(newSearchParams, { replace: true });
            }}
            className={`px-4 py-2 font-semibold transition-colors ${
              activeTab === 'recommendations'
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Recommendations
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <>
      {/* Alliance Stats - Collapsible */}
      {allianceStats && allianceStats.totalNations > 0 && (
        <div className="mb-5 p-4 bg-transparent rounded-lg border border-slate-300">
          <div 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
          >
            <h3 className="m-0">Alliance Statistics</h3>
            <span className="text-gray-400 text-xl">
              {isSummaryExpanded ? '▼' : '▶'}
            </span>
          </div>
          {isSummaryExpanded && (
            <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5">
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
          )}
        </div>
      )}

      {/* Alliance-to-Alliance Aid Statistics */}
      {allianceAidStats && allianceAidStats.length > 0 && (
        <div className="mb-5 p-4 bg-transparent rounded-lg border border-slate-300">
          <h3>{alliance.name} Aid Offers, by receiving/sending alliance</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-700 text-sm bg-gray-800">
              <thead>
                <tr className="bg-gray-700">
                  <th className="p-3 border border-gray-600 text-left bg-gray-700 text-white font-bold">
                    Alliance
                  </th>
                  <th className="p-3 border border-gray-600 text-center bg-gray-700 text-white font-bold">
                    Received
                  </th>
                  <th className="p-3 border border-gray-600 text-center bg-gray-700 text-white font-bold">
                    Sent
                  </th>
                  <th className="p-3 border border-gray-600 text-center bg-gray-700 text-white font-bold">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedAllianceAidStats?.map((stats) => (
                  <tr key={stats.allianceId} className="bg-gray-800 hover:bg-gray-700">
                    <td className="p-2 border border-gray-700 font-bold text-gray-200 bg-gray-800">
                      {stats.allianceName}
                    </td>
                    <td className={`p-2 border border-gray-700 text-center text-gray-200 bg-gray-800 ${stats.incomingAid > 0 ? 'font-bold' : 'font-normal'}`}>
                      {stats.incomingAid}
                    </td>
                    <td className={`p-2 border border-gray-700 text-center text-gray-200 bg-gray-800 ${stats.outgoingAid > 0 ? 'font-bold' : 'font-normal'}`}>
                      {stats.outgoingAid}
                    </td>
                    <td className="p-2 border border-gray-700 text-center text-gray-200 bg-gray-800 font-bold">
                      {stats.incomingAid + stats.outgoingAid}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Active Aid Offers by Alliance - Collapsible */}
      {activeAidByAlliance && activeAidByAlliance.length > 0 && (
        <div className="mb-5 p-4 bg-transparent rounded-lg border border-slate-300">
          <div 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setIsActiveAidTableExpanded(!isActiveAidTableExpanded)}
          >
            <h3 className="m-0">Active Aid Offers by Alliance</h3>
            <span className="text-gray-400 text-xl">
              {isActiveAidTableExpanded ? '▼' : '▶'}
            </span>
          </div>
          {isActiveAidTableExpanded && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse border border-gray-700 text-sm bg-gray-800">
                <thead>
                  <tr className="bg-gray-700">
                    <th className="p-3 border border-gray-600 text-left bg-gray-700 text-white font-bold">
                      Alliance
                    </th>
                    <th className="p-3 border border-gray-600 text-center bg-gray-700 text-white font-bold">
                      Sent Offers
                    </th>
                    <th className="p-3 border border-gray-600 text-center bg-gray-700 text-white font-bold">
                      Received Offers
                    </th>
                    <th className="p-3 border border-gray-600 text-center bg-gray-700 text-white font-bold">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedActiveAidByAlliance.map((stats) => (
                    <tr key={stats.allianceId} className="bg-gray-800 hover:bg-gray-700">
                      <td className="p-2 border border-gray-700 font-bold text-gray-200 bg-gray-800">
                        {stats.allianceName}
                      </td>
                      <td className={`p-2 border border-gray-700 text-center text-gray-200 bg-gray-800 ${stats.sentOffers > 0 ? 'font-bold' : 'font-normal'}`}>
                        {stats.sentOffers}
                      </td>
                      <td className={`p-2 border border-gray-700 text-center text-gray-200 bg-gray-800 ${stats.receivedOffers > 0 ? 'font-bold' : 'font-normal'}`}>
                        {stats.receivedOffers}
                      </td>
                      <td className="p-2 border border-gray-700 text-center text-gray-200 bg-gray-800 font-bold">
                        {stats.sentOffers + stats.receivedOffers}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Show Recommendations Checkbox */}
      <div className="mb-5">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={showRecommendations}
            onChange={(e) => {
              const checked = e.target.checked;
              setShowRecommendations(checked);
              updateUrlParams({ showRecommendations: checked ? 'true' : null });
            }}
            className="mr-2 w-4 h-4 cursor-pointer"
          />
          <span className="font-bold">Show aid recommendations</span>
        </label>
        {showRecommendations && (
          <p className="text-sm text-gray-600 mt-1">
            Recommendations are displayed with a dashed border and "RECOMMENDED" label. Missing slots show empty boxes with slot type labels. Mismatched offers (that don't match configured slots) are highlighted in red.
          </p>
        )}
      </div>

      {/* Aid Slots Table - Desktop View */}
      {getFilteredAidSlots().length > 0 && (
        <div>
          <h2>Aid Slots by Nation</h2>
          
          {/* Desktop Table View - Hidden on mobile */}
          <div className="hidden md:block overflow-x-auto w-full max-w-none">
            <table className="border-collapse border border-slate-300 text-sm w-full table-fixed">
              <thead>
                <tr className="bg-gray-800 border-b-2 border-slate-500">
                  <th className={headerClasses.nation}>
                    Nation
                  </th>
                  {[1, 2, 3, 4, 5, 6].map(slotNum => (
                    <th key={slotNum} className={headerClasses.aidSlot} style={{ width: slotWidth }}>
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
                {getFilteredAidSlots().map((nationAidSlots) => {
                  // Get slot configuration for this nation if recommendations are shown
                  const nationConfig = showRecommendations 
                    ? nationsConfig.find(nc => nc.nation_id === nationAidSlots.nation.id)
                    : null;
                  
                  // Count actual filled slots by type (only real offers, not recommendations)
                  // First check if offer is external (other party not in alliance), then categorize as tech/cash
                  const countFilledSlots = (nationAidSlots: NationAidSlots) => {
                    // Create a Set of all nation IDs in the current alliance for quick lookup
                    const allianceNationIds = new Set(
                      getFilteredAidSlots().map(nas => nas.nation.id)
                    );
                    
                    let filledSendCash = 0;
                    let filledSendTech = 0;
                    let filledGetCash = 0;
                    let filledGetTech = 0;
                    let filledExternal = 0;
                    
                    // Process each slot
                    nationAidSlots.aidSlots.forEach(slot => {
                      if (!slot.aidOffer || slot.aidOffer.aidId <= 0 || slot.aidOffer.aidId === -2) {
                        return; // Skip empty slots, recommendations, and external slot recommendations
                      }
                      
                      // Determine the other party's ID
                      const otherPartyId = slot.isOutgoing 
                        ? slot.aidOffer.receivingId  // For outgoing, check receiving nation
                        : slot.aidOffer.declaringId; // For incoming, check declaring nation
                      
                      // Step 1: Check if the other party is external (not in alliance)
                      const isExternal = !allianceNationIds.has(otherPartyId);
                      
                      if (isExternal) {
                        // Count as external
                        filledExternal++;
                      } else {
                        // Step 2: Categorize as tech/cash within alliance
                        const isCash = slot.aidOffer.money > 0 && slot.aidOffer.technology === 0;
                        const isTech = slot.aidOffer.technology > 0;
                        
                        if (slot.isOutgoing) {
                          // Outgoing (send)
                          if (isCash) {
                            filledSendCash++;
                          } else if (isTech) {
                            filledSendTech++;
                          }
                        } else {
                          // Incoming (get)
                          if (isCash) {
                            filledGetCash++;
                          } else if (isTech) {
                            filledGetTech++;
                          }
                        }
                      }
                    });
                    
                    return {
                      sendCash: filledSendCash,
                      sendTech: filledSendTech,
                      getCash: filledGetCash,
                      getTech: filledGetTech,
                      external: filledExternal
                    };
                  };
                  
                  const filledSlots = nationConfig ? countFilledSlots(nationAidSlots) : null;
                  
                  return (
                    <tr key={nationAidSlots.nation.id} className="border-b-2 border-slate-400">
                    <td 
                      className={columnClasses.nation}
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
                        <small className="text-gray-700 font-medium">
                          NS: {formatNumber(nationAidSlots.nation.strength)}
                          {nationAidSlots.nation.infrastructure && ` | Infra: ${nationAidSlots.nation.infrastructure}`}
                          {nationAidSlots.nation.technology && ` | Tech: ${nationAidSlots.nation.technology}`}
                        </small>
                        <br />
                        <small 
                          className="font-bold"
                          style={{ color: getWarStatusColor(nationAidSlots.nation.inWarMode) }}
                        >
                          {getWarStatusIcon(nationAidSlots.nation.inWarMode)} {nationAidSlots.nation.inWarMode ? 'War Mode' : 'Peace Mode'}
                        </small>
                        {showRecommendations && nationConfig && filledSlots && (
                          <>
                            <br />
                            <div className="mt-1 pt-1 border-t border-gray-400">
                              <small className="text-xs font-semibold text-gray-700 block mb-0.5">Slot Config:</small>
                              <div className="text-[10px] leading-tight">
                                {nationConfig.slots.sendCash > 0 && (
                                  <div className="text-blue-700">
                                    💰 Send Cash: {filledSlots.sendCash}/{nationConfig.slots.sendCash}
                                  </div>
                                )}
                                {nationConfig.slots.sendTech > 0 && (
                                  <div className="text-blue-700">
                                    🔬 Send Tech: {filledSlots.sendTech}/{nationConfig.slots.sendTech}
                                  </div>
                                )}
                                {nationConfig.slots.getCash > 0 && (
                                  <div className="text-purple-700">
                                    💰 Get Cash: {filledSlots.getCash}/{nationConfig.slots.getCash}
                                  </div>
                                )}
                                {nationConfig.slots.getTech > 0 && (
                                  <div className="text-purple-700">
                                    🔬 Get Tech: {filledSlots.getTech}/{nationConfig.slots.getTech}
                                  </div>
                                )}
                                {nationConfig.slots.external > 0 && (
                                  <div className="text-gray-600">
                                    🌐 External: {filledSlots.external}/{nationConfig.slots.external}
                                  </div>
                                )}
                                <div className="text-gray-600 mt-0.5">
                                  Priority: S{nationConfig.slots.send_priority}/R{nationConfig.slots.receive_priority}
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                    {nationAidSlots.aidSlots.map((slot) => {
                      const isExpired = slot.aidOffer ? slot.aidOffer.isExpired : false;
                      const isRecommendation = slot.aidOffer && slot.aidOffer.aidId < 0;
                      const isExternalSlot = slot.aidOffer && slot.aidOffer.aidId === -2;
                      const isMissingSlot = slot.aidOffer && slot.aidOffer.aidId === -3;
                      const isMismatched = slot.aidOffer && slot.aidOffer.aidId > 0 && isMismatchedOffer(slot.aidOffer, nationAidSlots.nation.id, slot.isOutgoing);
                      
                      // Get slot type label for missing slots
                      const getSlotTypeLabel = (type?: string): string => {
                        switch (type) {
                          case 'sendCash': return '💰 Send Cash';
                          case 'sendTech': return '🔬 Send Tech';
                          case 'getCash': return '💰 Get Cash';
                          case 'getTech': return '🔬 Get Tech';
                          default: return 'Empty';
                        }
                      };
                      
                      return (
                      <td 
                        key={slot.slotNumber}
                        className={columnClasses.aidSlot}
                        style={{ 
                          width: slotWidth,
                          backgroundColor: isMissingSlot 
                            ? '#fff9e6' 
                            : isMismatched 
                              ? '#ffebee' 
                              : slot.aidOffer 
                                ? (isExpired ? '#ffebee' : (slot.isOutgoing ? '#e3f2fd' : '#f3e5f5')) 
                                : EMPTY_CELL_BG,
                          borderStyle: isRecommendation || isMissingSlot ? 'dashed' : 'solid',
                          borderWidth: isRecommendation || isMissingSlot ? '2px' : (isMismatched ? '3px' : '1px'),
                          borderColor: isMissingSlot 
                            ? '#f59e0b' 
                            : isMismatched 
                              ? '#d32f2f' 
                              : isRecommendation 
                                ? '#f59e0b' 
                                : 'inherit'
                        }}
                      >
                        {slot.aidOffer ? (
                          <div className="text-xs">
                            {isMissingSlot ? (
                              <div className="text-center">
                                <div className="mb-1">
                                  <span className="text-xs font-bold px-1 py-0.5 rounded-sm border bg-amber-100 text-amber-800 border-amber-300">
                                    MISSING SLOT
                                  </span>
                                </div>
                                <div className="font-bold text-amber-700">
                                  {getSlotTypeLabel(slot.missingSlotType)}
                                </div>
                                {slot.missingSlotType && (
                                  <div className="mb-1 mt-1 text-[11px]">
                                    <span className="text-green-900 font-bold bg-green-50 px-1 py-0.5 rounded-sm">
                                      {slot.missingSlotType === 'sendCash' || slot.missingSlotType === 'getCash'
                                        ? formatAidValue(9000000, 0, 0)
                                        : slot.missingSlotType === 'sendTech' || slot.missingSlotType === 'getTech'
                                        ? formatAidValue(0, 100, 0)
                                        : ''}
                                    </span>
                                  </div>
                                )}
                                <div className="text-[10px] text-amber-600 font-semibold italic mt-1">
                                  {slot.isOutgoing ? 'Expected to send' : 'Expected to receive'}
                                </div>
                              </div>
                            ) : (
                              <>
                                {isMismatched && (
                                  <div className="mb-1">
                                    <span className="text-xs font-bold px-1 py-0.5 rounded-sm border bg-red-100 text-red-800 border-red-300">
                                      ⚠️ MISMATCHED
                                    </span>
                                  </div>
                                )}
                                {isRecommendation && (
                                  <div className="mb-1">
                                    <span className={`text-xs font-bold px-1 py-0.5 rounded-sm border ${
                                      isExternalSlot 
                                        ? 'bg-purple-100 text-purple-800 border-purple-300' 
                                        : 'bg-amber-100 text-amber-800 border-amber-300'
                                    }`}>
                                      {isExternalSlot ? 'EXTERNAL SLOT' : 'RECOMMENDED'}
                                    </span>
                                  </div>
                                )}
                            <div 
                              className="font-bold mb-1"
                              style={{ color: isExpired ? '#d32f2f' : (slot.isOutgoing ? '#1976d2' : '#7b1fa2') }}
                            >
                              {!isExternalSlot && (slot.isOutgoing ? '→ ' : '← ')}
                              {isExternalSlot ? (
                                <span>{slot.aidOffer.targetNation}</span>
                              ) : (
                                <>
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
                                </>
                              )}
                              {isExpired && <span className="text-red-600 text-[10px]"> (EXPIRED)</span>}
                            </div>
                                {!isExternalSlot && (
                                  <div className="mb-1 text-[11px]">
                                    <span className="text-green-900 font-bold bg-green-50 px-1 py-0.5 rounded-sm">
                                      {formatAidValue(slot.aidOffer.money, slot.aidOffer.technology, slot.aidOffer.soldiers)}
                                    </span>
                                    {slot.aidOffer.reason && (
                                      <span className="text-gray-600 ml-1"> - {decodeHtmlEntities(slot.aidOffer.reason)}</span>
                                    )}
                                  </div>
                                )}
                                {isExternalSlot && (
                                  <div className="mb-1 text-[11px] text-purple-700 font-semibold">
                                    {decodeHtmlEntities(slot.aidOffer.reason)}
                                  </div>
                                )}
                                {!isRecommendation && (
                                  <div 
                                    className={`text-[10px] ${isExpired ? 'text-red-600 font-bold' : 'text-gray-600 font-normal'}`}
                                  >
                                    Expires: {slot.aidOffer.expirationDate} ({slot.aidOffer.daysUntilExpiration} days)
                                  </div>
                                )}
                                {isRecommendation && !isExternalSlot && (
                                  <div className="text-[10px] text-amber-700 font-semibold italic">
                                    Pending recommendation
                                  </div>
                                )}
                                {isExternalSlot && (
                                  <div className="text-[10px] text-purple-700 font-semibold italic">
                                    Available for external aid
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">Empty</span>
                        )}
                      </td>
                      );
                    })}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View - Visible on mobile only */}
          <div className="md:hidden space-y-4 mt-4">
            {getFilteredAidSlots().map((nationAidSlots) => {
              const nationConfig = showRecommendations 
                ? nationsConfig.find(nc => nc.nation_id === nationAidSlots.nation.id)
                : null;
              
              const countFilledSlots = (nationAidSlots: NationAidSlots) => {
                const allianceNationIds = new Set(
                  getFilteredAidSlots().map(nas => nas.nation.id)
                );
                
                let filledSendCash = 0;
                let filledSendTech = 0;
                let filledGetCash = 0;
                let filledGetTech = 0;
                let filledExternal = 0;
                let totalFilled = 0;
                
                nationAidSlots.aidSlots.forEach(slot => {
                  // Count all filled slots (including recommendations and missing slots)
                  if (slot.aidOffer && slot.aidOffer.aidId !== -2) {
                    totalFilled++;
                  }
                  
                  if (!slot.aidOffer || slot.aidOffer.aidId <= 0 || slot.aidOffer.aidId === -2) {
                    return;
                  }
                  
                  const otherPartyId = slot.isOutgoing 
                    ? slot.aidOffer.receivingId
                    : slot.aidOffer.declaringId;
                  
                  const isExternal = !allianceNationIds.has(otherPartyId);
                  
                  if (isExternal) {
                    filledExternal++;
                  } else {
                    const isCash = slot.aidOffer.money > 0 && slot.aidOffer.technology === 0;
                    const isTech = slot.aidOffer.technology > 0;
                    
                    if (slot.isOutgoing) {
                      if (isCash) filledSendCash++;
                      else if (isTech) filledSendTech++;
                    } else {
                      if (isCash) filledGetCash++;
                      else if (isTech) filledGetTech++;
                    }
                  }
                });
                
                return {
                  sendCash: filledSendCash,
                  sendTech: filledSendTech,
                  getCash: filledGetCash,
                  getTech: filledGetTech,
                  external: filledExternal,
                  totalFilled
                };
              };
              
              const filledSlots = countFilledSlots(nationAidSlots);
              const isExpanded = expandedNationCards.has(nationAidSlots.nation.id);
              const totalSlots = nationAidSlots.aidSlots.length;
              
              const toggleExpanded = () => {
                const newExpanded = new Set(expandedNationCards);
                if (isExpanded) {
                  newExpanded.delete(nationAidSlots.nation.id);
                } else {
                  newExpanded.add(nationAidSlots.nation.id);
                }
                setExpandedNationCards(newExpanded);
              };
              
              return (
                <div 
                  key={nationAidSlots.nation.id}
                  className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden"
                  style={{ backgroundColor: getActivityColor(nationAidSlots.nation.activity) }}
                >
                  {/* Nation Header - Clickable to expand/collapse */}
                  <div 
                    className="p-4 cursor-pointer border-b border-gray-600"
                    onClick={toggleExpanded}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-bold text-base">
                          <a 
                            href={`https://www.cybernations.net/search_aid.asp?search=${nationAidSlots.nation.id}&Extended=1`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {nationAidSlots.nation.nationName}
                          </a>
                        </div>
                        <div className="text-sm text-gray-400">{nationAidSlots.nation.rulerName}</div>
                        <div className="text-sm text-gray-300 mt-1">
                          NS: {formatNumber(nationAidSlots.nation.strength)}
                          {nationAidSlots.nation.infrastructure && ` | Infra: ${nationAidSlots.nation.infrastructure}`}
                          {nationAidSlots.nation.technology && ` | Tech: ${nationAidSlots.nation.technology}`}
                        </div>
                        <div 
                          className="text-sm font-bold mt-1"
                          style={{ color: getWarStatusColor(nationAidSlots.nation.inWarMode) }}
                        >
                          {getWarStatusIcon(nationAidSlots.nation.inWarMode)} {nationAidSlots.nation.inWarMode ? 'War Mode' : 'Peace Mode'}
                        </div>
                        {showRecommendations && nationConfig && (
                          <div className="mt-2 pt-2 border-t border-gray-500 text-xs">
                            <div className="grid grid-cols-2 gap-1">
                              {nationConfig.slots.sendCash > 0 && (
                                <div className="text-blue-300">💰 Send Cash: {filledSlots.sendCash}/{nationConfig.slots.sendCash}</div>
                              )}
                              {nationConfig.slots.sendTech > 0 && (
                                <div className="text-blue-300">🔬 Send Tech: {filledSlots.sendTech}/{nationConfig.slots.sendTech}</div>
                              )}
                              {nationConfig.slots.getCash > 0 && (
                                <div className="text-purple-300">💰 Get Cash: {filledSlots.getCash}/{nationConfig.slots.getCash}</div>
                              )}
                              {nationConfig.slots.getTech > 0 && (
                                <div className="text-purple-300">🔬 Get Tech: {filledSlots.getTech}/{nationConfig.slots.getTech}</div>
                              )}
                              {nationConfig.slots.external > 0 && (
                                <div className="text-gray-400">🌐 External: {filledSlots.external}/{nationConfig.slots.external}</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="ml-4 flex flex-col items-end">
                        {/* Slot count summary - on the right */}
                        <div className="text-base font-bold text-gray-900 mb-1">
                          {filledSlots.totalFilled}/{totalSlots}
                        </div>
                        <div className="text-xs text-gray-700 font-medium">
                          slots
                        </div>
                        <div className="mt-2 text-gray-600 text-xl">
                          {isExpanded ? '▼' : '▶'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Aid Slots - Hidden by default, shown when expanded */}
                  {isExpanded && (
                    <div className="p-4 space-y-2">
                    {nationAidSlots.aidSlots.map((slot) => {
                      const isExpired = slot.aidOffer ? slot.aidOffer.isExpired : false;
                      const isRecommendation = slot.aidOffer && slot.aidOffer.aidId < 0;
                      const isExternalSlot = slot.aidOffer && slot.aidOffer.aidId === -2;
                      const isMissingSlot = slot.aidOffer && slot.aidOffer.aidId === -3;
                      const isMismatched = slot.aidOffer && slot.aidOffer.aidId > 0 && isMismatchedOffer(slot.aidOffer, nationAidSlots.nation.id, slot.isOutgoing);
                      
                      const getSlotTypeLabel = (type?: string): string => {
                        switch (type) {
                          case 'sendCash': return '💰 Send Cash';
                          case 'sendTech': return '🔬 Send Tech';
                          case 'getCash': return '💰 Get Cash';
                          case 'getTech': return '🔬 Get Tech';
                          default: return 'Empty';
                        }
                      };

                      let bgColor = '#374151'; // EMPTY_CELL_BG
                      let borderStyle = 'solid';
                      let borderWidth = '1px';
                      let borderColor = 'inherit';

                      if (isMissingSlot) {
                        bgColor = '#fff9e6';
                        borderStyle = 'dashed';
                        borderWidth = '2px';
                        borderColor = '#f59e0b';
                      } else if (isMismatched) {
                        bgColor = '#ffebee';
                        borderWidth = '3px';
                        borderColor = '#d32f2f';
                      } else if (slot.aidOffer) {
                        if (isExpired) {
                          bgColor = '#ffebee';
                        } else {
                          bgColor = slot.isOutgoing ? '#e3f2fd' : '#f3e5f5';
                        }
                        if (isRecommendation) {
                          borderStyle = 'dashed';
                          borderWidth = '2px';
                          borderColor = '#f59e0b';
                        }
                      }

                      return (
                        <div
                          key={slot.slotNumber}
                          className="p-3 rounded border"
                          style={{
                            backgroundColor: bgColor,
                            borderStyle: borderStyle as any,
                            borderWidth,
                            borderColor
                          }}
                        >
                          <div className="text-xs font-semibold mb-1 text-gray-400">
                            Slot {slot.slotNumber} {slot.isOutgoing ? '(Outgoing)' : '(Incoming)'}
                          </div>
                          
                          {slot.aidOffer ? (
                            <div>
                              {isMissingSlot ? (
                                <div>
                                  <div className="mb-1">
                                    <span className="text-xs font-bold px-2 py-1 rounded border bg-amber-100 text-amber-800 border-amber-300">
                                      MISSING SLOT
                                    </span>
                                  </div>
                                  <div className="font-bold text-amber-700 text-sm">
                                    {getSlotTypeLabel(slot.missingSlotType)}
                                  </div>
                                  {slot.missingSlotType && (
                                    <div className="mt-1 text-xs">
                                      <span className="text-green-900 font-bold bg-green-50 px-1 py-0.5 rounded">
                                        {slot.missingSlotType === 'sendCash' || slot.missingSlotType === 'getCash'
                                          ? formatAidValue(9000000, 0, 0)
                                          : slot.missingSlotType === 'sendTech' || slot.missingSlotType === 'getTech'
                                          ? formatAidValue(0, 100, 0)
                                          : ''}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <>
                                  {isMismatched && (
                                    <div className="mb-1">
                                      <span className="text-xs font-bold px-2 py-1 rounded border bg-red-100 text-red-800 border-red-300">
                                        ⚠️ MISMATCHED
                                      </span>
                                    </div>
                                  )}
                                  {isRecommendation && (
                                    <div className="mb-1">
                                      <span className={`text-xs font-bold px-2 py-1 rounded border ${
                                        isExternalSlot 
                                          ? 'bg-purple-100 text-purple-800 border-purple-300' 
                                          : 'bg-amber-100 text-amber-800 border-amber-300'
                                      }`}>
                                        {isExternalSlot ? 'EXTERNAL SLOT' : 'RECOMMENDED'}
                                      </span>
                                    </div>
                                  )}
                                  <div 
                                    className="font-bold text-sm mb-1"
                                    style={{ color: isExpired ? '#d32f2f' : (slot.isOutgoing ? '#1976d2' : '#7b1fa2') }}
                                  >
                                    {!isExternalSlot && (slot.isOutgoing ? '→ ' : '← ')}
                                    {isExternalSlot ? (
                                      <span>{slot.aidOffer.targetNation}</span>
                                    ) : (
                                      <>
                                        <a 
                                          href={`https://www.cybernations.net/search_aid.asp?search=${slot.aidOffer.targetId || 'undefined'}&Extended=1`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="hover:underline"
                                          style={{ color: 'inherit' }}
                                        >
                                          {slot.aidOffer.targetNation}
                                        </a>
                                        <span className="text-gray-600 font-normal text-xs"> / {slot.aidOffer.targetRuler}</span>
                                      </>
                                    )}
                                    {isExpired && <span className="text-red-600 text-xs ml-1">(EXPIRED)</span>}
                                  </div>
                                  {!isExternalSlot && (
                                    <div className="mb-1 text-xs">
                                      <span className="text-green-900 font-bold bg-green-50 px-1 py-0.5 rounded">
                                        {formatAidValue(slot.aidOffer.money, slot.aidOffer.technology, slot.aidOffer.soldiers)}
                                      </span>
                                      {slot.aidOffer.reason && (
                                        <span className="text-gray-600 ml-1"> - {decodeHtmlEntities(slot.aidOffer.reason)}</span>
                                      )}
                                    </div>
                                  )}
                                  {isExternalSlot && (
                                    <div className="mb-1 text-xs text-purple-700 font-semibold">
                                      {decodeHtmlEntities(slot.aidOffer.reason)}
                                    </div>
                                  )}
                                  {!isRecommendation && (
                                    <div className={`text-xs ${isExpired ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                                      Expires: {slot.aidOffer.expirationDate} ({slot.aidOffer.daysUntilExpiration} days)
                                    </div>
                                  )}
                                  {isRecommendation && !isExternalSlot && (
                                    <div className="text-xs text-amber-700 font-semibold italic">
                                      Pending recommendation
                                    </div>
                                  )}
                                  {isExternalSlot && (
                                    <div className="text-xs text-purple-700 font-semibold italic">
                                      Available for external aid
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="text-gray-400 text-sm">Empty</div>
                          )}
                        </div>
                      );
                    })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {getFilteredAidSlots().length === 0 && !loading && (
        <div className="text-center p-10 text-gray-600">
          No aid slot data found for this alliance.
        </div>
      )}
        </>
      )}
      
      {activeTab === 'recommendations' && allianceId && (
        <RecommendationsPage />
      )}
    </PageContainer>
  );
};

export default AidPage;
