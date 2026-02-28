import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import NationEditor from '../components/NationEditor';
import PageContainer from '../components/PageContainer';
import { useAuth } from '../contexts/AuthContext';

const NationsPage: React.FC = () => {
  const { allianceId } = useParams<{ allianceId: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading, hasCapability, isAllianceManager } = useAuth();

  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return;
    const canManageAll = hasCapability('manage_all_alliance');
    const managedIds = user.managedAllianceIds ?? [];
    const hasManageableAlliances = canManageAll || managedIds.length > 0;
    if (!hasManageableAlliances) return;
    if (!allianceId) {
      if (!canManageAll && managedIds.length === 1) {
        navigate(`/nations/${managedIds[0]}`, { replace: true });
      }
      return;
    }
    const allianceIdNum = parseInt(allianceId);
    if (!isNaN(allianceIdNum) && !hasCapability('manage_alliance', allianceIdNum)) {
      return;
    }
  }, [isLoading, isAuthenticated, user, allianceId, navigate, hasCapability, isAllianceManager]);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <PageContainer className="text-center p-10 text-gray-400">
        Loading...
      </PageContainer>
    );
  }

  // Show error if not authenticated
  if (!isAuthenticated || !user) {
    return (
      <PageContainer className="text-center p-10">
        <div className="max-w-md mx-auto">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Authentication Required</h2>
          <p className="text-gray-400 mb-6">
            You must be logged in to access the Alliance Manager.
          </p>
          <button
            onClick={() => window.location.href = '/api/auth/google'}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Log In
          </button>
        </div>
      </PageContainer>
    );
  }

  const hasManageableAlliances = hasCapability('manage_all_alliance') || (user.managedAllianceIds?.length ?? 0) > 0;
  if (!hasManageableAlliances) {
    return (
      <PageContainer className="text-center p-10">
        <div className="max-w-md mx-auto">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
          <p className="text-gray-400">
            You do not have permission to manage any alliances. Please contact an administrator.
          </p>
        </div>
      </PageContainer>
    );
  }

  // If no allianceId, show message (unless redirect is in progress)
  if (!allianceId) {
    return (
      <PageContainer className="text-center p-10 text-gray-400">
        Please select an alliance to use the Alliance Manager.
      </PageContainer>
    );
  }

  const allianceIdNum = parseInt(allianceId);
  if (!isNaN(allianceIdNum) && !hasCapability('manage_alliance', allianceIdNum)) {
    return (
      <PageContainer className="text-center p-10">
        <div className="max-w-md mx-auto">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
          <p className="text-gray-400 mb-6">
            You do not have permission to manage this alliance.
          </p>
          {(user.managedAllianceIds?.length ?? 0) > 0 && (
            <button
              onClick={() => navigate(`/nations/${user.managedAllianceIds![0]}`)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Go to Your Alliance
            </button>
          )}
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <NationEditor allianceId={allianceIdNum} />
    </PageContainer>
  );
};

export default NationsPage;
