import React from 'react';

export interface FilterCheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

const FilterCheckbox: React.FC<FilterCheckboxProps> = ({ 
  label, 
  checked, 
  onChange, 
  disabled = false,
  className = ''
}) => {
  return (
    <label style={{ 
      display: 'flex', 
      alignItems: 'center', 
      padding: '6px 10px',
      backgroundColor: '#f8f9fa',
      border: '1px solid #ddd',
      borderRadius: '4px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: '13px',
      fontWeight: '500',
      color: disabled ? '#999' : '#333',
      opacity: disabled ? 0.6 : 1
    }} className={className}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        style={{ 
          marginRight: '6px',
          accentColor: '#007bff',
          transform: 'scale(1.1)',
          cursor: disabled ? 'not-allowed' : 'pointer'
        }}
      />
      {label}
    </label>
  );
};

export default FilterCheckbox;
