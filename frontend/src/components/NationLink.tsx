import React from 'react';
import clsx from 'clsx';

export interface NationLinkProps {
  nationId: number;
  nationName: string;
  className?: string;
  style?: React.CSSProperties;
  showId?: boolean;
}

const NationLink: React.FC<NationLinkProps> = ({ 
  nationId, 
  nationName, 
  className = '',
  style = {},
  showId = false
}) => {
  return (
    <a 
      href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${nationId}`}
      target="_blank"
      rel="noopener noreferrer"
      className={clsx('text-primary no-underline font-semibold hover:underline', className)}
      style={style}
    >
      {nationName}
      {showId && <span className="text-gray-600 font-normal ml-1">({nationId})</span>}
    </a>
  );
};

export default NationLink;

