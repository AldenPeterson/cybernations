import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';

interface DropdownItem {
  label: string;
  path: string;
  devOnly?: boolean;
}

interface NavigationDropdownProps {
  label: string;
  items: DropdownItem[];
}

interface MobileDropdownProps extends NavigationDropdownProps {
  onItemClick: () => void;
}

const NavigationDropdown: React.FC<NavigationDropdownProps> = ({ label, items }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Check if any item in the dropdown is active
  const isAnyItemActive = items.some(item => {
    const pathParts = location.pathname.split('/');
    const itemPathParts = item.path.split('/');
    return pathParts[1] === itemPathParts[1];
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Filter out dev-only items in production
  const filteredItems = items.filter(item => 
    !item.devOnly || import.meta.env.DEV
  );

  if (filteredItems.length === 0) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Dropdown Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'no-underline px-4 py-2.5 rounded-lg transition-all duration-200 font-medium text-sm whitespace-nowrap flex items-center gap-1',
          isAnyItemActive
            ? 'bg-primary text-white font-semibold shadow-md'
            : 'text-gray-300 hover:bg-gray-800 hover:text-white'
        )}
      >
        {label}
        <svg
          className={clsx(
            'w-4 h-4 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 min-w-[200px] bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50">
          {filteredItems.map((item, index) => {
            // Exact match → active. Prefix match → active only if no other item is a more specific match
            // (avoids e.g. /admin and /admin/users both being active on /admin/users)
            const isActive = (() => {
              if (location.pathname === item.path) return true;
              if (!location.pathname.startsWith(item.path + '/')) return false;
              const hasMoreSpecificMatch = filteredItems.some(
                (other) =>
                  other.path !== item.path &&
                  (location.pathname === other.path || location.pathname.startsWith(other.path + '/')) &&
                  other.path.startsWith(item.path)
              );
              return !hasMoreSpecificMatch;
            })();

            return (
              <Link
                key={index}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={clsx(
                  'block px-4 py-2.5 text-sm no-underline transition-colors',
                  'first:rounded-t-lg last:rounded-b-lg',
                  isActive
                    ? 'bg-primary text-white font-semibold'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Mobile version with expandable sections
export const MobileNavigationDropdown: React.FC<MobileDropdownProps> = ({ 
  label, 
  items, 
  onItemClick 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const location = useLocation();

  // Check if any item in the dropdown is active
  const isAnyItemActive = items.some(item => {
    const pathParts = location.pathname.split('/');
    const itemPathParts = item.path.split('/');
    return pathParts[1] === itemPathParts[1];
  });

  // Filter out dev-only items in production
  const filteredItems = items.filter(item => 
    !item.devOnly || import.meta.env.DEV
  );

  if (filteredItems.length === 0) {
    return null;
  }

  return (
    <div>
      {/* Section Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={clsx(
          'w-full text-left px-4 py-3 rounded-lg transition-all duration-200 font-medium text-sm flex items-center justify-between',
          isAnyItemActive
            ? 'bg-primary text-white font-semibold shadow-md'
            : 'text-gray-300 hover:bg-gray-800 hover:text-white'
        )}
      >
        {label}
        <svg
          className={clsx(
            'w-4 h-4 transition-transform duration-200',
            isExpanded && 'rotate-180'
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expandable Items */}
      {isExpanded && (
        <div className="ml-4 mt-1 space-y-1">
          {filteredItems.map((item, index) => {
            const isActive = (() => {
              if (location.pathname === item.path) return true;
              if (!location.pathname.startsWith(item.path + '/')) return false;
              const hasMoreSpecificMatch = filteredItems.some(
                (other) =>
                  other.path !== item.path &&
                  (location.pathname === other.path || location.pathname.startsWith(other.path + '/')) &&
                  other.path.startsWith(item.path)
              );
              return !hasMoreSpecificMatch;
            })();

            return (
              <Link
                key={index}
                to={item.path}
                onClick={() => {
                  setIsExpanded(false);
                  onItemClick();
                }}
                className={clsx(
                  'block px-4 py-2 rounded-lg text-sm no-underline transition-colors',
                  isActive
                    ? 'bg-primary/80 text-white font-semibold'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NavigationDropdown;

