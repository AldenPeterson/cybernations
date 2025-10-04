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

const containerStyle: React.CSSProperties = {
  marginBottom: '20px',
  padding: '15px',
  backgroundColor: 'transparent',
  borderRadius: '8px',
  border: '1px solid #ddd'
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
  gap: '10px'
};

const cardStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '10px',
  borderRadius: '4px'
};

const valueStyle: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 'bold'
};

const labelStyle: React.CSSProperties = {
  color: '#666',
  fontSize: '14px'
};

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
    <div style={containerStyle}>
      <h3>{title}</h3>
      <div style={gridStyle}>
        {displaySlotTypes.map((slotType) => (
          <div 
            key={slotType.key}
            style={{
              ...cardStyle,
              backgroundColor: slotType.backgroundColor
            }}
          >
            <div style={{
              ...valueStyle,
              color: slotType.textColor
            }}>
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
            <div style={labelStyle}>
              {slotType.label}
              {hasCrossAllianceData && (slotType.key === 'totalGetCash' || slotType.key === 'totalGetTech') && ' 🌐'}
            </div>
          </div>
        ))}
      </div>
      {onCrossAllianceToggle && (
        <div style={{ 
          marginTop: '10px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          fontSize: '12px',
          color: '#666'
        }}>
          <input
            type="checkbox"
            id="crossAllianceToggle"
            checked={crossAllianceEnabled}
            onChange={(e) => onCrossAllianceToggle(e.target.checked)}
            style={{
              margin: 0,
              cursor: 'pointer'
            }}
          />
          <label 
            htmlFor="crossAllianceToggle"
            style={{
              cursor: 'pointer',
              fontStyle: 'italic',
              userSelect: 'none'
            }}
          >
            🌐 Cross-alliance coordination enabled
          </label>
        </div>
      )}
    </div>
  );
};

export default SlotCountsSummary;
