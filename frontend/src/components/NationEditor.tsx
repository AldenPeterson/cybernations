import { useState, useEffect, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import { createNationTableColumns, type NationConfig } from './NationTableColumns';
import { tableStyles, tableCSS, combineStyles, getTextAlignment, getHeaderContentAlignment } from '../styles/tableStyles';

interface NationEditorProps {
  allianceId: number;
}

export default function NationEditor({ allianceId }: NationEditorProps) {
  const [nations, setNations] = useState<NationConfig[]>([]);
  const [originalNations, setOriginalNations] = useState<NationConfig[]>([]);
  const [localChanges, setLocalChanges] = useState<Map<number, Partial<NationConfig>>>(new Map());
  const [allianceExists, setAllianceExists] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [saving, setSaving] = useState<number | null>(null);

  // TanStack Table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

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
      
      // Sort nations by strength (descending) - this will be handled by TanStack Table now
      const sortedNations = (data.nations || []).sort((a: NationConfig, b: NationConfig) => {
        const strengthA = parseFloat(a.current_stats?.strength || '0');
        const strengthB = parseFloat(b.current_stats?.strength || '0');
        return strengthB - strengthA;
      });
      
      setNations(sortedNations);
      setOriginalNations(sortedNations);
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
      console.log('updateNation called with:', { updates });
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
      
      // Update the original nations state to reflect the saved changes
      setOriginalNations(prevOriginal => 
        prevOriginal.map(nation => 
          nation.nation_id === nationId 
            ? { ...nation, ...updates }
            : nation
        )
      );
      
      // Clear local changes for this nation
      setLocalChanges(prev => {
        const newChanges = new Map(prev);
        newChanges.delete(nationId);
        return newChanges;
      });
      
      // Show success feedback
      console.log('Nation updated successfully');
    } catch (err) {
      console.error('Error updating nation:', err);
      alert(`Error updating nation: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(null);
    }
  };

  const handleFieldChange = (nationId: number, field: string, value: any) => {
    // Update local changes immediately for save button state
    setLocalChanges(prev => {
      const newChanges = new Map(prev);
      const existingChanges = newChanges.get(nationId) || {};
      newChanges.set(nationId, { ...existingChanges, [field]: value });
      return newChanges;
    });

    // Update the main state (this will be debounced by the input components)
    setNations(prevNations => 
      prevNations.map(nation => 
        nation.nation_id === nationId 
          ? { ...nation, [field]: value }
          : nation
      )
    );
  };

  const handleSlotChange = (nationId: number, slotType: keyof NationConfig['slots'], value: number) => {
    // Update local changes immediately for save button state
    setLocalChanges(prev => {
      const newChanges = new Map(prev);
      const existingChanges = newChanges.get(nationId) || {};
      const existingSlots = existingChanges.slots || {
        sendTech: 0,
        sendCash: 0,
        getTech: 0,
        getCash: 0
      };
      newChanges.set(nationId, { 
        ...existingChanges, 
        slots: { 
          ...existingSlots, 
          [slotType]: value 
        } 
      });
      return newChanges;
    });

    // Update the main state
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
    const originalNation = originalNations.find(n => n.nation_id === nationId);
    const localChange = localChanges.get(nationId);
    
    if (nation && originalNation) {
      // Check for validation errors first
      if (hasValidationErrors(nationId)) {
        alert('Cannot save: Validation errors exist. Please fix the slot totals before saving.');
        return;
      }
      
      const updates: Partial<NationConfig> = {};
      
      // Use local changes if available, otherwise fall back to main state
      const currentNation = localChange ? { ...nation, ...localChange } : nation;
      
      // Only include fields that have actually changed
      if (currentNation.discord_handle !== originalNation.discord_handle) {
        updates.discord_handle = currentNation.discord_handle;
      }
      
      if (currentNation.has_dra !== originalNation.has_dra) {
        updates.has_dra = currentNation.has_dra;
      }
      
      if (currentNation.notes !== originalNation.notes) {
        updates.notes = currentNation.notes;
      }
      
      // Check if slots have changed
      const slotsChanged = currentNation.slots.sendTech !== originalNation.slots.sendTech ||
                          currentNation.slots.sendCash !== originalNation.slots.sendCash ||
                          currentNation.slots.getTech !== originalNation.slots.getTech ||
                          currentNation.slots.getCash !== originalNation.slots.getCash;
      
      if (slotsChanged) {
        updates.slots = currentNation.slots;
      }
      
      // Only make the API call if there are actual changes
      if (Object.keys(updates).length > 0) {
        updateNation(nationId, updates);
      } else {
        console.log('No changes detected for nation', nationId);
      }
    }
  };

  // Helper function to check if a nation has unsaved changes
  const hasUnsavedChanges = (nationId: number) => {
    const nation = nations.find(n => n.nation_id === nationId);
    const originalNation = originalNations.find(n => n.nation_id === nationId);
    const localChange = localChanges.get(nationId);
    
    if (!nation || !originalNation) return false;
    
    // Check if there are any local changes (immediate feedback)
    if (localChange) {
      // Check for field changes
      if (localChange.discord_handle !== undefined && localChange.discord_handle !== originalNation.discord_handle) return true;
      if (localChange.has_dra !== undefined && localChange.has_dra !== originalNation.has_dra) return true;
      if (localChange.notes !== undefined && localChange.notes !== originalNation.notes) return true;
      
      // Check for slot changes
      if (localChange.slots) {
        const originalSlots = originalNation.slots;
        if (localChange.slots.sendTech !== undefined && localChange.slots.sendTech !== originalSlots.sendTech) return true;
        if (localChange.slots.sendCash !== undefined && localChange.slots.sendCash !== originalSlots.sendCash) return true;
        if (localChange.slots.getTech !== undefined && localChange.slots.getTech !== originalSlots.getTech) return true;
        if (localChange.slots.getCash !== undefined && localChange.slots.getCash !== originalSlots.getCash) return true;
      }
      
      return false;
    }
    
    // Fallback to checking main state changes
    return nation.discord_handle !== originalNation.discord_handle ||
           nation.has_dra !== originalNation.has_dra ||
           nation.notes !== originalNation.notes ||
           nation.slots.sendTech !== originalNation.slots.sendTech ||
           nation.slots.sendCash !== originalNation.slots.sendCash ||
           nation.slots.getTech !== originalNation.slots.getTech ||
           nation.slots.getCash !== originalNation.slots.getCash;
  };

  // Helper function to check if a nation has validation errors
  const hasValidationErrors = (nationId: number) => {
    const nation = nations.find(n => n.nation_id === nationId);
    
    if (!nation) return false;
    
    // Calculate total slots
    const totalSlots = nation.slots.sendTech + nation.slots.sendCash + nation.slots.getTech + nation.slots.getCash;
    
    // Expected total: 5 if no DRA, 6 if DRA
    const expectedTotal = nation.has_dra ? 6 : 5;
    
    return totalSlots !== expectedTotal;
  };

  // Create columns with handlers
  const columns = useMemo(() => createNationTableColumns({
    handleFieldChange,
    handleSlotChange,
    saveNation,
    saving,
    hasUnsavedChanges,
    hasValidationErrors,
  }), [saving, localChanges]);

  // Initialize TanStack Table
  const table = useReactTable({
    data: nations,
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: {
      sorting: [{ id: 'strength', desc: true }], // Default sort by strength descending
    },
    enableSorting: true,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
  });

  if (loading) {
    return (
      <div style={tableStyles.loadingContainer}>
        <div style={tableStyles.loadingCard}>
          <div style={tableStyles.loadingText}>Loading nations configuration...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={tableStyles.errorContainer}>
        <div style={tableStyles.errorCard}>
          <h3 style={tableStyles.errorTitle}>Error</h3>
          <p style={tableStyles.errorText}>{error}</p>
          <button 
            onClick={fetchNationsConfig}
            style={tableStyles.retryButton}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!allianceExists) {
    return (
      <div style={tableStyles.loadingContainer}>
        <div style={tableStyles.loadingCard}>
          <h3 style={{ color: '#1e293b', margin: '0 0 16px 0' }}>Alliance Not Configured</h3>
          <p style={{ color: '#64748b', margin: '0' }}>
            This alliance is not present in the configuration file.
          </p>
          <p style={{ color: '#64748b', margin: '8px 0 0 0' }}>
            Add nations to the configuration file to enable editing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={tableStyles.container}>
      <div style={tableStyles.tableWrapper}>
        <style>{tableCSS}</style>
        <table style={tableStyles.table}>
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} style={tableStyles.headerRow}>
                  {headerGroup.headers.map(header => (
                    <th 
                      key={header.id} 
                      style={combineStyles(
                        tableStyles.headerCell,
                        {
                          textAlign: getTextAlignment(header.id),
                          fontSize: header.id.includes('send') || header.id.includes('get') ? '12px' : '14px',
                          width: header.getSize(),
                          cursor: header.column.getCanSort() ? 'pointer' : 'default',
                          position: 'relative'
                        }
                      )}
                      className={header.column.getCanSort() ? 'sortable-header' : ''}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div style={combineStyles(
                        tableStyles.headerCellContent,
                        { justifyContent: getHeaderContentAlignment(header.id) }
                      )}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <span style={combineStyles(
                            tableStyles.sortIndicator,
                            header.column.getIsSorted() ? tableStyles.sortIndicatorActive : tableStyles.sortIndicatorInactive
                          )}>
                            {{
                              asc: '↑',
                              desc: '↓',
                            }[header.column.getIsSorted() as string] ?? '↕'}
                          </span>
                        )}
                      </div>
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: 0,
                            height: '100%',
                            width: '4px',
                            background: 'rgba(0, 0, 0, 0.1)',
                            cursor: 'col-resize',
                            userSelect: 'none',
                            touchAction: 'none',
                          }}
                        />
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map(row => {
                const hasErrors = hasValidationErrors(row.original.nation_id);
                return (
                  <tr 
                    key={row.id} 
                    className="nation-table-row"
                    style={{
                      ...tableStyles.dataRow,
                      backgroundColor: hasErrors ? '#fef2f2' : undefined,
                      borderLeft: hasErrors ? '4px solid #ef4444' : undefined,
                    }}>
                    {row.getVisibleCells().map(cell => (
                      <td 
                        key={cell.id}
                        style={combineStyles(
                          tableStyles.dataCell,
                          { 
                            textAlign: getTextAlignment(cell.column.id),
                            width: cell.column.getSize(),
                            backgroundColor: hasErrors ? '#fef2f2' : undefined,
                          }
                        )}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
        </table>
      </div>

      {nations.length === 0 && (
        <div style={tableStyles.emptyState}>
          <p style={tableStyles.emptyStateText}>
            No nations found in the configuration for this alliance.
          </p>
        </div>
      )}
    </div>
  );
}