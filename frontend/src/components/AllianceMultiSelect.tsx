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

  const styles = {
    container: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    },
    label: {
      fontSize: '14px',
      fontWeight: '600',
      color: '#2c3e50',
      whiteSpace: 'nowrap' as const
    },
    select: {
      padding: '10px 14px',
      border: '2px solid #3498db',
      borderRadius: '6px',
      backgroundColor: disabled ? '#f8f9fa' : '#fff',
      fontSize: '15px',
      fontWeight: '500',
      color: disabled ? '#6c757d' : '#2c3e50',
      minWidth: '280px',
      minHeight: '100px',
      boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
      fontFamily: 'Arial, sans-serif',
      lineHeight: '1.4',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1
    },
    option: {
      padding: '6px 10px',
      fontSize: '15px',
      fontWeight: '500',
      color: '#2c3e50',
      backgroundColor: '#fff',
      lineHeight: '1.4'
    },
    placeholder: {
      fontSize: '12px',
      color: '#5a6c7d',
      fontWeight: '500',
      maxWidth: '140px',
      lineHeight: '1.3'
    }
  };

  // Add CSS to ensure selected options are always visible
  const cssStyle = `
    .alliance-multiselect option:checked {
      background-color: #3498db !important;
      color: white !important;
    }
    .alliance-multiselect option:checked:not(:focus) {
      background-color: #3498db !important;
      color: white !important;
    }
  `;

  return (
    <div style={styles.container}>
      <style>{cssStyle}</style>
      <label style={styles.label}>
        {label}:
      </label>
      <select
        className="alliance-multiselect"
        multiple
        value={selectValue}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        style={styles.select}
      >
        {availableAlliances.map(alliance => (
          <option 
            key={alliance.id} 
            value={alliance.id.toString()}
            style={styles.option}
          >
            {alliance.name} ({alliance.nationCount} nations)
          </option>
        ))}
      </select>
      <div style={styles.placeholder}>
        {placeholder}
      </div>
    </div>
  );
};

export default AllianceMultiSelect;
