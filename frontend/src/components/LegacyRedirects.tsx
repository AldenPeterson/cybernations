import { useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

/**
 * Component that redirects from /recommendations to /aid?tab=recommendations
 * Preserves alliance ID if present
 */
export const RecommendationsRedirect = () => {
  const navigate = useNavigate();
  const { allianceId } = useParams<{ allianceId?: string }>();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Preserve any existing query parameters
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('tab', 'recommendations');
    
    if (allianceId) {
      navigate(`/aid/${allianceId}?${newSearchParams.toString()}`, { replace: true });
    } else {
      navigate(`/aid?${newSearchParams.toString()}`, { replace: true });
    }
  }, [navigate, allianceId, searchParams]);

  return null;
};

