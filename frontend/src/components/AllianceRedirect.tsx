import { Navigate } from 'react-router-dom';
import { useAlliances } from '../contexts/AlliancesContext';
import { useAuth } from '../contexts/AuthContext';

interface AllianceRedirectProps {
  tabName: string;
}

const AllianceRedirect: React.FC<AllianceRedirectProps> = ({ tabName }) => {
  const { alliances, loading } = useAlliances();
  const { user, isAuthenticated, isLoading, hasCapability } = useAuth();

  if (tabName === 'nations') {
    if (isLoading) {
      return (
        <div className="text-center p-10 text-gray-600 mt-20">
          Loading...
        </div>
      );
    }
    if (!isAuthenticated || !user) {
      return <Navigate to="/nations" replace />;
    }
    const canManageAll = hasCapability('manage_all_alliance');
    const managedIds = user.managedAllianceIds ?? [];
    const hasManageableAlliances = canManageAll || managedIds.length > 0;
    if (!hasManageableAlliances) {
      return <Navigate to="/nations" replace />;
    }
    if (!canManageAll && managedIds.length === 1) {
      return <Navigate to={`/${tabName}/${managedIds[0]}`} replace />;
    }
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

