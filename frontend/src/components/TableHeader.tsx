import React from 'react';
import { tableClasses } from '../styles/tableClasses';
import clsx from 'clsx';

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
    <div className={clsx(tableClasses.header, className)}>
      <h1 className={tableClasses.title}>{title}</h1>
      {subtitle && <p className={tableClasses.subtitle}>{subtitle}</p>}
      {children}
    </div>
  );
};

export default TableHeader;

