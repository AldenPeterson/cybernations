import React from 'react';
import clsx from 'clsx';

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
    <div className={clsx('mb-5 p-4 bg-black border border-gray-700 rounded-lg text-xs', className)}>
      <h4 className="m-0 mb-3 text-sm font-bold text-white">
        Color Legend
      </h4>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5">
        {sections.map((section, sectionIndex) => (
          <div key={sectionIndex}>
            <strong className="text-white text-xs">{section.title}:</strong>
            {section.items.map((item, itemIndex) => (
              <div key={itemIndex} className="flex items-center my-0.5">
                <div 
                  className="w-[18px] h-[18px] border border-gray-600 mr-2"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-[11px] text-white">{item.label}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ColorLegend;

