import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiCallWithErrorHandling, API_ENDPOINTS } from '../utils/api';
import TableContainer from '../components/TableContainer';
import { useAuth, UserRole } from '../contexts/AuthContext';

interface MobilizationNation {
  nationId: number;
  nationName: string;
  rulerName: string;
  strength: number;
  oldDefcon?: number | null;
  newDefcon?: number | null;
  createdAt: string;
}

interface BucketCategory {
  count: number;
  nations: MobilizationNation[];
}

interface MobilizationBucket {
  date: string;
  enteredWarMode: BucketCategory;
  leftWarMode: BucketCategory;
  defconDown: BucketCategory;
  defconUp: BucketCategory;
}

interface MobilizationCurrentState {
  warModeCount: number;
  peaceModeCount: number;
  defconDistribution: Record<string, number>;
}

interface MobilizationResponse {
  success: boolean;
  allianceId: number;
  allianceName: string;
  startDate: string;
  endDate: string;
  buckets: MobilizationBucket[];
  currentState: MobilizationCurrentState;
  totalNations: number;
}

interface WarModeHistoryPoint {
  date: string;
  warMode: number;
  peaceMode: number;
  total: number;
  warModeNations: NationRef[];
  peaceModeNations: NationRef[];
}

interface NationRef {
  nationId: number;
  nationName: string;
  rulerName: string;
  strength: number;
}

interface WarModeHistoryResponse {
  success: boolean;
  allianceId: number;
  allianceName: string;
  startDate: string;
  endDate: string;
  earliestEventDate: string | null;
  series: WarModeHistoryPoint[];
}

type CategoryKey = 'enteredWarMode' | 'defconDown' | 'defconUp' | 'leftWarMode';

interface CategoryDef {
  key: CategoryKey;
  label: string;
  shortLabel: string;
  color: string;
  description: string;
}

const CATEGORY_BY_KEY: Record<CategoryKey, CategoryDef> = {
  enteredWarMode: {
    key: 'enteredWarMode',
    label: 'Entered War Mode',
    shortLabel: 'War On',
    color: '#10b981',
    description: 'Nations that switched from peace mode to war mode.',
  },
  leftWarMode: {
    key: 'leftWarMode',
    label: 'Left War Mode',
    shortLabel: 'War Off',
    color: '#ef4444',
    description: 'Nations that switched from war mode to peace mode.',
  },
  defconDown: {
    key: 'defconDown',
    label: 'DEFCON Decreased (Mobilizing)',
    shortLabel: 'DEFCON ↓',
    color: '#ef4444',
    description: 'Nations that lowered their DEFCON level (e.g. 5 → 3).',
  },
  defconUp: {
    key: 'defconUp',
    label: 'DEFCON Increased (Demobilizing)',
    shortLabel: 'DEFCON ↑',
    color: '#10b981',
    description: 'Nations that raised their DEFCON level (e.g. 1 → 5).',
  },
};

const WAR_MODE_KEYS: CategoryKey[] = ['enteredWarMode', 'leftWarMode'];
const DEFCON_KEYS: CategoryKey[] = ['defconDown', 'defconUp'];
const ALL_CATEGORY_KEYS: CategoryKey[] = [...WAR_MODE_KEYS, ...DEFCON_KEYS];
const CATEGORIES: CategoryDef[] = ALL_CATEGORY_KEYS.map((k) => CATEGORY_BY_KEY[k]);

const POPOVER_WIDTH = 360;
const POPOVER_MAX_HEIGHT = 420;

const computePopoverPosition = (rect: {
  top: number;
  bottom: number;
  left: number;
  right: number;
}): { top: number; left: number } => {
  const margin = 8;
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  const spaceBelow = viewportH - rect.bottom;
  const spaceAbove = rect.top;
  const top =
    spaceBelow >= POPOVER_MAX_HEIGHT + margin || spaceBelow >= spaceAbove
      ? rect.bottom + margin
      : Math.max(margin, rect.top - POPOVER_MAX_HEIGHT - margin);

  // Center horizontally on the anchor, then clamp to viewport.
  const anchorCenter = (rect.left + rect.right) / 2;
  let left = anchorCenter - POPOVER_WIDTH / 2;
  if (left < margin) left = margin;
  if (left + POPOVER_WIDTH > viewportW - margin) {
    left = Math.max(margin, viewportW - POPOVER_WIDTH - margin);
  }
  return { top, left };
};

