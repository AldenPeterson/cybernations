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
}

interface SlotCountsSummaryProps {
  slotCounts: SlotCounts;
  title?: string;
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
  title = "Total Slot Types" 
}) => {
  // Filter out unassigned if it's not provided or is 0
  const displaySlotTypes = slotTypes.filter(slotType => 
    slotType.key !== 'totalUnassigned' || 
    (slotCounts.totalUnassigned !== undefined && slotCounts.totalUnassigned > 0)
  );

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
                
                // Handle get slots with active aid info
                if (slotType.key === 'totalGetCash') {
                  const active = slotCounts.activeGetCash || 0;
                  return active > 0 ? `${total} [${active} active]` : total;
                }
                if (slotType.key === 'totalGetTech') {
                  const active = slotCounts.activeGetTech || 0;
                  return active > 0 ? `${total} [${active} active]` : total;
                }
                
                return total;
              })()}
            </div>
            <div style={labelStyle}>
              {slotType.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SlotCountsSummary;
