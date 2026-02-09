import React from 'react';
import { tableClasses } from '../styles/tableClasses';
import clsx from 'clsx';
import PageContainer from './PageContainer';

export interface TableContainerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Container for table-based pages with dark theme.
 * Uses PageContainer internally for consistent spacing and theming.
 */
const TableContainer: React.FC<TableContainerProps> = ({ 
  children, 
  className = '' 
}) => {
  return (
    <PageContainer className={clsx('p-4 md:p-8 w-full max-w-full overflow-x-auto', className)}>
      <div className={clsx(tableClasses.card, 'p-4 md:p-8')}>
        {children}
      </div>
    </PageContainer>
  );
};

export default TableContainer;

