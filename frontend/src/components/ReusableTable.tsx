import React from 'react';
import { tableStyles } from '../styles/tableStyles';

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
      <div style={tableStyles.loadingContainer}>
        <div style={tableStyles.loadingCard}>
          <div style={tableStyles.loadingText}>Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={tableStyles.errorContainer}>
        <div style={tableStyles.errorCard}>
          <h3 style={tableStyles.errorTitle}>Error</h3>
          <p style={tableStyles.errorText}>{error}</p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div style={tableStyles.emptyState}>
        <p style={tableStyles.emptyStateText}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div style={tableStyles.tableWrapper} className={className}>
      <table style={tableStyles.table}>
        <thead>
          <tr style={tableStyles.headerRow}>
            {columns.map((column) => (
              <th
                key={String(column.key)}
                style={{
                  ...tableStyles.headerCell,
                  textAlign: column.align || 'left',
                  width: column.width,
                  cursor: column.sortable ? 'pointer' : 'default'
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
              style={{
                ...tableStyles.dataRow,
                ...(rowIndex % 2 === 0 ? tableStyles.dataRowEven : {})
              }}
              className="nation-table-row"
            >
              {columns.map((column) => (
                <td
                  key={`${String(column.key)}-${rowIndex}`}
                  style={{
                    ...tableStyles.dataCell,
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
