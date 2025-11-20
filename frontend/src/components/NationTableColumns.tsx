import {
  createColumnHelper,
} from '@tanstack/react-table';
import {
  EditableTextInput,
  EditableNumberInput,
  EditableCheckbox,
  NationCell,
  StrengthCell,
  SaveButton,
} from './EditableCells';
import { type NationConfig, type NationSlots } from '../types/nation';

// Re-export types for backward compatibility
export type { NationConfig, NationSlots };

interface ColumnProps {
  handleFieldChange: (nationId: number, field: string, value: any) => void;
  handleSlotChange: (nationId: number, slotType: keyof NationSlots, value: number) => void;
  saveNation: (nationId: number) => void;
  saving: number | null;
  hasUnsavedChanges: (nationId: number) => boolean;
  hasValidationErrors?: (nationId: number) => boolean;
  hasValidationWarnings?: (nationId: number) => boolean;
}

const columnHelper = createColumnHelper<NationConfig>();

// Column size constants
const SLOT_COLUMN_SIZE = 70;
const STAT_COLUMN_SIZE = 80;

export const createNationTableColumns = ({
  handleFieldChange,
  handleSlotChange,
  saveNation,
  saving,
  hasUnsavedChanges,
}: ColumnProps) => [
  // Index column (read-only)
  columnHelper.accessor((_, index) => index, {
    id: 'index',
    header: '#',
    cell: ({ getValue }) => (
      <div className="text-slate-500 text-center font-semibold text-sm">
        {getValue() + 1}
      </div>
    ),
    size: 50,
    enableSorting: true,
    sortingFn: (rowA, rowB) => rowA.index - rowB.index,
  }),

  // Nation / Ruler column (read-only)
  columnHelper.display({
    id: 'nation',
    header: 'Nation / Ruler',
    cell: ({ row }) => <NationCell nation={row.original} />,
    size: 200,
    enableSorting: false,
  }),

  // NS (Nation Strength) column (read-only)
  columnHelper.accessor('current_stats.strength', {
    id: 'strength',
    header: 'NS',
    cell: ({ getValue }) => (
      <div className="text-right">
        <StrengthCell strength={getValue()} />
      </div>
    ),
    size: STAT_COLUMN_SIZE,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const strengthA = parseFloat((rowA.original.current_stats?.strength || '0').replace(/,/g, ''));
      const strengthB = parseFloat((rowB.original.current_stats?.strength || '0').replace(/,/g, ''));
      return strengthA - strengthB;
    },
  }),

  // Infra (Infrastructure) column (read-only)
  columnHelper.accessor('current_stats.infrastructure', {
    id: 'infrastructure',
    header: 'Infra',
    cell: ({ getValue }) => (
      <div className="text-right">
        <StrengthCell strength={getValue()} />
      </div>
    ),
    size: STAT_COLUMN_SIZE,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const infraA = parseFloat((rowA.original.current_stats?.infrastructure || '0').replace(/,/g, ''));
      const infraB = parseFloat((rowB.original.current_stats?.infrastructure || '0').replace(/,/g, ''));
      return infraA - infraB;
    },
  }),

  // Tech (Technology) column (read-only)
  columnHelper.accessor('current_stats.technology', {
    id: 'technology',
    header: 'Tech',
    cell: ({ getValue }) => (
      <div className="text-right">
        <StrengthCell strength={getValue()} />
      </div>
    ),
    size: STAT_COLUMN_SIZE,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const techA = parseFloat((rowA.original.current_stats?.technology || '0').replace(/,/g, ''));
      const techB = parseFloat((rowB.original.current_stats?.technology || '0').replace(/,/g, ''));
      return techA - techB;
    },
  }),

  // Discord Handle column (editable)
  columnHelper.accessor('discord_handle', {
    header: 'Discord Handle',
    cell: ({ getValue, row }) => (
      <EditableTextInput
        value={getValue()}
        onChange={(value) => handleFieldChange(row.original.nation_id, 'discord_handle', value)}
        placeholder="Enter Discord handle..."
      />
    ),
    size: 200,
    enableSorting: true,
  }),

  // Notes column (editable)
  columnHelper.accessor('notes', {
    header: 'Notes',
    cell: ({ getValue, row }) => (
      <EditableTextInput
        value={getValue() || ''}
        onChange={(value) => handleFieldChange(row.original.nation_id, 'notes', value)}
        placeholder="Enter notes..."
      />
    ),
    size: 300,
    enableSorting: false,
  }),

  // Has DRA column (editable)
  columnHelper.accessor('has_dra', {
    header: 'Has DRA',
    cell: ({ getValue, row }) => (
      <div className="text-center">
        <EditableCheckbox
          checked={getValue()}
          onChange={(checked) => handleFieldChange(row.original.nation_id, 'has_dra', checked)}
        />
      </div>
    ),
    size: 70,
    enableSorting: true,
  }),

  // Send Priority column (editable)
  columnHelper.accessor('slots.send_priority', {
    header: () => (
      <div className="leading-tight text-center">
        <div>Send</div>
        <div>Priority</div>
      </div>
    ),
    cell: ({ getValue, row }) => (
      <div className="text-center">
        <EditableNumberInput
          value={getValue()}
          onChange={(value) => handleSlotChange(row.original.nation_id, 'send_priority', value)}
          min={1}
          max={3}
        />
      </div>
    ),
    size: 65,
    enableSorting: true,
  }),

  // Receive Priority column (editable)
  columnHelper.accessor('slots.receive_priority', {
    header: () => (
      <div className="leading-tight text-center">
        <div>Receive</div>
        <div>Priority</div>
      </div>
    ),
    cell: ({ getValue, row }) => (
      <div className="text-center">
        <EditableNumberInput
          value={getValue()}
          onChange={(value) => handleSlotChange(row.original.nation_id, 'receive_priority', value)}
          min={1}
          max={3}
        />
      </div>
    ),
    size: 65,
    enableSorting: true,
  }),

  // Send Tech column (editable)
  columnHelper.accessor('slots.sendTech', {
    header: () => (
      <div className="leading-tight text-center">
        <div>Send</div>
        <div>Tech</div>
      </div>
    ),
    cell: ({ getValue, row }) => {
      // Calculate validation directly in the column cell instead of relying on passed functions
      const totalSlots = row.original.slots.sendTech + row.original.slots.sendCash + 
                        row.original.slots.getTech + row.original.slots.getCash + 
                        row.original.slots.external;
      const expectedTotal = row.original.has_dra ? 6 : 5;
      
      // Calculate validation directly
      const hasErrors = totalSlots > expectedTotal; // Over-assignment blocks saving
      const hasWarnings = totalSlots < expectedTotal; // Under-assignment shows warning
      
      return (
        <div className="text-center">
          <EditableNumberInput
            value={getValue()}
            onChange={(value) => handleSlotChange(row.original.nation_id, 'sendTech', value)}
            min={0}
            max={6}
          />
          {(hasErrors || hasWarnings) && (
            <div className={`text-[10px] mt-0.5 font-semibold ${hasErrors ? 'text-red-500' : 'text-amber-500'}`}>
              {totalSlots}/{expectedTotal}
            </div>
          )}
        </div>
      );
    },
    size: SLOT_COLUMN_SIZE,
    maxSize: SLOT_COLUMN_SIZE,
    enableSorting: true,
  }),

  // Send Cash column (editable)
  columnHelper.accessor('slots.sendCash', {
    header: () => (
      <div className="leading-tight text-center">
        <div>Send</div>
        <div>Cash</div>
      </div>
    ),
    cell: ({ getValue, row }) => {
      // Calculate validation directly in the column cell instead of relying on passed functions
      const totalSlots = row.original.slots.sendTech + row.original.slots.sendCash + 
                        row.original.slots.getTech + row.original.slots.getCash + 
                        row.original.slots.external;
      const expectedTotal = row.original.has_dra ? 6 : 5;
      
      // Calculate validation directly
      const hasErrors = totalSlots > expectedTotal; // Over-assignment blocks saving
      const hasWarnings = totalSlots < expectedTotal; // Under-assignment shows warning
      
      return (
        <div className="text-center">
          <EditableNumberInput
            value={getValue()}
            onChange={(value) => handleSlotChange(row.original.nation_id, 'sendCash', value)}
            min={0}
            max={6}
          />
          {(hasErrors || hasWarnings) && (
            <div className={`text-[10px] mt-0.5 font-semibold ${hasErrors ? 'text-red-500' : 'text-amber-500'}`}>
              {totalSlots}/{expectedTotal}
            </div>
          )}
        </div>
      );
    },
    size: SLOT_COLUMN_SIZE,
    enableSorting: true,
  }),

  // Get Tech column (editable)
  columnHelper.accessor('slots.getTech', {
    header: () => (
      <div className="leading-tight text-center">
        <div>Get</div>
        <div>Tech</div>
      </div>
    ),
    cell: ({ getValue, row }) => {
      // Calculate validation directly in the column cell instead of relying on passed functions
      const totalSlots = row.original.slots.sendTech + row.original.slots.sendCash + 
                        row.original.slots.getTech + row.original.slots.getCash + 
                        row.original.slots.external;
      const expectedTotal = row.original.has_dra ? 6 : 5;
      
      // Calculate validation directly
      const hasErrors = totalSlots > expectedTotal; // Over-assignment blocks saving
      const hasWarnings = totalSlots < expectedTotal; // Under-assignment shows warning
      
      return (
        <div className="text-center">
          <EditableNumberInput
            value={getValue()}
            onChange={(value) => handleSlotChange(row.original.nation_id, 'getTech', value)}
            min={0}
            max={6}
          />
          {(hasErrors || hasWarnings) && (
            <div className={`text-[10px] mt-0.5 font-semibold ${hasErrors ? 'text-red-500' : 'text-amber-500'}`}>
              {totalSlots}/{expectedTotal}
            </div>
          )}
        </div>
      );
    },
    size: SLOT_COLUMN_SIZE,
    enableSorting: true,
  }),

  // Get Cash column (editable)
  columnHelper.accessor('slots.getCash', {
    header: () => (
      <div className="leading-tight text-center">
        <div>Get</div>
        <div>Cash</div>
      </div>
    ),
    cell: ({ getValue, row }) => {
      // Calculate validation directly in the column cell instead of relying on passed functions
      const totalSlots = row.original.slots.sendTech + row.original.slots.sendCash + 
                        row.original.slots.getTech + row.original.slots.getCash + 
                        row.original.slots.external;
      const expectedTotal = row.original.has_dra ? 6 : 5;
      
      // Calculate validation directly
      const hasErrors = totalSlots > expectedTotal; // Over-assignment blocks saving
      const hasWarnings = totalSlots < expectedTotal; // Under-assignment shows warning
      
      return (
        <div className="text-center">
          <EditableNumberInput
            value={getValue()}
            onChange={(value) => handleSlotChange(row.original.nation_id, 'getCash', value)}
            min={0}
            max={6}
          />
          {(hasErrors || hasWarnings) && (
            <div className={`text-[10px] mt-0.5 font-semibold ${hasErrors ? 'text-red-500' : 'text-amber-500'}`}>
              {totalSlots}/{expectedTotal}
            </div>
          )}
        </div>
      );
    },
    size: SLOT_COLUMN_SIZE,
    enableSorting: true,
  }),

  // External column (editable)
  columnHelper.accessor('slots.external', {
    header: () => (
      <div className="leading-tight text-center">
        <div>External</div>
      </div>
    ),
    cell: ({ getValue, row }) => {
      // Calculate validation directly in the column cell instead of relying on passed functions
      const totalSlots = row.original.slots.sendTech + row.original.slots.sendCash + 
                        row.original.slots.getTech + row.original.slots.getCash + 
                        row.original.slots.external;
      const expectedTotal = row.original.has_dra ? 6 : 5;
      
      // Calculate validation directly
      const hasErrors = totalSlots > expectedTotal; // Over-assignment blocks saving
      const hasWarnings = totalSlots < expectedTotal; // Under-assignment shows warning
      
      return (
        <div className="text-center">
          <EditableNumberInput
            value={getValue()}
            onChange={(value) => handleSlotChange(row.original.nation_id, 'external', value)}
            min={0}
            max={6}
          />
          {(hasErrors || hasWarnings) && (
            <div className={`text-[10px] mt-0.5 font-semibold ${hasErrors ? 'text-red-500' : 'text-amber-500'}`}>
              {totalSlots}/{expectedTotal}
            </div>
          )}
        </div>
      );
    },
    size: SLOT_COLUMN_SIZE,
    enableSorting: true,
  }),

  // Actions column (read-only)
  columnHelper.display({
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => (
      <div className="text-center">
        <SaveButton
          nationId={row.original.nation_id}
          isSaving={saving === row.original.nation_id}
          hasChanges={hasUnsavedChanges(row.original.nation_id)}
          hasValidationErrors={(() => {
            const totalSlots = row.original.slots.sendTech + row.original.slots.sendCash + 
                              row.original.slots.getTech + row.original.slots.getCash + 
                              row.original.slots.external;
            const expectedTotal = row.original.has_dra ? 6 : 5;
            return totalSlots > expectedTotal;
          })()}
          onSave={saveNation}
        />
      </div>
    ),
    enableSorting: false,
    size: 120,
  }),
];
