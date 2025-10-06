import React from 'react';

export interface WarStatusBadgeProps {
  inWarMode: boolean;
  variant?: 'default' | 'compact' | 'inline';
  className?: string;
  style?: React.CSSProperties;
}

const WarStatusBadge: React.FC<WarStatusBadgeProps> = ({ 
  inWarMode, 
  variant = 'default',
  className = '',
  style = {}
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'compact':
        return {
          padding: '1px 4px',
          fontSize: '9px',
          borderRadius: '3px'
        };
      case 'inline':
        return {
          padding: '1px 4px',
          fontSize: '9px',
          borderRadius: '3px'
        };
      default:
        return {
          padding: '2px 6px',
          fontSize: '10px',
          borderRadius: '4px'
        };
    }
  };

  return (
    <span
      className={className}
      style={{
        display: 'inline-block',
        fontWeight: 'bold',
        backgroundColor: inWarMode ? '#d4edda' : '#f8d7da',
        color: inWarMode ? '#155724' : '#721c24',
        border: `1px solid ${inWarMode ? '#c3e6cb' : '#f5c6cb'}`,
        ...getVariantStyles(),
        ...style
      }}
    >
      {inWarMode ? 'War' : 'Peace'}
    </span>
  );
};

export default WarStatusBadge;