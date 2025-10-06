import React from 'react';

export interface ColorLegendItem {
  color: string;
  label: string;
}

export interface ColorLegendSection {
  title: string;
  items: ColorLegendItem[];
}

export interface ColorLegendProps {
  sections: ColorLegendSection[];
  className?: string;
}

const ColorLegend: React.FC<ColorLegendProps> = ({ sections, className = '' }) => {
  return (
    <div style={{ 
      marginBottom: '20px', 
      padding: '15px',
      backgroundColor: '#000000',
      border: '1px solid #333',
      borderRadius: '8px',
      fontSize: '13px'
    }} className={className}>
      <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold', color: '#ffffff' }}>
        Color Legend
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
        {sections.map((section, sectionIndex) => (
          <div key={sectionIndex}>
            <strong style={{ color: '#ffffff', fontSize: '12px' }}>{section.title}:</strong>
            {section.items.map((item, itemIndex) => (
              <div key={itemIndex} style={{ display: 'flex', alignItems: 'center', margin: '3px 0' }}>
                <div style={{ 
                  width: '18px', 
                  height: '18px', 
                  backgroundColor: item.color, 
                  border: '1px solid #666', 
                  marginRight: '8px' 
                }}></div>
                <span style={{ fontSize: '11px', color: '#ffffff' }}>{item.label}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ColorLegend;
