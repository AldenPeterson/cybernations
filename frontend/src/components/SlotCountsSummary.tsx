import React from 'react';

interface SlotCounts {
  totalGetCash: number;
  totalGetTech: number;
  totalSendCash: number;
  totalSendTech: number;
  totalSendCashPeaceMode?: number;
  totalSendTechPeaceMode?: number;
  activeGetCash?: number;
  activeGetTech?: number;
  activeSendCash?: number;
  activeSendTech?: number;
  totalUnassigned?: number;
  // Cross-alliance slot counts
  internalGetCash?: number;
  internalGetTech?: number;
  internalSendCash?: number;
  internalSendTech?: number;
  crossAllianceGetCash?: number;
  crossAllianceGetTech?: number;
}

interface SlotCountsSummaryProps {
  slotCounts: SlotCounts;
  title?: string;
  crossAllianceEnabled?: boolean;
  onCrossAllianceToggle?: (enabled: boolean) => void;
}

interface SlotType {
  key: keyof SlotCounts;
  label: string;
  backgroundColor: string;
  textColor: string;
}

const slotTypes: SlotType[] = [
  {
    key: 'totalGetCash',
    label: 'Get Cash',
    backgroundColor: '#e8f5e8',
    textColor: '#2e7d32'
  },
  {
    key: 'totalGetTech',
    label: 'Get Tech',
    backgroundColor: '#e3f2fd',
    textColor: '#1976d2'
  },
  {
    key: 'totalSendCash',
    label: 'Send Cash',
    backgroundColor: '#fff3cd',
    textColor: '#f57c00'
  },
  {
    key: 'totalSendTech',
    label: 'Send Tech',
    backgroundColor: '#f3e5f5',
    textColor: '#7b1fa2'
  },
  {
    key: 'totalUnassigned',
    label: 'Unassigned',
    backgroundColor: '#f5f5f5',
    textColor: '#666666'
  }
];

const containerClass = 'mb-5 p-4 bg-transparent rounded-lg border border-slate-300';
const gridClass = 'grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2.5';
const cardClass = 'text-center p-2.5 rounded';
const valueClass = 'text-xl font-bold';
const labelClass = 'text-gray-600 text-sm';

const SlotCountsSummary: React.FC<SlotCountsSummaryProps> = ({ 
  slotCounts, 
  title = "Total Slot Types",
  crossAllianceEnabled = true,
  onCrossAllianceToggle
}) => {
  // Filter out unassigned if it's not provided or is 0
  const displaySlotTypes = slotTypes.filter(slotType => 
    slotType.key !== 'totalUnassigned' || 
    (slotCounts.totalUnassigned !== undefined && slotCounts.totalUnassigned > 0)
  );

  // Check if we have cross-alliance data
  const hasCrossAllianceData = (slotCounts.crossAllianceGetCash || 0) > 0 || (slotCounts.crossAllianceGetTech || 0) > 0;

  return (
    <div className={containerClass}>
      <h3>{title}</h3>
      <div className={gridClass}>
        {displaySlotTypes.map((slotType) => (
          <div 
            key={slotType.key}
            className={cardClass}
            style={{ backgroundColor: slotType.backgroundColor }}
          >
            <div 
              className={valueClass}
              style={{ color: slotType.textColor }}
            >
              {(() => {
                const total = slotCounts[slotType.key] || 0;
                
                // Handle send slots with peace mode info
                if (slotType.key === 'totalSendCash' && slotCounts.totalSendCashPeaceMode !== undefined) {
                  const peaceMode = slotCounts.totalSendCashPeaceMode;
                  const active = slotCounts.activeSendCash || 0;
                  let display = total.toString();
                  if (peaceMode > 0) display += ` (${peaceMode} in PM)`;
                  if (active > 0) display += ` [${active} active]`;
                  return display;
                }
                if (slotType.key === 'totalSendTech' && slotCounts.totalSendTechPeaceMode !== undefined) {
                  const peaceMode = slotCounts.totalSendTechPeaceMode;
                  const active = slotCounts.activeSendTech || 0;
                  let display = total.toString();
                  if (peaceMode > 0) display += ` (${peaceMode} in PM)`;
                  if (active > 0) display += ` [${active} active]`;
                  return display;
                }
                
                // Handle get slots with active aid info and cross-alliance breakdown
                if (slotType.key === 'totalGetCash') {
                  const active = slotCounts.activeGetCash || 0;
                  const internal = slotCounts.internalGetCash || 0;
                  const crossAlliance = slotCounts.crossAllianceGetCash || 0;
                  let display = total.toString();
                  if (active > 0) display += ` [${active} active]`;
                  if (hasCrossAllianceData && internal > 0 && crossAlliance > 0) {
                    display += ` (${internal} internal, ${crossAlliance} cross)`;
                  }
                  return display;
                }
                if (slotType.key === 'totalGetTech') {
                  const active = slotCounts.activeGetTech || 0;
                  const internal = slotCounts.internalGetTech || 0;
                  const crossAlliance = slotCounts.crossAllianceGetTech || 0;
                  let display = total.toString();
                  if (active > 0) display += ` [${active} active]`;
                  if (hasCrossAllianceData && internal > 0 && crossAlliance > 0) {
                    display += ` (${internal} internal, ${crossAlliance} cross)`;
                  }
                  return display;
                }
                
                return total;
              })()}
            </div>
            <div className={labelClass}>
              {slotType.label}
              {hasCrossAllianceData && (slotType.key === 'totalGetCash' || slotType.key === 'totalGetTech') && ' 🌐'}
            </div>
          </div>
        ))}
      </div>
      {onCrossAllianceToggle && (
        <div className="mt-2.5 flex items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            id="crossAllianceToggle"
            checked={crossAllianceEnabled}
            onChange={(e) => onCrossAllianceToggle(e.target.checked)}
            className="m-0 cursor-pointer"
          />
          <label 
            htmlFor="crossAllianceToggle"
            className="cursor-pointer italic select-none"
          >
            🌐 Cross-alliance coordination enabled
          </label>
        </div>
      )}
    </div>
  );
};

export default SlotCountsSummary;
