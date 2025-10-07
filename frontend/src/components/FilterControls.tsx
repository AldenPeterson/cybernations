import React from 'react';
import { tableStyles } from '../styles/tableStyles';

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterControlsProps {
  children?: React.ReactNode;
  className?: string;
}

const FilterControls: React.FC<FilterControlsProps> = ({ 
  children, 
  className = '' 
}) => {
  return (
    <div style={tableStyles.filterContainer} className={className}>
      {children}
    </div>
  );
};

export default FilterControls;

