import React from 'react';

export interface Alliance {
  id: number;
  name: string;
  nationCount: number;
}

export interface AllianceMultiSelectProps {
  label: string;
  alliances: Alliance[];
  selectedAllianceIds: number[];
  excludedAllianceId?: number;
  onChange: (selectedIds: number[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

const AllianceMultiSelect: React.FC<AllianceMultiSelectProps> = ({
  label,
  alliances,
  selectedAllianceIds,
  excludedAllianceId,
  onChange,
  placeholder = "Hold Ctrl/Cmd to select multiple alliances",
  disabled = false
}) => {
  const availableAlliances = alliances.filter(alliance => 
    !excludedAllianceId || alliance.id !== excludedAllianceId
  );
  
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValues = Array.from(e.target.selectedOptions, option => 
      parseInt(option.value)
    );
    onChange(selectedValues);
  };

  const handleBlur = () => {
    // Prevent the browser from deselecting all options when clicking outside
    // Force a re-render by calling onChange with current selections
    const currentSelections = selectedAllianceIds;
    if (currentSelections.length > 0) {
      // Use setTimeout to ensure this happens after the blur event
      setTimeout(() => {
        onChange(currentSelections);
      }, 0);
    }
  };

  const selectValue = selectedAllianceIds.map(id => id.toString());

  // Add CSS to ensure selected options are always visible and fix mobile issues
  const cssStyle = `
    .alliance-multiselect option:checked {
      background-color: #3498db !important;
      color: white !important;
    }
    .alliance-multiselect option:checked:not(:focus) {
      background-color: #3498db !important;
      color: white !important;
    }
    .alliance-multiselect option {
      background-color: white !important;
      color: #374151 !important;
      padding: 8px !important;
      font-size: 14px !important;
      line-height: 1.4 !important;
      border: none !important;
      display: block !important;
      visibility: visible !important;
    }
    .alliance-multiselect option:hover {
      background-color: #f3f4f6 !important;
    }
    @media (max-width: 640px) {
      .alliance-multiselect option {
        font-size: 16px !important;
        padding: 12px !important;
      }
    }
  `;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
      <style>{cssStyle}</style>
      <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">
        {label}:
      </label>
      <select
        className="alliance-multiselect px-3.5 py-2.5 border-2 border-blue-500 rounded-md font-sans text-sm sm:text-[15px] font-medium w-full sm:min-w-[280px] min-h-[100px] shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:bg-slate-100 disabled:text-gray-500 disabled:cursor-not-allowed disabled:opacity-60"
        multiple
        value={selectValue}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        style={{ 
          WebkitAppearance: 'none',
          appearance: 'none',
          backgroundImage: 'none'
        }}
      >
        {availableAlliances.map(alliance => (
          <option 
            key={alliance.id} 
            value={alliance.id.toString()}
          >
            {alliance.name} ({alliance.nationCount} nations)
          </option>
        ))}
      </select>
      <div className="text-xs text-gray-600 font-medium max-w-full sm:max-w-[140px] leading-tight">
        {placeholder}
      </div>
    </div>
  );
};

export default AllianceMultiSelect;
