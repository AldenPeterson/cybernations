import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, UserRole } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole[];
  requireAllianceManager?: number;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  requireAllianceManager,
}) => {
  const { isAuthenticated, isLoading, user, isAllianceManager } = useAuth();

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

  if (requiredRole && user) {
    if (!requiredRole.includes(user.role)) {
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

