import React from 'react';
import { tableClasses } from '../styles/tableClasses';
import clsx from 'clsx';

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
    <div className={clsx(tableClasses.filterContainer, className)}>
      {children}
    </div>
  );
};

export default FilterControls;

