import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import WarStatusBadge from './WarStatusBadge';
import FilterCheckbox from './FilterCheckbox';
import NSPercentageBadge from './NSPercentageBadge';
import AllianceMultiSelect from './AllianceMultiSelect';
import { apiCall, API_ENDPOINTS } from '../utils/api';
import { tableClasses, EMPTY_CELL_BG } from '../styles/tableClasses';
import { useAlliances } from '../contexts/AlliancesContext';

interface StaggerRecommendationsCellProps {
  rawRecommendations: any[]; // Pre-fetched recommendations passed from parent
  includePeaceMode: boolean;
  assignOnlyPositive: boolean;
  maxRecommendations: number;
  showForFullTargets: boolean;
  defendingWarsCount: number;
}

const StaggerRecommendationsCell: React.FC<StaggerRecommendationsCellProps> = ({ 
  rawRecommendations,
  includePeaceMode,
  assignOnlyPositive,
  maxRecommendations,
  showForFullTargets,
  defendingWarsCount
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Apply filters client-side whenever filter settings change
  const filteredRecommendations = React.useMemo(() => {
    let filtered = [...rawRecommendations];
    
    // Apply "Include Peace Mode" filter
    if (!includePeaceMode) {
      filtered = filtered.filter(rec => rec.inWarMode);
    }
    
    // Apply "Assign only positive" filter - only show attackers with >= 100% NS
    if (assignOnlyPositive) {
      filtered = filtered.filter(rec => rec.strengthRatio >= 1.0);
    }
    
    return filtered;
  }, [rawRecommendations, includePeaceMode, assignOnlyPositive]);

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

  // If showForFullTargets is false and nation has full defending war slots (3), don't show assignments
  if (!showForFullTargets && defendingWarsCount >= 3) {
    return <span className="text-gray-400 text-[9px]">Full</span>;
  }

  if (filteredRecommendations.length === 0) {
    return <span className="text-gray-400 text-[9px]">None</span>;
  }

  const totalRecommendations = filteredRecommendations.length;
  const displayedRecommendations = isExpanded ? filteredRecommendations : filteredRecommendations.slice(0, maxRecommendations);
  const hasMore = totalRecommendations > maxRecommendations;

  return (
    <div className={tableClasses.assignmentCell.container}>
      {displayedRecommendations.map((attacker) => (
        <div key={attacker.id} className={tableClasses.assignmentCell.row}>
          <div className={tableClasses.assignmentCell.nationName}>
            <div className="flex items-center min-w-0">
              <a 
                href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${attacker.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 no-underline font-bold hover:underline overflow-hidden overflow-ellipsis whitespace-nowrap flex-1 min-w-0"
                title={`${attacker.name} / ${attacker.ruler}`}
              >
                {attacker.name} / {attacker.ruler}
              </a>
              {!attacker.inWarMode && (
                <span className="ml-1 flex-shrink-0">
                  <WarStatusBadge inWarMode={false} variant="inline" />
                </span>
              )}
            </div>
          </div>
          <div className={tableClasses.assignmentCell.strengthBadge}>
            {attacker.strengthRatio && (
              <NSPercentageBadge strengthRatio={attacker.strengthRatio} />
            )}
          </div>
          <div className={tableClasses.assignmentCell.alliance} title={attacker.alliance || 'None'}>
            {attacker.alliance || 'None'}
          </div>
          <div className={tableClasses.assignmentCell.strength}>
            {formatNumber(attacker.strength)} NS
          </div>
          <div className={tableClasses.assignmentCell.technology}>
            {formatTechnology(attacker.technology)} Tech
          </div>
          <div className={tableClasses.assignmentCell.nukes}>
            {attacker.nuclearWeapons} nukes
          </div>
          <div className={`${tableClasses.assignmentCell.wars} ${attacker.currentWars > 0 ? 'text-red-400 font-bold' : ''}`}>
            {attacker.currentWars !== undefined && attacker.currentWars > 0 ? `${attacker.currentWars} war${attacker.currentWars !== 1 ? 's' : ''}` : '—'}
          </div>
        </div>
      ))}
      {hasMore && (
        <div 
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 px-2 py-1 bg-yellow-900/30 border border-yellow-700 rounded text-yellow-400 font-bold text-[9px] cursor-pointer select-none hover:bg-yellow-900/40"
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
  };
  attackingWars: War[];
  defendingWars: War[];
  staggeredStatus: {
    status: 'staggered' | 'same-day' | 'empty';
    color: string;
  };
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
  const [showForFullTargets, setShowForFullTargets] = useState<boolean>(true);
  const [allWarsEndingInDays, setAllWarsEndingInDays] = useState<boolean>(false);
  const [warsEndingInDays, setWarsEndingInDays] = useState<number>(7);
  const { alliances } = useAlliances();
  const [assignAllianceIds, setAssignAllianceIds] = useState<number[]>([]);
  const [staggerRecommendationsMap, setStaggerRecommendationsMap] = useState<Map<number, any[]>>(new Map());
  const [sellDownEnabled, setSellDownEnabled] = useState<boolean>(false);
  const [militaryNS, setMilitaryNS] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');

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
    setShowForFullTargets(parseBooleanParam(searchParams.get('showForFullTargets'), true)); // default true
    setUrgentTargets(parseBooleanParam(searchParams.get('urgentTargets')));
    setBlownStaggers(parseBooleanParam(searchParams.get('blownStaggers')));
    setShowPMNations(parseBooleanParam(searchParams.get('showPMNations')));
    setAllWarsEndingInDays(parseBooleanParam(searchParams.get('allWarsEndingInDays')));
    const maxRecsParam = searchParams.get('maxRecommendations');
    if (maxRecsParam) {
      const parsed = parseInt(maxRecsParam);
      if (!isNaN(parsed) && parsed > 0) {
        setMaxRecommendations(parsed);
      }
    }
    const warsEndingParam = searchParams.get('warsEndingInDays');
    if (warsEndingParam) {
      const parsed = parseInt(warsEndingParam);
      if (!isNaN(parsed) && parsed > 0) {
        setWarsEndingInDays(parsed);
      }
    }
    setSellDownEnabled(parseBooleanParam(searchParams.get('sellDownEnabled')));
    const militaryNSParam = searchParams.get('militaryNS');
    if (militaryNSParam) {
      const parsed = parseInt(militaryNSParam);
      if (!isNaN(parsed) && parsed >= 0) {
        setMilitaryNS(parsed);
      }
    }
    const searchParam = searchParams.get('search');
    if (searchParam) {
      setSearchQuery(searchParam);
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

  // Use column and header classes from tableClasses
  const columnClasses = tableClasses.defendingWarsColumns;
  const headerClasses = tableClasses.defendingWarsHeaders;

  useEffect(() => {
    if (allianceId) {
      fetchNationWars();
    }
  }, [allianceId]);

  // Fetch all stagger recommendations once when assign alliances change
  useEffect(() => {
    const fetchAllStaggerRecommendations = async () => {
      if (assignAllianceIds.length === 0) {
        setStaggerRecommendationsMap(new Map());
        return;
      }

      try {
        const newMap = new Map<number, any[]>();

        // Fetch stagger eligibility data for each assign alliance
        for (const assignAllianceId of assignAllianceIds) {
          try {
            const url = `${API_ENDPOINTS.staggerEligibility}/${assignAllianceId}/${allianceId}?hideAnarchy=true&hidePeaceMode=false&hideNonPriority=false&includeFullTargets=true&sellDownEnabled=${sellDownEnabled}&militaryNS=${militaryNS}`;
            const response = await apiCall(url);
            const data = await response.json();

            if (data.success && data.staggerData) {
              // Store recommendations for each defending nation
              data.staggerData.forEach((item: any) => {
                const defendingNationId = item.defendingNation.id;
                const existingRecs = newMap.get(defendingNationId) || [];
                
                // Add eligible attackers for this nation
                if (item.eligibleAttackers) {
                  existingRecs.push(...item.eligibleAttackers);
                }
                
                newMap.set(defendingNationId, existingRecs);
              });
            }
          } catch (err) {
            console.error(`Failed to fetch stagger recommendations for alliance ${assignAllianceId}:`, err);
          }
        }

        // Remove duplicates and sort for each nation
        newMap.forEach((recommendations, nationId) => {
          const uniqueRecs = recommendations
            .filter((rec, index, self) => 
              index === self.findIndex(r => r.id === rec.id)
            )
            .sort((a, b) => b.strength - a.strength);
          
          newMap.set(nationId, uniqueRecs);
        });

        setStaggerRecommendationsMap(newMap);
      } catch (err) {
        console.error('Failed to fetch stagger recommendations:', err);
        setStaggerRecommendationsMap(new Map());
      }
    };

    fetchAllStaggerRecommendations();
  }, [assignAllianceIds, allianceId, sellDownEnabled, militaryNS]);



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

  const renderCondensedWarStats = (strength: number, technology: string, nuclearWeapons: number) => {
    const techValue = formatTechnology(technology).replace(/K/g, 'k');
    const nukesBackground = getNuclearWeaponsColor(nuclearWeapons);
    return (
      <span className="inline-flex items-center gap-1 text-[9px] text-gray-400">
        <span>{`${formatNumber(strength)}NS`}</span>
        <span>|</span>
        <span>{techValue}</span>
        <span>|</span>
        <span
          className="px-1 rounded text-gray-200 font-semibold"
          style={{ backgroundColor: nukesBackground }}
        >
          {nuclearWeapons}
        </span>
      </span>
    );
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
    if (!lastNukedDate) return EMPTY_CELL_BG;
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

  // Filter to hide nations in peace mode if showPMNations is false
  // This must run FIRST before other filters that check inWarMode
  if (!showPMNations) {
    filteredNationWars = filteredNationWars.filter(nationWar => {
      return nationWar.nation.inWarMode;
    });
  }

  // Filter to only show nations that need stagger if needsStagger is true
  // When showPMNations is true, always show PM nations; otherwise only show war mode nations that need stagger
  if (needsStagger) {
    filteredNationWars = filteredNationWars.filter(nationWar => {
      // If showPMNations is true and this is a PM nation, always show it
      if (showPMNations && !nationWar.nation.inWarMode) {
        return true;
      }
      // Otherwise, only show war mode nations that need stagger
      return nationWar.nation.inWarMode && nationWar.staggeredStatus.status !== 'staggered';
    });
  }

  // Filter to only show nations that need staggers if staggerOnly is true (for target assignment)
  // When showPMNations is true, always show PM nations; otherwise only show war mode nations that need stagger
  if (staggerOnly && assignAllianceIds.length > 0) {
    filteredNationWars = filteredNationWars.filter(nationWar => {
      // If showPMNations is true and this is a PM nation, always show it
      if (showPMNations && !nationWar.nation.inWarMode) {
        return true;
      }
      // Otherwise, only show war mode nations that need stagger
      return nationWar.nation.inWarMode && nationWar.staggeredStatus.status !== 'staggered';
    });
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

  // Filter to show only urgent targets (newest war expires in 0 or 1 days, or no defending wars)
  if (urgentTargets) {
    filteredNationWars = filteredNationWars.filter(nationWar => {
      // Show nations with no defending wars as urgent targets
      if (nationWar.defendingWars.length === 0) return true;
      
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

  // Filter to show only nations where all wars end within X days
  if (allWarsEndingInDays) {
    filteredNationWars = filteredNationWars.filter(nationWar => {
      // Get all wars (attacking + defending)
      const allWars = [...nationWar.attackingWars, ...nationWar.defendingWars];
      
      // If no wars, exclude this nation
      if (allWars.length === 0) {
        return false;
      }
      
      // Check if ALL wars end within the specified number of days
      return allWars.every(war => {
        const daysUntilExpiration = war.daysUntilExpiration ?? 0;
        return daysUntilExpiration <= warsEndingInDays;
      });
    });
  }

  // Search filter: only show nations that:
  // 1) have a war (attacking or defending)
  // 2) are eligible for assignment (have recommendations)
  // 3) match the search query (nation name, ruler name, or alliance - matches defending nation, assigned attackers, or any nation in war rows)
  if (searchQuery.trim()) {
    const lowerQuery = searchQuery.toLowerCase().trim();
    filteredNationWars = filteredNationWars.filter(nationWar => {
      // Check if nation has at least one war
      const hasWar = nationWar.attackingWars.length > 0 || nationWar.defendingWars.length > 0;
      
      // Check if nation is eligible for assignment (has recommendations)
      const hasRecommendations = staggerRecommendationsMap.has(nationWar.nation.id) && 
                                  (staggerRecommendationsMap.get(nationWar.nation.id)?.length ?? 0) > 0;
      
      // Check if defending nation matches search query
      const defendingMatches = 
        nationWar.nation.name.toLowerCase().includes(lowerQuery) ||
        nationWar.nation.ruler.toLowerCase().includes(lowerQuery) ||
        nationWar.nation.alliance.toLowerCase().includes(lowerQuery);
      
      // Check if any assigned attacker matches search query
      const recommendations = staggerRecommendationsMap.get(nationWar.nation.id) || [];
      const assignmentMatches = recommendations.some(attacker => 
        attacker.name?.toLowerCase().includes(lowerQuery) ||
        attacker.ruler?.toLowerCase().includes(lowerQuery) ||
        attacker.alliance?.toLowerCase().includes(lowerQuery)
      );
      
      // Check if any nation in the attacking wars matches search query
      const attackingWarMatches = nationWar.attackingWars.some(war => 
        war.defendingNation.name.toLowerCase().includes(lowerQuery) ||
        war.defendingNation.ruler.toLowerCase().includes(lowerQuery) ||
        war.defendingNation.alliance.toLowerCase().includes(lowerQuery)
      );
      
      // Check if any nation in the defending wars matches search query
      const defendingWarMatches = nationWar.defendingWars.some(war => 
        war.attackingNation.name.toLowerCase().includes(lowerQuery) ||
        war.attackingNation.ruler.toLowerCase().includes(lowerQuery) ||
        war.attackingNation.alliance.toLowerCase().includes(lowerQuery)
      );
      
      const matchesQuery = defendingMatches || assignmentMatches || attackingWarMatches || defendingWarMatches;
      
      return hasWar && hasRecommendations && matchesQuery;
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
        <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg">
          <h4 className="m-0 mb-3 text-sm font-bold text-gray-200">
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
              <FilterCheckbox
                label="Show for full targets"
                checked={showForFullTargets}
                onChange={(checked) => {
                  setShowForFullTargets(checked);
                  updateUrlParams({ showForFullTargets: checked.toString() });
                }}
              />
              <div className="flex items-center gap-1.5">
                <label className="text-sm text-gray-200 font-medium whitespace-nowrap">
                  Max recommendations:
                </label>
                <select
                  value={maxRecommendations}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    setMaxRecommendations(value);
                    updateUrlParams({ maxRecommendations: value.toString() });
                  }}
                  className="w-[80px] px-2 py-1 text-sm text-gray-200 font-medium border border-gray-600 rounded text-center bg-gray-800 focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30].map(num => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-1.5 p-2 border border-gray-600 rounded bg-gray-800">
                <FilterCheckbox
                  label="Sell down?"
                  checked={sellDownEnabled}
                  onChange={(checked) => {
                    setSellDownEnabled(checked);
                    updateUrlParams({ sellDownEnabled: checked.toString() });
                  }}
                />
                <div className="flex items-center gap-1.5">
                  <label className="text-sm text-gray-200 font-medium whitespace-nowrap">
                    Fixed Military NS to drop:
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    min="0"
                    value={militaryNS}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (!isNaN(value) && value >= 0) {
                        setMilitaryNS(value);
                        updateUrlParams({ militaryNS: value.toString() });
                      }
                    }}
                    disabled={!sellDownEnabled}
                    className="w-[80px] px-2 py-1 text-sm text-gray-200 font-medium border border-gray-600 rounded text-center bg-gray-800 focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 disabled:bg-gray-700 disabled:text-gray-500 touch-manipulation"
                  />
                </div>
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
          <div className="flex items-center gap-1.5 p-2 border border-gray-600 rounded bg-gray-800">
            <FilterCheckbox
              label="Wars ending in under"
              checked={allWarsEndingInDays}
              onChange={(checked) => {
                setAllWarsEndingInDays(checked);
                updateUrlParams({ allWarsEndingInDays: checked.toString() });
              }}
            />
            <select
              value={warsEndingInDays}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                setWarsEndingInDays(value);
                updateUrlParams({ warsEndingInDays: value.toString() });
              }}
              disabled={!allWarsEndingInDays}
              className="w-[80px] px-2 py-1 text-sm text-gray-200 font-medium border border-gray-600 rounded text-center bg-gray-800 focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 disabled:bg-gray-700 disabled:text-gray-500"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
            <span className="text-sm text-gray-200 font-medium">days</span>
          </div>
        </div>

        {/* Search Field */}
        <div className="w-full">
          <input
            type="text"
            value={searchQuery}
            placeholder="Search any nation in table (name, ruler, or alliance)"
            onChange={(e) => {
              setSearchQuery(e.target.value);
              updateUrlParams({ search: e.target.value || null });
            }}
            className="w-full px-3 md:px-4 py-2 md:py-3 border-2 border-gray-600 rounded-lg text-sm md:text-base font-medium bg-gray-800 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 hover:border-gray-500"
          />
          {searchQuery && (
            <p className="mt-1 text-xs text-gray-400">
              Showing nations with wars AND eligible for assignment matching "{searchQuery}"
            </p>
          )}
        </div>
      </div>

      {/* Nation Wars Table */}
      {filteredNationWars.length > 0 ? (
        <div className="overflow-x-auto w-full max-w-none">
          <table className="border-collapse border border-slate-300 text-sm min-w-[1600px] w-full">
              <thead>
                <tr className="bg-gray-800">
                  <th className={`${headerClasses.default} sticky left-0 z-[200] bg-gray-800 shadow-[2px_0_8px_-2px_rgba(0,0,0,0.3),1px_0_0_0_#999]`}>Nation</th>
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
                        <span className={`text-[10px] ${nationWar.nation.governmentType.toLowerCase() === 'anarchy' ? 'text-red-400 font-bold' : 'text-gray-400 font-normal'}`}>
                          {formatNumber(nationWar.nation.strength)} NS / {formatTechnology(nationWar.nation.technology)} Tech
                        </span>
                        <br />
                        <WarStatusBadge inWarMode={nationWar.nation.inWarMode} />
                      </div>
                    </td>
                    {/* Nuclear Weapons Column */}
                    <td 
                      className={columnClasses.nukes}
                      style={{ backgroundColor: getNuclearWeaponsColor(nationWar.nation.nuclearWeapons) }}
                    >
                      <div className="text-xs font-bold text-red-400">
                        {nationWar.nation.nuclearWeapons}
                      </div>
                    </td>
                    {/* Last Nuked Column */}
                    <td 
                      className={columnClasses.lastNuked}
                      style={{ backgroundColor: getLastNukedCellColor(nationWar.nation.lastNukedDate) }}
                    >
                      <div className={`text-[11px] font-semibold ${nationWar.nation.lastNukedDate ? 'text-gray-800' : 'text-gray-200'}`}>
                        {formatLastNukedDisplay(nationWar.nation.lastNukedDate)}
                      </div>
                    </td>
                    {/* Attacking Wars Columns */}
                    {[0, 1, 2, 3].map(index => {
                      const attackingWar = nationWar.attackingWars[index];
                      const defendingNation = attackingWar?.defendingNation;
                      return (
                      <td
                        key={`attacking-${index}`}
                        className={columnClasses.war}
                        style={{ backgroundColor: attackingWar ? (attackingWar.expirationColor || '#e8f5e8') : EMPTY_CELL_BG }}
                      >
                        {attackingWar && defendingNation ? (
                          <div className="text-[11px]">
                            <div className="font-bold mb-0.5 text-blue-400">
                              <a 
                                href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${defendingNation.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 no-underline hover:underline"
                              >
                                {defendingNation.ruler} / {defendingNation.name}
                              </a>
                            </div>
                            <div className="text-[9px] text-gray-400 mb-0.5">
                              {defendingNation.alliance}
                            </div>
                            <div className="mb-0.5">
                              {renderCondensedWarStats(defendingNation.strength, defendingNation.technology, defendingNation.nuclearWeapons)}
                            </div>
                            <div className="text-[9px] text-gray-400">
                              {attackingWar.formattedEndDate || attackingWar.endDate}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-[10px]">Empty</span>
                        )}
                      </td>
                      );
                    })}
                    {/* Defending Wars Columns */}
                    {[0, 1, 2].map(index => {
                      const defendingWar = nationWar.defendingWars[index];
                      const attackingNation = defendingWar?.attackingNation;
                      return (
                      <td
                        key={`defending-${index}`}
                        className={columnClasses.war}
                        style={{ backgroundColor: defendingWar ? (defendingWar.expirationColor || '#e8f5e8') : EMPTY_CELL_BG }}
                      >
                        {defendingWar && attackingNation ? (
                          <div className="text-[11px]">
                            <div className="font-bold mb-0.5 text-red-400">
                              <a 
                                href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${attackingNation.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-red-400 no-underline hover:underline"
                              >
                                {attackingNation.ruler} / {attackingNation.name}
                              </a>
                            </div>
                            <div className="text-[9px] text-gray-400 mb-0.5">
                              {attackingNation.alliance}
                            </div>
                            <div className="mb-0.5">
                              {renderCondensedWarStats(attackingNation.strength, attackingNation.technology, attackingNation.nuclearWeapons)}
                            </div>
                            <div className="text-[9px] text-gray-400">
                              {defendingWar.formattedEndDate || defendingWar.endDate}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-[10px]">Empty</span>
                        )}
                      </td>
                      );
                    })}
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
                          return <span className="text-green-400 text-[10px] font-bold">✓</span>;
                        } else {
                          return <span className="text-red-400 text-[10px] font-bold">⚠</span>;
                        }
                      })()}
                    </td>
                    {/* PM Column */}
                    <td 
                      className={columnClasses.pm}
                      style={{ backgroundColor: shouldBeInPeaceMode(nationWar.nation.nuclearWeapons, nationWar.nation.governmentType, nationWar.attackingWars, nationWar.defendingWars) ? '#ffebee' : EMPTY_CELL_BG }}
                    >
                      {shouldBeInPeaceMode(nationWar.nation.nuclearWeapons, nationWar.nation.governmentType, nationWar.attackingWars, nationWar.defendingWars) ? (
                        <span className="text-red-400 text-[10px] font-bold">✓</span>
                      ) : (
                        <span className="text-gray-400 text-[10px]">—</span>
                      )}
                    </td>
                    {/* Stagger Recommendations Column */}
                    <td 
                      className={columnClasses.assignments}
                    >
                      {assignAllianceIds.length > 0 ? (
                        <StaggerRecommendationsCell 
                          rawRecommendations={staggerRecommendationsMap.get(nationWar.nation.id) || []}
                          includePeaceMode={includePeaceMode}
                          assignOnlyPositive={assignOnlyPositive}
                          maxRecommendations={maxRecommendations}
                          showForFullTargets={showForFullTargets}
                          defendingWarsCount={nationWar.defendingWars.length}
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
        <div className="text-center p-10 text-gray-400">
          No results found with current filters.
        </div>
      )}
    </div>
  );
};

export default DefendingWarsTable;
