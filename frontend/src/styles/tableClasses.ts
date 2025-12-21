// Reusable Tailwind class strings for table components
// This replaces the old tableStyles.ts with Tailwind utility classes

// Empty cell background color (bg-gray-700 in Tailwind)
export const EMPTY_CELL_BG = '#374151';

export const tableClasses = {
  // Main container styles
  container: 'p-8 bg-transparent min-h-screen w-full max-w-full overflow-x-auto',

  // Card wrapper styles
  card: 'bg-gray-800 rounded-2xl p-8 shadow-custom border border-gray-700 max-w-none w-full',

  // Header styles
  header: 'mb-8',
  title: 'text-3xl font-bold text-gray-200 mb-2 tracking-tight',
  subtitle: 'mt-0 mb-5 text-gray-400 text-base leading-relaxed',

  // Filter controls
  filterContainer: 'flex gap-4 mb-5 flex-wrap items-center',
  filterInput: 'px-4 py-3 border-2 border-gray-600 rounded-lg text-base font-medium min-w-[200px] bg-gray-800 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 hover:border-gray-500',
  filterSelect: 'px-4 py-3 border-2 border-gray-600 rounded-lg text-base font-medium bg-gray-800 text-gray-200 focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 hover:border-gray-500',

  // Table wrapper
  tableWrapper: 'overflow-x-auto rounded-xl shadow-md bg-gray-800 w-full max-w-full max-h-[65vh] overflow-y-auto relative',

  // Table styles
  table: 'w-full min-w-[1000px] border-separate border-spacing-0 bg-gray-800 rounded-xl overflow-visible',

  // Header row styles
  headerRow: 'bg-gradient-to-br from-gray-700 to-gray-800 border-b-2 border-gray-600',

  // Header cell styles
  headerCell: 'px-3 py-4 text-gray-200 font-bold text-base tracking-wide border-b-2 border-gray-600 cursor-pointer select-none transition-all duration-200 bg-gray-700',
  headerCellSmall: 'text-xs',
  headerCellContent: 'flex items-center gap-1',

  // Sort indicator styles
  sortIndicator: 'text-sm font-bold ml-1',
  sortIndicatorActive: 'text-secondary',
  sortIndicatorInactive: 'text-gray-500',

  // Data row styles
  dataRow: 'bg-gray-800 border-b border-gray-700 min-h-[60px] transition-colors',
  dataRowEven: 'bg-gray-800/50',
  dataRowHover: 'hover:bg-gray-700',

  // Data cell styles
  dataCell: 'px-3 py-2 text-gray-200 border-b border-gray-700 align-middle',
  dataCellCompact: 'px-2 py-2 text-gray-200 border-b border-gray-700 align-middle',

  // Input field styles
  inputField: 'border-2 border-gray-600 rounded-lg px-3 py-2 text-sm transition-all duration-200 bg-gray-800 text-gray-200 break-words box-border leading-snug',
  inputFieldFocus: 'outline-none border-secondary ring-2 ring-secondary/20',
  inputFieldHover: 'border-gray-500',
  numberInput: 'text-center font-semibold',
  checkboxInput: 'w-[18px] h-[18px] cursor-pointer accent-secondary',

  // Button styles
  saveButton: 'bg-gradient-to-br from-success to-success-dark text-white border-none rounded-lg px-5 py-2.5 text-sm font-semibold cursor-pointer transition-all shadow-md shadow-success/20 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-success/30 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none',
  saveButtonHover: '-translate-y-0.5 shadow-lg shadow-success/30',
  saveButtonDisabled: 'opacity-60 cursor-not-allowed transform-none',

  // Empty state styles
  emptyState: 'text-center p-15 text-gray-400 bg-gray-800 rounded-xl border-2 border-dashed border-gray-700 mt-5',
  emptyStateText: 'text-base m-0 font-medium',

  // Loading states
  loadingContainer: 'p-8 bg-transparent min-h-screen flex items-center justify-center',
  loadingCard: 'bg-gray-800 rounded-2xl p-10 shadow-custom text-center border border-gray-700',
  loadingText: 'text-lg text-gray-400',

  // Error states
  errorContainer: 'p-8 bg-transparent min-h-screen flex items-center justify-center',
  errorCard: 'bg-gray-800 rounded-2xl p-10 shadow-custom text-center border border-error',
  errorTitle: 'text-error m-0 mb-4',
  errorText: 'text-gray-400 m-0 mb-5',
  retryButton: 'bg-secondary text-white border-none rounded-lg px-5 py-2.5 cursor-pointer text-sm font-semibold hover:bg-blue-600 transition-colors',

  // DefendingWarsTable specific column classes
  defendingWarsColumns: {
    nation: 'p-[2px] md:p-0.5 border border-gray-600 bg-gray-700 min-w-[100px] md:min-w-[150px] max-w-[130px] md:max-w-[200px] w-[100px] md:w-[150px] sticky left-0 z-[100] shadow-[2px_0_8px_-2px_rgba(0,0,0,0.3),1px_0_0_0_#999]',
    warchest: 'p-[2px] md:p-0.5 px-0.5 md:px-1 border border-gray-600 text-center bg-gray-700 min-w-[55px] md:min-w-[80px] max-w-[70px] md:max-w-[100px] w-[60px] md:w-[90px]',
    nukes: 'p-[2px] md:p-0.5 border border-gray-600 text-center bg-gray-700 min-w-[32px] md:min-w-[40px] max-w-[40px] md:max-w-[50px] w-[35px] md:w-[45px]',
    lastNuked: 'p-[2px] md:p-0.5 px-0.5 md:px-1 border border-gray-600 text-center bg-gray-800 min-w-[38px] md:min-w-[50px] max-w-[45px] md:max-w-[60px] w-[40px] md:w-[55px]',
    war: 'p-[2px] md:p-0.5 px-0.5 md:px-1 border border-gray-600 text-center bg-gray-800 min-w-[85px] md:min-w-[120px] max-w-[110px] md:max-w-[150px] w-[95px] md:w-[135px]',
    staggered: 'px-0.5 md:px-1.5 py-0.5 md:py-1 border border-gray-600 text-center bg-gray-800 min-w-[40px] md:min-w-[60px] max-w-[55px] md:max-w-[80px] w-[45px] md:w-[70px]',
    pm: 'px-0.5 md:px-1.5 py-0.5 md:py-1 border border-gray-600 text-center bg-gray-800 min-w-[38px] md:min-w-[50px] max-w-[50px] md:max-w-[70px] w-[42px] md:w-[60px]',
    assignments: 'px-0.5 md:px-1.5 py-0.5 md:py-1 border border-gray-600 text-center bg-gray-800 text-left'
  },

  // DefendingWarsTable header classes
  defendingWarsHeaders: {
    default: 'px-0.5 md:px-1.5 py-1 md:py-2 border border-gray-600 text-left text-white font-bold text-[8px] md:text-sm',
    center: 'px-0.5 md:px-1.5 py-1 md:py-2 border border-gray-600 text-center text-white font-bold text-[8px] md:text-sm'
  },

  // Assignment cell content classes
  assignmentCell: {
    container: 'text-[7px] md:text-[9px] text-left',
    row: 'mb-1 leading-tight font-mono flex items-center',
    nationName: 'w-[120px] md:w-[180px] flex-shrink-0 flex items-center',
    strengthBadge: 'w-[35px] md:w-[50px] flex-shrink-0',
    alliance: 'w-[100px] md:w-[130px] text-gray-400 whitespace-nowrap overflow-hidden overflow-ellipsis flex-shrink-0',
    strength: 'w-[50px] md:w-[75px] text-gray-400 text-right flex-shrink-0',
    technology: 'w-[50px] md:w-[75px] text-gray-400 text-right flex-shrink-0',
    nukes: 'w-[45px] md:w-[60px] text-gray-400 text-right flex-shrink-0',
    wars: 'w-[50px] md:w-[65px] text-gray-400 text-right flex-shrink-0'
  }
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
