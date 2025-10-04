import React, { useState, useEffect } from 'react';
import WarStatusBadge from './WarStatusBadge';

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
}

interface DefendingWarsStats {
  totalDefendingWars: number;
  totalAttackingWars: number;
  totalActiveWars: number;
  defendingByAlliance: Array<{
    allianceName: string;
    count: number;
  }>;
  attackingByAlliance: Array<{
    allianceName: string;
    count: number;
  }>;
}

interface DefendingWarsTableProps {
  allianceId: number;
}

const DefendingWarsTable: React.FC<DefendingWarsTableProps> = ({ allianceId }) => {
  const [nationWars, setNationWars] = useState<NationWars[]>([]);
  const [stats, setStats] = useState<DefendingWarsStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includePeaceMode, setIncludePeaceMode] = useState<boolean>(false);

  useEffect(() => {
    if (allianceId) {
      fetchNationWars();
      fetchDefendingWarsStats();
    }
  }, [allianceId, includePeaceMode]);

  const fetchNationWars = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/alliances/${allianceId}/nation-wars?includePeaceMode=${includePeaceMode}`);
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

  const fetchDefendingWarsStats = async () => {
    try {
      const response = await fetch(`/api/alliances/${allianceId}/defending-wars-stats`);
      const data = await response.json();
      
      if (data.success) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch defending wars stats:', err);
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

  const getGovernmentTypeColor = (governmentType: string): string => {
    if (governmentType.toLowerCase() === 'anarchy') {
      return '#ffebee'; // Light red for anarchy
    }
    return '#f8f9fa'; // Default light gray
  };

  const shouldBeInPeaceMode = (nuclearWeapons: number, governmentType: string, attackingWars: War[], defendingWars: War[]): boolean => {
    return (governmentType.toLowerCase() === 'anarchy'  || nuclearWeapons < 20) && 
           (attackingWars.length === 0 && 
           defendingWars.length === 0);
  };


  const formatWarEndDate = (endDate: string): string => {
    // Parse the date and add one day to show the day after the war actually ends
    const date = new Date(endDate);
    const nextDay = new Date(date.getTime() + (24 * 60 * 60 * 1000)); // Add 24 hours
    return nextDay.toLocaleDateString('en-US', { 
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const getDaysUntilExpiration = (endDate: string): number => {
    // Parse the end date and current time, both in UTC to avoid timezone issues
    const endDateObj = new Date(endDate);
    const now = new Date();
    
    // Set both dates to start of day in UTC to compare just the date part
    const endDateUTC = new Date(Date.UTC(endDateObj.getUTCFullYear(), endDateObj.getUTCMonth(), endDateObj.getUTCDate()));
    const nowUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    
    const diffTime = endDateUTC.getTime() - nowUTC.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const getStaggeredStatus = (defendingWars: War[]): { status: 'staggered' | 'same-day' | 'empty', color: string } => {
    if (defendingWars.length === 0) {
      return { status: 'empty', color: '#ffffff' };
    }
    
    if (defendingWars.length === 1) {
      return { status: 'empty', color: '#ffffff' };
    }
    
    // Get unique end dates (ignoring time, just the date part)
    const endDates = defendingWars.map(war => {
      const date = new Date(war.endDate);
      return date.toLocaleDateString('en-US', { 
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    });
    
    const uniqueDates = new Set(endDates);
    
    if (uniqueDates.size > 1) {
      return { status: 'staggered', color: '#e8f5e8' }; // Green for staggered
    } else {
      return { status: 'same-day', color: '#ffebee' }; // Red for same day
    }
  };

  const getWarExpirationColor = (endDate: string): string => {
    const daysUntilExpiration = getDaysUntilExpiration(endDate);
    
    if (daysUntilExpiration <= 1) {
      return '#ffebee'; // Light red for expires tomorrow or today
    } else if (daysUntilExpiration === 2) {
      return '#fff3e0'; // Light orange for expires in 2 days
    } else if (daysUntilExpiration === 3) {
      return '#fffde7'; // Light yellow for expires in 3 days
    } else {
      return '#e8f5e8'; // Light green for expires in more than 3 days
    }
  };

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading defending wars...</div>;
  }

  if (error) {
    return <div style={{ padding: '20px', color: 'red' }}>Error: {error}</div>;
  }

  return (
    <div>
      {/* War Statistics */}
      {stats && (
        <div style={{ 
          marginBottom: '20px', 
          padding: '15px', 
          backgroundColor: 'transparent', 
          borderRadius: '8px',
          border: '1px solid #ddd'
        }}>
          <h3>War Statistics</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            <div><strong>Total Active Wars:</strong> {stats.totalActiveWars}</div>
            <div><strong>Defending Wars:</strong> {stats.totalDefendingWars}</div>
            <div><strong>Attacking Wars:</strong> {stats.totalAttackingWars}</div>
          </div>
        </div>
      )}

      {/* Peace Mode Filter */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ 
          display: 'flex', 
          alignItems: 'center', 
          padding: '8px 12px',
          backgroundColor: '#f8f9fa',
          border: '1px solid #ddd',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '500',
          width: 'fit-content',
          color: '#333'
        }}>
          <input
            type="checkbox"
            checked={includePeaceMode}
            onChange={(e) => setIncludePeaceMode(e.target.checked)}
            style={{ 
              marginRight: '8px',
              accentColor: '#007bff',
              transform: 'scale(1.2)'
            }}
          />
          Include Peace Mode Nations
        </label>
      </div>

      {/* Nation Wars Table */}
      {nationWars.length > 0 ? (
        <div>
          <h2>Nation Wars</h2>
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ 
              width: '1600px',
              borderCollapse: 'collapse', 
              border: '1px solid #ddd',
              fontSize: '14px'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#343a40' }}>
                  <th style={{ padding: '8px 6px', border: '1px solid #ddd', textAlign: 'left', color: 'white', fontWeight: 'bold' }}>
                    Nation
                  </th>
                  <th style={{ padding: '8px 6px', border: '1px solid #ddd', textAlign: 'center', color: 'white', fontWeight: 'bold' }}>
                    Nukes
                  </th>
                  <th style={{ padding: '8px 6px', border: '1px solid #ddd', textAlign: 'center', color: 'white', fontWeight: 'bold' }}>
                    Gov
                  </th>
                  <th style={{ padding: '8px 6px', border: '1px solid #ddd', textAlign: 'center', color: 'white', fontWeight: 'bold' }}>
                    Attacking War 1
                  </th>
                  <th style={{ padding: '8px 6px', border: '1px solid #ddd', textAlign: 'center', color: 'white', fontWeight: 'bold' }}>
                    Attacking War 2
                  </th>
                  <th style={{ padding: '8px 6px', border: '1px solid #ddd', textAlign: 'center', color: 'white', fontWeight: 'bold' }}>
                    Attacking War 3
                  </th>
                  <th style={{ padding: '8px 6px', border: '1px solid #ddd', textAlign: 'center', color: 'white', fontWeight: 'bold' }}>
                    Attacking War 4
                  </th>
                  <th style={{ padding: '8px 6px', border: '1px solid #ddd', textAlign: 'center', color: 'white', fontWeight: 'bold' }}>
                    Defending War 1
                  </th>
                  <th style={{ padding: '8px 6px', border: '1px solid #ddd', textAlign: 'center', color: 'white', fontWeight: 'bold' }}>
                    Defending War 2
                  </th>
                  <th style={{ padding: '8px 6px', border: '1px solid #ddd', textAlign: 'center', color: 'white', fontWeight: 'bold' }}>
                    Defending War 3
                  </th>
                  <th style={{ padding: '8px 6px', border: '1px solid #ddd', textAlign: 'center', color: 'white', fontWeight: 'bold' }}>
                    Staggered
                  </th>
                  <th style={{ padding: '8px 6px', border: '1px solid #ddd', textAlign: 'center', color: 'white', fontWeight: 'bold' }}>
                    PM?
                  </th>
                </tr>
              </thead>
              <tbody>
                {nationWars.map((nationWar) => (
                  <tr key={nationWar.nation.id}>
                    <td style={{ 
                      padding: '4px 6px', 
                      border: '1px solid #ddd',
                      backgroundColor: getActivityColor(nationWar.nation.activity)
                    }}>
                      <div style={{ fontSize: '12px' }}>
                        <strong>
                          <a 
                            href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${nationWar.nation.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ 
                              color: '#007bff', 
                              textDecoration: 'none'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                          >
                            {nationWar.nation.name}
                          </a>
                        </strong>
                        <br />
                        <span style={{ color: '#666', fontSize: '10px' }}>
                          {nationWar.nation.ruler} • {formatNumber(nationWar.nation.strength)} NS
                        </span>
                        <br />
                        <WarStatusBadge inWarMode={nationWar.nation.inWarMode} />
                      </div>
                    </td>
                    {/* Nuclear Weapons Column */}
                    <td style={{ 
                      padding: '4px 6px', 
                      border: '1px solid #ddd', 
                      textAlign: 'center',
                      backgroundColor: getNuclearWeaponsColor(nationWar.nation.nuclearWeapons),
                      minWidth: '45px'
                    }}>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#d32f2f' }}>
                        {nationWar.nation.nuclearWeapons}
                      </div>
                    </td>
                    {/* Government Type Column */}
                    <td style={{ 
                      padding: '4px 6px', 
                      border: '1px solid #ddd', 
                      textAlign: 'center',
                      backgroundColor: getGovernmentTypeColor(nationWar.nation.governmentType),
                      minWidth: '60px'
                    }}>
                      <div style={{ fontSize: '10px', color: '#666' }}>
                        {nationWar.nation.governmentType}
                      </div>
                    </td>
                    {/* Attacking Wars Columns */}
                    {[0, 1, 2, 3].map(index => (
                      <td key={`attacking-${index}`} style={{ 
                        padding: '4px 6px', 
                        border: '1px solid #ddd', 
                        textAlign: 'center',
                        backgroundColor: nationWar.attackingWars[index] ? getWarExpirationColor(nationWar.attackingWars[index].endDate) : '#ffffff',
                        minWidth: '120px'
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
                              Exp: {formatWarEndDate(nationWar.attackingWars[index].endDate)}
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
                        padding: '4px 6px', 
                        border: '1px solid #ddd', 
                        textAlign: 'center',
                        backgroundColor: nationWar.defendingWars[index] ? getWarExpirationColor(nationWar.defendingWars[index].endDate) : '#ffffff',
                        minWidth: '120px'
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
                              Exp: {formatWarEndDate(nationWar.defendingWars[index].endDate)}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#999', fontSize: '10px' }}>Empty</span>
                        )}
                      </td>
                    ))}
                    {/* Staggered Column */}
                    <td style={{ 
                      padding: '4px 6px', 
                      border: '1px solid #ddd', 
                      textAlign: 'center',
                      backgroundColor: getStaggeredStatus(nationWar.defendingWars).color,
                      minWidth: '80px'
                    }}>
                      {(() => {
                        const staggeredInfo = getStaggeredStatus(nationWar.defendingWars);
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
                      padding: '4px 6px', 
                      border: '1px solid #ddd', 
                      textAlign: 'center',
                      backgroundColor: shouldBeInPeaceMode(nationWar.nation.nuclearWeapons, nationWar.nation.governmentType, nationWar.attackingWars, nationWar.defendingWars) ? '#ffebee' : '#ffffff',
                      minWidth: '50px'
                    }}>
                      {shouldBeInPeaceMode(nationWar.nation.nuclearWeapons, nationWar.nation.governmentType, nationWar.attackingWars, nationWar.defendingWars) ? (
                        <span style={{ color: '#d32f2f', fontSize: '10px', fontWeight: 'bold' }}>✓</span>
                      ) : (
                        <span style={{ color: '#999', fontSize: '10px' }}>—</span>
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
