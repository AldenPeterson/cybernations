import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import WarStatusBadge from './WarStatusBadge';
import FilterCheckbox from './FilterCheckbox';
import NSPercentageBadge from './NSPercentageBadge';
import AllianceMultiSelect from './AllianceMultiSelect';
import { apiCall, API_ENDPOINTS } from '../utils/api';

interface StaggerRecommendationsCellProps {
  defendingNation: {
    id: number;
    name: string;
    ruler: string;
    alliance: string;
    allianceId: number;
    strength: number;
    technology: string;
    activity: string;
    inWarMode: boolean;
    nuclearWeapons: number;
    governmentType: string;
    warchest?: number;
    spyglassLastUpdated?: number;
  };
  assignAllianceIds: number[];
  hideNonPriority: boolean;
  includePeaceMode: boolean;
  assignOnlyPositive: boolean;
  staggerOnly: boolean;
  maxRecommendations: number;
}

const StaggerRecommendationsCell: React.FC<StaggerRecommendationsCellProps> = ({ 
  defendingNation, 
  assignAllianceIds,
  hideNonPriority,
  includePeaceMode,
  assignOnlyPositive,
  staggerOnly,
  maxRecommendations
}) => {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Reset expanded state when recommendations change
  useEffect(() => {
    setIsExpanded(false);
  }, [recommendations.length, maxRecommendations]);

  useEffect(() => {
    const fetchStaggerRecommendations = async () => {
      try {
        setLoading(true);
        const allRecommendations: any[] = [];
        
        // Fetch recommendations for each selected assign alliance
        for (const assignAllianceId of assignAllianceIds) {
          try {
            const url = `${API_ENDPOINTS.staggerEligibility}/${assignAllianceId}/${defendingNation.allianceId}?hideAnarchy=true&hidePeaceMode=${!includePeaceMode}&hideNonPriority=${hideNonPriority}`;
            const response = await apiCall(url);
            const data = await response.json();
            
            if (data.success) {
              // Find recommendations for this specific defending nation
              const nationRecommendations = data.staggerData.find(
                (item: any) => item.defendingNation.id === defendingNation.id
              );
              if (nationRecommendations?.eligibleAttackers) {
                allRecommendations.push(...nationRecommendations.eligibleAttackers);
              }
            }
          } catch (err) {
            console.error(`Failed to fetch stagger recommendations for alliance ${assignAllianceId}:`, err);
          }
        }
        
        // Remove duplicates based on attacker ID and apply filters
        let uniqueRecommendations = allRecommendations
          .filter((rec, index, self) => 
            index === self.findIndex(r => r.id === rec.id)
          );
        
        // Apply "Assign only positive" filter - only show attackers with >= 100% NS
        if (assignOnlyPositive) {
          uniqueRecommendations = uniqueRecommendations.filter(rec => rec.strengthRatio >= 1.0);
        }
        
        // Sort by strength (highest first)
        uniqueRecommendations.sort((a, b) => b.strength - a.strength);
        
        setRecommendations(uniqueRecommendations);
      } catch (err) {
        console.error('Failed to fetch stagger recommendations:', err);
        setRecommendations([]);
      } finally {
        setLoading(false);
      }
    };

    if (assignAllianceIds.length > 0 && defendingNation.id) {
      // Add a small delay to prevent too many simultaneous requests
      const timeoutId = setTimeout(() => {
        fetchStaggerRecommendations();
      }, 100);
      
      return () => {
        clearTimeout(timeoutId);
      };
    } else {
      // Only clear recommendations if there are no alliances selected
      setRecommendations([]);
      setLoading(false);
    }
  }, [assignAllianceIds, defendingNation.id, defendingNation.allianceId, hideNonPriority, includePeaceMode, assignOnlyPositive, staggerOnly]);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const formatTechnology = (techStr: string): string => {
    const tech = parseFloat(techStr.replace(/,/g, '')) || 0;
    if (tech >= 1000000) {
      return (tech / 1000000).toFixed(1) + 'M';
    } else if (tech >= 1000) {
      return (tech / 1000).toFixed(1) + 'K';
    }
    return tech.toString();
  };

  if (loading && recommendations.length === 0) {
    return <span className="text-gray-600 text-[9px]">Loading...</span>;
  }

  if (!loading && recommendations.length === 0) {
    return <span className="text-gray-400 text-[9px]">None</span>;
  }

  const totalRecommendations = recommendations.length;
  const displayedRecommendations = isExpanded ? recommendations : recommendations.slice(0, maxRecommendations);
  const hasMore = totalRecommendations > maxRecommendations;

  return (
    <div className="text-[9px] text-left">
      {displayedRecommendations.map((attacker) => (
        <div key={attacker.id} className="mb-1 leading-tight font-mono flex items-center">
          <div className="min-w-[180px] max-w-[180px] overflow-hidden overflow-ellipsis whitespace-nowrap">
            <a 
              href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${attacker.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 no-underline font-bold hover:underline"
              title={`${attacker.name} / ${attacker.ruler}`}
            >
              {attacker.name} / {attacker.ruler}
            </a>
          </div>
          <div className="min-w-[50px]">
            {attacker.strengthRatio && (
              <NSPercentageBadge strengthRatio={attacker.strengthRatio} />
            )}
          </div>
          <div className="min-w-[120px] text-gray-600 overflow-hidden overflow-ellipsis whitespace-nowrap" title={attacker.alliance || 'None'}>
            {attacker.alliance || 'None'}
          </div>
          <div className="min-w-[75px] text-gray-600 text-right">
            {formatNumber(attacker.strength)} NS
          </div>
          <div className="min-w-[75px] text-gray-600 text-right">
            {formatTechnology(attacker.technology)} Tech
          </div>
          <div className="min-w-[60px] text-gray-600 text-right">
            {attacker.nuclearWeapons} nukes
          </div>
        </div>
      ))}
      {hasMore && (
        <div 
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 px-2 py-1 bg-yellow-100 border border-yellow-400 rounded text-yellow-800 font-bold text-[9px] cursor-pointer select-none hover:bg-yellow-200"
        >
          {isExpanded 
            ? `▲ Show less (${totalRecommendations} total)` 
            : `▼ +${totalRecommendations - maxRecommendations} more available`
          }
        </div>
      )}
    </div>
  );
};

interface War {
  warId: number;
  defendingNation: {
    id: number;
    name: string;
    ruler: string;
    alliance: string;
    allianceId: number;
    strength: number;
    technology: string;
    activity: string;
    inWarMode: boolean;
    nuclearWeapons: number;
    governmentType: string;
    warchest?: number;
    spyglassLastUpdated?: number;
  };
  attackingNation: {
    id: number;
    name: string;
    ruler: string;
    alliance: string;
    allianceId: number;
    strength: number;
    technology: string;
    activity: string;
    inWarMode: boolean;
    nuclearWeapons: number;
    governmentType: string;
    warchest?: number;
    spyglassLastUpdated?: number;
  };
  status: string;
  date: string;
  endDate: string;
  // Calculated war end date fields from backend
  formattedEndDate?: string;
  daysUntilExpiration?: number;
  expirationColor?: string;
  isExpired?: boolean;
}

interface NationWars {
  nation: {
    id: number;
    name: string;
    ruler: string;
    alliance: string;
    allianceId: number;
    strength: number;
    technology: string;
    activity: string;
    inWarMode: boolean;
    nuclearWeapons: number;
    governmentType: string;
    lastNukedDate?: string;
    warchest?: number;
    spyglassLastUpdated?: number;
  };
  attackingWars: War[];
  defendingWars: War[];
  staggeredStatus: {
    status: 'staggered' | 'same-day' | 'empty';
    color: string;
  };
}


interface Alliance {
  id: number;
  name: string;
  nationCount: number;
}

interface DefendingWarsTableProps {
  allianceId: number;
}

const DefendingWarsTable: React.FC<DefendingWarsTableProps> = ({ allianceId }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [allNationWars, setAllNationWars] = useState<NationWars[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includePeaceMode, setIncludePeaceMode] = useState<boolean>(false);
  const [needsStagger, setNeedsStagger] = useState<boolean>(false);
  const [hideNonPriority, setHideNonPriority] = useState<boolean>(false);
  const [needsNuke, setNeedsNuke] = useState<boolean>(false);
  const [assignOnlyPositive, setAssignOnlyPositive] = useState<boolean>(false);
  const [staggerOnly, setStaggerOnly] = useState<boolean>(true);
  const [maxRecommendations, setMaxRecommendations] = useState<number>(7);
  const [urgentTargets, setUrgentTargets] = useState<boolean>(false);
  const [blownStaggers, setBlownStaggers] = useState<boolean>(false);
  const [showPMNations, setShowPMNations] = useState<boolean>(false);
  const [alliances, setAlliances] = useState<Alliance[]>([]);
  const [assignAllianceIds, setAssignAllianceIds] = useState<number[]>([]);

  // Helper function to parse boolean from URL parameter
  const parseBooleanParam = (value: string | null, defaultValue: boolean = false): boolean => {
    if (value === null) return defaultValue;
    return value.toLowerCase() === 'true';
  };

  // Helper function to parse array of numbers from URL parameter
  const parseNumberArrayParam = (value: string | null): number[] => {
    if (!value) return [];
    return value.split(',')
      .map(id => parseInt(id.trim()))
      .filter(id => !isNaN(id));
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

  // Handler for assign alliance selection changes (with URL update)
  const handleAssignAllianceChange = useCallback((selectedIds: number[]) => {
    setAssignAllianceIds(selectedIds);
    updateUrlParams({ 
      assignAlliances: selectedIds.length > 0 ? selectedIds.join(',') : null 
    });
  }, [updateUrlParams]);

  // Handler for setting assign alliances without URL update (for initialization)
  const setAssignAllianceIdsOnly = useCallback((selectedIds: number[]) => {
    setAssignAllianceIds(selectedIds);
  }, []);


  // Initialize boolean parameters from URL (only once on mount)
  useEffect(() => {
    setIncludePeaceMode(parseBooleanParam(searchParams.get('includePeaceMode')));
    setNeedsStagger(parseBooleanParam(searchParams.get('needsStagger')));
    setHideNonPriority(parseBooleanParam(searchParams.get('hideNonPriority')));
    setNeedsNuke(parseBooleanParam(searchParams.get('needsNuke')));
    setAssignOnlyPositive(parseBooleanParam(searchParams.get('assignOnlyPositive')));
    setStaggerOnly(parseBooleanParam(searchParams.get('staggerOnly'), true)); // default true
    setUrgentTargets(parseBooleanParam(searchParams.get('urgentTargets')));
    setBlownStaggers(parseBooleanParam(searchParams.get('blownStaggers')));
    setShowPMNations(parseBooleanParam(searchParams.get('showPMNations')));
    const maxRecsParam = searchParams.get('maxRecommendations');
    if (maxRecsParam) {
      const parsed = parseInt(maxRecsParam);
      if (!isNaN(parsed) && parsed > 0) {
        setMaxRecommendations(parsed);
      }
    }
  }, []); // Empty dependency array - only run on mount

  // Initialize assign alliances from URL (when alliances load or allianceId changes)
  useEffect(() => {
    const assignAllianceIdsParam = parseNumberArrayParam(searchParams.get('assignAlliances'));
    
    // Only filter alliances if we have alliances loaded, otherwise keep the URL params as-is
    // This prevents clearing selections during the initial load when alliances array is empty
    const validAllianceIds = alliances.length > 0 
      ? assignAllianceIdsParam.filter(id => 
          alliances.some(alliance => alliance.id === id && alliance.id !== allianceId)
        )
      : assignAllianceIdsParam; // Keep URL params during initial load
    
    setAssignAllianceIdsOnly(validAllianceIds);
  }, [alliances, allianceId, setAssignAllianceIdsOnly]); // Remove searchParams from dependencies

  // Column styles (Tailwind version)
  const columnClasses = {
    nation: 'p-0.5 border border-slate-300 bg-slate-50 min-w-[150px] max-w-[200px] w-[150px] sticky left-0 z-[100] shadow-[2px_0_8px_-2px_rgba(0,0,0,0.3),1px_0_0_0_#999]',
    warchest: 'p-0.5 px-1 border border-slate-300 text-center bg-slate-50 min-w-[80px] max-w-[100px] w-[90px]',
    nukes: 'p-0.5 border border-slate-300 text-center bg-slate-50 min-w-[40px] max-w-[50px] w-[45px]',
    lastNuked: 'p-0.5 px-1 border border-slate-300 text-center bg-white min-w-[50px] max-w-[60px] w-[55px]',
    war: 'p-0.5 px-1 border border-slate-300 text-center bg-white min-w-[120px] max-w-[150px] w-[135px]',
    staggered: 'px-1.5 py-1 border border-slate-300 text-center bg-white min-w-[60px] max-w-[80px] w-[70px]',
    pm: 'px-1.5 py-1 border border-slate-300 text-center bg-white min-w-[50px] max-w-[70px] w-[60px]'
  };

  // Header classes (Tailwind version)
  const headerClasses = {
    default: 'px-1.5 py-2 border border-slate-300 text-left text-white font-bold',
    center: 'px-1.5 py-2 border border-slate-300 text-center text-white font-bold'
  };

  useEffect(() => {
    if (allianceId) {
      fetchNationWars();
    }
  }, [allianceId]);

  useEffect(() => {
    fetchAlliances();
  }, []);


  const fetchAlliances = async () => {
    try {
      const response = await apiCall(API_ENDPOINTS.alliances);
      const data = await response.json();
      
      if (data.success) {
        setAlliances(data.alliances);
      }
    } catch (err) {
      console.error('Failed to fetch alliances:', err);
    }
  };

  const fetchNationWars = async () => {
    try {
      setLoading(true);
      // Fetch all data without any filtering - we'll filter client-side
      const response = await apiCall(`${API_ENDPOINTS.nationWars(allianceId)}?includePeaceMode=true&needsStagger=false`);
      const data = await response.json();
      
      if (data.success) {
        setAllNationWars(data.nationWars);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch nation wars');
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

  const formatTechnology = (techStr: string): string => {
    const tech = parseFloat(techStr.replace(/,/g, '')) || 0;
    if (tech >= 1000000) {
      return (tech / 1000000).toFixed(1) + 'M';
    } else if (tech >= 1000) {
      return (tech / 1000).toFixed(1) + 'K';
    }
    return tech.toFixed(0);
  };

  const formatWarchest = (warchest: number): string => {
    if (warchest >= 1000000000) {
      return '$' + (warchest / 1000000000).toFixed(1) + 'B';
    } else if (warchest >= 1000000) {
      return '$' + (warchest / 1000000).toFixed(1) + 'M';
    } else if (warchest >= 1000) {
      return '$' + (warchest / 1000).toFixed(1) + 'K';
    }
    return '$' + warchest.toFixed(0);
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

  const getNuclearWeaponsColor = (nuclearWeapons: number): string => {
    if (nuclearWeapons < 10) {
      return '#ffebee'; // Light red for below 10
    } else if (nuclearWeapons >= 10 && nuclearWeapons <= 18) {
      return '#fffde7'; // Light yellow for 10-18
    }
    return '#e8f5e8'; // Light green for above 18
  };

  const getWarchestColor = (warchest: number): string => {
    if (warchest < 100000000) { // Less than $100M
      return '#ffebee'; // Light red
    } else if (warchest >= 100000000 && warchest < 1000000000) { // $100M - $1B
      return '#fffde7'; // Light yellow
    }
    return '#e8f5e8'; // Light green for $1B+
  };

  const getCentralTodayYMD = (): { y: number; m: number; d: number } => {
    const centralNowStr = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });
    const centralNow = new Date(centralNowStr);
    return {
      y: centralNow.getFullYear(),
      m: centralNow.getMonth() + 1,
      d: centralNow.getDate()
    };
  };

  const parseMmDdYyyy = (dateStr: string): { y: number; m: number; d: number } | null => {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    const m = parseInt(parts[0], 10);
    const d = parseInt(parts[1], 10);
    const y = parseInt(parts[2], 10);
    if (!m || !d || !y) return null;
    return { y, m, d };
  };

  const getLastNukedCellColor = (lastNukedDate?: string): string => {
    if (!lastNukedDate) return '#ffffff';
    const parsed = parseMmDdYyyy(lastNukedDate);
    if (!parsed) return '#ffffff';
    const today = getCentralTodayYMD();
    const todayUtc = Date.UTC(today.y, today.m - 1, today.d);
    const lastUtc = Date.UTC(parsed.y, parsed.m - 1, parsed.d);
    const diffDays = Math.floor((todayUtc - lastUtc) / (1000 * 60 * 60 * 24));
    if (diffDays <= 1) return '#e8f5e8'; // green: today or yesterday
    if (diffDays === 2) return '#fffde7'; // yellow: 2 days ago
    return '#ffebee'; // red: 3+ days
  };

  const formatLastNukedDisplay = (lastNukedDate?: string): string => {
    const parsed = lastNukedDate ? parseMmDdYyyy(lastNukedDate) : null;
    if (!parsed) return '—';
    const mm = String(parsed.m).padStart(2, '0');
    const dd = String(parsed.d).padStart(2, '0');
    return `${mm}/${dd}`;
  };

  const shouldBeInPeaceMode = (nuclearWeapons: number, governmentType: string, attackingWars: War[], defendingWars: War[]): boolean => {
    return (governmentType.toLowerCase() === 'anarchy'  || nuclearWeapons < 20) && 
           (attackingWars.length === 0 && 
           defendingWars.length === 0);
  };

  const isPriorityNation = (nationWar: NationWars): boolean => {
    const defendingNation = nationWar.nation;
    const defendingWars = nationWar.defendingWars;
    
    // Priority if in anarchy
    if (defendingNation.governmentType.toLowerCase() === 'anarchy') {
      return true;
    }
    
    // Priority if not staggered but has defending wars
    // "Not staggered" means they have open war slots (less than 3 defensive wars)
    const currentDefendingWars = defendingWars.length;
    const openWarSlots = Math.max(0, 3 - currentDefendingWars);
    
    if (openWarSlots > 0 && currentDefendingWars > 0) {
      return true;
    }
    
    return false;
  };

  // Apply client-side filtering
  let filteredNationWars = allNationWars;

  // Filter to only show nations that need stagger if needsStagger is true
  if (needsStagger) {
    filteredNationWars = filteredNationWars.filter(nationWar => 
      nationWar.nation.inWarMode && nationWar.staggeredStatus.status !== 'staggered'
    );
  }

  // Filter to only show nations that need staggers if staggerOnly is true (for target assignment)
  if (staggerOnly && assignAllianceIds.length > 0) {
    filteredNationWars = filteredNationWars.filter(nationWar => 
      nationWar.nation.inWarMode && nationWar.staggeredStatus.status !== 'staggered'
    );
  }

  // Filter to hide non-priority nations if hideNonPriority is true
  if (hideNonPriority) {
    filteredNationWars = filteredNationWars.filter(isPriorityNation);
  }

  // Filter to show only nations that need a nuke (no nuke today or yesterday)
  if (needsNuke) {
    filteredNationWars = filteredNationWars.filter(nationWar => {
      const last = nationWar.nation.lastNukedDate;
      if (!last) return true;
      const parsed = parseMmDdYyyy(last);
      if (!parsed) return true;
      const today = getCentralTodayYMD();
      const todayUtc = Date.UTC(today.y, today.m - 1, today.d);
      const lastUtc = Date.UTC(parsed.y, parsed.m - 1, parsed.d);
      const diffDays = Math.floor((todayUtc - lastUtc) / (1000 * 60 * 60 * 24));
      return diffDays >= 2; // keep if 2+ days ago
    });
  }

  // Filter to show only urgent targets (newest war expires in 0 or 1 days)
  if (urgentTargets) {
    filteredNationWars = filteredNationWars.filter(nationWar => {
      if (nationWar.defendingWars.length === 0) return false;
      
      // Find the newest war (most recently started) by finding the one with most days until expiration
      const newestWar = nationWar.defendingWars.reduce((newest, current) => {
        const newestDays = newest.daysUntilExpiration ?? 0;
        const currentDays = current.daysUntilExpiration ?? 0;
        return currentDays > newestDays ? current : newest;
      });
      
      // Check if newest war expires in 0 or 1 days (today or tomorrow)
      const daysUntilExpiration = newestWar.daysUntilExpiration;
      return daysUntilExpiration === 0 || daysUntilExpiration === 1;
    });
  }

  // Filter to show only blown staggers (3 defending wars ending on same date, no attacking wars after)
  if (blownStaggers) {
    filteredNationWars = filteredNationWars.filter(nationWar => {
      try {
        // Must have exactly 3 defending wars
        if (nationWar.defendingWars.length !== 3) return false;
        
        // Check if all 3 defending wars have the same end date (compare the formatted date string or raw date)
        const firstEndDate = nationWar.defendingWars[0].formattedEndDate || nationWar.defendingWars[0].endDate;
        const allSameDate = nationWar.defendingWars.every(war => {
          const warDate = war.formattedEndDate || war.endDate;
          return warDate === firstEndDate;
        });
        
        if (!allSameDate) return false;
        
        // Check if there are any attacking wars ending after this date
        if (nationWar.attackingWars.length === 0) return true; // No attacking wars, so blown stagger
        
        // Get the daysUntilExpiration for the defending wars (all should be the same)
        const defendingDaysUntilExpiration = nationWar.defendingWars[0].daysUntilExpiration ?? 0;
        
        // Check if any attacking war expires later than the defending wars
        const hasAttackingWarsAfter = nationWar.attackingWars.some(war => {
          const attackingDaysUntilExpiration = war.daysUntilExpiration ?? 0;
          return attackingDaysUntilExpiration > defendingDaysUntilExpiration;
        });
        
        return !hasAttackingWarsAfter; // Show if no attacking wars end after defending wars
      } catch (err) {
        console.error('Error in blown staggers filter:', err);
        return false;
      }
    });
  }

  // Filter to hide nations in peace mode if showPMNations is false
  if (!showPMNations) {
    filteredNationWars = filteredNationWars.filter(nationWar => {
      return nationWar.nation.inWarMode;
    });
  }





  // Show loading indicator without hiding the entire interface
  if (loading && allNationWars.length === 0) {
    return <div className="p-5 text-center">Loading defending wars...</div>;
  }

  if (error) {
    return <div className="p-5 text-error">Error: {error}</div>;
  }

  return (
    <div className="w-full max-w-none">
      {/* Color Legend */}
      <div className="mb-5 mx-5 p-4 bg-black border border-gray-700 rounded-lg text-xs">
        <h4 className="m-0 mb-3 text-sm font-bold text-white">
          Color Legend
        </h4>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5">
          {/* War Expiration Colors */}
          <div>
            <strong className="text-white text-xs">War Expiration:</strong>
            <div className="flex items-center my-0.5">
              <div className="w-[18px] h-[18px] border border-gray-600 mr-2" style={{ backgroundColor: '#ffebee' }}></div>
              <span className="text-[11px] text-white">Expires today/tomorrow</span>
            </div>
            <div className="flex items-center my-0.5">
              <div className="w-[18px] h-[18px] border border-gray-600 mr-2" style={{ backgroundColor: '#fff3e0' }}></div>
              <span className="text-[11px] text-white">Expires in 2 days</span>
            </div>
            <div className="flex items-center my-0.5">
              <div className="w-[18px] h-[18px] border border-gray-600 mr-2" style={{ backgroundColor: '#fffde7' }}></div>
              <span className="text-[11px] text-white">Expires in 3 days</span>
            </div>
            <div className="flex items-center my-0.5">
              <div className="w-[18px] h-[18px] border border-gray-600 mr-2" style={{ backgroundColor: '#e8f5e8' }}></div>
              <span className="text-[11px] text-white">Expires in 4+ days</span>
            </div>
          </div>

          {/* Activity Colors */}
          <div>
            <strong className="text-white text-xs">Activity Status:</strong>
            <div className="flex items-center my-0.5">
              <div className="w-[18px] h-[18px] border border-gray-600 mr-2" style={{ backgroundColor: '#d4edda' }}></div>
              <span className="text-[11px] text-white">Active last 3 days</span>
            </div>
            <div className="flex items-center my-0.5">
              <div className="w-[18px] h-[18px] border border-gray-600 mr-2" style={{ backgroundColor: '#fff3cd' }}></div>
              <span className="text-[11px] text-white">Active this week</span>
            </div>
            <div className="flex items-center my-0.5">
              <div className="w-[18px] h-[18px] border border-gray-600 mr-2" style={{ backgroundColor: '#ffeaa7' }}></div>
              <span className="text-[11px] text-white">Active last week</span>
            </div>
            <div className="flex items-center my-0.5">
              <div className="w-[18px] h-[18px] border border-gray-600 mr-2" style={{ backgroundColor: '#f8d7da' }}></div>
              <span className="text-[11px] text-white">Inactive 3+ weeks</span>
            </div>
          </div>

          {/* Nuclear Weapons Colors */}
          <div>
            <strong className="text-white text-xs">Nuclear Weapons:</strong>
            <div className="flex items-center my-0.5">
              <div className="w-[18px] h-[18px] border border-gray-600 mr-2" style={{ backgroundColor: '#ffebee' }}></div>
              <span className="text-[11px] text-white">&lt; 10 nukes</span>
            </div>
            <div className="flex items-center my-0.5">
              <div className="w-[18px] h-[18px] border border-gray-600 mr-2" style={{ backgroundColor: '#fffde7' }}></div>
              <span className="text-[11px] text-white">10-18 nukes</span>
            </div>
            <div className="flex items-center my-0.5">
              <div className="w-[18px] h-[18px] border border-gray-600 mr-2" style={{ backgroundColor: '#e8f5e8' }}></div>
              <span className="text-[11px] text-white">&gt; 18 nukes</span>
            </div>
          </div>

          {/* Warchest Colors */}
          <div>
            <strong className="text-white text-xs">Warchest:</strong>
            <div className="flex items-center my-0.5">
              <div className="w-[18px] h-[18px] border border-gray-600 mr-2" style={{ backgroundColor: '#ffebee' }}></div>
              <span className="text-[11px] text-white">&lt; $100M</span>
            </div>
            <div className="flex items-center my-0.5">
              <div className="w-[18px] h-[18px] border border-gray-600 mr-2" style={{ backgroundColor: '#fffde7' }}></div>
              <span className="text-[11px] text-white">$100M - $1B</span>
            </div>
            <div className="flex items-center my-0.5">
              <div className="w-[18px] h-[18px] border border-gray-600 mr-2" style={{ backgroundColor: '#e8f5e8' }}></div>
              <span className="text-[11px] text-white">&gt; $1B</span>
            </div>
          </div>

          {/* Other Colors */}
          <div>
            <strong className="text-white text-xs">Other Indicators:</strong>
            <div className="flex items-center my-0.5">
              <div className="w-[18px] h-[18px] border border-gray-600 mr-2" style={{ backgroundColor: '#d32f2f' }}></div>
              <span className="text-[11px] text-white">Nation in anarchy (red text)</span>
            </div>
            <div className="flex items-center my-0.5">
              <div className="w-[18px] h-[18px] border border-gray-600 mr-2" style={{ backgroundColor: '#e8f5e8' }}></div>
              <span className="text-[11px] text-white">Staggered wars</span>
            </div>
            <div className="flex items-center my-0.5">
              <div className="w-[18px] h-[18px] border border-gray-600 mr-2" style={{ backgroundColor: '#ffebee' }}></div>
              <span className="text-[11px] text-white">Should be in Peace Mode</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Controls - positioned above table */}
      <div className="mb-4 mx-5 flex flex-col gap-4">
        {/* Target Assignment Controls Section */}
        <div className="p-4 bg-slate-50 border border-slate-300 rounded-lg">
          <h4 className="m-0 mb-3 text-sm font-bold text-gray-800">
            Target Assignment Configuration
          </h4>
          <div className="flex flex-col lg:flex-row lg:justify-between items-stretch lg:items-center gap-3">
            {/* Assign Alliances Multi-Select */}
            <AllianceMultiSelect
              label="Assign Alliances"
              alliances={alliances}
              selectedAllianceIds={assignAllianceIds}
              excludedAllianceId={allianceId}
              onChange={handleAssignAllianceChange}
            />
            
            {/* Assignment configuration checkboxes */}
            <div className="flex flex-wrap items-center gap-2.5">
              <FilterCheckbox
                label="Assign PM nations"
                checked={includePeaceMode}
                onChange={(checked) => {
                  setIncludePeaceMode(checked);
                  updateUrlParams({ includePeaceMode: checked.toString() });
                }}
              />
              <FilterCheckbox
                label="Assign only stronger"
                checked={assignOnlyPositive}
                onChange={(checked) => {
                  setAssignOnlyPositive(checked);
                  updateUrlParams({ assignOnlyPositive: checked.toString() });
                }}
              />
              <FilterCheckbox
                label="Stagger only"
                checked={staggerOnly}
                onChange={(checked) => {
                  setStaggerOnly(checked);
                  updateUrlParams({ staggerOnly: checked.toString() });
                }}
              />
              <div className="flex items-center gap-1.5">
                <label className="text-sm text-gray-800 font-medium whitespace-nowrap">
                  Max recommendations:
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={maxRecommendations}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (!isNaN(value) && value > 0) {
                      setMaxRecommendations(value);
                      updateUrlParams({ maxRecommendations: value.toString() });
                    }
                  }}
                  className="w-[60px] px-2 py-1 text-sm text-gray-800 font-medium border border-gray-300 rounded text-center bg-white focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20"
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Defending Nations Filter Section */}
        <div className="flex flex-wrap justify-start lg:justify-end items-center gap-2.5">
          <FilterCheckbox
            label="Needs Stagger?"
            checked={needsStagger}
            onChange={(checked) => {
              setNeedsStagger(checked);
              updateUrlParams({ needsStagger: checked.toString() });
            }}
          />
          <FilterCheckbox
            label="Hide non-priority defending nations"
            checked={hideNonPriority}
            onChange={(checked) => {
              setHideNonPriority(checked);
              updateUrlParams({ hideNonPriority: checked.toString() });
            }}
          />
          <FilterCheckbox
            label="Needs nuke?"
            checked={needsNuke}
            onChange={(checked) => {
              setNeedsNuke(checked);
              updateUrlParams({ needsNuke: checked.toString() });
            }}
          />
          <FilterCheckbox
            label="Urgent Targets"
            checked={urgentTargets}
            onChange={(checked) => {
              setUrgentTargets(checked);
              updateUrlParams({ urgentTargets: checked.toString() });
            }}
          />
          <FilterCheckbox
            label="Blown Staggers"
            checked={blownStaggers}
            onChange={(checked) => {
              setBlownStaggers(checked);
              updateUrlParams({ blownStaggers: checked.toString() });
            }}
          />
          <FilterCheckbox
            label="Show PM nations?"
            checked={showPMNations}
            onChange={(checked) => {
              setShowPMNations(checked);
              updateUrlParams({ showPMNations: checked.toString() });
            }}
          />
        </div>
      </div>

      {/* Nation Wars Table */}
      {filteredNationWars.length > 0 ? (
        <div className="overflow-x-auto w-full max-w-none">
          <table className="border-collapse border border-slate-300 text-sm min-w-[1600px] w-full">
              <thead>
                <tr className="bg-gray-800">
                  <th className={`${headerClasses.default} sticky left-0 z-[200] bg-gray-800 shadow-[2px_0_8px_-2px_rgba(0,0,0,0.3),1px_0_0_0_#999]`}>Nation</th>
                  <th className={headerClasses.center}>Warchest</th>
                  <th className={headerClasses.center}>Nukes</th>
                  <th className={headerClasses.center}>Last Nuked</th>
                  <th className={headerClasses.center}>Attacking War 1</th>
                  <th className={headerClasses.center}>Attacking War 2</th>
                  <th className={headerClasses.center}>Attacking War 3</th>
                  <th className={headerClasses.center}>Attacking War 4</th>
                  <th className={headerClasses.center}>Defending War 1</th>
                  <th className={headerClasses.center}>Defending War 2</th>
                  <th className={headerClasses.center}>Defending War 3</th>
                  <th className={headerClasses.center}>Staggered</th>
                  <th className={headerClasses.center}>Should PM?</th>
                  <th className={headerClasses.center}>Assignments</th>
                </tr>
              </thead>
              <tbody>
                {filteredNationWars.map((nationWar) => (
                  <tr key={nationWar.nation.id}>
                    <td 
                      className={columnClasses.nation}
                      style={{ backgroundColor: getActivityColor(nationWar.nation.activity) }}
                    >
                      <div className="text-xs">
                        <strong>
                          <a 
                            href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${nationWar.nation.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`no-underline hover:underline ${nationWar.nation.governmentType.toLowerCase() === 'anarchy' ? 'text-red-600' : 'text-primary'}`}
                          >
                            {nationWar.nation.ruler} / {nationWar.nation.name}
                          </a>
                        </strong>
                        <br />
                        <span className={`text-[10px] ${nationWar.nation.governmentType.toLowerCase() === 'anarchy' ? 'text-red-600 font-bold' : 'text-gray-600 font-normal'}`}>
                          {formatNumber(nationWar.nation.strength)} NS / {formatTechnology(nationWar.nation.technology)} Tech
                        </span>
                        <br />
                        <WarStatusBadge inWarMode={nationWar.nation.inWarMode} />
                      </div>
                    </td>
                    {/* Warchest Column */}
                    <td 
                      className={columnClasses.warchest}
                      style={{ backgroundColor: nationWar.nation.warchest !== undefined ? getWarchestColor(nationWar.nation.warchest) : '#ffffff' }}
                    >
                      {nationWar.nation.warchest !== undefined ? (
                        <div className="text-[11px]">
                          <div className="text-green-800 font-bold">
                            {formatWarchest(nationWar.nation.warchest)}
                          </div>
                          {nationWar.nation.spyglassLastUpdated !== undefined && (
                            <div className="text-gray-600 text-[9px] mt-0.5">
                              ({nationWar.nation.spyglassLastUpdated}d)
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-[10px]">—</span>
                      )}
                    </td>
                    {/* Nuclear Weapons Column */}
                    <td 
                      className={columnClasses.nukes}
                      style={{ backgroundColor: getNuclearWeaponsColor(nationWar.nation.nuclearWeapons) }}
                    >
                      <div className="text-xs font-bold text-red-600">
                        {nationWar.nation.nuclearWeapons}
                      </div>
                    </td>
                    {/* Last Nuked Column */}
                    <td 
                      className={columnClasses.lastNuked}
                      style={{ backgroundColor: getLastNukedCellColor(nationWar.nation.lastNukedDate) }}
                    >
                      <div className="text-[11px] text-gray-800">
                        {formatLastNukedDisplay(nationWar.nation.lastNukedDate)}
                      </div>
                    </td>
                    {/* Attacking Wars Columns */}
                    {[0, 1, 2, 3].map(index => (
                      <td 
                        key={`attacking-${index}`}
                        className={columnClasses.war}
                        style={{ backgroundColor: nationWar.attackingWars[index] ? (nationWar.attackingWars[index].expirationColor || '#e8f5e8') : '#ffffff' }}
                      >
                        {nationWar.attackingWars[index] ? (
                          <div className="text-[11px]">
                            <div className="font-bold mb-0.5 text-blue-700">
                              <a 
                                href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${nationWar.attackingWars[index].defendingNation.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-700 no-underline hover:underline"
                              >
                                {nationWar.attackingWars[index].defendingNation.name}
                              </a>
                            </div>
                            <div className="text-[9px] text-gray-600 mb-0.5">
                              {nationWar.attackingWars[index].defendingNation.ruler} • {nationWar.attackingWars[index].defendingNation.alliance}
                            </div>
                            {nationWar.attackingWars[index].defendingNation.warchest !== undefined && (
                              <div className="text-[9px] mb-0.5">
                                <span className="text-green-800 font-bold">
                                  {formatWarchest(nationWar.attackingWars[index].defendingNation.warchest!)}
                                </span>
                                {nationWar.attackingWars[index].defendingNation.spyglassLastUpdated !== undefined && (
                                  <span className="text-gray-600 ml-1">
                                    ({nationWar.attackingWars[index].defendingNation.spyglassLastUpdated}d)
                                  </span>
                                )}
                              </div>
                            )}
                            <div className="text-[9px] text-gray-600">
                              {nationWar.attackingWars[index].formattedEndDate || nationWar.attackingWars[index].endDate}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-[10px]">Empty</span>
                        )}
                      </td>
                    ))}
                    {/* Defending Wars Columns */}
                    {[0, 1, 2].map(index => (
                      <td 
                        key={`defending-${index}`}
                        className={columnClasses.war}
                        style={{ backgroundColor: nationWar.defendingWars[index] ? (nationWar.defendingWars[index].expirationColor || '#e8f5e8') : '#ffffff' }}
                      >
                        {nationWar.defendingWars[index] ? (
                          <div className="text-[11px]">
                            <div className="font-bold mb-0.5 text-red-600">
                              <a 
                                href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${nationWar.defendingWars[index].attackingNation.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-red-600 no-underline hover:underline"
                              >
                                {nationWar.defendingWars[index].attackingNation.name}
                              </a>
                            </div>
                            <div className="text-[9px] text-gray-600 mb-0.5">
                              {nationWar.defendingWars[index].attackingNation.ruler} • {nationWar.defendingWars[index].attackingNation.alliance}
                            </div>
                            {nationWar.defendingWars[index].attackingNation.warchest !== undefined && (
                              <div className="text-[9px] mb-0.5">
                                <span className="text-green-800 font-bold">
                                  {formatWarchest(nationWar.defendingWars[index].attackingNation.warchest!)}
                                </span>
                                {nationWar.defendingWars[index].attackingNation.spyglassLastUpdated !== undefined && (
                                  <span className="text-gray-600 ml-1">
                                    ({nationWar.defendingWars[index].attackingNation.spyglassLastUpdated}d)
                                  </span>
                                )}
                              </div>
                            )}
                            <div className="text-[9px] text-gray-600">
                              {nationWar.defendingWars[index].formattedEndDate || nationWar.defendingWars[index].endDate}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-[10px]">Empty</span>
                        )}
                      </td>
                    ))}
                    {/* Staggered Column */}
                    <td 
                      className={columnClasses.staggered}
                      style={{ backgroundColor: nationWar.staggeredStatus.color }}
                    >
                      {(() => {
                        const staggeredInfo = nationWar.staggeredStatus;
                        if (staggeredInfo.status === 'empty') {
                          return <span className="text-gray-400 text-[10px]">—</span>;
                        } else if (staggeredInfo.status === 'staggered') {
                          return <span className="text-green-800 text-[10px] font-bold">✓</span>;
                        } else {
                          return <span className="text-red-600 text-[10px] font-bold">⚠</span>;
                        }
                      })()}
                    </td>
                    {/* PM Column */}
                    <td 
                      className={columnClasses.pm}
                      style={{ backgroundColor: shouldBeInPeaceMode(nationWar.nation.nuclearWeapons, nationWar.nation.governmentType, nationWar.attackingWars, nationWar.defendingWars) ? '#ffebee' : '#ffffff' }}
                    >
                      {shouldBeInPeaceMode(nationWar.nation.nuclearWeapons, nationWar.nation.governmentType, nationWar.attackingWars, nationWar.defendingWars) ? (
                        <span className="text-red-600 text-[10px] font-bold">✓</span>
                      ) : (
                        <span className="text-gray-400 text-[10px]">—</span>
                      )}
                    </td>
                    {/* Stagger Recommendations Column */}
                    <td 
                      className={`${columnClasses.staggered} bg-white min-w-[600px] max-w-[700px] text-left`}
                    >
                      {assignAllianceIds.length > 0 ? (
                        <StaggerRecommendationsCell 
                          defendingNation={nationWar.nation}
                          assignAllianceIds={assignAllianceIds}
                          hideNonPriority={hideNonPriority}
                          includePeaceMode={includePeaceMode}
                          assignOnlyPositive={assignOnlyPositive}
                          staggerOnly={staggerOnly}
                          maxRecommendations={maxRecommendations}
                        />
                      ) : (
                        <span className="text-gray-400 text-[10px]">Select alliances</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      ) : (
        <div className="text-center p-10 text-gray-600">
          No results found with current filters.
        </div>
      )}
    </div>
  );
};

export default DefendingWarsTable;
