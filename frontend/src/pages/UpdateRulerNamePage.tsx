import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiCallWithErrorHandling } from '../utils/api';
import PageContainer from '../components/PageContainer';

const UpdateRulerNamePage: React.FC = () => {
  const { user, fetchAuthState, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [rulerName, setRulerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if not authenticated or already has rulerName
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/aid');
      return;
    }
    
    // If user already has a rulerName, redirect to home
    if (user?.rulerName) {
      navigate('/aid');
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!rulerName.trim()) {
      setError('Ruler name cannot be empty');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiCallWithErrorHandling('/api/auth/update-rulername', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ rulerName: rulerName.trim() }),
      });

      if (response.success) {
        // Refresh auth state to get updated user info
        await fetchAuthState();
        // Redirect to home page
        navigate('/aid');
      } else {
        setError(response.error || 'Failed to update ruler name');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while updating your ruler name');
    } finally {
      setLoading(false);
    }
  };

  // Don't render if user already has rulerName (will redirect)
  if (user?.rulerName) {
    return null;
  }

  return (
    <PageContainer className="flex items-center justify-center min-h-screen">
      <div className="bg-gray-800 rounded-2xl p-8 shadow-custom border border-gray-700 max-w-md w-full">
        <h1 className="text-3xl font-bold text-gray-200 mb-2 tracking-tight">
          Set Your Ruler Name
        </h1>
        <p className="text-gray-400 mb-6 text-base leading-relaxed">
          Please enter your Cyber Nations ruler name to continue. This will be used to identify you in the system.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="rulerName" className="block text-sm font-medium text-gray-300 mb-2">
              Ruler Name
            </label>
            <input
              id="rulerName"
              type="text"
              value={rulerName}
              onChange={(e) => {
                setRulerName(e.target.value);
                setError(null);
              }}
              className="w-full px-4 py-3 border-2 border-gray-600 rounded-lg text-base font-medium bg-gray-800 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 hover:border-gray-500 transition-all"
              placeholder="Enter your ruler name"
              maxLength={100}
              autoFocus
              disabled={loading}
            />
            {error && (
              <p className="mt-2 text-sm text-red-400">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !rulerName.trim()}
            className="w-full bg-gradient-to-br from-success to-success-dark text-white border-none rounded-lg px-5 py-3 text-base font-semibold cursor-pointer transition-all shadow-md shadow-success/20 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-success/30 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
          >
            {loading ? 'Saving...' : 'Save Ruler Name'}
          </button>
        </form>
      </div>
    </PageContainer>
  );
};

export default UpdateRulerNamePage;

