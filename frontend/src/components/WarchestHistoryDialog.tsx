import React, { useState, useEffect } from 'react';
import { apiCall } from '../utils/api';

interface WarchestSubmission {
  id: number;
  nationId: number | null;
  nationName: string;
  totalMoney: number;
  armyXP?: number | null;
  navyXP?: number | null;
  airForceXP?: number | null;
  intelligenceXP?: number | null;
  hasAssignedGenerals: boolean;
  assignedGenerals?: string | null;
  capturedAt: string;
  createdAt: string;
}

interface WarchestHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  nationId: number;
  nationName: string;
  rulerName: string;
}

const WarchestHistoryDialog: React.FC<WarchestHistoryDialogProps> = ({
  isOpen,
  onClose,
  nationId,
  nationName,
  rulerName
}) => {
  const [submissions, setSubmissions] = useState<WarchestSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && nationId) {
      fetchWarchestHistory();
    }
  }, [isOpen, nationId]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const fetchWarchestHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiCall(`/api/warchest-submissions?nationId=${nationId}`);
      const data = await response.json();
      
      if (data.success && data.data && data.data.submissions) {
        setSubmissions(data.data.submissions);
      } else {
        setError('Failed to load warchest history');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load warchest history');
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (amount: number): string => {
    if (amount >= 1000000000) {
      return `$${(amount / 1000000000).toFixed(2)}B`;
    } else if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(2)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(2)}K`;
    }
    return `$${amount.toFixed(2)}`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div 
        className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-200">
            Warchest History: {rulerName} / {nationName}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-2xl font-bold leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="text-center text-gray-400 py-8">Loading...</div>
          )}
          
          {error && (
            <div className="text-center text-red-400 py-8">{error}</div>
          )}
          
          {!loading && !error && submissions.length === 0 && (
            <div className="text-center text-gray-400 py-8">No warchest history found</div>
          )}
          
          {!loading && !error && submissions.length > 0 && (
            <div className="space-y-2 overflow-x-auto">
              <table className="w-full border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left p-2 text-gray-300 font-semibold text-sm">Submitted</th>
                    <th className="text-right p-2 text-gray-300 font-semibold text-sm">Amount</th>
                    <th className="text-left p-2 text-gray-300 font-semibold text-sm">XP</th>
                    <th className="text-left p-2 text-gray-300 font-semibold text-sm">Generals</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((submission) => (
                    <tr key={submission.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                      <td className="p-2 text-gray-300 text-sm">{formatDate(submission.createdAt)}</td>
                      <td className="p-2 text-green-400 text-sm font-semibold text-right">
                        {formatMoney(submission.totalMoney)}
                      </td>
                      <td className="p-2 text-gray-300 text-sm">
                        {(submission.armyXP !== null && submission.armyXP !== undefined) ||
                         (submission.navyXP !== null && submission.navyXP !== undefined) ||
                         (submission.airForceXP !== null && submission.airForceXP !== undefined) ||
                         (submission.intelligenceXP !== null && submission.intelligenceXP !== undefined) ? (
                          <div className="text-xs space-y-0.5">
                            {submission.armyXP !== null && submission.armyXP !== undefined && (
                              <div>Army: {submission.armyXP}</div>
                            )}
                            {submission.navyXP !== null && submission.navyXP !== undefined && (
                              <div>Navy: {submission.navyXP}</div>
                            )}
                            {submission.airForceXP !== null && submission.airForceXP !== undefined && (
                              <div>Air: {submission.airForceXP}</div>
                            )}
                            {submission.intelligenceXP !== null && submission.intelligenceXP !== undefined && (
                              <div>Intel: {submission.intelligenceXP}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500 text-xs">—</span>
                        )}
                      </td>
                      <td className="p-2 text-gray-300 text-sm">
                        {submission.hasAssignedGenerals && submission.assignedGenerals ? (
                          <div className="text-xs text-blue-300" title={submission.assignedGenerals}>
                            {submission.assignedGenerals.length > 50 
                              ? `${submission.assignedGenerals.substring(0, 50)}...`
                              : submission.assignedGenerals}
                          </div>
                        ) : (
                          <span className="text-gray-500 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WarchestHistoryDialog;

