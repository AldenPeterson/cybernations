import {
  createColumnHelper,
} from '@tanstack/react-table';
import {
  EditableTextInput,
  EditableTextarea,
  EditableNumberInput,
  EditableCheckbox,
  NationCell,
  StrengthCell,
  SaveButton,
} from './EditableCells';
import { tableStyles } from '../styles/tableStyles';

export interface NationSlots {
  sendTech: number;
  sendCash: number;
  getTech: number;
  getCash: number;
}

export interface NationConfig {
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

interface ColumnProps {
  handleFieldChange: (nationId: number, field: string, value: any) => void;
  handleSlotChange: (nationId: number, slotType: keyof NationSlots, value: number) => void;
  saveNation: (nationId: number) => void;
  saving: number | null;
}

const columnHelper = createColumnHelper<NationConfig>();

// Column size constants
const SLOT_COLUMN_SIZE = 100;

export const createNationTableColumns = ({
  handleFieldChange,
  handleSlotChange,
  saveNation,
  saving,
}: ColumnProps) => [
  // Index column (read-only)
  columnHelper.display({
    id: 'index',
    header: '#',
    cell: ({ row }) => (
      <div style={{
        ...tableStyles.dataCell,
        color: '#64748b',
        textAlign: 'center',
        fontWeight: '600',
        fontSize: '14px'
      }}>
        {row.index + 1}
      </div>
    ),
    size: 'auto',
    enableSorting: true,
    sortingFn: (rowA, rowB) => rowA.index - rowB.index,
  }),

  // Nation / Ruler column (read-only)
  columnHelper.display({
    id: 'nation',
    header: 'Nation / Ruler',
    cell: ({ row }) => <NationCell nation={row.original} />,
    size: 'auto',
    enableSorting: false,
  }),

  // NS (Nation Strength) column (read-only)
  columnHelper.display({
    id: 'strength',
    header: 'NS',
    cell: ({ row }) => (
      <div style={{ ...tableStyles.dataCell, textAlign: 'right' }}>
        <StrengthCell strength={row.original.current_stats?.strength} />
      </div>
    ),
    size: 100,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const strengthA = parseFloat(rowA.original.current_stats?.strength || '0');
      const strengthB = parseFloat(rowB.original.current_stats?.strength || '0');
      return strengthA - strengthB;
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
    size: 250,
    enableSorting: true,
  }),

  // Notes column (editable)
  columnHelper.accessor('notes', {
    header: 'Notes',
    cell: ({ getValue, row }) => (
      <EditableTextarea
        value={getValue() || ''}
        onChange={(value) => handleFieldChange(row.original.nation_id, 'notes', value)}
      />
    ),
    size: 400,
    enableSorting: false,
  }),

  // Has DRA column (editable)
  columnHelper.accessor('has_dra', {
    header: 'Has DRA',
    cell: ({ getValue, row }) => (
      <div style={{ textAlign: 'center' }}>
        <EditableCheckbox
          checked={getValue()}
          onChange={(checked) => handleFieldChange(row.original.nation_id, 'has_dra', checked)}
        />
      </div>
    ),
    size: 'auto',
    enableSorting: true,
  }),

  // Send Tech column (editable)
  columnHelper.accessor('slots.sendTech', {
    header: () => (
      <div style={{ lineHeight: '1.2', textAlign: 'center' }}>
        <div>Send</div>
        <div>Tech</div>
      </div>
    ),
    cell: ({ getValue, row }) => (
      <div style={{ textAlign: 'center' }}>
        <EditableNumberInput
          value={getValue()}
          onChange={(value) => handleSlotChange(row.original.nation_id, 'sendTech', value)}
          min={0}
          max={6}
        />
      </div>
    ),
    size: 'auto',
    minSize: SLOT_COLUMN_SIZE,
    enableSorting: true,
  }),

  // Send Cash column (editable)
  columnHelper.accessor('slots.sendCash', {
    header: () => (
      <div style={{ lineHeight: '1.2', textAlign: 'center' }}>
        <div>Send</div>
        <div>Cash</div>
      </div>
    ),
    cell: ({ getValue, row }) => (
      <div style={{ textAlign: 'center' }}>
        <EditableNumberInput
          value={getValue()}
          onChange={(value) => handleSlotChange(row.original.nation_id, 'sendCash', value)}
          min={0}
          max={6}
        />
      </div>
    ),
    size: 'auto',
    minSize: SLOT_COLUMN_SIZE,
    enableSorting: true,
  }),

  // Get Tech column (editable)
  columnHelper.accessor('slots.getTech', {
    header: () => (
      <div style={{ lineHeight: '1.2', textAlign: 'center' }}>
        <div>Get</div>
        <div>Tech</div>
      </div>
    ),
    cell: ({ getValue, row }) => (
      <div style={{ textAlign: 'center' }}>
        <EditableNumberInput
          value={getValue()}
          onChange={(value) => handleSlotChange(row.original.nation_id, 'getTech', value)}
          min={0}
          max={6}
        />
      </div>
    ),
    size: 'auto',
    minSize: SLOT_COLUMN_SIZE,
    enableSorting: true,
  }),

  // Get Cash column (editable)
  columnHelper.accessor('slots.getCash', {
    header: () => (
      <div style={{ lineHeight: '1.2', textAlign: 'center' }}>
        <div>Get</div>
        <div>Cash</div>
      </div>
    ),
    cell: ({ getValue, row }) => (
      <div style={{ textAlign: 'center' }}>
        <EditableNumberInput
          value={getValue()}
          onChange={(value) => handleSlotChange(row.original.nation_id, 'getCash', value)}
          min={0}
          max={6}
        />
      </div>
    ),
    size: 'auto',
    minSize: SLOT_COLUMN_SIZE,
    enableSorting: true,
  }),

  // Actions column (read-only)
  columnHelper.display({
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => (
      <div style={{ textAlign: 'center' }}>
        <SaveButton
          nationId={row.original.nation_id}
          isSaving={saving === row.original.nation_id}
          onSave={saveNation}
        />
      </div>
    ),
    enableSorting: false,
    size: 'auto',
  }),
];
