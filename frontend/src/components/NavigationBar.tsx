import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useAlliances } from '../contexts/AlliancesContext';
import { useAuth, UserRole } from '../contexts/AuthContext';
import LoginButton from './LoginButton';
import NavigationDropdown, { MobileNavigationDropdown } from './NavigationDropdown';
import UpdateRulerNameModal from './UpdateRulerNameModal';

interface NavigationBarProps {
  selectedAllianceId: number | null;
  setSelectedAllianceId: (id: number | null) => void;
}

const NavigationBar: React.FC<NavigationBarProps> = ({ 
  selectedAllianceId, 
  setSelectedAllianceId 
}) => {
  const { alliances, loading, error } = useAlliances();
  const { isAuthenticated, user, logout, isLoading: authLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showRulerNameModal, setShowRulerNameModal] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Check if user can manage nations (admin or has manageable alliances)
  const canManageNations = isAuthenticated && user && (
    user.role === UserRole.ADMIN || user.managedAllianceIds.length > 0
  );

  // Define navigation structure
  const aidToolsItems = [
    { label: 'Aid', path: selectedAllianceId ? `/aid/${selectedAllianceId}` : '/aid' },
    { label: 'Interalliance Aid', path: '/interalliance-aid' },
  ];

  const warToolsItems = [
    { label: 'Wars', path: selectedAllianceId ? `/wars/${selectedAllianceId}` : '/wars' },
    { label: 'Warchest Submission', path: '/warchest-submission' },
  ];

  const statsItems = [
    { label: 'Aid Efficiency', path: '/aid-efficiency' },
    { label: 'Casualties', path: '/casualties' },
    { label: 'Damage', path: '/war-stats' },
    { label: 'Global Wars', path: '/global-wars' },
    { label: 'Nation Aid Efficiency', path: '/nation-aid-efficiency' },
    { label: 'Nuclear', path: '/nuclear-stats' },
  ];

  const utilitiesItems = [
    { label: 'NS Comparisons', path: '/ns-comparisons' },
    { label: 'Shame Offers', path: '/shame-offers' },
  ];

  const adminItems = [
    { label: 'User Management', path: '/admin/users' },
    // Only show Alliance Manager if user can manage nations
    ...(canManageNations ? [{ label: 'Alliance Manager', path: selectedAllianceId ? `/nations/${selectedAllianceId}` : '/nations', devOnly: true }] : []),
  ];

  useEffect(() => {
    // Set Doombrella as default if it exists and no alliance is already selected
    // Only set default if we're not on an alliance-specific page (to avoid race condition with URL params)
    if (alliances.length > 0) {
      const pathParts = location.pathname.split('/');
      const tabName = pathParts[1];
      const allianceIdParam = pathParts[2];
      const isOnAllianceSpecificPage = allianceIdParam && ['aid', 'nations', 'wars'].includes(tabName);
      
      const doombrella = alliances.find((alliance: any) => 
        alliance.name.toLowerCase().includes('doombrella')
      );
      if (doombrella && !selectedAllianceId && !isOnAllianceSpecificPage) {
        setSelectedAllianceId(doombrella.id);
      }
    }
  }, [alliances, selectedAllianceId, location.pathname, setSelectedAllianceId]);

  // Update document title
  useEffect(() => {
    const pathParts = location.pathname.split('/');
    const tabName = pathParts[1];
    
    let pageTitle: string;
    switch(tabName) {
      case 'aid':
        pageTitle = 'Aid Tools - Aid';
        break;
      case 'interalliance-aid':
        pageTitle = 'Aid Tools - Interalliance Aid';
        break;
      case 'nations':
        pageTitle = 'Admin - Alliance Manager';
        break;
      case 'wars':
        pageTitle = 'War Tools - Wars';
        break;
      case 'warchest-submission':
        pageTitle = 'War Tools - Warchest Submission';
        break;
      case 'ns-comparisons':
        pageTitle = 'Utilities - NS Comparisons';
        break;
      case 'shame-offers':
        pageTitle = 'Utilities - Shame Offers';
        break;
      case 'global-wars':
        pageTitle = 'Stats - Global Wars';
        break;
      case 'nuclear-stats':
        pageTitle = 'Stats - Nuclear';
        break;
      case 'aid-efficiency':
        pageTitle = 'Stats - Aid Efficiency';
        break;
      case 'nation-aid-efficiency':
        pageTitle = 'Stats - Nation Aid Efficiency';
        break;
      case 'war-stats':
        pageTitle = 'Stats - Damage';
        break;
      case 'casualties':
        pageTitle = 'Stats - Casualties';
        break;
      case 'events':
        pageTitle = 'Events';
        break;
      case 'admin':
        pageTitle = 'Admin - User Management';
        break;
      default:
        pageTitle = 'CyberNations';
    }
    
    if (pageTitle === 'CyberNations') {
      document.title = 'Doomation';
    } else {
      document.title = `${pageTitle} | Doomation`;
    }
  }, [location.pathname]);

  const handleAllianceChange = (allianceId: number | null) => {
    setSelectedAllianceId(allianceId);
    
    // Navigate to the current tab with the new alliance ID
    const currentPath = location.pathname;
    const pathParts = currentPath.split('/');
    const tabName = pathParts[1];
    const searchParams = new URLSearchParams(location.search);
    
    if (allianceId && tabName && ['aid', 'nations', 'wars'].includes(tabName)) {
      navigate(`/${tabName}/${allianceId}`);
    } else if (allianceId && tabName === 'aid') {
      navigate(`/${tabName}/${allianceId}`);
    } else if (tabName === 'nation-aid-efficiency') {
      // For nation-aid-efficiency page, update query parameter
      if (allianceId) {
        searchParams.set('allianceId', allianceId.toString());
      } else {
        searchParams.delete('allianceId');
      }
      navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
    } else if (tabName === 'interalliance-aid') {
      // For interalliance-aid, update alliance1 parameter
      if (allianceId) {
        searchParams.set('alliance1', allianceId.toString());
      } else {
        searchParams.delete('alliance1');
      }
      navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
    } else if (tabName === 'casualties') {
      // For casualties page, update query parameter if on alliance-filtered tab
      const tabParam = searchParams.get('tab');
      if (tabParam === 'alliance-filtered') {
        if (allianceId) {
          searchParams.set('allianceId', allianceId.toString());
        } else {
          searchParams.delete('allianceId');
        }
        navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
      }
    }
  };

  const isActiveTab = (tabName: string): boolean => {
    const pathParts = location.pathname.split('/');
    return pathParts[1] === tabName;
  };

  const getCurrentTabName = (): string => {
    const pathParts = location.pathname.split('/');
    const tabName = pathParts[1];
    
    switch(tabName) {
      case 'aid':
        return 'Aid Tools - Aid';
      case 'interalliance-aid':
        return 'Aid Tools - Interalliance Aid';
      case 'nations':
        return 'Admin - Alliance Manager';
      case 'wars':
        return 'War Tools - Wars';
      case 'warchest-submission':
        return 'War Tools - Warchest Submission';
      case 'ns-comparisons':
        return 'Utilities - NS Comparisons';
      case 'shame-offers':
        return 'Utilities - Shame Offers';
      case 'global-wars':
        return 'Stats - Global Wars';
      case 'nuclear-stats':
        return 'Stats - Nuclear';
      case 'aid-efficiency':
        return 'Stats - Aid Efficiency';
      case 'nation-aid-efficiency':
        return 'Stats - Nation Aid Efficiency';
      case 'war-stats':
        return 'Stats - Damage';
      case 'casualties':
        return 'Stats - Casualties';
      case 'events':
        return 'Events';
      case 'admin':
        return 'Admin - User Management';
      default:
        return 'CyberNations';
    }
  };

  // Check if current page uses alliance selector
  const isAllianceRelevant = (): boolean => {
    const pathParts = location.pathname.split('/');
    const tabName = pathParts[1];
    
    // Check if we're on the casualties page with the alliance-filtered tab
    if (tabName === 'casualties') {
      const searchParams = new URLSearchParams(location.search);
      const tabParam = searchParams.get('tab');
      return tabParam === 'alliance-filtered';
    }
    
    // Only these pages use the alliance selector (events has its own filter, so excluded)
    return ['aid', 'nations', 'wars', 'nation-aid-efficiency', 'interalliance-aid'].includes(tabName);
  };

  // Check if we're on the nations page
  const isOnNationsPage = (): boolean => {
    const pathParts = location.pathname.split('/');
    return pathParts[1] === 'nations';
  };

  // Get filtered alliances based on current page and user permissions
  const getFilteredAlliances = () => {
    // If on nations page, filter to only show manageable alliances
    if (isOnNationsPage() && isAuthenticated && user) {
      const isAdmin = user.role === UserRole.ADMIN;
      if (isAdmin) {
        // Admins can see all alliances
        return alliances;
      } else {
        // Non-admins can only see alliances they manage
        return alliances.filter(alliance => user.managedAllianceIds.includes(alliance.id));
      }
    }
    // For other pages, show all alliances
    return alliances;
  };

  const filteredAlliances = getFilteredAlliances();

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
          <NavigationDropdown label="Aid Tools" items={aidToolsItems} />
          <NavigationDropdown label="War Tools" items={warToolsItems} />
          <NavigationDropdown label="Stats" items={statsItems} />
          <NavigationDropdown label="Utilities" items={utilitiesItems} />
          <Link 
            to="/events"
            className={clsx(
              'no-underline px-4 py-2.5 rounded-lg transition-all duration-200 font-medium text-sm whitespace-nowrap',
              isActiveTab('events') 
                ? 'bg-primary text-white font-semibold shadow-md' 
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            )}
          >
            Events
          </Link>
          {isAuthenticated && user?.role === UserRole.ADMIN && (
            <NavigationDropdown label="Admin" items={adminItems} />
          )}
        </div>

        {/* Mobile: Show current tab name - with flex-shrink to allow alliance selector space */}
        <div className="lg:hidden text-white font-semibold text-sm sm:text-base flex-shrink min-w-0 text-center">
          {getCurrentTabName()}
        </div>

        {/* Alliance Selector and Auth - flex-shrink-0 ensures it never shrinks */}
        <div className="flex items-center gap-1 sm:gap-2 lg:gap-3 flex-shrink-0">
          <label className="hidden md:block font-semibold text-xs lg:text-sm text-gray-300 whitespace-nowrap">
            Alliance:
          </label>
          <select
            value={selectedAllianceId || ''}
            onChange={(e) => handleAllianceChange(e.target.value ? parseInt(e.target.value) : null)}
            className={`px-1.5 sm:px-3 lg:px-4 py-1.5 sm:py-2 lg:py-2.5 text-xs sm:text-sm rounded-lg border-2 w-[160px] sm:w-[200px] lg:min-w-[280px] font-medium focus:outline-none transition-all duration-200 ${
              isAllianceRelevant()
                ? 'border-gray-600 bg-gray-800 text-gray-200 hover:border-gray-500 focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer'
                : 'border-gray-700 bg-gray-900 text-gray-500 cursor-not-allowed opacity-60'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            disabled={loading || !isAllianceRelevant()}
          >
            <option value="">Choose...</option>
            {filteredAlliances.map(alliance => (
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
          
          {/* Auth Section */}
          <div className="flex items-center gap-2 ml-2">
            {authLoading ? (
              // Show nothing or a loading indicator while checking auth state
              <span className="hidden lg:inline text-xs text-gray-500">Loading...</span>
            ) : isAuthenticated ? (
              <>
                <button
                  onClick={() => setShowRulerNameModal(true)}
                  className="hidden lg:inline text-xs text-gray-300 hover:text-white cursor-pointer transition-colors underline decoration-dotted underline-offset-2"
                  title="Click to update your ruler name"
                >
                  {user?.rulerName || user?.email || 'Set Ruler Name'}
                </button>
                <button
                  onClick={logout}
                  className="px-3 py-1.5 text-xs sm:text-sm bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <LoginButton />
            )}
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-gray-700 bg-gray-900">
          <div className="px-4 py-2 flex flex-col gap-1">
            <MobileNavigationDropdown 
              label="Aid Tools" 
              items={aidToolsItems}
              onItemClick={() => setMobileMenuOpen(false)}
            />
            <MobileNavigationDropdown 
              label="War Tools" 
              items={warToolsItems}
              onItemClick={() => setMobileMenuOpen(false)}
            />
            <MobileNavigationDropdown 
              label="Stats" 
              items={statsItems}
              onItemClick={() => setMobileMenuOpen(false)}
            />
            <MobileNavigationDropdown 
              label="Utilities" 
              items={utilitiesItems}
              onItemClick={() => setMobileMenuOpen(false)}
            />
            <Link 
              to="/events"
              onClick={() => setMobileMenuOpen(false)}
              className={clsx(
                'no-underline px-4 py-3 rounded-lg transition-all duration-200 font-medium text-sm',
                isActiveTab('events') 
                  ? 'bg-primary text-white font-semibold shadow-md' 
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              )}
            >
              Events
            </Link>
            {isAuthenticated && user?.role === UserRole.ADMIN && (
              <MobileNavigationDropdown 
                label="Admin" 
                items={adminItems}
                onItemClick={() => setMobileMenuOpen(false)}
              />
            )}
          </div>
        </div>
      )}

      {/* Update Ruler Name Modal */}
      {isAuthenticated && (
        <UpdateRulerNameModal
          isOpen={showRulerNameModal}
          onClose={() => setShowRulerNameModal(false)}
        />
      )}
    </nav>
  );
};

export default NavigationBar;
