import React from 'react';
import { tableClasses } from '../styles/tableClasses';
import clsx from 'clsx';

export interface TableColumn<T> {
  key: keyof T | string;
  header: string;
  render?: (value: any, row: T, index: number) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
}

export interface ReusableTableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  className?: string;
  rowKey?: keyof T | ((row: T, index: number) => string);
}

function ReusableTable<T>({ 
  data, 
  columns, 
  loading = false, 
  error = null, 
  emptyMessage = 'No data available',
  className = '',
  rowKey
}: ReusableTableProps<T>) {
  
  const getRowKey = (row: T, index: number): string => {
    if (typeof rowKey === 'function') {
      return rowKey(row, index);
    }
    if (typeof rowKey === 'string') {
      return String(row[rowKey as keyof T]);
    }
    return `row-${index}`;
  };

  if (loading) {
    return (
      <div className={tableClasses.loadingContainer}>
        <div className={tableClasses.loadingCard}>
          <div className={tableClasses.loadingText}>Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={tableClasses.errorContainer}>
        <div className={tableClasses.errorCard}>
          <h3 className={tableClasses.errorTitle}>Error</h3>
          <p className={tableClasses.errorText}>{error}</p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={tableClasses.emptyState}>
        <p className={tableClasses.emptyStateText}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={clsx(tableClasses.tableWrapper, className)}>
      <table className={tableClasses.table}>
        <thead>
          <tr className={tableClasses.headerRow}>
            {columns.map((column) => (
              <th
                key={String(column.key)}
                className={clsx(
                  tableClasses.headerCell,
                  column.sortable && 'cursor-pointer'
                )}
                style={{
                  textAlign: column.align || 'left',
                  width: column.width
                }}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr 
              key={getRowKey(row, rowIndex)}
              className={clsx(tableClasses.dataRow, 'nation-table-row')}
            >
              {columns.map((column) => (
                <td
                  key={`${String(column.key)}-${rowIndex}`}
                  className={tableClasses.dataCell}
                  style={{
                    textAlign: column.align || 'left'
                  }}
                >
                  {column.render 
                    ? column.render(row[column.key as keyof T], row, rowIndex)
                    : String(row[column.key as keyof T] || '')
                  }
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ReusableTable;
