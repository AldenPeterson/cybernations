import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { apiCall, API_ENDPOINTS } from '../utils/api';

interface Alliance {
  id: number;
  name: string;
  nationCount: number;
}

interface NavigationBarProps {
  selectedAllianceId: number | null;
  setSelectedAllianceId: (id: number | null) => void;
}

const NavigationBar: React.FC<NavigationBarProps> = ({ 
  selectedAllianceId, 
  setSelectedAllianceId 
}) => {
  const [alliances, setAlliances] = useState<Alliance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    fetchAlliances();
  }, []);

  useEffect(() => {
    if (selectedAllianceId && location.pathname !== '/shame-offers') {
      // Update URL to include alliance ID for alliance-specific pages
      const currentPath = location.pathname;
      const pathParts = currentPath.split('/');
      const tabName = pathParts[1];
      
      if (tabName && ['overview', 'recommendations', 'nations', 'defending-wars'].includes(tabName)) {
        const newPath = `/${tabName}/${selectedAllianceId}`;
        if (currentPath !== newPath) {
          navigate(newPath, { replace: true });
        }
      }
    }
  }, [selectedAllianceId, location.pathname, navigate]);

  const fetchAlliances = async () => {
    try {
      setLoading(true);
      const response = await apiCall(API_ENDPOINTS.alliances);
      const data = await response.json();
      
      if (data.success) {
        setAlliances(data.alliances);
        // Set Doombrella as default if it exists
        const doombrella = data.alliances.find((alliance: any) => 
          alliance.name.toLowerCase().includes('doombrella')
        );
        if (doombrella && !selectedAllianceId) {
          setSelectedAllianceId(doombrella.id);
        }
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch alliances');
    } finally {
      setLoading(false);
    }
  };

  const handleAllianceChange = (allianceId: number | null) => {
    setSelectedAllianceId(allianceId);
    
    // Navigate to the current tab with the new alliance ID
    const currentPath = location.pathname;
    const pathParts = currentPath.split('/');
    const tabName = pathParts[1];
    
    if (allianceId && tabName && ['overview', 'recommendations', 'nations', 'defending-wars'].includes(tabName)) {
      navigate(`/${tabName}/${allianceId}`);
    } else if (allianceId && tabName === 'overview') {
      navigate(`/${tabName}/${allianceId}`);
    }
  };

  const isActiveTab = (tabName: string): boolean => {
    const pathParts = location.pathname.split('/');
    return pathParts[1] === tabName;
  };

  const getTabLink = (tabName: string): string => {
    if (tabName === 'shame-offers') {
      return '/shame-offers';
    }
    
    if (selectedAllianceId) {
      return `/${tabName}/${selectedAllianceId}`;
    }
    
    return `/${tabName}`;
  };

  return (
    <nav style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: '#f8f9fa',
      borderBottom: '1px solid #ddd',
      padding: '10px 20px',
      zIndex: 1000,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* Left side - Navigation Links */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
        <Link 
          to={getTabLink('overview')}
          style={{
            textDecoration: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            backgroundColor: isActiveTab('overview') ? '#007bff' : 'transparent',
            color: isActiveTab('overview') ? 'white' : '#333',
            fontWeight: isActiveTab('overview') ? 'bold' : 'normal',
            transition: 'all 0.2s ease'
          }}
        >
          Overview
        </Link>
        <Link 
          to={getTabLink('recommendations')}
          style={{
            textDecoration: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            backgroundColor: isActiveTab('recommendations') ? '#007bff' : 'transparent',
            color: isActiveTab('recommendations') ? 'white' : '#333',
            fontWeight: isActiveTab('recommendations') ? 'bold' : 'normal',
            transition: 'all 0.2s ease'
          }}
        >
          Aid Recommendations
        </Link>
        <Link 
          to={getTabLink('nations')}
          style={{
            textDecoration: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            backgroundColor: isActiveTab('nations') ? '#007bff' : 'transparent',
            color: isActiveTab('nations') ? 'white' : '#333',
            fontWeight: isActiveTab('nations') ? 'bold' : 'normal',
            transition: 'all 0.2s ease'
          }}
        >
          Nation Editor
        </Link>
        <Link 
          to={getTabLink('defending-wars')}
          style={{
            textDecoration: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            backgroundColor: isActiveTab('defending-wars') ? '#007bff' : 'transparent',
            color: isActiveTab('defending-wars') ? 'white' : '#333',
            fontWeight: isActiveTab('defending-wars') ? 'bold' : 'normal',
            transition: 'all 0.2s ease'
          }}
        >
          Wars
        </Link>
        <Link 
          to={getTabLink('shame-offers')}
          style={{
            textDecoration: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            backgroundColor: isActiveTab('shame-offers') ? '#007bff' : 'transparent',
            color: isActiveTab('shame-offers') ? 'white' : '#333',
            fontWeight: isActiveTab('shame-offers') ? 'bold' : 'normal',
            transition: 'all 0.2s ease'
          }}
        >
          Shame Offers
        </Link>
      </div>

      {/* Right side - Alliance Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <label style={{ fontWeight: 'bold', fontSize: '14px', color: '#333' }}>
          Alliance:
        </label>
        <select
          value={selectedAllianceId || ''}
          onChange={(e) => handleAllianceChange(e.target.value ? parseInt(e.target.value) : null)}
          style={{
            padding: '8px 12px',
            fontSize: '16px',
            borderRadius: '4px',
            border: '1px solid #ccc',
            minWidth: '280px',
            backgroundColor: 'white',
            fontFamily: 'Arial, sans-serif',
            fontWeight: '500',
            color: '#333',
            lineHeight: '1.4'
          }}
          disabled={loading}
        >
          <option value="">Choose an alliance...</option>
          {alliances.map(alliance => (
            <option key={alliance.id} value={alliance.id}>
              {alliance.name} ({alliance.nationCount} nations)
            </option>
          ))}
        </select>
        {loading && (
          <span style={{ fontSize: '12px', color: '#666' }}>Loading...</span>
        )}
        {error && (
          <span style={{ fontSize: '12px', color: '#dc3545' }}>Error loading alliances</span>
        )}
      </div>
    </nav>
  );
};

export default NavigationBar;
