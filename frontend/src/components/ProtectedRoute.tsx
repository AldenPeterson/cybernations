import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredCapability?: string | string[];
  requiredCapabilityAllianceId?: number;
  requireAllianceManager?: number;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredCapability,
  requiredCapabilityAllianceId,
  requireAllianceManager,
}) => {
  const { isAuthenticated, isLoading, user, hasCapability, isAllianceManager } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (requiredCapability && user) {
    const caps = Array.isArray(requiredCapability) ? requiredCapability : [requiredCapability];
    const hasOne = caps.some((cap) =>
      requiredCapabilityAllianceId != null
        ? hasCapability(cap, requiredCapabilityAllianceId)
        : hasCapability(cap)
    );
    if (!hasOne) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-lg text-red-600">Insufficient permissions</div>
        </div>
      );
    }
  }

  if (requireAllianceManager && !isAllianceManager(requireAllianceManager)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red-600">
          You do not have permission to manage this alliance
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;

