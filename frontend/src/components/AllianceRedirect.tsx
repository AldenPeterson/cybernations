import { Navigate } from 'react-router-dom';
import { useAlliances } from '../contexts/AlliancesContext';

interface AllianceRedirectProps {
  tabName: string;
}

const AllianceRedirect: React.FC<AllianceRedirectProps> = ({ tabName }) => {
  const { alliances, loading } = useAlliances();

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

