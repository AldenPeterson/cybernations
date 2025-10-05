import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import './App.css'
import NavigationBar from './components/NavigationBar'
import OverviewPage from './pages/OverviewPage'
import RecommendationsPage from './pages/RecommendationsPage'
import NationsPage from './pages/NationsPage'
import DefendingWarsPage from './pages/DefendingWarsPage'
import ShameOffersPage from './pages/ShameOffersPage'

function App() {
  const [selectedAllianceId, setSelectedAllianceId] = useState<number | null>(null);
  const location = useLocation();

  // Sync selectedAllianceId with URL parameters
  useEffect(() => {
    const pathParts = location.pathname.split('/');
    const tabName = pathParts[1];
    const allianceIdParam = pathParts[2];
    
    // Check if we're on an alliance-specific page with an alliance ID in the URL
    if (allianceIdParam && ['overview', 'recommendations', 'nations', 'defending-wars'].includes(tabName)) {
      const allianceId = parseInt(allianceIdParam);
      if (!isNaN(allianceId)) {
        setSelectedAllianceId(allianceId);
      }
    } else if (!allianceIdParam && ['overview', 'recommendations', 'nations', 'defending-wars'].includes(tabName)) {
      // If we're on an alliance-specific page but no alliance ID in URL, clear selection
      setSelectedAllianceId(null);
    }
  }, [location.pathname]);

  return (
    <div style={{ fontFamily: 'Arial, sans-serif' }}>
      <NavigationBar 
        selectedAllianceId={selectedAllianceId}
        setSelectedAllianceId={setSelectedAllianceId}
      />
      
      <Routes>
        {/* Default redirect to overview */}
        <Route path="/" element={<Navigate to="/overview" replace />} />
        
        {/* Alliance-specific routes */}
        <Route path="/overview/:allianceId" element={<OverviewPage />} />
        <Route path="/overview" element={<Navigate to="/overview" replace />} />
        
        <Route path="/recommendations/:allianceId" element={<RecommendationsPage />} />
        <Route path="/recommendations" element={<Navigate to="/recommendations" replace />} />
        
        <Route path="/nations/:allianceId" element={<NationsPage />} />
        <Route path="/nations" element={<Navigate to="/nations" replace />} />
        
        <Route path="/defending-wars/:allianceId" element={<DefendingWarsPage />} />
        <Route path="/defending-wars" element={<Navigate to="/defending-wars" replace />} />
        
        {/* Shame offers doesn't need alliance ID */}
        <Route path="/shame-offers" element={<ShameOffersPage />} />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Routes>
    </div>
  )
}

export default App
