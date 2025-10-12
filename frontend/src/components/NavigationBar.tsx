import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { apiCall, API_ENDPOINTS } from '../utils/api';
import clsx from 'clsx';

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    fetchAlliances();
  }, []);

  const fetchAlliances = async () => {
    try {
      setLoading(true);
      const response = await apiCall(API_ENDPOINTS.alliances);
      const data = await response.json();
      
      if (data.success) {
        setAlliances(data.alliances);
        // Set Doombrella as default if it exists and no alliance is already selected
        // Only set default if we're not on an alliance-specific page (to avoid race condition with URL params)
        const pathParts = location.pathname.split('/');
        const tabName = pathParts[1];
        const allianceIdParam = pathParts[2];
        const isOnAllianceSpecificPage = allianceIdParam && ['aid', 'recommendations', 'nations', 'wars'].includes(tabName);
        
        const doombrella = data.alliances.find((alliance: any) => 
          alliance.name.toLowerCase().includes('doombrella')
        );
        if (doombrella && !selectedAllianceId && !isOnAllianceSpecificPage) {
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
    
    if (allianceId && tabName && ['aid', 'recommendations', 'nations', 'wars'].includes(tabName)) {
      navigate(`/${tabName}/${allianceId}`);
    } else if (allianceId && tabName === 'aid') {
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

  const getCurrentTabName = (): string => {
    const pathParts = location.pathname.split('/');
    const tabName = pathParts[1];
    
    switch(tabName) {
      case 'aid':
        return 'Aid';
      case 'ns-comparisons':
        return 'NS Comparisons';
      case 'recommendations':
        return 'Aid Recommendations';
      case 'nations':
        return 'Nation Editor';
      case 'wars':
        return 'Wars';
      case 'shame-offers':
        return 'Shame Offers';
      default:
        return 'CyberNations';
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 bg-gray-900 border-b-2 border-gray-700 z-[1000] font-sans shadow-lg shadow-gray-900/50">
      <div className="px-2 sm:px-4 py-3 flex justify-between items-center gap-2">
        {/* Hamburger Menu Button (Mobile Only) */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden text-gray-300 hover:text-white focus:outline-none p-2 flex-shrink-0"
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>

        {/* Desktop Navigation Links */}
        <div className="hidden lg:flex gap-1 items-center flex-1">
          <Link 
            to={getTabLink('aid')}
            className={clsx(
              'no-underline px-4 py-2.5 rounded-lg transition-all duration-200 font-medium text-sm whitespace-nowrap',
              isActiveTab('aid') 
                ? 'bg-primary text-white font-semibold shadow-md' 
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            )}
          >
            Aid
          </Link>
          <Link 
            to={'/ns-comparisons'}
            className={clsx(
              'no-underline px-4 py-2.5 rounded-lg transition-all duration-200 font-medium text-sm whitespace-nowrap',
              isActiveTab('ns-comparisons') 
                ? 'bg-primary text-white font-semibold shadow-md' 
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            )}
          >
            NS Comparisons
          </Link>
          <Link 
            to={getTabLink('recommendations')}
            className={clsx(
              'no-underline px-4 py-2.5 rounded-lg transition-all duration-200 font-medium text-sm whitespace-nowrap',
              isActiveTab('recommendations') 
                ? 'bg-primary text-white font-semibold shadow-md' 
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            )}
          >
            Aid Recommendations
          </Link>
          {/* Only show Nation Editor in development */}
          {import.meta.env.DEV && (
            <Link 
              to={getTabLink('nations')}
              className={clsx(
                'no-underline px-4 py-2.5 rounded-lg transition-all duration-200 font-medium text-sm whitespace-nowrap',
                isActiveTab('nations') 
                  ? 'bg-primary text-white font-semibold shadow-md' 
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              )}
            >
              Nation Editor
            </Link>
          )}
          <Link 
            to={getTabLink('wars')}
            className={clsx(
              'no-underline px-4 py-2.5 rounded-lg transition-all duration-200 font-medium text-sm whitespace-nowrap',
              isActiveTab('wars') 
                ? 'bg-primary text-white font-semibold shadow-md' 
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            )}
          >
            Wars
          </Link>
          <Link 
            to={getTabLink('shame-offers')}
            className={clsx(
              'no-underline px-4 py-2.5 rounded-lg transition-all duration-200 font-medium text-sm whitespace-nowrap',
              isActiveTab('shame-offers') 
                ? 'bg-primary text-white font-semibold shadow-md' 
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            )}
          >
            Shame Offers
          </Link>
        </div>

        {/* Mobile: Show current tab name - with flex-shrink to allow alliance selector space */}
        <div className="lg:hidden text-white font-semibold text-sm sm:text-base flex-shrink min-w-0 text-center">
          {getCurrentTabName()}
        </div>

        {/* Alliance Selector - flex-shrink-0 ensures it never shrinks */}
        <div className="flex items-center gap-1 sm:gap-2 lg:gap-3 flex-shrink-0">
          <label className="hidden md:block font-semibold text-xs lg:text-sm text-gray-300 whitespace-nowrap">
            Alliance:
          </label>
          <select
            value={selectedAllianceId || ''}
            onChange={(e) => handleAllianceChange(e.target.value ? parseInt(e.target.value) : null)}
            className="px-1.5 sm:px-3 lg:px-4 py-1.5 sm:py-2 lg:py-2.5 text-xs sm:text-sm rounded-lg border-2 border-gray-600 w-[160px] sm:w-[200px] lg:min-w-[280px] bg-gray-800 font-medium text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 hover:border-gray-500"
            disabled={loading}
          >
            <option value="">Choose...</option>
            {alliances.map(alliance => (
              <option key={alliance.id} value={alliance.id}>
                {alliance.name} ({alliance.nationCount})
              </option>
            ))}
          </select>
          {loading && (
            <span className="hidden md:inline text-xs text-gray-400 font-medium">Loading...</span>
          )}
          {error && (
            <span className="hidden md:inline text-xs text-error font-medium">Error</span>
          )}
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-gray-700 bg-gray-900">
          <div className="px-4 py-2 flex flex-col gap-1">
            <Link 
              to={getTabLink('aid')}
              onClick={() => setMobileMenuOpen(false)}
              className={clsx(
                'no-underline px-4 py-3 rounded-lg transition-all duration-200 font-medium text-sm',
                isActiveTab('aid') 
                  ? 'bg-primary text-white font-semibold shadow-md' 
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              )}
            >
              Aid
            </Link>
            <Link 
              to={'/ns-comparisons'}
              onClick={() => setMobileMenuOpen(false)}
              className={clsx(
                'no-underline px-4 py-3 rounded-lg transition-all duration-200 font-medium text-sm',
                isActiveTab('ns-comparisons') 
                  ? 'bg-primary text-white font-semibold shadow-md' 
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              )}
            >
              NS Comparisons
            </Link>
            <Link 
              to={getTabLink('recommendations')}
              onClick={() => setMobileMenuOpen(false)}
              className={clsx(
                'no-underline px-4 py-3 rounded-lg transition-all duration-200 font-medium text-sm',
                isActiveTab('recommendations') 
                  ? 'bg-primary text-white font-semibold shadow-md' 
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              )}
            >
              Aid Recommendations
            </Link>
            {/* Only show Nation Editor in development */}
            {import.meta.env.DEV && (
              <Link 
                to={getTabLink('nations')}
                onClick={() => setMobileMenuOpen(false)}
                className={clsx(
                  'no-underline px-4 py-3 rounded-lg transition-all duration-200 font-medium text-sm',
                  isActiveTab('nations') 
                    ? 'bg-primary text-white font-semibold shadow-md' 
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                )}
              >
                Nation Editor
              </Link>
            )}
            <Link 
              to={getTabLink('wars')}
              onClick={() => setMobileMenuOpen(false)}
              className={clsx(
                'no-underline px-4 py-3 rounded-lg transition-all duration-200 font-medium text-sm',
                isActiveTab('wars') 
                  ? 'bg-primary text-white font-semibold shadow-md' 
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              )}
            >
              Wars
            </Link>
            <Link 
              to={getTabLink('shame-offers')}
              onClick={() => setMobileMenuOpen(false)}
              className={clsx(
                'no-underline px-4 py-3 rounded-lg transition-all duration-200 font-medium text-sm',
                isActiveTab('shame-offers') 
                  ? 'bg-primary text-white font-semibold shadow-md' 
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              )}
            >
              Shame Offers
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default NavigationBar;
