import React from 'react';

interface NSPercentageBadgeProps {
  strengthRatio: number;
}

const NSPercentageBadge: React.FC<NSPercentageBadgeProps> = ({ strengthRatio }) => {
  const percentage = Math.round(strengthRatio * 100);
  
  // Determine color based on percentage
  const getBadgeColor = (percentage: number): string => {
    if (percentage < 95) {
      return '#dc3545'; // Red - below 95%
    } else if (percentage >= 95 && percentage <= 105) {
      return '#ffc107'; // Yellow - between 95% and 105%
    } else {
      return '#28a745'; // Green - above 105%
    }
  };

  const badgeColor = getBadgeColor(percentage);

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 4px',
        borderRadius: '3px',
        backgroundColor: badgeColor,
        color: 'white',
        fontSize: '8px',
        fontWeight: 'bold',
        fontFamily: 'monospace',
        marginLeft: '4px',
        minWidth: '24px',
        textAlign: 'center'
      }}
    >
      {percentage}%
    </span>
  );
};

export default NSPercentageBadge;
