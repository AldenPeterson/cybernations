import React from 'react';
import { tableClasses } from '../styles/tableClasses';
import clsx from 'clsx';

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
    <div className={clsx('flex items-center gap-2.5', className)}>
      <label className="font-semibold text-[15px] text-gray-800">
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
        className={clsx(
          tableClasses.filterSelect,
          'text-slate-800 font-inherit',
          disabled && 'opacity-60 cursor-not-allowed'
        )}
        style={{ minWidth }}
      >
        <option value="" className="text-slate-800">{placeholder}</option>
        {options.map(option => (
          <option key={option.value} value={option.value} className="text-slate-800">
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default FilterSelect;
