import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import NationEditor from '../components/NationEditor';
import PageContainer from '../components/PageContainer';
import { useAuth, UserRole } from '../contexts/AuthContext';
import { getApiBaseUrl } from '../utils/api';

const NationsPage: React.FC = () => {
  const { allianceId } = useParams<{ allianceId: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading, isAllianceManager } = useAuth();

  // Check authentication and permissions
  useEffect(() => {
    if (isLoading) return;

    // If not authenticated, show error (handled in render)
    if (!isAuthenticated || !user) {
      return;
    }

    // Check if user is admin or has manageable alliances
    const isAdmin = user.role === UserRole.ADMIN;
    const hasManageableAlliances = user.managedAllianceIds.length > 0;

    if (!isAdmin && !hasManageableAlliances) {
      // User is logged in but can't manage any alliances
      return;
    }

    // If no allianceId in URL, handle redirect
    if (!allianceId) {
      // If user can only manage one alliance, redirect to it
      if (!isAdmin && user.managedAllianceIds.length === 1) {
        navigate(`/nations/${user.managedAllianceIds[0]}`, { replace: true });
        return;
      }
      // Otherwise, let the component show the "select alliance" message
      return;
    }

    // If allianceId is provided, check if user can manage it
    const allianceIdNum = parseInt(allianceId);
    if (!isNaN(allianceIdNum)) {
      if (!isAdmin && !isAllianceManager(allianceIdNum)) {
        // User cannot manage this alliance - error will be shown in render
        return;
      }
    }
  }, [isLoading, isAuthenticated, user, allianceId, navigate, isAllianceManager]);

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

  // Check if user is admin or has manageable alliances
  const isAdmin = user.role === UserRole.ADMIN;
  const hasManageableAlliances = user.managedAllianceIds.length > 0;

  if (!isAdmin && !hasManageableAlliances) {
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

  // Check if user can manage this specific alliance
  const allianceIdNum = parseInt(allianceId);
  if (!isNaN(allianceIdNum) && !isAdmin && !isAllianceManager(allianceIdNum)) {
    return (
      <PageContainer className="text-center p-10">
        <div className="max-w-md mx-auto">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
          <p className="text-gray-400 mb-6">
            You do not have permission to manage this alliance.
          </p>
          {user.managedAllianceIds.length > 0 && (
            <button
              onClick={() => navigate(`/nations/${user.managedAllianceIds[0]}`)}
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
