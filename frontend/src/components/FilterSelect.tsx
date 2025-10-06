import React from 'react';
import { tableStyles } from '../styles/tableStyles';

export interface FilterOption {
  label: string;
  value: string | number;
}

export interface FilterSelectProps {
  label: string;
  value: string | number | null;
  options: FilterOption[];
  onChange: (value: string | number | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minWidth?: string;
}

const FilterSelect: React.FC<FilterSelectProps> = ({ 
  label, 
  value, 
  options, 
  onChange, 
  placeholder = 'Choose an option...',
  disabled = false,
  className = '',
  minWidth = '300px'
}) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} className={className}>
      <label style={{ fontWeight: '600', fontSize: '15px', color: '#333' }}>
        {label}:
      </label>
      <select
        value={value || ''}
        onChange={(e) => {
          const value = e.target.value;
          if (value === '') {
            onChange(null);
          } else {
            // Try to parse as number first, fallback to string
            const numValue = parseInt(value);
            onChange(isNaN(numValue) ? value : numValue);
          }
        }}
        disabled={disabled}
        style={{
          ...tableStyles.filterSelect,
          minWidth,
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
          color: '#1e293b',
          fontFamily: 'inherit'
        }}
      >
        <option value="" style={{ color: '#1e293b' }}>{placeholder}</option>
        {options.map(option => (
          <option key={option.value} value={option.value} style={{ color: '#1e293b' }}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default FilterSelect;
