// Reusable Tailwind class strings for table components
// This replaces the old tableStyles.ts with Tailwind utility classes

export const tableClasses = {
  // Main container styles
  container: 'p-8 bg-slate-50 min-h-screen w-full max-w-full overflow-x-auto',

  // Card wrapper styles
  card: 'bg-white rounded-2xl p-8 shadow-custom border border-slate-200 max-w-none w-full',

  // Header styles
  header: 'mb-8',
  title: 'text-3xl font-bold text-slate-800 mb-2 tracking-tight',
  subtitle: 'mt-0 mb-5 text-slate-500 text-base leading-relaxed',

  // Filter controls
  filterContainer: 'flex gap-4 mb-5 flex-wrap items-center',
  filterInput: 'px-3 py-2 border-2 border-slate-200 rounded-lg text-sm min-w-[200px] focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20',
  filterSelect: 'px-3 py-2 border-2 border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20',

  // Table wrapper
  tableWrapper: 'overflow-x-auto rounded-xl shadow-md bg-white w-full max-w-full h-[90vh] overflow-y-auto relative',

  // Table styles
  table: 'w-full min-w-[1000px] border-separate border-spacing-0 bg-white rounded-xl overflow-visible',

  // Header row styles
  headerRow: 'bg-gradient-to-br from-slate-50 to-slate-200 border-b-2 border-slate-300',

  // Header cell styles
  headerCell: 'px-3 py-4 text-gray-700 font-bold text-sm tracking-wide border-b-2 border-slate-300 cursor-pointer select-none transition-all duration-200 bg-slate-50',
  headerCellSmall: 'text-xs',
  headerCellContent: 'flex items-center gap-1',

  // Sort indicator styles
  sortIndicator: 'text-sm font-bold ml-1',
  sortIndicatorActive: 'text-secondary',
  sortIndicatorInactive: 'text-gray-400',

  // Data row styles
  dataRow: 'bg-white border-b border-slate-100 min-h-[60px] transition-colors',
  dataRowEven: 'bg-slate-50/50',
  dataRowHover: 'hover:bg-slate-50',

  // Data cell styles
  dataCell: 'px-3 py-2 text-slate-800 border-b border-slate-100 align-middle',
  dataCellCompact: 'px-1 py-0.5 text-slate-800 border-b border-slate-100 align-middle',

  // Input field styles
  inputField: 'border-2 border-slate-200 rounded-lg px-3 py-2 text-sm transition-all duration-200 bg-white text-slate-800 break-words box-border leading-snug',
  inputFieldFocus: 'outline-none border-secondary ring-2 ring-secondary/20',
  inputFieldHover: 'border-slate-300',
  numberInput: 'text-center font-semibold w-[50px]',
  checkboxInput: 'w-[18px] h-[18px] cursor-pointer',

  // Button styles
  saveButton: 'bg-gradient-to-br from-success to-success-dark text-white border-none rounded-lg px-5 py-2.5 text-sm font-semibold cursor-pointer transition-all shadow-md shadow-success/20 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-success/30 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none',
  saveButtonHover: '-translate-y-0.5 shadow-lg shadow-success/30',
  saveButtonDisabled: 'opacity-60 cursor-not-allowed transform-none',

  // Empty state styles
  emptyState: 'text-center p-15 text-slate-500 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300 mt-5',
  emptyStateText: 'text-base m-0 font-medium',

  // Loading states
  loadingContainer: 'p-8 bg-slate-50 min-h-screen flex items-center justify-center',
  loadingCard: 'bg-white rounded-2xl p-10 shadow-custom text-center',
  loadingText: 'text-lg text-slate-500',

  // Error states
  errorContainer: 'p-8 bg-slate-50 min-h-screen flex items-center justify-center',
  errorCard: 'bg-white rounded-2xl p-10 shadow-custom text-center border border-error-light',
  errorTitle: 'text-error m-0 mb-4',
  errorText: 'text-slate-500 m-0 mb-5',
  retryButton: 'bg-secondary text-white border-none rounded-lg px-5 py-2.5 cursor-pointer text-sm font-semibold hover:bg-blue-600 transition-colors',
};

// Helper function to combine classes (similar to combineStyles)
export const combineClasses = (...classes: (string | undefined | null | false)[]) => {
  return classes.filter(Boolean).join(' ');
};

// Helper function to get text alignment based on column type
export const getTextAlignment = (columnId: string) => {
  if (['strength', 'infrastructure', 'technology'].includes(columnId)) return 'text-right';
  if (['sendTech', 'sendCash', 'getTech', 'getCash', 'has_dra', 'actions'].includes(columnId)) return 'text-center';
  return 'text-left';
};

// Helper function to get header content alignment
export const getHeaderContentAlignment = (columnId: string) => {
  if (['strength', 'infrastructure', 'technology'].includes(columnId)) return 'justify-end';
  if (['sendTech', 'sendCash', 'getTech', 'getCash', 'has_dra', 'actions'].includes(columnId)) return 'justify-center';
  return 'justify-start';
};

