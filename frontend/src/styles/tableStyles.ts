// Table Styles - Centralized styling for TanStack Table components
import type { CSSProperties } from 'react';

export const tableStyles: Record<string, CSSProperties> = {
  // Main container styles
  container: {
    padding: '32px',
    backgroundColor: '#f8fafc',
    minHeight: '100vh',
    width: '100%',
    maxWidth: '100vw',
    overflowX: 'auto' as const
  },

  // Card wrapper styles
  card: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '32px',
    boxShadow: '0 10px 25px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    border: '1px solid #e2e8f0',
    maxWidth: 'none',
    width: '100%'
  },

  // Header styles
  header: {
    marginBottom: '32px'
  },

  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#1e293b',
    margin: '0 0 8px 0',
    letterSpacing: '-0.025em'
  },

  subtitle: {
    margin: '0 0 20px 0',
    color: '#64748b',
    fontSize: '16px',
    lineHeight: '1.5'
  },

  // Filter controls
  filterContainer: {
    display: 'flex',
    gap: '16px',
    marginBottom: '20px',
    flexWrap: 'wrap' as const,
    alignItems: 'center'
  },

  filterInput: {
    padding: '8px 12px',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    minWidth: '200px'
  },

  filterSelect: {
    padding: '8px 12px',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    backgroundColor: 'white'
  },

  // Table wrapper
  tableWrapper: {
    overflowX: 'auto' as const,
    borderRadius: '12px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    backgroundColor: 'white',
    width: '100%',
    maxWidth: '100%',
    height: '90vh',
    overflowY: 'auto' as const,
    position: 'relative'
  },

  // Table styles
  table: {
    width: '100%',
    minWidth: '1000px',
    borderCollapse: 'separate' as const,
    borderSpacing: 0,
    backgroundColor: 'white',
    borderRadius: '12px',
    overflow: 'visible' as const
  },

  // Header row styles
  headerRow: {
    background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
    borderBottom: '2px solid #cbd5e1'
  },

  // Header cell styles
  headerCell: {
    padding: '16px 12px',
    color: '#374151',
    fontWeight: '700',
    fontSize: '14px',
    letterSpacing: '0.025em',
    borderBottom: '2px solid #cbd5e1',
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'all 0.2s ease',
    backgroundColor: '#f8fafc'
  },

  headerCellSmall: {
    fontSize: '12px'
  },

  headerCellContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },

  // Sort indicator styles
  sortIndicator: {
    fontSize: '14px',
    fontWeight: 'bold',
    marginLeft: '4px'
  },

  sortIndicatorActive: {
    color: '#3b82f6'
  },

  sortIndicatorInactive: {
    color: '#9ca3af'
  },

  // Data row styles
  dataRow: {
    backgroundColor: 'white',
    borderBottom: '1px solid #f1f5f9'
  },

  dataRowEven: {
    backgroundColor: '#fafbfc'
  },

  dataRowHover: {
    backgroundColor: '#f8fafc'
  },

  // Data cell styles
  dataCell: {
    padding: '2px 2px',
    color: '#1e293b',
    borderBottom: '1px solid #f1f5f9'
  },

  // Input field styles
  inputField: {
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '14px',
    transition: 'all 0.2s ease',
    backgroundColor: '#ffffff',
    color: '#1e293b',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
    boxSizing: 'border-box'
  },

  inputFieldFocus: {
    outline: 'none',
    borderColor: '#3b82f6',
    boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)'
  },

  inputFieldHover: {
    borderColor: '#cbd5e1'
  },

  numberInput: {
    textAlign: 'center' as const,
    fontWeight: '600',
    width: '50px'
  },

  checkboxInput: {
    width: '18px',
    height: '18px',
    accentColor: '#3b82f6',
    cursor: 'pointer'
  },

  // Button styles
  saveButton: {
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)'
  },

  saveButtonHover: {
    transform: 'translateY(-1px)',
    boxShadow: '0 4px 8px rgba(16, 185, 129, 0.3)'
  },

  saveButtonDisabled: {
    opacity: '0.6',
    cursor: 'not-allowed',
    transform: 'none'
  },


  // Empty state styles
  emptyState: {
    textAlign: 'center' as const,
    padding: '60px 40px',
    color: '#64748b',
    backgroundColor: '#f8fafc',
    borderRadius: '12px',
    border: '2px dashed #cbd5e1',
    marginTop: '20px'
  },

  emptyStateText: {
    fontSize: '16px',
    margin: '0',
    fontWeight: '500'
  },

  // Loading states
  loadingContainer: {
    padding: '32px',
    backgroundColor: '#f8fafc',
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },

  loadingCard: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '40px',
    boxShadow: '0 10px 25px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    textAlign: 'center' as const
  },

  loadingText: {
    fontSize: '18px',
    color: '#64748b'
  },

  // Error states
  errorContainer: {
    padding: '32px',
    backgroundColor: '#f8fafc',
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },

  errorCard: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '40px',
    boxShadow: '0 10px 25px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    textAlign: 'center' as const,
    border: '1px solid #fecaca'
  },

  errorTitle: {
    color: '#dc2626',
    margin: '0 0 16px 0'
  },

  errorText: {
    color: '#64748b',
    margin: '0 0 20px 0'
  },

  retryButton: {
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 20px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600'
  }
};

// CSS classes for dynamic styling
export const tableCSS = `
  .nation-table-row:hover {
    background-color: #f8fafc !important;
  }
  .nation-table-row:nth-child(even) {
    background-color: #fafbfc;
  }
  .input-field {
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 14px;
    transition: all 0.2s ease;
    background-color: #ffffff;
    color: #1e293b;
  }
  .input-field:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  .input-field:hover {
    border-color: #cbd5e1;
  }
  .number-input {
    text-align: center;
    font-weight: 600;
  }
  .checkbox-input {
    width: 18px;
    height: 18px;
    accent-color: #3b82f6;
    cursor: pointer;
  }
  .save-button {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    border: none;
    border-radius: 8px;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
  }
  .save-button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(16, 185, 129, 0.3);
  }
  .save-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
  .sortable-header {
    cursor: pointer;
    user-select: none;
    transition: all 0.2s ease;
  }
  .sortable-header:hover {
    background-color: #f1f5f9;
    transform: translateY(-1px);
  }
  .sortable-header:active {
    transform: translateY(0);
  }
  .sticky-header {
    position: sticky !important;
    top: 0 !important;
    z-index: 10 !important;
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%) !important;
  }
`;

// Utility functions for combining styles
export const combineStyles = (...styles: any[]) => {
  return styles.reduce((acc, style) => ({ ...acc, ...style }), {});
};

// Helper function to get text alignment based on column type
export const getTextAlignment = (columnId: string) => {
  if (['strength', 'infrastructure', 'technology'].includes(columnId)) return 'right';
  if (['sendTech', 'sendCash', 'getTech', 'getCash', 'has_dra', 'actions'].includes(columnId)) return 'center';
  return 'left';
};

// Helper function to get header content alignment
export const getHeaderContentAlignment = (columnId: string) => {
  if (['strength', 'infrastructure', 'technology'].includes(columnId)) return 'flex-end';
  if (['sendTech', 'sendCash', 'getTech', 'getCash', 'has_dra', 'actions'].includes(columnId)) return 'center';
  return 'flex-start';
};
