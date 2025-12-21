import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import NavigationBar from './components/NavigationBar'
import AllianceRedirect from './components/AllianceRedirect'
import GlobalWarsPage from './pages/GlobalWarsPage'
import AidPage from './pages/AidPage'
import RecommendationsPage from './pages/RecommendationsPage'
import NationsPage from './pages/NationsPage'
import DefendingWarsPage from './pages/DefendingWarsPage'
import ShameOffersPage from './pages/ShameOffersPage'
import NSComparisonsPage from './pages/NSComparisonsPage.tsx'
import NuclearStatsPage from './pages/NuclearStatsPage'
import AidEfficiencyPage from './pages/AidEfficiencyPage'
import NationAidEfficiencyPage from './pages/NationAidEfficiencyPage'

function App() {
  const [selectedAllianceId, setSelectedAllianceId] = useState<number | null>(null);
  const location = useLocation();

  // Sync selectedAllianceId with URL parameters
  useEffect(() => {
    const pathParts = location.pathname.split('/');
    const tabName = pathParts[1];
    const allianceIdParam = pathParts[2];
    
    // Check if we're on an alliance-specific page with an alliance ID in the URL
    if (allianceIdParam && ['aid', 'recommendations', 'nations', 'wars'].includes(tabName)) {
      const allianceId = parseInt(allianceIdParam);
      if (!isNaN(allianceId)) {
        setSelectedAllianceId(allianceId);
      }
    } else if (!allianceIdParam && ['aid', 'recommendations', 'nations', 'wars'].includes(tabName)) {
      // If we're on an alliance-specific page but no alliance ID in URL, clear selection
      setSelectedAllianceId(null);
    } else if (tabName === 'nation-aid-efficiency') {
      // For nation-aid-efficiency, sync from query params
      const searchParams = new URLSearchParams(location.search);
      const allianceIdFromQuery = searchParams.get('allianceId');
      if (allianceIdFromQuery) {
        const allianceId = parseInt(allianceIdFromQuery);
        if (!isNaN(allianceId)) {
          setSelectedAllianceId(allianceId);
        }
      }
    }
  }, [location.pathname, location.search]);

  return (
    <div className="font-sans max-w-full overflow-x-hidden">
      <NavigationBar 
        selectedAllianceId={selectedAllianceId}
        setSelectedAllianceId={setSelectedAllianceId}
      />
      
      <Routes>
        {/* Default redirect to aid */}
        <Route path="/" element={<Navigate to="/aid" replace />} />
        <Route path="/global-wars" element={<GlobalWarsPage />} />
        {/* Alliance-specific routes */}
        <Route path="/aid/:allianceId" element={<AidPage />} />
        <Route path="/aid" element={<AllianceRedirect tabName="aid" />} />
        
        <Route path="/recommendations/:allianceId" element={<RecommendationsPage />} />
        <Route path="/recommendations" element={<AllianceRedirect tabName="recommendations" />} />
        
        <Route path="/nations/:allianceId" element={<NationsPage />} />
        <Route path="/nations" element={<AllianceRedirect tabName="nations" />} />
        
        <Route path="/wars/:allianceId" element={<DefendingWarsPage />} />
        <Route path="/wars" element={<AllianceRedirect tabName="wars" />} />
        
        
        {/* Non-alliance-specific */}
        <Route path="/ns-comparisons" element={<NSComparisonsPage />} />
        <Route path="/nuclear-stats" element={<NuclearStatsPage />} />
        <Route path="/aid-efficiency" element={<AidEfficiencyPage />} />
        <Route path="/nation-aid-efficiency" element={<NationAidEfficiencyPage />} />
        {/* Shame offers doesn't need alliance ID */}
        <Route path="/shame-offers" element={<ShameOffersPage />} />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/aid" replace />} />
      </Routes>
    </div>
  )
}

export default App