const formatDateLabel = (dateStr: string): string => {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [, m, d] = parts;
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
};

const formatLongDateLabel = (dateStr: string): string => {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  const date = new Date(Date.UTC(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10)));
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

const toYmd = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getDefaultDates = (): { startDate: string; endDate: string } => {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 13); // 14-day window, inclusive
  return { startDate: toYmd(start), endDate: toYmd(today) };
};

interface EventPopoverContent {
  scope: 'event';
  date: string;
  category: CategoryDef;
  nations: MobilizationNation[];
}

interface StatePopoverContent {
  scope: 'state';
  date: string;
  label: string;
  color: string;
  count: number;
  totalActive: number;
  nations: NationRef[];
}

type PopoverContent = EventPopoverContent | StatePopoverContent;

interface PopoverState {
  content: PopoverContent;
  anchorRect: { top: number; bottom: number; left: number; right: number };
  locked: boolean;
}

const MobilizationEventsPage: React.FC = () => {
  const { allianceId: allianceIdParam } = useParams<{ allianceId: string }>();
  const allianceId = allianceIdParam ? parseInt(allianceIdParam, 10) : NaN;
  const { user } = useAuth();
  const canEditDates = !!user?.roles?.some((r) =>
    r === UserRole.WAR_MANAGER || r === UserRole.ALLIANCE_MANAGER || r === UserRole.ADMIN
  );

  const defaults = useMemo(getDefaultDates, []);
  const [startDate, setStartDate] = useState<string>(defaults.startDate);
  const [endDate, setEndDate] = useState<string>(defaults.endDate);
  const [debouncedStart, setDebouncedStart] = useState<string>(defaults.startDate);
  const [debouncedEnd, setDebouncedEnd] = useState<string>(defaults.endDate);

  const [data, setData] = useState<MobilizationResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [history, setHistory] = useState<WarModeHistoryResponse | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [popover, setPopover] = useState<PopoverState | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const hoverOpenTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  // Debounce date changes so dragging the date picker doesn't spam the API.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedStart(startDate);
      setDebouncedEnd(endDate);
    }, 400);
    return () => clearTimeout(t);
  }, [startDate, endDate]);

  useEffect(() => {
    if (isNaN(allianceId)) return;
    if (!debouncedStart || !debouncedEnd) return;
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        setHistoryError(null);
        const [mobResult, histResult] = await Promise.allSettled([
          apiCallWithErrorHandling(
            API_ENDPOINTS.mobilization(allianceId, debouncedStart, debouncedEnd)
          ) as Promise<MobilizationResponse>,
          apiCallWithErrorHandling(
            API_ENDPOINTS.warModeHistory(allianceId, debouncedStart, debouncedEnd)
          ) as Promise<WarModeHistoryResponse>,
        ]);
        if (cancelled) return;

        if (mobResult.status === 'fulfilled' && mobResult.value.success) {
          setData(mobResult.value);
        } else {
          const msg =
            mobResult.status === 'rejected'
              ? mobResult.reason instanceof Error
                ? mobResult.reason.message
                : 'Failed to load mobilization data'
              : 'Failed to load mobilization data';
          setError(msg);
        }

        if (histResult.status === 'fulfilled' && histResult.value.success) {
          setHistory(histResult.value);
        } else {
          const msg =
            histResult.status === 'rejected'
              ? histResult.reason instanceof Error
                ? histResult.reason.message
                : 'Failed to load war/peace history'
              : 'Failed to load war/peace history';
          setHistoryError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [allianceId, debouncedStart, debouncedEnd]);

  const closePopover = useCallback(() => setPopover(null), []);

  const cancelTimers = useCallback(() => {
    if (hoverOpenTimerRef.current !== null) {
      window.clearTimeout(hoverOpenTimerRef.current);
      hoverOpenTimerRef.current = null;
    }
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      setPopover((prev) => (prev && !prev.locked ? null : prev));
      closeTimerRef.current = null;
    }, 250);
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => cancelTimers(), [cancelTimers]);

  useEffect(() => {
    if (!popover) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePopover();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [popover, closePopover]);

  useEffect(() => {
    if (!popover?.locked) return;
    const onMouseDown = (e: MouseEvent) => {
      if (popoverRef.current && popoverRef.current.contains(e.target as Node)) return;
      closePopover();
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [popover?.locked, closePopover]);

  const openPopoverForElement = useCallback(
    (target: Element, content: PopoverContent, locked: boolean) => {
      const rect = target.getBoundingClientRect();
      cancelTimers();
      setPopover({
        content,
        anchorRect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
        locked,
      });
    },
    [cancelTimers]
  );

  const handleSegmentEnter = useCallback(
    (e: React.MouseEvent<Element>, content: PopoverContent) => {
      cancelClose();
      if (popover?.locked) return;
      const target = e.currentTarget;
      const rect = target.getBoundingClientRect();
      const anchorRect = {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
      };
      if (hoverOpenTimerRef.current !== null) window.clearTimeout(hoverOpenTimerRef.current);
      hoverOpenTimerRef.current = window.setTimeout(() => {
        setPopover({ content, anchorRect, locked: false });
        hoverOpenTimerRef.current = null;
      }, 120);
    },
    [popover?.locked, cancelClose]
  );

  const handleSegmentLeave = useCallback(() => {
    if (hoverOpenTimerRef.current !== null) {
      window.clearTimeout(hoverOpenTimerRef.current);
      hoverOpenTimerRef.current = null;
    }
    scheduleClose();
  }, [scheduleClose]);

  const handleSegmentClick = useCallback(
    (e: React.MouseEvent<Element>, content: PopoverContent) => {
      e.stopPropagation();
      openPopoverForElement(e.currentTarget, content, true);
    },
    [openPopoverForElement]
  );

  const totals = useMemo(() => {
    const totals: Record<CategoryKey, number> = {
      enteredWarMode: 0,
      defconDown: 0,
      defconUp: 0,
      leftWarMode: 0,
    };
    if (!data) return totals;
    for (const b of data.buckets) {
      totals.enteredWarMode += b.enteredWarMode.count;
      totals.defconDown += b.defconDown.count;
      totals.defconUp += b.defconUp.count;
      totals.leftWarMode += b.leftWarMode.count;
    }
    return totals;
  }, [data]);

  if (isNaN(allianceId)) {
    return (
      <TableContainer>
        <div className="text-center p-10 text-gray-400">No alliance selected.</div>
      </TableContainer>
    );
  }

  return (
    <TableContainer>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-200 mb-1">
          Mobilization Events{data ? ` — ${data.allianceName}` : ''}
        </h1>
        <p className="text-sm text-gray-400">
          DEFCON changes and war/peace mode toggles for this alliance, bucketed by day. Hover any
          stacked segment to see contributing nations; click to keep the popover open.
        </p>
      </div>

      {/* Date range — restricted to war managers (and above) */}
      {canEditDates && (
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <label htmlFor="mob-start-date" className="text-sm font-semibold text-gray-300 whitespace-nowrap w-24">
              Start Date:
            </label>
            <input
              id="mob-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border-2 border-gray-600 rounded-lg text-base font-medium bg-gray-800 text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="mob-end-date" className="text-sm font-semibold text-gray-300 whitespace-nowrap w-24">
              End Date:
            </label>
            <input
              id="mob-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border-2 border-gray-600 rounded-lg text-base font-medium bg-gray-800 text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
        </div>
      )}

      {loading && <div className="text-center py-6 text-gray-400">Loading mobilization data...</div>}
      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-200 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Current state KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">War Mode</div>
              <div className="text-3xl font-bold text-red-400">
                {data.currentState.warModeCount}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                of {data.totalNations} active nation{data.totalNations === 1 ? '' : 's'}
              </div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Peace Mode</div>
              <div className="text-3xl font-bold text-emerald-400">
                {data.currentState.peaceModeCount}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                of {data.totalNations} active nation{data.totalNations === 1 ? '' : 's'}
              </div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">
                DEFCON Distribution
              </div>
              <div className="flex flex-wrap gap-2">
                {(['1', '2', '3', '4', '5'] as const).map((lvl) => {
                  const count = data.currentState.defconDistribution[lvl] ?? 0;
                  const isMobilized = lvl === '1' || lvl === '2';
                  return (
                    <div
                      key={lvl}
                      className={`flex flex-col items-center px-2 py-1 rounded border text-xs ${
                        isMobilized
                          ? 'border-orange-700/60 bg-orange-900/20 text-orange-200'
                          : 'border-gray-700 bg-gray-900/40 text-gray-300'
                      }`}
                    >
                      <span className="font-semibold">DEFCON {lvl}</span>
                      <span className="text-base font-bold">{count}</span>
                    </div>
                  );
                })}
                {(data.currentState.defconDistribution.unknown ?? 0) > 0 && (
                  <div className="flex flex-col items-center px-2 py-1 rounded border border-gray-700 bg-gray-900/40 text-gray-400 text-xs">
                    <span className="font-semibold">Unknown</span>
                    <span className="text-base font-bold">
                      {data.currentState.defconDistribution.unknown}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Range totals */}
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-gray-400">Totals in range:</span>
            {CATEGORIES.map((cat) => (
              <span
                key={cat.key}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-gray-700 bg-gray-800/60"
              >
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="text-gray-300">{cat.label}</span>
                <span className="font-semibold text-gray-100">{totals[cat.key]}</span>
              </span>
            ))}
          </div>

          {/* Chart */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 overflow-x-auto">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-1">
              <span className="text-xs uppercase tracking-wide text-gray-400">
                ↑ War / Peace Mode &nbsp;·&nbsp; ↓ DEFCON
              </span>
            </div>
            <MobilizationChart
              buckets={data.buckets}
              aboveKeys={WAR_MODE_KEYS}
              belowKeys={DEFCON_KEYS}
              onSegmentEnter={handleSegmentEnter}
              onSegmentLeave={handleSegmentLeave}
              onSegmentClick={handleSegmentClick}
            />
          </div>
        </>
      )}

      {!loading && !error && data && data.buckets.every((b) =>
        ALL_CATEGORY_KEYS.every((k) => b[k].count === 0)
      ) && (
        <div className="text-center text-gray-400 mt-6">
          No DEFCON or war-mode changes recorded in this range.
        </div>
      )}

      {/* Reconstructed war/peace history (prototype) */}
      {!loading && (history || historyError) && (
        <div className="mt-8">
          <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
            <h2 className="text-lg font-semibold text-gray-200">
              Reconstructed War / Peace Counts
            </h2>
            {history?.earliestEventDate && (
              <span className="text-xs text-gray-500">
                Reliable from {history.earliestEventDate} onward
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Walks event log backward from current state. Use to spot-check the data;
            see notes in <code>warModeHistoryController.ts</code> for caveats.
          </p>
          {historyError && (
            <div className="bg-red-900/30 border border-red-700 text-red-200 px-4 py-3 rounded mb-3 text-sm">
              {historyError}
            </div>
          )}
          {history && history.series.length > 0 && (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 overflow-x-auto">
              <WarModeHistoryChart
                series={history.series}
                onSegmentEnter={handleSegmentEnter}
                onSegmentLeave={handleSegmentLeave}
                onSegmentClick={handleSegmentClick}
              />
            </div>
          )}
          {history && history.series.length === 0 && !historyError && (
            <div className="text-center text-gray-400 text-sm">
              No history available for this range.
            </div>
          )}
        </div>
      )}

      {popover && (() => {
        const pos = computePopoverPosition(popover.anchorRect);
        const c = popover.content;
        const headerLabel = c.scope === 'event' ? c.category.label : c.label;
        const headerColor = c.scope === 'event' ? c.category.color : c.color;
        const subtitle =
          c.scope === 'event'
            ? `${formatLongDateLabel(c.date)} • ${c.nations.length} nation${c.nations.length === 1 ? '' : 's'}`
            : `${formatLongDateLabel(c.date)} • ${c.count} of ${c.totalActive} (${
                c.totalActive > 0 ? ((c.count / c.totalActive) * 100).toFixed(1) : '0.0'
              }%)`;
        return (
          <div
            ref={popoverRef}
            className="fixed z-[2000] bg-gray-900 border border-gray-700 rounded-lg shadow-xl text-sm overflow-y-auto"
            style={{
              top: pos.top,
              left: pos.left,
              width: POPOVER_WIDTH,
              maxHeight: POPOVER_MAX_HEIGHT,
            }}
            onMouseEnter={cancelClose}
            onMouseLeave={popover.locked ? undefined : scheduleClose}
          >
            <div className="flex items-start justify-between gap-3 p-3 border-b border-gray-700">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm"
                    style={{ backgroundColor: headerColor }}
                  />
                  <span className="font-bold text-gray-100">{headerLabel}</span>
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">{subtitle}</div>
              </div>
              {popover.locked && (
                <button
                  type="button"
                  onClick={closePopover}
                  className="text-gray-400 hover:text-white text-xl leading-none px-1.5 -mt-0.5"
                  aria-label="Close"
                >
                  ×
                </button>
              )}
            </div>

            <div className="p-3 space-y-1.5">
              {c.nations.length === 0 && (
                <div className="text-xs text-gray-500 text-center py-2">No nations</div>
              )}
              {c.nations.map((n) => (
                <div
                  key={n.nationId}
                  className="flex items-baseline justify-between gap-2 bg-gray-800/40 border border-gray-700/60 rounded px-2 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <a
                      href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${n.nationId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary no-underline font-medium hover:underline truncate block text-xs"
                    >
                      {n.nationName}
                    </a>
                    <div className="text-[10px] text-gray-500 truncate">
                      {n.rulerName} • NS {Math.round(n.strength).toLocaleString()}
                    </div>
                  </div>
                  {c.scope === 'event' &&
                  (c.category.key === 'defconDown' || c.category.key === 'defconUp') ? (
                    <span className="text-[11px] font-semibold whitespace-nowrap text-gray-200">
                      DEFCON {(n as MobilizationNation).oldDefcon ?? '?'} →{' '}
                      {(n as MobilizationNation).newDefcon ?? '?'}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </TableContainer>
  );
};

interface MobilizationChartProps {
  buckets: MobilizationBucket[];
  aboveKeys: CategoryKey[];
  belowKeys: CategoryKey[];
  onSegmentEnter: (e: React.MouseEvent<Element>, content: PopoverContent) => void;
  onSegmentLeave: () => void;
  onSegmentClick: (e: React.MouseEvent<Element>, content: PopoverContent) => void;
}

const niceUpperBound = (n: number): number => {
  if (n <= 5) return 5;
  if (n <= 10) return 10;
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  return Math.ceil(n / pow) * pow;
};

const MobilizationChart: React.FC<MobilizationChartProps> = ({
  buckets,
  aboveKeys,
  belowKeys,
  onSegmentEnter,
  onSegmentLeave,
  onSegmentClick,
}) => {
  const margin = { top: 16, right: 24, bottom: 56, left: 44 };
  const minWidth = 720;
  const widthPerBar = 28;
  const width = Math.max(minWidth, margin.left + margin.right + buckets.length * widthPerBar);
  const height = 420;
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const aboveCats = aboveKeys.map((k) => CATEGORY_BY_KEY[k]);
  const belowCats = belowKeys.map((k) => CATEGORY_BY_KEY[k]);

  const aboveSums = buckets.map((b) => aboveKeys.reduce((s, k) => s + b[k].count, 0));
  const belowSums = buckets.map((b) => belowKeys.reduce((s, k) => s + b[k].count, 0));
  const maxAbove = Math.max(0, ...aboveSums);
  const maxBelow = Math.max(0, ...belowSums);
  // Each half gets its own scale so a busy DEFCON day doesn't squash the war/peace bars.
  const niceAbove = niceUpperBound(Math.max(1, maxAbove));
  const niceBelow = niceUpperBound(Math.max(1, maxBelow));

  const halfHeight = plotHeight / 2;
  const zeroY = halfHeight;

  const yScalePos = (v: number) => zeroY - (v / niceAbove) * halfHeight;
  const yScaleNeg = (v: number) => zeroY + (v / niceBelow) * halfHeight;

  const tickCount = 4;
  const aboveStep = niceAbove / tickCount;
  const belowStep = niceBelow / tickCount;
  const aboveTicks = Array.from({ length: tickCount + 1 }, (_, i) =>
    Math.round(i * aboveStep)
  );
  const belowTicks = Array.from({ length: tickCount + 1 }, (_, i) =>
    Math.round(i * belowStep)
  ).filter((v) => v > 0); // 0 already drawn from above-side

  const xScale = (i: number) => {
    if (buckets.length === 0) return 0;
    const slot = plotWidth / buckets.length;
    return i * slot + slot / 2;
  };
  const barWidth = Math.max(8, (plotWidth / Math.max(1, buckets.length)) * 0.7);

  const xLabelIndices = useMemo(() => {
    const n = buckets.length;
    if (n === 0) return [] as number[];
    const max = 12;
    const step = Math.max(1, Math.ceil(n / max));
    const out: number[] = [];
    for (let i = 0; i < n; i += step) out.push(i);
    if (out[out.length - 1] !== n - 1) out.push(n - 1);
    return out;
  }, [buckets.length]);

  return (
    <svg width={width} height={height} className="block">
      <g transform={`translate(${margin.left},${margin.top})`}>
        {/* Grid + y-axis ticks (above zero) */}
        {aboveTicks.map((t, i) => (
          <g key={`yta-${i}`}>
            <line
              x1={0}
              y1={yScalePos(t)}
              x2={plotWidth}
              y2={yScalePos(t)}
              stroke="#374151"
              strokeWidth={1}
              strokeDasharray={t === 0 ? undefined : '2,3'}
            />
            <text
              x={-8}
              y={yScalePos(t)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={11}
              fill="#9ca3af"
            >
              {t}
            </text>
          </g>
        ))}

        {/* Grid + y-axis ticks (below zero) */}
        {belowTicks.map((t, i) => (
          <g key={`ytb-${i}`}>
            <line
              x1={0}
              y1={yScaleNeg(t)}
              x2={plotWidth}
              y2={yScaleNeg(t)}
              stroke="#374151"
              strokeWidth={1}
              strokeDasharray="2,3"
            />
            <text
              x={-8}
              y={yScaleNeg(t)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={11}
              fill="#9ca3af"
            >
              {t}
            </text>
          </g>
        ))}

        {/* Zero (x-axis) line — emphasized */}
        <line
          x1={0}
          y1={zeroY}
          x2={plotWidth}
          y2={zeroY}
          stroke="#9ca3af"
          strokeWidth={1.5}
        />

        {/* Bars */}
        {buckets.map((b, i) => {
          const x = xScale(i) - barWidth / 2;
          let aboveStack = 0;
          let belowStack = 0;
          return (
            <g key={b.date}>
              {aboveCats.map((cat) => {
                const cell = b[cat.key];
                if (cell.count === 0) return null;
                const yTop = yScalePos(aboveStack + cell.count);
                const yBottom = yScalePos(aboveStack);
                aboveStack += cell.count;
                const segHeight = Math.max(1, yBottom - yTop);
                const content: PopoverContent = {
                  scope: 'event',
                  date: b.date,
                  category: cat,
                  nations: cell.nations,
                };
                return (
                  <rect
                    key={`a-${cat.key}`}
                    x={x}
                    y={yTop}
                    width={barWidth}
                    height={segHeight}
                    fill={cat.color}
                    stroke="#111827"
                    strokeWidth={0.5}
                    className="cursor-pointer transition-opacity hover:opacity-80"
                    onMouseEnter={(e) => onSegmentEnter(e, content)}
                    onMouseLeave={onSegmentLeave}
                    onClick={(e) => onSegmentClick(e, content)}
                  />
                );
              })}
              {belowCats.map((cat) => {
                const cell = b[cat.key];
                if (cell.count === 0) return null;
                const yTop = yScaleNeg(belowStack);
                const yBottom = yScaleNeg(belowStack + cell.count);
                belowStack += cell.count;
                const segHeight = Math.max(1, yBottom - yTop);
                const content: PopoverContent = {
                  scope: 'event',
                  date: b.date,
                  category: cat,
                  nations: cell.nations,
                };
                return (
                  <rect
                    key={`b-${cat.key}`}
                    x={x}
                    y={yTop}
                    width={barWidth}
                    height={segHeight}
                    fill={cat.color}
                    stroke="#111827"
                    strokeWidth={0.5}
                    className="cursor-pointer transition-opacity hover:opacity-80"
                    onMouseEnter={(e) => onSegmentEnter(e, content)}
                    onMouseLeave={onSegmentLeave}
                    onClick={(e) => onSegmentClick(e, content)}
                  />
                );
              })}
            </g>
          );
        })}

        {/* X labels (placed below the bottom of the plot, not at zero) */}
        {xLabelIndices.map((i) => {
          const b = buckets[i];
          if (!b) return null;
          const x = xScale(i);
          return (
            <g key={`xl-${i}`} transform={`translate(${x}, ${plotHeight + 6})`}>
              <line x1={0} y1={-6} x2={0} y2={0} stroke="#9ca3af" strokeWidth={1} />
              <text
                x={0}
                y={14}
                textAnchor="middle"
                fontSize={10}
                fill="#d1d5db"
                transform="rotate(-45) translate(-12, 8)"
              >
                {formatDateLabel(b.date)}
              </text>
            </g>
          );
        })}

        {/* Y axis labels for halves */}
        <text
          transform={`translate(${-32}, ${halfHeight / 2}) rotate(-90)`}
          textAnchor="middle"
          fontSize={11}
          fill="#9ca3af"
          fontWeight="bold"
        >
          War / Peace
        </text>
        <text
          transform={`translate(${-32}, ${zeroY + halfHeight / 2}) rotate(-90)`}
          textAnchor="middle"
          fontSize={11}
          fill="#9ca3af"
          fontWeight="bold"
        >
          DEFCON
        </text>
      </g>
    </svg>
  );
};

interface WarModeHistoryChartProps {
  series: WarModeHistoryPoint[];
  onSegmentEnter: (e: React.MouseEvent<Element>, content: PopoverContent) => void;
  onSegmentLeave: () => void;
  onSegmentClick: (e: React.MouseEvent<Element>, content: PopoverContent) => void;
}

const WAR_COLOR = '#10b981';
const PEACE_COLOR = '#ef4444';

const WarModeHistoryChart: React.FC<WarModeHistoryChartProps> = ({
  series,
  onSegmentEnter,
  onSegmentLeave,
  onSegmentClick,
}) => {
  const margin = { top: 16, right: 24, bottom: 56, left: 44 };
  const minWidth = 720;
  const widthPerBar = 28;
  const width = Math.max(minWidth, margin.left + margin.right + series.length * widthPerBar);
  const height = 280;
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const xScale = (i: number) => {
    if (series.length === 0) return 0;
    const slot = plotWidth / series.length;
    return i * slot + slot / 2;
  };
  const barWidth = Math.max(8, (plotWidth / Math.max(1, series.length)) * 0.7);

  const yTicks = [0, 25, 50, 75, 100];
  const yScale = (pct: number) => plotHeight - (pct / 100) * plotHeight;

  const xLabelIndices = (() => {
    const n = series.length;
    if (n === 0) return [] as number[];
    const max = 12;
    const step = Math.max(1, Math.ceil(n / max));
    const out: number[] = [];
    for (let i = 0; i < n; i += step) out.push(i);
    if (out[out.length - 1] !== n - 1) out.push(n - 1);
    return out;
  })();

  return (
    <svg width={width} height={height} className="block">
      <g transform={`translate(${margin.left},${margin.top})`}>
        {/* Grid + y ticks (percentage axis) */}
        {yTicks.map((t, i) => (
          <g key={`yt-${i}`}>
            <line
              x1={0}
              y1={yScale(t)}
              x2={plotWidth}
              y2={yScale(t)}
              stroke="#374151"
              strokeWidth={1}
              strokeDasharray={i === 0 || i === yTicks.length - 1 ? undefined : '2,3'}
            />
            <text
              x={-8}
              y={yScale(t)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={11}
              fill="#9ca3af"
            >
              {t}%
            </text>
          </g>
        ))}

        {/* Bars: each bar is 100% tall, split into peace (bottom) and war (top) */}
        {series.map((p, i) => {
          const x = xScale(i) - barWidth / 2;
          if (p.total === 0) {
            // Show a thin gray placeholder so the day isn't visually blank.
            return (
              <rect
                key={`empty-${p.date}`}
                x={x}
                y={yScale(100) - 1}
                width={barWidth}
                height={1}
                fill="#4b5563"
              />
            );
          }
          const warPct = (p.warMode / p.total) * 100;
          const peacePct = 100 - warPct;
          const peaceY = yScale(peacePct);
          const warY = yScale(100);
          const peaceHeight = Math.max(0, plotHeight - peaceY);
          const warHeight = Math.max(0, peaceY - warY);

          const peaceContent: PopoverContent = {
            scope: 'state',
            date: p.date,
            label: 'Peace mode',
            color: PEACE_COLOR,
            count: p.peaceMode,
            totalActive: p.total,
            nations: p.peaceModeNations,
          };
          const warContent: PopoverContent = {
            scope: 'state',
            date: p.date,
            label: 'War mode',
            color: WAR_COLOR,
            count: p.warMode,
            totalActive: p.total,
            nations: p.warModeNations,
          };

          return (
            <g key={p.date}>
              {peaceHeight > 0 && (
                <rect
                  x={x}
                  y={peaceY}
                  width={barWidth}
                  height={peaceHeight}
                  fill={PEACE_COLOR}
                  stroke="#111827"
                  strokeWidth={0.5}
                  className="cursor-pointer transition-opacity hover:opacity-80"
                  onMouseEnter={(e) => onSegmentEnter(e, peaceContent)}
                  onMouseLeave={onSegmentLeave}
                  onClick={(e) => onSegmentClick(e, peaceContent)}
                />
              )}
              {warHeight > 0 && (
                <rect
                  x={x}
                  y={warY}
                  width={barWidth}
                  height={warHeight}
                  fill={WAR_COLOR}
                  stroke="#111827"
                  strokeWidth={0.5}
                  className="cursor-pointer transition-opacity hover:opacity-80"
                  onMouseEnter={(e) => onSegmentEnter(e, warContent)}
                  onMouseLeave={onSegmentLeave}
                  onClick={(e) => onSegmentClick(e, warContent)}
                />
              )}
            </g>
          );
        })}

        {/* X labels */}
        {xLabelIndices.map((i) => {
          const p = series[i];
          if (!p) return null;
          const x = xScale(i);
          return (
            <g key={`xl-${i}`} transform={`translate(${x}, ${plotHeight + 6})`}>
              <line x1={0} y1={-6} x2={0} y2={0} stroke="#9ca3af" strokeWidth={1} />
              <text
                x={0}
                y={14}
                textAnchor="middle"
                fontSize={10}
                fill="#d1d5db"
                transform="rotate(-45) translate(-12, 8)"
              >
                {formatDateLabel(p.date)}
              </text>
            </g>
          );
        })}

        {/* Y axis label */}
        <text
          transform={`translate(${-32}, ${plotHeight / 2}) rotate(-90)`}
          textAnchor="middle"
          fontSize={11}
          fill="#9ca3af"
          fontWeight="bold"
        >
          Share
        </text>
      </g>
    </svg>
  );
};

export default MobilizationEventsPage;
