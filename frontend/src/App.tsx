import { useState, useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import NavigationBar from './components/NavigationBar'
import AllianceRedirect from './components/AllianceRedirect'
import { RecommendationsRedirect } from './components/LegacyRedirects'
import GlobalWarsPage from './pages/GlobalWarsPage'
import AidPage from './pages/AidPage'
import InterallianceAidPage from './pages/InterallianceAidPage'
import NationsPage from './pages/NationsPage'
import DefendingWarsPage from './pages/DefendingWarsPage'
import ShameOffersPage from './pages/ShameOffersPage'
import NSComparisonsPage from './pages/NSComparisonsPage.tsx'
import NuclearStatsPage from './pages/NuclearStatsPage'
import AidEfficiencyPage from './pages/AidEfficiencyPage'
import NationAidEfficiencyPage from './pages/NationAidEfficiencyPage'
import EventsPage from './pages/EventsPage'
import WarStatsPage from './pages/WarStatsPage'

function App() {
  const [selectedAllianceId, setSelectedAllianceId] = useState<number | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const hasInitializedNationAidEfficiency = useRef(false);

  // Sync selectedAllianceId with URL parameters
  useEffect(() => {
    const pathParts = location.pathname.split('/');
    const tabName = pathParts[1];
    const allianceIdParam = pathParts[2];
    
    // Check if we're on an alliance-specific page with an alliance ID in the URL
    if (allianceIdParam && ['aid', 'nations', 'wars'].includes(tabName)) {
      const allianceId = parseInt(allianceIdParam);
      if (!isNaN(allianceId)) {
        setSelectedAllianceId(allianceId);
      }
    } else if (!allianceIdParam && ['aid', 'nations', 'wars'].includes(tabName)) {
      // If we're on an alliance-specific page but no alliance ID in URL, clear selection
      setSelectedAllianceId(null);
    } else if (tabName === 'nation-aid-efficiency' || tabName === 'events' || tabName === 'interalliance-aid') {
      // For nation-aid-efficiency, events, and interalliance-aid, sync from query params
      const searchParams = new URLSearchParams(location.search);
      const allianceIdFromQuery = searchParams.get('allianceId') || searchParams.get('alliance1');
      if (allianceIdFromQuery) {
        const allianceId = parseInt(allianceIdFromQuery);
        if (!isNaN(allianceId)) {
          setSelectedAllianceId(allianceId);
          hasInitializedNationAidEfficiency.current = true;
        }
      } else if (selectedAllianceId && !hasInitializedNationAidEfficiency.current && tabName === 'interalliance-aid') {
        // For interalliance-aid, if no alliance1 in URL but we have one selected, add it to URL
        searchParams.set('alliance1', selectedAllianceId.toString());
        navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
        hasInitializedNationAidEfficiency.current = true;
      } else if (selectedAllianceId && !hasInitializedNationAidEfficiency.current) {
        // For other pages (nation-aid-efficiency, events), use allianceId param
        searchParams.set('allianceId', selectedAllianceId.toString());
        navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
        hasInitializedNationAidEfficiency.current = true;
      }
    } else {
      // Reset flag when navigating away from query-param-based pages
      hasInitializedNationAidEfficiency.current = false;
    }
  }, [location.pathname, location.search, selectedAllianceId, navigate]);

  return (
    <div className="font-sans max-w-full overflow-x-hidden">
      <NavigationBar 
        selectedAllianceId={selectedAllianceId}
        setSelectedAllianceId={setSelectedAllianceId}
      />
      
      <Routes>
        {/* Default redirect to aid */}
        <Route path="/" element={<Navigate to="/aid" replace />} />
        
        {/* Alliance-specific routes */}
        <Route path="/aid/:allianceId" element={<AidPage />} />
        <Route path="/aid" element={<AllianceRedirect tabName="aid" />} />
        
        {/* Interalliance Aid - Top-level aid tool */}
        <Route path="/interalliance-aid" element={<InterallianceAidPage selectedAllianceId={selectedAllianceId} />} />
        
        <Route path="/nations/:allianceId" element={<NationsPage />} />
        <Route path="/nations" element={<AllianceRedirect tabName="nations" />} />
        
        <Route path="/wars/:allianceId" element={<DefendingWarsPage />} />
        <Route path="/wars" element={<AllianceRedirect tabName="wars" />} />
        
        {/* Legacy redirects - redirect old recommendations URLs to aid with tab parameter */}
        <Route path="/recommendations/:allianceId" element={<RecommendationsRedirect />} />
        <Route path="/recommendations" element={<RecommendationsRedirect />} />
        
        {/* Global/Stats pages */}
        <Route path="/global-wars" element={<GlobalWarsPage />} />
        <Route path="/ns-comparisons" element={<NSComparisonsPage />} />
        <Route path="/nuclear-stats" element={<NuclearStatsPage />} />
        <Route path="/aid-efficiency" element={<AidEfficiencyPage />} />
        <Route path="/nation-aid-efficiency" element={<NationAidEfficiencyPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/war-stats" element={<WarStatsPage />} />
        <Route path="/shame-offers" element={<ShameOffersPage />} />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/aid" replace />} />
      </Routes>
    </div>
  )
}

export default App
