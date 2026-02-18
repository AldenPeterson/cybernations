import React, { useState, useEffect } from 'react';
import { apiCallWithErrorHandling } from '../utils/api';
import PageContainer from '../components/PageContainer';

interface SpyOperationSubmission {
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
  nation?: {
    id: number;
    nationName: string;
    rulerName: string;
    alliance: {
      id: number;
      name: string;
    };
  } | null;
}

const SpyOperationSubmissionPage: React.FC = () => {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<SpyOperationSubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  // Load submissions on mount
  useEffect(() => {
    loadSubmissions();
    // We intentionally do not include loadSubmissions in the dependency array
    // to avoid reloading unnecessarily.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSubmissions = async () => {
    setLoadingSubmissions(true);
    try {
      const response = await apiCallWithErrorHandling('/api/warchest-submissions?limit=50', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.success && response.data) {
        setSubmissions(response.data.submissions || []);
      }
    } catch (err: any) {
      console.error('Error loading submissions:', err);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!text.trim()) {
      setError('Please paste the spy operation text');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await apiCallWithErrorHandling('/api/warchest-submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ text: text.trim() }),
      });

      if (response.success) {
        setSuccess('Spy operation submission created successfully!');
        setText('');
        // Reload submissions
        await loadSubmissions();
      } else {
        setError(response.error || 'Failed to submit spy operation data');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while submitting spy operation data');
    } finally {
      setSubmitting(false);
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <PageContainer className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-200 mb-2">Spy Operation Submission</h1>
        <p className="text-gray-400">
          Paste spy operation text to extract and store warchest, XP levels, and assigned generals information.
        </p>
      </div>

      <div className="bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-700 mb-6">
        <h2 className="text-xl font-semibold text-gray-200 mb-4">Submit Spy Operation Data</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="spyText" className="block text-sm font-medium text-gray-300 mb-2">
              Spy Operation Text
            </label>
            <textarea
              id="spyText"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setError(null);
                setSuccess(null);
              }}
              className="w-full px-4 py-3 border-2 border-gray-600 rounded-lg text-sm font-medium bg-gray-900 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 hover:border-gray-500 transition-all font-mono"
              placeholder="Paste the spy operation text here..."
              rows={10}
              disabled={submitting}
            />
            {error && (
              <p className="mt-2 text-sm text-red-400">{error}</p>
            )}
            {success && (
              <p className="mt-2 text-sm text-green-400">{success}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || !text.trim()}
            className="bg-primary text-white border-none rounded-lg px-6 py-3 text-base font-semibold cursor-pointer transition-all shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </form>
      </div>

      <div className="bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-700">
        <h2 className="text-xl font-semibold text-gray-200 mb-4">Recent Submissions</h2>
        
        {loadingSubmissions ? (
          <p className="text-gray-400">Loading...</p>
        ) : submissions.length === 0 ? (
          <p className="text-gray-400">No submissions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-gray-300 font-semibold">Nation</th>
                  <th className="text-left py-3 px-4 text-gray-300 font-semibold">Alliance</th>
                  <th className="text-right py-3 px-4 text-gray-300 font-semibold">Total Money</th>
                  <th className="text-left py-3 px-4 text-gray-300 font-semibold">XP Levels</th>
                  <th className="text-left py-3 px-4 text-gray-300 font-semibold">Assigned Generals</th>
                  <th className="text-left py-3 px-4 text-gray-300 font-semibold">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((submission) => (
                  <tr key={submission.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-3 px-4 text-gray-200">
                      {submission.nation ? (
                        <>
                          <div className="font-medium">{submission.nation.nationName}</div>
                          <div className="text-xs text-gray-400">{submission.nation.rulerName}</div>
                        </>
                      ) : (
                        <span className="text-gray-400">{submission.nationName}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-300">
                      {submission.nation?.alliance.name || '-'}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-200 font-medium">
                      {formatMoney(submission.totalMoney)}
                    </td>
                    <td className="py-3 px-4 text-gray-300">
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
                            <div>Air Force: {submission.airForceXP}</div>
                          )}
                          {submission.intelligenceXP !== null && submission.intelligenceXP !== undefined && (
                            <div>Intelligence: {submission.intelligenceXP}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500 text-xs">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-300">
                      {submission.hasAssignedGenerals ? (
                        <div className="text-xs">
                          <span className="text-green-400 font-semibold">Yes</span>
                          {submission.assignedGenerals && (
                            <div className="text-gray-400 mt-1">{submission.assignedGenerals}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500 text-xs">No</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-400 text-xs">
                      {formatDate(submission.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageContainer>
  );
};

export default SpyOperationSubmissionPage;

