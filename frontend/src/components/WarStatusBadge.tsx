import React from 'react';
import clsx from 'clsx';

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
  const getVariantClasses = () => {
    switch (variant) {
      case 'compact':
      case 'inline':
        return 'px-0.5 md:px-1 py-px text-[7px] md:text-[9px] rounded-sm';
      default:
        return 'px-1 md:px-1.5 py-px md:py-0.5 text-[8px] md:text-[10px] rounded';
    }
  };

  return (
    <span
      className={clsx(
        'inline-block font-bold',
        inWarMode 
          ? 'bg-red-100 text-red-800 border border-red-300'
          : 'bg-green-100 text-green-800 border border-green-300',
        getVariantClasses(),
        className
      )}
      style={style}
    >
      {inWarMode ? 'War' : 'Peace'}
    </span>
  );
};

export default WarStatusBadge;