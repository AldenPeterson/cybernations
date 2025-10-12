import React from 'react';
import clsx from 'clsx';

interface NSPercentageBadgeProps {
  strengthRatio: number;
}

const NSPercentageBadge: React.FC<NSPercentageBadgeProps> = ({ strengthRatio }) => {
  const percentage = Math.round(strengthRatio * 100);
  
  // Determine color classes based on percentage
  const getBadgeClasses = (percentage: number): string => {
    if (percentage < 95) {
      return 'bg-red-600'; // Red - below 95%
    } else if (percentage >= 95 && percentage <= 105) {
      return 'bg-yellow-500'; // Yellow - between 95% and 105%
    } else {
      return 'bg-green-600'; // Green - above 105%
    }
  };

  return (
    <span
      className={clsx(
        'inline-block px-1 py-px rounded-sm text-white text-[8px] font-bold font-mono ml-1 min-w-[24px] text-center',
        getBadgeClasses(percentage)
      )}
    >
      {percentage}%
    </span>
  );
};

export default NSPercentageBadge;
