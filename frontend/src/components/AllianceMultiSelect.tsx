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

  // Get selected alliance names for display
  const selectedAllianceNames = selectedAllianceIds.map(id => {
    const alliance = alliances.find(a => a.id === id);
    return alliance ? alliance.name : '';
  }).filter(name => name !== '');

  // Add CSS to ensure selected options are always visible and fix mobile issues
  const cssStyle = `
    .alliance-multiselect {
      background-color: white !important;
      color: #1f2937 !important;
    }
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
      color: #1f2937 !important;
      padding: 8px !important;
      font-size: 14px !important;
      line-height: 1.4 !important;
      border: none !important;
      display: block !important;
      visibility: visible !important;
    }
    .alliance-multiselect option:hover {
      background-color: #f3f4f6 !important;
      color: #1f2937 !important;
    }
    @media (max-width: 640px) {
      .alliance-multiselect {
        background-color: white !important;
        color: #1f2937 !important;
        -webkit-text-fill-color: #1f2937 !important;
        -webkit-opacity: 1 !important;
      }
      .alliance-multiselect option {
        font-size: 16px !important;
        padding: 12px !important;
        background-color: white !important;
        color: #1f2937 !important;
        -webkit-text-fill-color: #1f2937 !important;
        -webkit-opacity: 1 !important;
      }
      .alliance-multiselect option:checked {
        background-color: #3498db !important;
        color: white !important;
        -webkit-text-fill-color: white !important;
      }
      .alliance-multiselect option:hover {
        background-color: #f3f4f6 !important;
        color: #1f2937 !important;
        -webkit-text-fill-color: #1f2937 !important;
      }
    }
  `;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
      <style>{cssStyle}</style>
      <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">
        {label}:
      </label>
      <div className="flex flex-col gap-2 w-full sm:min-w-[280px]">
        <select
          className="alliance-multiselect px-3.5 py-2.5 border-2 border-blue-500 rounded-md font-sans text-sm sm:text-[15px] font-medium w-full min-h-[100px] shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:bg-slate-100 disabled:text-gray-500 disabled:cursor-not-allowed disabled:opacity-60"
          multiple
          value={selectValue}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          style={{ 
            WebkitAppearance: 'none',
            appearance: 'none',
            backgroundImage: 'none',
            backgroundColor: 'white',
            color: '#1f2937',
            WebkitTextFillColor: '#1f2937',
            opacity: 1
          } as React.CSSProperties}
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
        {/* Mobile display of selected alliances */}
        <div className="block sm:hidden">
          {selectedAllianceNames.length > 0 ? (
            <div className="p-2 bg-blue-50 border border-blue-200 rounded-md">
              <div className="text-xs font-semibold text-blue-800 mb-1">
                Selected Alliances ({selectedAllianceNames.length}):
              </div>
              <div className="text-xs text-blue-700 space-y-1">
                {selectedAllianceNames.map((name, index) => (
                  <div key={index} className="flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-2 flex-shrink-0"></span>
                    {name}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-2 bg-gray-50 border border-gray-200 rounded-md">
              <div className="text-xs text-gray-600">No alliances selected</div>
            </div>
          )}
        </div>
      </div>
      <div className="text-xs text-gray-600 font-medium max-w-full sm:max-w-[140px] leading-tight">
        {placeholder}
      </div>
    </div>
  );
};

export default AllianceMultiSelect;
