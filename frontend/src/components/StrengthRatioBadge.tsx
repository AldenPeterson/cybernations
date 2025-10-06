import React from 'react';

export interface StrengthRatioBadgeProps {
  ratio: number;
  className?: string;
  style?: React.CSSProperties;
}

const StrengthRatioBadge: React.FC<StrengthRatioBadgeProps> = ({ 
  ratio, 
  className = '',
  style = {}
}) => {
  const percentage = (ratio * 100).toFixed(1);
  
  // Determine color based on ratio
  const getColor = (ratio: number) => {
    if (ratio >= 0.95 && ratio <= 1.05) return '#059669'; // Green for close to 1:1
    if (ratio >= 0.85 && ratio <= 1.15) return '#d97706'; // Orange for close to range
    return '#dc2626'; // Red for far from optimal
  };

  const getBackgroundColor = (ratio: number) => {
    if (ratio >= 0.95 && ratio <= 1.05) return '#d1fae5'; // Light green
    if (ratio >= 0.85 && ratio <= 1.15) return '#fed7aa'; // Light orange
    return '#fecaca'; // Light red
  };

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 8px',
        borderRadius: '6px',
        backgroundColor: getBackgroundColor(ratio),
        color: getColor(ratio),
        fontSize: '12px',
        fontWeight: '600',
        border: `1px solid ${getColor(ratio)}20`,
        ...style
      }}
    >
      {percentage}%
    </div>
  );
};

export default StrengthRatioBadge;
