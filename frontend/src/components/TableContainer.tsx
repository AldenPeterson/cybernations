import React from 'react';
import { tableClasses } from '../styles/tableClasses';
import clsx from 'clsx';

export interface TableContainerProps {
  children: React.ReactNode;
  className?: string;
}

const TableContainer: React.FC<TableContainerProps> = ({ 
  children, 
  className = '' 
}) => {
  return (
    <div className={clsx(tableClasses.container, className)}>
      <div className={tableClasses.card}>
        {children}
      </div>
    </div>
  );
};

export default TableContainer;

