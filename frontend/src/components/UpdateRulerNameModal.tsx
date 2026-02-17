import React, { useState, useEffect } from 'react';
import { apiCallWithErrorHandling } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

interface UpdateRulerNameModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const UpdateRulerNameModal: React.FC<UpdateRulerNameModalProps> = ({ isOpen, onClose }) => {
  const { user, fetchAuthState } = useAuth();
  const [rulerName, setRulerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize with current rulerName when modal opens
  useEffect(() => {
    if (isOpen && user) {
      setRulerName(user.rulerName || '');
      setError(null);
    }
  }, [isOpen, user]);

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

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
        // Close modal
        onClose();
      } else {
        setError(response.error || 'Failed to update ruler name');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while updating your ruler name');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // Reset to original value
    setRulerName(user?.rulerName || '');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleCancel}
    >
      <div 
        className="bg-gray-800 rounded-2xl p-8 shadow-custom border border-gray-700 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-gray-200 mb-2 tracking-tight">
          Update Ruler Name
        </h2>
        <p className="text-gray-400 mb-6 text-sm leading-relaxed">
          Enter your Cyber Nations ruler name. This will be used to identify you in the system.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="modal-rulerName" className="block text-sm font-medium text-gray-300 mb-2">
              Ruler Name
            </label>
            <input
              id="modal-rulerName"
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

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="px-5 py-2.5 text-base font-semibold rounded-lg border-2 border-gray-600 bg-gray-700 text-gray-200 hover:bg-gray-600 hover:border-gray-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !rulerName.trim()}
              className="px-5 py-2.5 text-base font-semibold rounded-lg bg-gradient-to-br from-success to-success-dark text-white border-none shadow-md shadow-success/20 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-success/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UpdateRulerNameModal;

