import React from 'react';
import clsx from 'clsx';

export interface FilterCheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  accentColor?: string;
}

const FilterCheckbox: React.FC<FilterCheckboxProps> = ({ 
  label, 
  checked, 
  onChange, 
  disabled = false,
  className = '',
  accentColor = '#007bff'
}) => {
  return (
    <label 
      className={clsx(
        'flex items-center px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-medium',
        disabled ? 'cursor-not-allowed text-gray-400 opacity-60' : 'cursor-pointer text-gray-800',
        className
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className={clsx(
          'mr-1.5 scale-110',
          disabled ? 'cursor-not-allowed' : 'cursor-pointer'
        )}
        style={{ accentColor }}
      />
      {label}
    </label>
  );
};

export default FilterCheckbox;

