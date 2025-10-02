import React from 'react';

interface WarStatusBadgeProps {
  inWarMode: boolean;
  variant?: 'default' | 'compact' | 'inline';
  className?: string;
}

const WarStatusBadge: React.FC<WarStatusBadgeProps> = ({ 
  inWarMode, 
  variant = 'default',
  className = ''
}) => {
  // Only show the badge if the nation is NOT in war mode (i.e., in peace mode)
  if (inWarMode) {
    return null;
  }

  // Base styles
  const baseStyles: React.CSSProperties = {
    fontWeight: 'bold',
    borderRadius: '3px',
    display: 'inline-block',
    backgroundColor: '#e8f5e8',
    color: '#2e7d32',
  };

  // Variant-specific styles
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'compact':
        return {
          fontSize: '9px',
          padding: '1px 4px',
          borderRadius: '2px',
          marginLeft: '4px',
        };
      case 'inline':
        return {
          fontSize: '10px',
          padding: '2px 6px',
          marginTop: '4px',
        };
      case 'default':
      default:
        return {
          fontSize: '10px',
          padding: '2px 6px',
        };
    }
  };

  const displayText = variant === 'compact' ? '🕊️ PEACE' : '🕊️ PEACE MODE';

  return (
    <span 
      style={{
        ...baseStyles,
        ...getVariantStyles(),
      }}
      className={className}
    >
      {displayText}
    </span>
  );
};

export default WarStatusBadge;
