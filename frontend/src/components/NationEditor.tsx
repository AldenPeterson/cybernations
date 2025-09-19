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

  const handleSlotChange = (nationId: number, slotType: keyof NationConfig['slots'], value: number) => {
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

  // Create columns with handlers
  const columns = useMemo(() => createNationTableColumns({
    handleFieldChange,
    handleSlotChange,
    saveNation,
    saving,
  }), [saving]);

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
              {table.getRowModel().rows.map(row => (
                <tr 
                  key={row.id} 
                  className="nation-table-row"
                  style={tableStyles.dataRow}>
                  {row.getVisibleCells().map(cell => (
                    <td 
                      key={cell.id}
                      style={combineStyles(
                        tableStyles.dataCell,
                        { 
                          textAlign: getTextAlignment(cell.column.id),
                          width: cell.column.getSize()
                        }
                      )}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
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