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
import { apiCall, API_ENDPOINTS } from '../utils/api';
import { createNationTableColumns } from './NationTableColumns';
import { type NationConfig } from '../types/nation';
import { tableClasses, getTextAlignment, getHeaderContentAlignment } from '../styles/tableClasses';
import SlotCountsSummary from './SlotCountsSummary';
import { useNationForm } from '../hooks/useNationForm';
import clsx from 'clsx';

interface AidOffer {
  aidId: number;
  declaringId: number;
  declaringRuler: string;
  declaringNation: string;
  declaringAlliance: string;
  declaringAllianceId: number;
  receivingId: number;
  receivingRuler: string;
  receivingNation: string;
  receivingAlliance: string;
  receivingAllianceId: number;
  status: string;
  money: number;
  technology: number;
  soldiers: number;
  date: string;
  reason: string;
  // Calculated fields from backend
  expirationDate?: string;
  daysUntilExpiration?: number;
  isExpired?: boolean;
}

interface AidSlot {
  slotNumber: number;
  aidOffer: AidOffer | null;
  isOutgoing: boolean;
}

interface NationAidSlots {
  nation: {
    id: number;
    rulerName: string;
    nationName: string;
    strength: number;
    activity: string;
    inWarMode: boolean;
  };
  aidSlots: AidSlot[];
}

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
  const [aidSlots, setAidSlots] = useState<NationAidSlots[]>([]);

  // TanStack Table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Calculate slot counts from nations data and active aid offers
  const slotCounts = useMemo(() => {
    const counts = nations.reduce((acc, nation) => {
      acc.totalGetCash += nation.slots.getCash;
      acc.totalGetTech += nation.slots.getTech;
      acc.totalSendCash += nation.slots.sendCash;
      acc.totalSendTech += nation.slots.sendTech;
      acc.totalExternal += nation.slots.external;
      
      // Track peace mode send slots
      if (!nation.inWarMode) {
        acc.totalSendCashPeaceMode += nation.slots.sendCash;
        acc.totalSendTechPeaceMode += nation.slots.sendTech;
      }
      
      // Calculate total possible slots for this nation
      const totalPossibleSlots = nation.has_dra ? 6 : 5;
      const assignedSlots = nation.slots.getCash + nation.slots.getTech + 
                           nation.slots.sendCash + nation.slots.sendTech + 
                           nation.slots.external;
      acc.totalUnassigned += totalPossibleSlots - assignedSlots;
      
      return acc;
    }, {
      totalGetCash: 0,
      totalGetTech: 0,
      totalSendCash: 0,
      totalSendTech: 0,
      totalExternal: 0,
      totalSendCashPeaceMode: 0,
      totalSendTechPeaceMode: 0,
      totalUnassigned: 0,
      activeGetCash: 0,
      activeGetTech: 0,
      activeSendCash: 0,
      activeSendTech: 0
    });

    // Calculate active aid counts from aid slots
    aidSlots.forEach(nationAidSlots => {
      nationAidSlots.aidSlots.forEach(slot => {
        if (slot.aidOffer && slot.aidOffer.status !== 'Expired') {
          const offer = slot.aidOffer;
          const isCash = offer.money > 0 && offer.technology === 0;
          const isTech = offer.technology > 0;
          
          if (slot.isOutgoing) {
            // Outgoing aid (sending)
            if (isCash) {
              counts.activeSendCash++;
            } else if (isTech) {
              counts.activeSendTech++;
            }
          } else {
            // Incoming aid (receiving)
            if (isCash) {
              counts.activeGetCash++;
            } else if (isTech) {
              counts.activeGetTech++;
            }
          }
        }
      });
    });
    
    return counts;
  }, [nations, aidSlots]);

  useEffect(() => {
    fetchNationsConfig();
    fetchAidSlots();
  }, [allianceId]);

  const fetchAidSlots = async () => {
    try {
      const response = await apiCall(API_ENDPOINTS.allianceAidSlots(allianceId));
      const data = await response.json();
      
      if (data.success) {
        setAidSlots(data.aidSlots);
      } else {
        console.error('Failed to fetch aid slots:', data.error);
      }
    } catch (err) {
      console.error('Failed to fetch aid slots:', err);
    }
  };

  const fetchNationsConfig = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await apiCall(API_ENDPOINTS.nationsConfig(allianceId));
      
      // Handle authentication/authorization errors
      if (response.status === 401) {
        setError('Authentication required. Please log in to access the Alliance Manager.');
        return;
      }
      if (response.status === 403) {
        setError('You do not have permission to manage this alliance.');
        return;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
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
      const response = await apiCall(API_ENDPOINTS.updateNationSlots(allianceId, nationId), {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      
      // Handle authentication/authorization errors
      if (response.status === 401) {
        alert('Authentication required. Please log in to update nations.');
        return;
      }
      if (response.status === 403) {
        alert('You do not have permission to manage this alliance.');
        return;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
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
    const totalSlots = nation.slots.sendTech + nation.slots.sendCash + nation.slots.getTech + nation.slots.getCash + nation.slots.external;
    
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
    const totalSlots = nation.slots.sendTech + nation.slots.sendCash + nation.slots.getTech + nation.slots.getCash + nation.slots.external;
    
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
      <div className={tableClasses.loadingContainer}>
        <div className={tableClasses.loadingCard}>
          <div className={tableClasses.loadingText}>Loading nations configuration...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={tableClasses.errorContainer}>
        <div className={tableClasses.errorCard}>
          <h3 className={tableClasses.errorTitle}>Error</h3>
          <p className={tableClasses.errorText}>{error}</p>
          <button 
            onClick={fetchNationsConfig}
            className={tableClasses.retryButton}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!allianceExists) {
    return (
      <div className={tableClasses.loadingContainer}>
        <div className={tableClasses.loadingCard}>
          <h3 className="text-slate-800 m-0 mb-4">Alliance Not Configured</h3>
          <p className="text-slate-500 m-0">
            This alliance is not present in the configuration file.
          </p>
          <p className="text-slate-500 mt-2 mb-0">
            Add nations to the configuration file to enable editing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx(tableClasses.container, 'bg-black')}>
      <SlotCountsSummary slotCounts={slotCounts} />

      <div className={tableClasses.tableWrapper}>
        <table className={tableClasses.table}>
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} className={clsx(tableClasses.headerRow, 'sticky-header')}>
                  {headerGroup.headers.map(header => (
                    <th 
                      key={header.id}
                      className={clsx(
                        tableClasses.headerCell,
                        getTextAlignment(header.id),
                        'sticky-header',
                        header.column.getCanSort() && 'sortable-header'
                      )}
                      style={{
                        fontSize: header.id.includes('send') || header.id.includes('get') ? '14px' : '16px',
                        width: `${header.getSize()}px`,
                        padding: header.getSize() < 70 ? '12px 8px' : '12px 12px'
                      }}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div 
                        className={clsx(tableClasses.headerCellContent, getHeaderContentAlignment(header.id))}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <span className={clsx(
                            tableClasses.sortIndicator,
                            header.column.getIsSorted() ? tableClasses.sortIndicatorActive : tableClasses.sortIndicatorInactive
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
                    className={clsx(
                      tableClasses.dataRow,
                      'nation-table-row'
                    )}
                    style={{
                      backgroundColor: hasErrors ? '#7f1d1d' : hasWarnings ? '#78350f' : undefined,
                      borderLeft: hasErrors ? '4px solid #ef4444' : hasWarnings ? '4px solid #f59e0b' : undefined,
                    }}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td 
                        key={cell.id}
                        className={clsx(
                          tableClasses.dataCellCompact,
                          getTextAlignment(cell.column.id)
                        )}
                        style={{ 
                          verticalAlign: 'middle',
                          width: `${cell.column.getSize()}px`,
                          backgroundColor: hasErrors ? '#7f1d1d' : hasWarnings ? '#78350f' : undefined,
                        }}
                      >
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
        <div className={tableClasses.emptyState}>
          <p className={tableClasses.emptyStateText}>
            No nations found in the configuration for this alliance.
          </p>
        </div>
      )}
    </div>
  );
}