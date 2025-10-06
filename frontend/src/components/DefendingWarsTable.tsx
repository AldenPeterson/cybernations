import React, { useState, useEffect } from 'react';
import WarStatusBadge from './WarStatusBadge';
import { apiCall, API_ENDPOINTS } from '../utils/api';

interface StaggerRecommendationsCellProps {
  defendingNation: {
    id: number;
    name: string;
    ruler: string;
    alliance: string;
    allianceId: number;
    strength: number;
    activity: string;
    inWarMode: boolean;
    nuclearWeapons: number;
    governmentType: string;
  };
  staggeringAllianceId: number;
}

const StaggerRecommendationsCell: React.FC<StaggerRecommendationsCellProps> = ({ 
  defendingNation, 
  staggeringAllianceId 
}) => {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (staggeringAllianceId && defendingNation.id) {
      // Add a small delay to prevent too many simultaneous requests
      const timeoutId = setTimeout(() => {
        fetchStaggerRecommendations();
      }, 100);
      
      return () => {
        clearTimeout(timeoutId);
        setRecommendations([]);
        setLoading(false);
      };
    }
    
    return () => {
      setRecommendations([]);
      setLoading(false);
    };
  }, [staggeringAllianceId, defendingNation.id]);

  const fetchStaggerRecommendations = async () => {
    try {
      setLoading(true);
      const url = `${API_ENDPOINTS.staggerEligibility}/${staggeringAllianceId}/${defendingNation.allianceId}?hideAnarchy=true&hidePeaceMode=true&hideNonPriority=false`;
      const response = await apiCall(url);
      const data = await response.json();
      
      if (data.success) {
        // Find recommendations for this specific defending nation
        const nationRecommendations = data.staggerData.find(
          (item: any) => item.defendingNation.id === defendingNation.id
        );
        setRecommendations(nationRecommendations?.eligibleAttackers || []);
      } else {
        setRecommendations([]);
      }
    } catch (err) {
      console.error('Failed to fetch stagger recommendations:', err);
      setRecommendations([]);
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
    return tech.toString();
  };

  if (loading) {
    return <span style={{ color: '#666', fontSize: '9px' }}>Loading...</span>;
  }

  if (recommendations.length === 0) {
    return <span style={{ color: '#999', fontSize: '9px' }}>None</span>;
  }

  return (
    <div style={{ fontSize: '9px', textAlign: 'left' }}>
      {recommendations.slice(0, 3).map((attacker) => (
        <div key={attacker.id} style={{ marginBottom: '3px', lineHeight: '1.2', fontFamily: 'monospace' }}>
          <a 
            href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${attacker.id}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ 
              color: '#1976d2', 
              textDecoration: 'none',
              fontWeight: 'bold'
            }}
            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
          >
            {attacker.name} / {attacker.ruler}
          </a>
          <span style={{ color: '#666', marginLeft: '8px' }}>
            | {formatNumber(attacker.strength).padStart(8)} NS | {formatTechnology(attacker.technology).padStart(8)} Tech | {attacker.nuclearWeapons.toString().padStart(2)} nukes
          </span>
        </div>
      ))}
      {recommendations.length > 3 && (
        <div style={{ color: '#666', fontSize: '8px', fontStyle: 'italic' }}>
          +{recommendations.length - 3} more
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
    activity: string;
    inWarMode: boolean;
    nuclearWeapons: number;
    governmentType: string;
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
  const [nationWars, setNationWars] = useState<NationWars[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includePeaceMode, setIncludePeaceMode] = useState<boolean>(false);
  const [needsStagger, setNeedsStagger] = useState<boolean>(false);
  const [alliances, setAlliances] = useState<Alliance[]>([]);
  const [staggeringAllianceId, setStaggeringAllianceId] = useState<number | null>(null);

  // Column styles
  const columnStyles = {
    nation: {
      padding: '2px 2px',
      border: '1px solid #ddd',
      backgroundColor: '#f8f9fa', // Default, will be overridden by activity color
      minWidth: '150px',
      maxWidth: '200px',
      width: '150px'
    },
    nukes: {
      padding: '2px 2px',
      border: '1px solid #ddd',
      textAlign: 'center' as const,
      backgroundColor: '#f8f9fa', // Default, will be overridden by nuclear weapons color
      minWidth: '5px',
      maxWidth: '10px'

    },
    war: {
      padding: '2px 3px',
      border: '1px solid #ddd',
      textAlign: 'center' as const,
      backgroundColor: '#ffffff',
      width: '40px'
    },
    staggered: {
      padding: '4px 6px',
      border: '1px solid #ddd',
      textAlign: 'center' as const,
      backgroundColor: '#ffffff',
      minWidth: '80px'
    },
    pm: {
      padding: '4px 6px',
      border: '1px solid #ddd',
      textAlign: 'center' as const,
      backgroundColor: '#ffffff',
      minWidth: '50px'
    }
  };

  // Header styles
  const headerStyles = {
    default: {
      padding: '8px 6px',
      border: '1px solid #ddd',
      textAlign: 'left' as const,
      color: 'white',
      fontWeight: 'bold'
    },
    center: {
      padding: '8px 6px',
      border: '1px solid #ddd',
      textAlign: 'center' as const,
      color: 'white',
      fontWeight: 'bold'
    }
  };

  useEffect(() => {
    if (allianceId) {
      fetchNationWars();
    }
  }, [allianceId, includePeaceMode, needsStagger]);

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
      const response = await apiCall(`${API_ENDPOINTS.nationWars(allianceId)}?includePeaceMode=${includePeaceMode}&needsStagger=${needsStagger}`);
      const data = await response.json();
      
      if (data.success) {
        setNationWars(data.nationWars);
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

  const shouldBeInPeaceMode = (nuclearWeapons: number, governmentType: string, attackingWars: War[], defendingWars: War[]): boolean => {
    return (governmentType.toLowerCase() === 'anarchy'  || nuclearWeapons < 20) && 
           (attackingWars.length === 0 && 
           defendingWars.length === 0);
  };





  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading defending wars...</div>;
  }

  if (error) {
    return <div style={{ padding: '20px', color: 'red' }}>Error: {error}</div>;
  }

  return (
    <div style={{ width: '100%', maxWidth: 'none' }}>
      {/* Color Legend */}
      <div style={{ 
        marginBottom: '20px', 
        padding: '15px',
        backgroundColor: '#000000',
        border: '1px solid #333',
        borderRadius: '8px',
        fontSize: '13px'
      }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold', color: '#ffffff' }}>
          Color Legend
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
          {/* War Expiration Colors */}
          <div>
            <strong style={{ color: '#ffffff', fontSize: '12px' }}>War Expiration:</strong>
            <div style={{ display: 'flex', alignItems: 'center', margin: '3px 0' }}>
              <div style={{ width: '18px', height: '18px', backgroundColor: '#ffebee', border: '1px solid #666', marginRight: '8px' }}></div>
              <span style={{ fontSize: '11px', color: '#ffffff' }}>Expires today/tomorrow</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', margin: '3px 0' }}>
              <div style={{ width: '18px', height: '18px', backgroundColor: '#fff3e0', border: '1px solid #666', marginRight: '8px' }}></div>
              <span style={{ fontSize: '11px', color: '#ffffff' }}>Expires in 2 days</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', margin: '3px 0' }}>
              <div style={{ width: '18px', height: '18px', backgroundColor: '#fffde7', border: '1px solid #666', marginRight: '8px' }}></div>
              <span style={{ fontSize: '11px', color: '#ffffff' }}>Expires in 3 days</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', margin: '3px 0' }}>
              <div style={{ width: '18px', height: '18px', backgroundColor: '#e8f5e8', border: '1px solid #666', marginRight: '8px' }}></div>
              <span style={{ fontSize: '11px', color: '#ffffff' }}>Expires in 4+ days</span>
            </div>
          </div>

          {/* Activity Colors */}
          <div>
            <strong style={{ color: '#ffffff', fontSize: '12px' }}>Activity Status:</strong>
            <div style={{ display: 'flex', alignItems: 'center', margin: '3px 0' }}>
              <div style={{ width: '18px', height: '18px', backgroundColor: '#d4edda', border: '1px solid #666', marginRight: '8px' }}></div>
              <span style={{ fontSize: '11px', color: '#ffffff' }}>Active last 3 days</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', margin: '3px 0' }}>
              <div style={{ width: '18px', height: '18px', backgroundColor: '#fff3cd', border: '1px solid #666', marginRight: '8px' }}></div>
              <span style={{ fontSize: '11px', color: '#ffffff' }}>Active this week</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', margin: '3px 0' }}>
              <div style={{ width: '18px', height: '18px', backgroundColor: '#ffeaa7', border: '1px solid #666', marginRight: '8px' }}></div>
              <span style={{ fontSize: '11px', color: '#ffffff' }}>Active last week</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', margin: '3px 0' }}>
              <div style={{ width: '18px', height: '18px', backgroundColor: '#f8d7da', border: '1px solid #666', marginRight: '8px' }}></div>
              <span style={{ fontSize: '11px', color: '#ffffff' }}>Inactive 3+ weeks</span>
            </div>
          </div>

          {/* Nuclear Weapons Colors */}
          <div>
            <strong style={{ color: '#ffffff', fontSize: '12px' }}>Nuclear Weapons:</strong>
            <div style={{ display: 'flex', alignItems: 'center', margin: '3px 0' }}>
              <div style={{ width: '18px', height: '18px', backgroundColor: '#ffebee', border: '1px solid #666', marginRight: '8px' }}></div>
              <span style={{ fontSize: '11px', color: '#ffffff' }}>&lt; 10 nukes</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', margin: '3px 0' }}>
              <div style={{ width: '18px', height: '18px', backgroundColor: '#fffde7', border: '1px solid #666', marginRight: '8px' }}></div>
              <span style={{ fontSize: '11px', color: '#ffffff' }}>10-18 nukes</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', margin: '3px 0' }}>
              <div style={{ width: '18px', height: '18px', backgroundColor: '#e8f5e8', border: '1px solid #666', marginRight: '8px' }}></div>
              <span style={{ fontSize: '11px', color: '#ffffff' }}>&gt; 18 nukes</span>
            </div>
          </div>

          {/* Other Colors */}
          <div>
            <strong style={{ color: '#ffffff', fontSize: '12px' }}>Other Indicators:</strong>
            <div style={{ display: 'flex', alignItems: 'center', margin: '3px 0' }}>
              <div style={{ width: '18px', height: '18px', backgroundColor: '#d32f2f', border: '1px solid #666', marginRight: '8px' }}></div>
              <span style={{ fontSize: '11px', color: '#ffffff' }}>Nation in anarchy (red text)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', margin: '3px 0' }}>
              <div style={{ width: '18px', height: '18px', backgroundColor: '#e8f5e8', border: '1px solid #666', marginRight: '8px' }}></div>
              <span style={{ fontSize: '11px', color: '#ffffff' }}>Staggered wars</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', margin: '3px 0' }}>
              <div style={{ width: '18px', height: '18px', backgroundColor: '#ffebee', border: '1px solid #666', marginRight: '8px' }}></div>
              <span style={{ fontSize: '11px', color: '#ffffff' }}>Should be in Peace Mode</span>
            </div>
          </div>
        </div>
      </div>

      {/* Nation Wars Table */}
      {nationWars.length > 0 ? (
        <div>
          {/* Filter Controls - positioned above table */}
          <div style={{ 
            marginBottom: '15px', 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px'
          }}>
            {/* Staggering Alliance Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ 
                fontSize: '13px',
                fontWeight: '500',
                color: '#333'
              }}>
                Staggering Alliance:
              </label>
              <select
                value={staggeringAllianceId || ''}
                onChange={(e) => setStaggeringAllianceId(e.target.value ? parseInt(e.target.value) : null)}
                style={{
                  padding: '6px 10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  backgroundColor: '#fff',
                  fontSize: '13px',
                  minWidth: '200px'
                }}
              >
                <option value="">Select alliance...</option>
                {alliances.filter(alliance => alliance.id !== allianceId).map(alliance => (
                  <option key={alliance.id} value={alliance.id}>
                    {alliance.name} ({alliance.nationCount} nations)
                  </option>
                ))}
              </select>
            </div>
            
            {/* Right side checkboxes */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              padding: '6px 10px',
              backgroundColor: '#f8f9fa',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              color: '#333'
            }}>
              <input
                type="checkbox"
                checked={needsStagger}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setNeedsStagger(checked);
                  // Auto-uncheck peacemode when needs stagger is selected
                  if (checked) {
                    setIncludePeaceMode(false);
                  }
                }}
                style={{ 
                  marginRight: '6px',
                  accentColor: '#dc3545',
                  transform: 'scale(1.1)'
                }}
              />
              Needs Stagger
            </label>
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              padding: '6px 10px',
              backgroundColor: '#f8f9fa',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              color: '#333'
            }}>
              <input
                type="checkbox"
                checked={includePeaceMode}
                onChange={(e) => setIncludePeaceMode(e.target.checked)}
                style={{ 
                  marginRight: '6px',
                  accentColor: '#007bff',
                  transform: 'scale(1.1)'
                }}
              />
              Include Peace Mode Nations
            </label>
            </div>
          </div>
          <div style={{ overflowX: 'auto', width: '100%', maxWidth: 'none' }}>
            <table style={{ 
              borderCollapse: 'collapse', 
              border: '1px solid #ddd',
              fontSize: '14px',
              minWidth: '1000px',
              width: '100%'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#343a40' }}>
                  <th style={headerStyles.default}>Nation</th>
                  <th style={headerStyles.center}>Nukes</th>
                  <th style={headerStyles.center}>Attacking War 1</th>
                  <th style={headerStyles.center}>Attacking War 2</th>
                  <th style={headerStyles.center}>Attacking War 3</th>
                  <th style={headerStyles.center}>Attacking War 4</th>
                  <th style={headerStyles.center}>Defending War 1</th>
                  <th style={headerStyles.center}>Defending War 2</th>
                  <th style={headerStyles.center}>Defending War 3</th>
                  <th style={headerStyles.center}>Staggered</th>
                  <th style={headerStyles.center}>Should PM?</th>
                  <th style={headerStyles.center}>Stagger Recs</th>
                </tr>
              </thead>
              <tbody>
                {nationWars.map((nationWar) => (
                  <tr key={nationWar.nation.id}>
                    <td style={{ 
                      ...columnStyles.nation,
                      backgroundColor: getActivityColor(nationWar.nation.activity)
                    }}>
                      <div style={{ fontSize: '12px' }}>
                        <strong>
                          <a 
                            href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${nationWar.nation.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ 
                              color: nationWar.nation.governmentType.toLowerCase() === 'anarchy' ? '#d32f2f' : '#007bff', 
                              textDecoration: 'none'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                          >
                            {nationWar.nation.name}
                          </a>
                        </strong>
                        <br />
                        <span style={{ 
                          color: nationWar.nation.governmentType.toLowerCase() === 'anarchy' ? '#d32f2f' : '#666', 
                          fontSize: '10px',
                          fontWeight: nationWar.nation.governmentType.toLowerCase() === 'anarchy' ? 'bold' : 'normal'
                        }}>
                          {nationWar.nation.ruler} • {formatNumber(nationWar.nation.strength)} NS
                        </span>
                        <br />
                        <WarStatusBadge inWarMode={nationWar.nation.inWarMode} />
                      </div>
                    </td>
                    {/* Nuclear Weapons Column */}
                    <td style={{ 
                      ...columnStyles.nukes,
                      backgroundColor: getNuclearWeaponsColor(nationWar.nation.nuclearWeapons)
                    }}>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#d32f2f' }}>
                        {nationWar.nation.nuclearWeapons}
                      </div>
                    </td>
                    {/* Attacking Wars Columns */}
                    {[0, 1, 2, 3].map(index => (
                      <td key={`attacking-${index}`} style={{ 
                        ...columnStyles.war,
                        backgroundColor: nationWar.attackingWars[index] ? (nationWar.attackingWars[index].expirationColor || '#e8f5e8') : '#ffffff'
                      }}>
                        {nationWar.attackingWars[index] ? (
                          <div style={{ fontSize: '11px' }}>
                            <div style={{ 
                              fontWeight: 'bold', 
                              marginBottom: '2px',
                              color: '#1976d2'
                            }}>
                              <a 
                                href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${nationWar.attackingWars[index].defendingNation.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ 
                                  color: '#1976d2', 
                                  textDecoration: 'none' 
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                              >
                                {nationWar.attackingWars[index].defendingNation.name}
                              </a>
                            </div>
                            <div style={{ fontSize: '9px', color: '#666', marginBottom: '2px' }}>
                              {nationWar.attackingWars[index].defendingNation.ruler} • {nationWar.attackingWars[index].defendingNation.alliance}
                            </div>
                            <div style={{ fontSize: '9px', color: '#666' }}>
                              Exp: {nationWar.attackingWars[index].formattedEndDate || nationWar.attackingWars[index].endDate}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#999', fontSize: '10px' }}>Empty</span>
                        )}
                      </td>
                    ))}
                    {/* Defending Wars Columns */}
                    {[0, 1, 2].map(index => (
                      <td key={`defending-${index}`} style={{ 
                        ...columnStyles.war,
                        backgroundColor: nationWar.defendingWars[index] ? (nationWar.defendingWars[index].expirationColor || '#e8f5e8') : '#ffffff'
                      }}>
                        {nationWar.defendingWars[index] ? (
                          <div style={{ fontSize: '11px' }}>
                            <div style={{ 
                              fontWeight: 'bold', 
                              marginBottom: '2px',
                              color: '#d32f2f'
                            }}>
                              <a 
                                href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${nationWar.defendingWars[index].attackingNation.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ 
                                  color: '#d32f2f', 
                                  textDecoration: 'none' 
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                              >
                                {nationWar.defendingWars[index].attackingNation.name}
                              </a>
                            </div>
                            <div style={{ fontSize: '9px', color: '#666', marginBottom: '2px' }}>
                              {nationWar.defendingWars[index].attackingNation.ruler} • {nationWar.defendingWars[index].attackingNation.alliance}
                            </div>
                            <div style={{ fontSize: '9px', color: '#666' }}>
                              Exp: {nationWar.defendingWars[index].formattedEndDate || nationWar.defendingWars[index].endDate}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#999', fontSize: '10px' }}>Empty</span>
                        )}
                      </td>
                    ))}
                    {/* Staggered Column */}
                    <td style={{ 
                      ...columnStyles.staggered,
                      backgroundColor: nationWar.staggeredStatus.color
                    }}>
                      {(() => {
                        const staggeredInfo = nationWar.staggeredStatus;
                        if (staggeredInfo.status === 'empty') {
                          return <span style={{ color: '#999', fontSize: '10px' }}>—</span>;
                        } else if (staggeredInfo.status === 'staggered') {
                          return <span style={{ color: '#2e7d32', fontSize: '10px', fontWeight: 'bold' }}>✓</span>;
                        } else {
                          return <span style={{ color: '#d32f2f', fontSize: '10px', fontWeight: 'bold' }}>⚠</span>;
                        }
                      })()}
                    </td>
                    {/* PM Column */}
                    <td style={{ 
                      ...columnStyles.pm,
                      backgroundColor: shouldBeInPeaceMode(nationWar.nation.nuclearWeapons, nationWar.nation.governmentType, nationWar.attackingWars, nationWar.defendingWars) ? '#ffebee' : '#ffffff'
                    }}>
                      {shouldBeInPeaceMode(nationWar.nation.nuclearWeapons, nationWar.nation.governmentType, nationWar.attackingWars, nationWar.defendingWars) ? (
                        <span style={{ color: '#d32f2f', fontSize: '10px', fontWeight: 'bold' }}>✓</span>
                      ) : (
                        <span style={{ color: '#999', fontSize: '10px' }}>—</span>
                      )}
                    </td>
                    {/* Stagger Recommendations Column */}
                    <td style={{ 
                      ...columnStyles.staggered,
                      backgroundColor: '#ffffff',
                      minWidth: '80px',
                      textAlign: 'left'
                    }}>
                      {staggeringAllianceId ? (
                        <StaggerRecommendationsCell 
                          defendingNation={nationWar.nation}
                          staggeringAllianceId={staggeringAllianceId}
                        />
                      ) : (
                        <span style={{ color: '#999', fontSize: '10px' }}>Select alliance</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          No active wars found for this alliance.
        </div>
      )}
    </div>
  );
};

export default DefendingWarsTable;
