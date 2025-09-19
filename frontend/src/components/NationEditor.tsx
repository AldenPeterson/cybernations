import { useState, useEffect } from 'react';

interface NationSlots {
  sendTech: number;
  sendCash: number;
  getTech: number;
  getCash: number;
}

interface NationConfig {
  nation_id: number;
  ruler_name: string;
  nation_name: string;
  discord_handle: string;
  has_dra: boolean;
  notes?: string;
  slots: NationSlots;
  current_stats?: {
    technology: string;
    infrastructure: string;
    strength: string;
  };
}

interface NationEditorProps {
  allianceId: number;
}

export default function NationEditor({ allianceId }: NationEditorProps) {
  const [nations, setNations] = useState<NationConfig[]>([]);
  const [allianceName, setAllianceName] = useState<string>('');
  const [allianceExists, setAllianceExists] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [saving, setSaving] = useState<number | null>(null);

  useEffect(() => {
    fetchNationsConfig();
  }, [allianceId]);

  const fetchNationsConfig = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(`http://localhost:3001/api/alliances/${allianceId}/nations-config`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch nations config');
      }
      
      setAllianceExists(data.allianceExists);
      setAllianceName(data.allianceName || '');
      
      // Sort nations by strength (descending)
      const sortedNations = (data.nations || []).sort((a: NationConfig, b: NationConfig) => {
        const strengthA = parseFloat(a.current_stats?.strength || '0');
        const strengthB = parseFloat(b.current_stats?.strength || '0');
        return strengthB - strengthA;
      });
      
      setNations(sortedNations);
    } catch (err) {
      console.error('Error fetching nations config:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const updateNation = async (nationId: number, updates: Partial<NationConfig>) => {
    try {
      setSaving(nationId);
      
      const response = await fetch(`http://localhost:3001/api/alliances/${allianceId}/nations/${nationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to update nation');
      }
      
      // Update the local state
      setNations(prevNations => 
        prevNations.map(nation => 
          nation.nation_id === nationId 
            ? { ...nation, ...updates }
            : nation
        )
      );
    } catch (err) {
      console.error('Error updating nation:', err);
      alert(`Error updating nation: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(null);
    }
  };

  const handleFieldChange = (nationId: number, field: string, value: any) => {
    setNations(prevNations => 
      prevNations.map(nation => 
        nation.nation_id === nationId 
          ? { ...nation, [field]: value }
          : nation
      )
    );
  };

  const handleSlotChange = (nationId: number, slotType: keyof NationSlots, value: number) => {
    setNations(prevNations => 
      prevNations.map(nation => 
        nation.nation_id === nationId 
          ? { 
              ...nation, 
              slots: { 
                ...nation.slots, 
                [slotType]: value 
              } 
            }
          : nation
      )
    );
  };

  const saveNation = (nationId: number) => {
    const nation = nations.find(n => n.nation_id === nationId);
    if (nation) {
      updateNation(nationId, {
        discord_handle: nation.discord_handle,
        has_dra: nation.has_dra,
        notes: nation.notes,
        slots: nation.slots
      });
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div>Loading nations configuration...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', color: 'red' }}>
        <h3>Error</h3>
        <p>{error}</p>
        <button onClick={fetchNationsConfig}>Retry</button>
      </div>
    );
  }

  if (!allianceExists) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h3>Alliance Not Configured</h3>
        <p>This alliance is not present in the nations.json configuration file.</p>
        <p>Add nations to the configuration file to enable editing.</p>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '32px', 
      backgroundColor: '#f8fafc',
      minHeight: '100vh'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '32px',
        boxShadow: '0 10px 25px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ 
            fontSize: '28px', 
            fontWeight: '700', 
            color: '#1e293b',
            margin: '0 0 8px 0',
            letterSpacing: '-0.025em'
          }}>
            Nation Editor - {allianceName}
          </h2>
          <p style={{ 
            margin: '0', 
            color: '#64748b',
            fontSize: '16px',
            lineHeight: '1.5'
          }}>
            Edit discord handles, DRA status, and slot assignments for nations in your configuration.
          </p>
        </div>

      <div style={{ overflowX: 'auto', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', backgroundColor: 'white' }}>
        <style>
          {`
            .nation-table-row:hover {
              background-color: #f8fafc !important;
            }
            .nation-table-row:nth-child(even) {
              background-color: #fafbfc;
            }
            .input-field {
              border: 2px solid #e2e8f0;
              border-radius: 8px;
              padding: 10px 12px;
              font-size: 14px;
              transition: all 0.2s ease;
              background-color: #ffffff;
              color: #1e293b;
            }
            .input-field:focus {
              outline: none;
              border-color: #3b82f6;
              box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
            }
            .input-field:hover {
              border-color: #cbd5e1;
            }
            .number-input {
              text-align: center;
              font-weight: 600;
            }
            .checkbox-input {
              width: 18px;
              height: 18px;
              accent-color: #3b82f6;
              cursor: pointer;
            }
            .save-button {
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              color: white;
              border: none;
              border-radius: 8px;
              padding: 10px 20px;
              font-size: 14px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s ease;
              box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
            }
            .save-button:hover:not(:disabled) {
              transform: translateY(-1px);
              box-shadow: 0 4px 8px rgba(16, 185, 129, 0.3);
            }
            .save-button:disabled {
              opacity: 0.6;
              cursor: not-allowed;
              transform: none;
            }
          `}
        </style>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'separate',
          borderSpacing: 0,
          minWidth: '1200px',
          backgroundColor: 'white',
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          <thead>
            <tr style={{ 
              background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
              borderBottom: '2px solid #cbd5e1'
            }}>
              <th style={{ 
                padding: '16px 12px', 
                textAlign: 'center',
                color: '#374151',
                fontWeight: '700',
                fontSize: '14px',
                letterSpacing: '0.025em',
                width: '60px',
                borderBottom: '2px solid #cbd5e1'
              }}>#</th>
              <th style={{ 
                padding: '16px 12px', 
                textAlign: 'left',
                color: '#374151',
                fontWeight: '700',
                fontSize: '14px',
                letterSpacing: '0.025em',
                borderBottom: '2px solid #cbd5e1'
              }}>Nation / Ruler</th>
              <th style={{ 
                padding: '16px 12px', 
                textAlign: 'right',
                color: '#374151',
                fontWeight: '700',
                fontSize: '14px',
                letterSpacing: '0.025em',
                width: '140px',
                borderBottom: '2px solid #cbd5e1'
              }}>Strength</th>
              <th style={{ 
                padding: '16px 12px', 
                textAlign: 'left',
                color: '#374151',
                fontWeight: '700',
                fontSize: '14px',
                letterSpacing: '0.025em',
                borderBottom: '2px solid #cbd5e1'
              }}>Discord Handle</th>
              <th style={{ 
                padding: '16px 12px', 
                textAlign: 'left',
                color: '#374151',
                fontWeight: '700',
                fontSize: '14px',
                letterSpacing: '0.025em',
                borderBottom: '2px solid #cbd5e1'
              }}>Notes</th>
              <th style={{ 
                padding: '16px 12px', 
                textAlign: 'center',
                color: '#374151',
                fontWeight: '700',
                fontSize: '14px',
                letterSpacing: '0.025em',
                width: '100px',
                borderBottom: '2px solid #cbd5e1'
              }}>Has DRA</th>
              <th style={{ 
                padding: '16px 8px', 
                textAlign: 'center',
                color: '#374151',
                fontWeight: '700',
                fontSize: '12px',
                letterSpacing: '0.025em',
                width: '80px',
                borderBottom: '2px solid #cbd5e1'
              }}>Send Tech</th>
              <th style={{ 
                padding: '16px 8px', 
                textAlign: 'center',
                color: '#374151',
                fontWeight: '700',
                fontSize: '12px',
                letterSpacing: '0.025em',
                width: '80px',
                borderBottom: '2px solid #cbd5e1'
              }}>Send Cash</th>
              <th style={{ 
                padding: '16px 8px', 
                textAlign: 'center',
                color: '#374151',
                fontWeight: '700',
                fontSize: '12px',
                letterSpacing: '0.025em',
                width: '80px',
                borderBottom: '2px solid #cbd5e1'
              }}>Get Tech</th>
              <th style={{ 
                padding: '16px 8px', 
                textAlign: 'center',
                color: '#374151',
                fontWeight: '700',
                fontSize: '12px',
                letterSpacing: '0.025em',
                width: '80px',
                borderBottom: '2px solid #cbd5e1'
              }}>Get Cash</th>
              <th style={{ 
                padding: '16px 12px', 
                textAlign: 'center',
                color: '#374151',
                fontWeight: '700',
                fontSize: '14px',
                letterSpacing: '0.025em',
                borderBottom: '2px solid #cbd5e1'
              }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {nations.map((nation, index) => {
              const isSaving = saving === nation.nation_id;
              
              return (
                <tr 
                  key={nation.nation_id} 
                  className="nation-table-row"
                  style={{ 
                    backgroundColor: 'white',
                    borderBottom: '1px solid #f1f5f9'
                  }}>
                  <td style={{ 
                    padding: '16px 12px', 
                    color: '#64748b',
                    textAlign: 'center',
                    fontWeight: '600',
                    fontSize: '14px',
                    borderBottom: '1px solid #f1f5f9'
                  }}>
                    {index + 1}
                  </td>
                  <td style={{ 
                    padding: '16px 12px', 
                    color: '#1e293b',
                    borderBottom: '1px solid #f1f5f9'
                  }}>
                    <div>
                      <a 
                        href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${nation.nation_id}`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{
                          color: '#3b82f6',
                          textDecoration: 'none',
                          fontWeight: '600',
                          fontSize: '15px',
                          transition: 'color 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#1d4ed8'}
                        onMouseLeave={(e) => e.currentTarget.style.color = '#3b82f6'}
                      >
                        {nation.nation_name}
                      </a>
                      <div style={{ 
                        fontSize: '13px', 
                        color: '#64748b',
                        marginTop: '4px',
                        fontWeight: '500'
                      }}>
                        {nation.ruler_name}
                      </div>
                    </div>
                  </td>
                  <td style={{ 
                    padding: '16px 12px', 
                    color: '#1e293b',
                    textAlign: 'right',
                    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                    width: '140px',
                    fontWeight: '600',
                    fontSize: '14px',
                    borderBottom: '1px solid #f1f5f9'
                  }}>
                    {nation.current_stats?.strength ? 
                      parseFloat(nation.current_stats.strength).toLocaleString(undefined, {
                        maximumFractionDigits: 0
                      }) : 
                      '0'
                    }
                  </td>
                  <td style={{ 
                    padding: '16px 12px', 
                    color: '#1e293b',
                    borderBottom: '1px solid #f1f5f9'
                  }}>
                    <input
                      type="text"
                      value={nation.discord_handle}
                      onChange={(e) => handleFieldChange(nation.nation_id, 'discord_handle', e.target.value)}
                      className="input-field"
                      style={{ 
                        width: '100%'
                      }}
                      placeholder="Enter Discord handle..."
                    />
                  </td>
                  <td style={{ 
                    padding: '16px 12px', 
                    color: '#1e293b',
                    borderBottom: '1px solid #f1f5f9'
                  }}>
                    <textarea
                      value={nation.notes || ''}
                      onChange={(e) => handleFieldChange(nation.nation_id, 'notes', e.target.value)}
                      className="input-field"
                      style={{ 
                        width: '100%',
                        minHeight: '80px',
                        resize: 'vertical',
                        fontFamily: 'inherit'
                      }}
                      placeholder="Add notes..."
                    />
                  </td>
                  <td style={{ 
                    padding: '16px 12px', 
                    textAlign: 'center',
                    color: '#1e293b',
                    width: '100px',
                    borderBottom: '1px solid #f1f5f9'
                  }}>
                    <input
                      type="checkbox"
                      checked={nation.has_dra}
                      onChange={(e) => handleFieldChange(nation.nation_id, 'has_dra', e.target.checked)}
                      className="checkbox-input"
                    />
                  </td>
                  <td style={{ padding: '16px 8px', color: '#1e293b', textAlign: 'center', width: '80px', borderBottom: '1px solid #f1f5f9' }}>
                    <input
                      type="number"
                      min="0"
                      max="6"
                      value={nation.slots.sendTech}
                      onChange={(e) => handleSlotChange(nation.nation_id, 'sendTech', parseInt(e.target.value) || 0)}
                      className="input-field number-input"
                      style={{ width: '60px' }}
                    />
                  </td>
                  <td style={{ padding: '16px 8px', color: '#1e293b', textAlign: 'center', width: '80px', borderBottom: '1px solid #f1f5f9' }}>
                    <input
                      type="number"
                      min="0"
                      max="6"
                      value={nation.slots.sendCash}
                      onChange={(e) => handleSlotChange(nation.nation_id, 'sendCash', parseInt(e.target.value) || 0)}
                      className="input-field number-input"
                      style={{ width: '60px' }}
                    />
                  </td>
                  <td style={{ padding: '16px 8px', color: '#1e293b', textAlign: 'center', width: '80px', borderBottom: '1px solid #f1f5f9' }}>
                    <input
                      type="number"
                      min="0"
                      max="6"
                      value={nation.slots.getTech}
                      onChange={(e) => handleSlotChange(nation.nation_id, 'getTech', parseInt(e.target.value) || 0)}
                      className="input-field number-input"
                      style={{ width: '60px' }}
                    />
                  </td>
                  <td style={{ padding: '16px 8px', color: '#1e293b', textAlign: 'center', width: '80px', borderBottom: '1px solid #f1f5f9' }}>
                    <input
                      type="number"
                      min="0"
                      max="6"
                      value={nation.slots.getCash}
                      onChange={(e) => handleSlotChange(nation.nation_id, 'getCash', parseInt(e.target.value) || 0)}
                      className="input-field number-input"
                      style={{ width: '60px' }}
                    />
                  </td>
                  {/* Category cell removed */}
                  <td style={{ padding: '16px 12px', color: '#1e293b', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>
                    <button
                      onClick={() => saveNation(nation.nation_id)}
                      disabled={isSaving}
                      className="save-button"
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

        {nations.length === 0 && (
          <div style={{ 
            textAlign: 'center', 
            padding: '60px 40px', 
            color: '#64748b',
            backgroundColor: '#f8fafc',
            borderRadius: '12px',
            border: '2px dashed #cbd5e1'
          }}>
            <p style={{ 
              fontSize: '16px', 
              margin: '0',
              fontWeight: '500'
            }}>
              No nations found in the configuration for this alliance.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
