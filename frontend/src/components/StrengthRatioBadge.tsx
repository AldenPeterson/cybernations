import React from 'react';
import clsx from 'clsx';

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
  
  // Determine color classes based on ratio
  const getColorClasses = (ratio: number) => {
    if (ratio >= 0.95 && ratio <= 1.05) {
      return 'bg-emerald-100 text-emerald-600 border-emerald-600/20'; // Green for close to 1:1
    }
    if (ratio >= 0.85 && ratio <= 1.15) {
      return 'bg-orange-100 text-orange-600 border-orange-600/20'; // Orange for close to range
    }
    return 'bg-red-100 text-red-600 border-red-600/20'; // Red for far from optimal
  };

  return (
    <div
      className={clsx(
        'inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold border',
        getColorClasses(ratio),
        className
      )}
      style={style}
    >
      {percentage}%
    </div>
  );
};

export default StrengthRatioBadge;

