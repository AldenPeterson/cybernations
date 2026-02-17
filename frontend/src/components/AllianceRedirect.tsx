import { Navigate } from 'react-router-dom';
import { useAlliances } from '../contexts/AlliancesContext';
import { useAuth, UserRole } from '../contexts/AuthContext';

interface AllianceRedirectProps {
  tabName: string;
}

const AllianceRedirect: React.FC<AllianceRedirectProps> = ({ tabName }) => {
  const { alliances, loading } = useAlliances();
  const { user, isAuthenticated, isLoading } = useAuth();

  // For nations tab, check authentication and permissions
  if (tabName === 'nations') {
    // Wait for auth to load
    if (isLoading) {
      return (
        <div className="text-center p-10 text-gray-600 mt-20">
          Loading...
        </div>
      );
    }

    // If not authenticated, redirect to nations page which will show error
    if (!isAuthenticated || !user) {
      return <Navigate to="/nations" replace />;
    }

    // Check if user is admin or has manageable alliances
    const isAdmin = user.role === UserRole.ADMIN;
    const hasManageableAlliances = user.managedAllianceIds.length > 0;

    if (!isAdmin && !hasManageableAlliances) {
      // User can't manage any alliances, redirect to nations page which will show error
      return <Navigate to="/nations" replace />;
    }

    // If user can only manage one alliance, redirect to it
    if (!isAdmin && user.managedAllianceIds.length === 1) {
      return <Navigate to={`/${tabName}/${user.managedAllianceIds[0]}`} replace />;
    }

    // For admins or users with multiple manageable alliances, continue with default behavior
  }

  // If alliances are still loading, show a loading state
  if (loading) {
    return (
      <div className="text-center p-10 text-gray-600 mt-20">
        Loading alliances...
      </div>
    );
  }

  // If no alliances available, show error
  if (alliances.length === 0) {
    return (
      <div className="text-center p-10 text-gray-600 mt-20">
        No alliances available. Please try again later.
      </div>
    );
  }

  // Find Doombrella first, otherwise use the first alliance
  const doombrella = alliances.find((alliance) =>
    alliance.name.toLowerCase().includes('doombrella')
  );
  const defaultAlliance = doombrella || alliances[0];

  // Redirect to the tab with the default alliance ID
  return <Navigate to={`/${tabName}/${defaultAlliance.id}`} replace />;
};

export default AllianceRedirect;

