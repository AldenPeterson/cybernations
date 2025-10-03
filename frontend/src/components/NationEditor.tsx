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
import { createNationTableColumns } from './NationTableColumns';
import { type NationConfig } from '../types/nation';
import { tableStyles, tableCSS, combineStyles, getTextAlignment, getHeaderContentAlignment } from '../styles/tableStyles';
import SlotCountsSummary from './SlotCountsSummary';
import { useNationForm } from '../hooks/useNationForm';

interface NationEditorProps {
  allianceId: number;
}

export default function NationEditor({ allianceId }: NationEditorProps) {
  const {
    nations,
    setNationsData,
    updateNationField,
    updateNationSlot,
    hasChanges,
    getChangedFieldsForNation,
    markNationAsSaved,
  } = useNationForm();
  
  const [allianceExists, setAllianceExists] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [saving, setSaving] = useState<number | null>(null);

  // TanStack Table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Calculate slot counts from nations data
  const slotCounts = useMemo(() => {
    const counts = nations.reduce((acc, nation) => {
      acc.totalGetCash += nation.slots.getCash;
      acc.totalGetTech += nation.slots.getTech;
      acc.totalSendCash += nation.slots.sendCash;
      acc.totalSendTech += nation.slots.sendTech;
      
      // Calculate total possible slots for this nation
      const totalPossibleSlots = nation.has_dra ? 6 : 5;
      const assignedSlots = nation.slots.getCash + nation.slots.getTech + 
                           nation.slots.sendCash + nation.slots.sendTech;
      acc.totalUnassigned += totalPossibleSlots - assignedSlots;
      
      return acc;
    }, {
      totalGetCash: 0,
      totalGetTech: 0,
      totalSendCash: 0,
      totalSendTech: 0,
      totalUnassigned: 0
    });
    
    return counts;
  }, [nations]);

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
      
      setNationsData(sortedNations);
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
      console.log('=== FRONTEND DEBUG ===');
      console.log('Updates being sent:', updates);
      console.log('Slots being sent:', updates.slots);
      console.log('========================');
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
      
      // Mark the nation as saved (this updates the original data)
      markNationAsSaved(nationId);
      
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
    updateNationField(nationId, field, value);
  };

  const handleSlotChange = (nationId: number, slotType: keyof NationConfig['slots'], value: number) => {
    updateNationSlot(nationId, slotType, value);
  };

  const saveNation = (nationId: number) => {
    // Check for validation errors first (blocks saving)
    if (hasValidationErrors(nationId)) {
      return;
    }
    
    // Get only the changed fields
    const updates = getChangedFieldsForNation(nationId);
    
    // Only make the API call if there are actual changes
    if (Object.keys(updates).length > 0) {
      updateNation(nationId, updates);
    } else {
      console.log('No changes detected for nation', nationId);
    }
  };

  // Use the hasChanges function from the hook
  const hasUnsavedChanges = hasChanges;

  // Helper function to check if a nation has validation errors (blocks saving)
  const hasValidationErrors = (nationId: number) => {
    const nation = nations.find(n => n.nation_id === nationId);
    
    if (!nation) return false;
    
    // Calculate total slots
    const totalSlots = nation.slots.sendTech + nation.slots.sendCash + nation.slots.getTech + nation.slots.getCash;
    
    // Expected total: 5 if no DRA, 6 if DRA
    const expectedTotal = nation.has_dra ? 6 : 5;
    
    // Block saving if slots exceed expected total (over-assignment)
    return totalSlots > expectedTotal;
  };

  // Helper function to check if a nation has validation warnings (shows warning but allows saving)
  const hasValidationWarnings = (nationId: number) => {
    const nation = nations.find(n => n.nation_id === nationId);
    
    if (!nation) return false;
    
    // Calculate total slots
    const totalSlots = nation.slots.sendTech + nation.slots.sendCash + nation.slots.getTech + nation.slots.getCash;
    
    // Expected total: 5 if no DRA, 6 if DRA
    const expectedTotal = nation.has_dra ? 6 : 5;
    
    // Show warning if slots are too low (below expected total) - this highlights the row
    const hasWarning = totalSlots < expectedTotal;
    
    
    return hasWarning;
  };

  // Create columns with handlers
  const columns = useMemo(() => createNationTableColumns({
    handleFieldChange,
    handleSlotChange,
    saveNation,
    saving,
    hasUnsavedChanges,
  }), [saving, hasUnsavedChanges]);


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
    enableColumnResizing: false,
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
    <div style={{ ...tableStyles.container, backgroundColor: '#000000' }}>
      <SlotCountsSummary slotCounts={slotCounts} />

      <div style={tableStyles.tableWrapper}>
        <style>{tableCSS}</style>
        <table style={tableStyles.table}>
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} style={tableStyles.headerRow} className="sticky-header">
                  {headerGroup.headers.map(header => (
                    <th 
                      key={header.id} 
                      style={combineStyles(
                        tableStyles.headerCell,
                        {
                          textAlign: getTextAlignment(header.id),
                          fontSize: header.id.includes('send') || header.id.includes('get') ? '12px' : '14px',
                          width: `${header.getSize()}px`,
                          cursor: header.column.getCanSort() ? 'pointer' : 'default',
                          padding: header.getSize() < 40 ? '16px 4px' : '16px 12px'
                        }
                      )}
                      className={`sticky-header ${header.column.getCanSort() ? 'sortable-header' : ''}`}
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
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map(row => {
                const hasErrors = hasValidationErrors(row.original.nation_id);
                const hasWarnings = hasValidationWarnings(row.original.nation_id);
                
                
                return (
                  <tr 
                    key={row.id} 
                    className="nation-table-row"
                    style={{
                      ...tableStyles.dataRow,
                      backgroundColor: hasErrors ? '#fef2f2' : hasWarnings ? '#fffbeb' : undefined,
                      borderLeft: hasErrors ? '4px solid #ef4444' : hasWarnings ? '4px solid #f59e0b' : undefined,
                    }}>
                    {row.getVisibleCells().map(cell => (
                      <td 
                        key={cell.id}
                        style={combineStyles(
                          tableStyles.dataCell,
                          { 
                            textAlign: getTextAlignment(cell.column.id),
                            verticalAlign: 'middle',
                            width: `${cell.column.getSize()}px`,
                            backgroundColor: hasErrors ? '#fef2f2' : hasWarnings ? '#fffbeb' : undefined,
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