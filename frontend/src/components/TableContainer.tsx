import React from 'react';
import { tableStyles } from '../styles/tableStyles';

export interface TableContainerProps {
  children: React.ReactNode;
  className?: string;
}

const TableContainer: React.FC<TableContainerProps> = ({ 
  children, 
  className = '' 
}) => {
  return (
    <div style={tableStyles.container} className={className}>
      <div style={tableStyles.card}>
        {children}
      </div>
    </div>
  );
};

export default TableContainer;

