import React from 'react';
import clsx from 'clsx';

export interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  /**
   * If true, uses a light theme container (white/slate background)
   * If false, inherits dark theme from body
   */
  lightTheme?: boolean;
}

/**
 * Standard page container that all pages should use.
 * Provides consistent spacing, theming, and layout.
 * 
 * - Automatically accounts for fixed navigation bar (mt-20 = 80px)
 * - Inherits theme from body (dark) by default
 * - Can use lightTheme prop for pages that need white backgrounds
 */
const PageContainer: React.FC<PageContainerProps> = ({ 
  children, 
  className = '',
  lightTheme = false
}) => {
  return (
    <div 
      className={clsx(
        // Base spacing - accounts for fixed nav bar
        'mt-20',
        // Theme: inherit dark from body by default, or use light theme
        lightTheme 
          ? 'bg-slate-50 min-h-screen' 
          : 'bg-transparent',
        // Base typography inherits from body (text-gray-200 from index.css)
        'font-sans',
        // Allow custom classes
        className
      )}
    >
      {children}
    </div>
  );
};

export default PageContainer;

