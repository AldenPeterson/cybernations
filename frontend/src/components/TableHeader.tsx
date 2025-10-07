import React from 'react';
import { tableStyles } from '../styles/tableStyles';

export interface TableHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
}

const TableHeader: React.FC<TableHeaderProps> = ({ 
  title, 
  subtitle, 
  children, 
  className = '' 
}) => {
  return (
    <div style={tableStyles.header} className={className}>
      <h1 style={tableStyles.title}>{title}</h1>
      {subtitle && <p style={tableStyles.subtitle}>{subtitle}</p>}
      {children}
    </div>
  );
};

export default TableHeader;

