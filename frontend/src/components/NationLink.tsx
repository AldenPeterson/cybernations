import React from 'react';

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
      className={className}
      style={{ 
        color: '#007bff', 
        textDecoration: 'none',
        fontWeight: '600',
        ...style
      }}
      onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
      onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
    >
      {nationName}
      {showId && <span style={{ color: '#666', fontWeight: 'normal', marginLeft: '4px' }}>({nationId})</span>}
    </a>
  );
};

export default NationLink;
