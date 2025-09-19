import type React from 'react';
import { tableStyles } from '../styles/tableStyles';

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
}) => (
  <input
    type="text"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={className}
    placeholder={placeholder}
    style={{ ...tableStyles.inputField, width: '100%' }}
  />
);

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
}) => (
  <textarea
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={className}
    placeholder={placeholder}
    style={{ 
      ...tableStyles.inputField,
      width: '100%',
      height: '40px',
      resize: 'none',
      fontFamily: 'inherit'
    }}
  />
);

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
    className={className}
    min={min}
    max={max}
    style={{ ...tableStyles.inputField, ...tableStyles.numberInput }}
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
    className={className}
    style={tableStyles.checkboxInput}
  />
);

interface NationCellProps {
  nation: {
    nation_id: number;
    nation_name: string;
    ruler_name: string;
  };
}

export const NationCell: React.FC<NationCellProps> = ({ nation }) => (
  <div>
    <a 
      href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${nation.nation_id}`}
      target="_blank" 
      rel="noopener noreferrer"
      style={{
        color: '#3b82f6',
        textDecoration: 'none',
        fontWeight: '600',
        fontSize: '15px',
        transition: 'color 0.2s ease'
      }}
      onMouseEnter={(e) => e.currentTarget.style.color = '#1d4ed8'}
      onMouseLeave={(e) => e.currentTarget.style.color = '#3b82f6'}
    >
      {nation.nation_name}
    </a>
    <div style={{ 
      fontSize: '13px', 
      color: '#64748b',
      marginTop: '4px',
      fontWeight: '500'
    }}>
      {nation.ruler_name}
    </div>
  </div>
);

interface StrengthCellProps {
  strength?: string;
}

export const StrengthCell: React.FC<StrengthCellProps> = ({ strength }) => (
  <div style={{
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
    fontWeight: '600',
    fontSize: '14px'
  }}>
    {strength ? 
      parseFloat(strength).toLocaleString(undefined, {
        maximumFractionDigits: 0
      }) : 
      '0'
    }
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
  let backgroundColor = '#3b82f6';
  
  if (isSaving) {
    buttonText = 'Saving...';
  } else if (hasValidationErrors) {
    buttonText = 'Fix Errors';
    backgroundColor = '#ef4444';
  } else if (!hasChanges) {
    buttonText = 'No Changes';
    backgroundColor = '#94a3b8';
  }
  
  return (
    <button
      onClick={() => onSave(nationId)}
      disabled={isDisabled}
      className="save-button"
      style={{
        ...tableStyles.saveButton,
        opacity: isDisabled ? 0.5 : 1,
        backgroundColor: backgroundColor,
      }}
    >
      {buttonText}
    </button>
  );
};
