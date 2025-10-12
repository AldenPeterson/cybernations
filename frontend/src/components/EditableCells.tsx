import type React from 'react';
import { useState, useEffect } from 'react';
import { tableClasses } from '../styles/tableClasses';
import WarStatusBadge from './WarStatusBadge';
import clsx from 'clsx';

// Custom hook for debouncing values
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

interface EditableTextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const EditableTextInput: React.FC<EditableTextInputProps> = ({
  value,
  onChange,
  placeholder,
  className = 'input-field'
}) => {
  const [localValue, setLocalValue] = useState(value);
  const debouncedValue = useDebounce(localValue, 500);

  // Update local value when prop value changes (e.g., from external updates)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Call onChange when debounced value changes
  useEffect(() => {
    if (debouncedValue !== value) {
      onChange(debouncedValue);
    }
  }, [debouncedValue, onChange, value]);

  return (
    <input
      type="text"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      className={clsx(tableClasses.inputField, 'w-full h-10', className)}
      placeholder={placeholder}
    />
  );
};

interface EditableTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const EditableTextarea: React.FC<EditableTextareaProps> = ({
  value,
  onChange,
  placeholder,
  className = 'input-field'
}) => {
  const [localValue, setLocalValue] = useState(value);
  const debouncedValue = useDebounce(localValue, 500);

  // Update local value when prop value changes (e.g., from external updates)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Call onChange when debounced value changes
  useEffect(() => {
    if (debouncedValue !== value) {
      onChange(debouncedValue);
    }
  }, [debouncedValue, onChange, value]);

  return (
    <textarea
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      className={clsx(tableClasses.inputField, 'w-full h-10 resize-none font-inherit py-2', className)}
      placeholder={placeholder}
    />
  );
};

interface EditableNumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
}

export const EditableNumberInput: React.FC<EditableNumberInputProps> = ({
  value,
  onChange,
  min = 0,
  max = 6,
  className = 'input-field number-input'
}) => (
  <input
    type="number"
    value={value}
    onChange={(e) => onChange(parseInt(e.target.value) || 0)}
    className={clsx(tableClasses.inputField, tableClasses.numberInput, 'h-10', className)}
    min={min}
    max={max}
  />
);

interface EditableCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export const EditableCheckbox: React.FC<EditableCheckboxProps> = ({
  checked,
  onChange,
  className = 'checkbox-input'
}) => (
  <input
    type="checkbox"
    checked={checked}
    onChange={(e) => onChange(e.target.checked)}
    className={clsx(tableClasses.checkboxInput, className)}
  />
);

interface NationCellProps {
  nation: {
    nation_id: number;
    nation_name: string;
    ruler_name: string;
    inWarMode: boolean;
  };
}

export const NationCell: React.FC<NationCellProps> = ({ nation }) => (
  <div>
    <a 
      href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${nation.nation_id}`}
      target="_blank" 
      rel="noopener noreferrer"
      className="text-secondary no-underline font-semibold text-[15px] transition-colors hover:text-blue-700"
    >
      {nation.nation_name}
    </a>
    <div className="text-xs text-slate-500 mt-1 font-medium">
      {nation.ruler_name}
    </div>
    <WarStatusBadge inWarMode={nation.inWarMode} variant="inline" />
  </div>
);

interface StrengthCellProps {
  strength?: string;
}

const formatStrength = (strength: string): string => {
  // Remove commas before parsing to handle comma-separated numbers
  const value = parseFloat(strength.replace(/,/g, ''));
  
  if (isNaN(value) || value === 0) {
    return '0';
  }
  
  if (value >= 10000) {
    // For values >= 10,000, show as whole thousands (e.g., 742,203 -> 742k)
    return Math.floor(value / 1000) + 'k';
  } else if (value >= 1000) {
    // For values >= 1,000 but < 10,000, show with 2 significant digits (e.g., 1200 -> 1.2k)
    const thousands = value / 1000;
    return thousands.toFixed(1) + 'k';
  } else {
    // For values < 1,000, show the actual amount (e.g., 500 -> 500)
    return Math.floor(value).toString();
  }
};

export const StrengthCell: React.FC<StrengthCellProps> = ({ strength }) => (
  <div className="font-mono font-semibold text-sm">
    {strength ? formatStrength(strength) : '0'}
  </div>
);

interface SaveButtonProps {
  nationId: number;
  isSaving: boolean;
  hasChanges: boolean;
  hasValidationErrors: boolean;
  onSave: (nationId: number) => void;
}

export const SaveButton: React.FC<SaveButtonProps> = ({ nationId, isSaving, hasChanges, hasValidationErrors, onSave }) => {
  const isDisabled = isSaving || !hasChanges || hasValidationErrors;
  
  let buttonText = 'Save';
  let bgColorClass = 'bg-secondary';
  
  if (isSaving) {
    buttonText = 'Saving...';
  } else if (hasValidationErrors) {
    buttonText = 'Fix Errors';
    bgColorClass = 'bg-red-500';
  } else if (!hasChanges) {
    buttonText = 'No Changes';
    bgColorClass = 'bg-slate-400';
  }
  
  return (
    <button
      onClick={() => onSave(nationId)}
      disabled={isDisabled}
      className={clsx(
        tableClasses.saveButton,
        bgColorClass,
        isDisabled && 'opacity-50'
      )}
    >
      {buttonText}
    </button>
  );
};
