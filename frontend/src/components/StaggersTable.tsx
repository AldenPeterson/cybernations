import React, { useState, useEffect, useCallback } from 'react';
import { apiCall, API_ENDPOINTS } from '../utils/api';
import TableContainer from './TableContainer';
import TableHeader from './TableHeader';
import FilterControls from './FilterControls';
import FilterCheckbox from './FilterCheckbox';
import FilterSelect from './FilterSelect';
import ReusableTable, { type TableColumn } from './ReusableTable';
import NationLink from './NationLink';
import StrengthRatioBadge from './StrengthRatioBadge';

interface Alliance {
  id: number;
  name: string;
  nationCount: number;
}

interface StaggerEligibility {
  defendingNation: {
    id: number;
    name: string;
    ruler: string;
    alliance: string;
    allianceId: number;
    strength: number;
    technology: string;
    activity: string;
    inWarMode: boolean;
    governmentType: string;
    openWarSlots: number;
    currentWars: number;
  };
  eligibleAttackers: {
    id: number;
    name: string;
    ruler: string;
    alliance: string;
    allianceId: number;
    strength: number;
    technology: string;
    activity: string;
    inWarMode: boolean;
    governmentType: string;
    currentWars: number;
    strengthRatio: number;
  }[];
}

interface StaggersTableProps {
  selectedAllianceId: number | null;
}

const StaggersTable: React.FC<StaggersTableProps> = ({ selectedAllianceId }) => {
  const [alliances, setAlliances] = useState<Alliance[]>([]);
  const [targetDefendingAllianceId, setTargetDefendingAllianceId] = useState<number | null>(null);
  const [staggerData, setStaggerData] = useState<StaggerEligibility[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [hideAnarchy, setHideAnarchy] = useState(true);
  const [hidePeaceMode, setHidePeaceMode] = useState(true);
  const [hideNonPriority, setHideNonPriority] = useState(false);


  const fetchAlliances = async () => {
    try {
      setLoading(true);
      const response = await apiCall(API_ENDPOINTS.alliances);
      const data = await response.json();
      
      if (data.success) {
        setAlliances(data.alliances);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch alliances');
    } finally {
      setLoading(false);
    }
  };

  const fetchStaggerData = useCallback(async () => {
    if (!selectedAllianceId || !targetDefendingAllianceId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const url = `${API_ENDPOINTS.staggerEligibility}/${selectedAllianceId}/${targetDefendingAllianceId}?hideAnarchy=${hideAnarchy}&hidePeaceMode=${hidePeaceMode}&hideNonPriority=${hideNonPriority}`;
      
      const response = await apiCall(url);
      const data = await response.json();
      
      if (data.success) {
        setStaggerData(data.staggerData);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stagger data');
    } finally {
      setLoading(false);
    }
  }, [selectedAllianceId, targetDefendingAllianceId, hideAnarchy, hidePeaceMode, hideNonPriority]);

  useEffect(() => {
    fetchAlliances();
  }, []);

  useEffect(() => {
    if (selectedAllianceId && targetDefendingAllianceId) {
      fetchStaggerData();
    }
  }, [selectedAllianceId, targetDefendingAllianceId, fetchStaggerData]);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const formatTechnology = (techStr: string): string => {
    const tech = parseFloat(techStr.replace(/,/g, '')) || 0;
    if (tech >= 1000000) {
      return (tech / 1000000).toFixed(1) + 'M';
    } else if (tech >= 1000) {
      return (tech / 1000).toFixed(1) + 'K';
    }
    return tech.toString();
  };

  const getActivityColor = (activity: string): string => {
    const activityLower = activity.toLowerCase();
    if (activityLower.includes('active in the last 3 days')) {
      return '#d4edda';
    } else if (activityLower.includes('active this week')) {
      return '#fff3cd';
    } else if (activityLower.includes('active last week') || activityLower.includes('active three weeks ago')) {
      return '#ffeaa7';
    } else if (activityLower.includes('active more than three weeks ago')) {
      return '#f8d7da';
    }
    return '#f8f9fa';
  };

  // Keep the data structured by defending nation for stagger planning
  const tableData = staggerData;

  const columns: TableColumn<typeof tableData[0]>[] = [
    {
      key: 'defendingNation',
      header: 'Defending Nation',
      width: '250px',
      render: (_, row) => (
        <div style={{ 
          padding: '12px',
          backgroundColor: getActivityColor(row.defendingNation.activity),
          borderRadius: '6px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ fontWeight: '600', marginBottom: '6px' }}>
            <NationLink 
              nationId={row.defendingNation.id} 
              nationName={row.defendingNation.name}
              style={{ fontSize: '15px' }}
            />
          </div>
          <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
            {row.defendingNation.ruler}
          </div>
          <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
            <strong>{formatNumber(row.defendingNation.strength)} NS</strong> • <strong>{formatTechnology(row.defendingNation.technology)} Tech</strong>
          </div>
          <div style={{ fontSize: '12px', color: '#9ca3af' }}>
            <span style={{ 
              backgroundColor: row.defendingNation.openWarSlots > 0 ? '#d1fae5' : '#fef3c7',
              color: row.defendingNation.openWarSlots > 0 ? '#065f46' : '#92400e',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: '600'
            }}>
              {row.defendingNation.openWarSlots} open slots
            </span>
            <span style={{ marginLeft: '8px', color: '#6b7280' }}>
              {row.defendingNation.currentWars} current wars
            </span>
          </div>
        </div>
      )
    },
    {
      key: 'eligibleAttackers',
      header: `Eligible Attackers (${tableData.reduce((sum, row) => sum + row.eligibleAttackers.length, 0)})`,
      render: (_, row) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '500px' }}>
          {row.eligibleAttackers.length === 0 ? (
            <div style={{ 
              padding: '20px', 
              textAlign: 'center', 
              color: '#6b7280', 
              fontStyle: 'italic',
              backgroundColor: '#f9fafb',
              borderRadius: '6px',
              border: '1px dashed #d1d5db'
            }}>
              No eligible attackers found
            </div>
          ) : (
            row.eligibleAttackers.map((attacker) => (
              <div key={attacker.id} style={{ 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                backgroundColor: getActivityColor(attacker.activity),
                borderRadius: '6px',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', marginBottom: '2px' }}>
                    <NationLink 
                      nationId={attacker.id} 
                      nationName={attacker.name}
                      style={{ fontSize: '14px' }}
                    />
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    {attacker.ruler} • {formatNumber(attacker.strength)} NS • {formatTechnology(attacker.technology)} Tech
                  </div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                    {attacker.governmentType} • {attacker.currentWars} wars
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ 
                    padding: '2px 6px',
                    backgroundColor: attacker.inWarMode ? '#d1fae5' : '#fef3c7',
                    color: attacker.inWarMode ? '#065f46' : '#92400e',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: '600'
                  }}>
                    {attacker.inWarMode ? 'War' : 'Peace'}
                  </div>
                  <StrengthRatioBadge ratio={attacker.strengthRatio} />
                </div>
              </div>
            ))
          )}
        </div>
      )
    }
  ];

  const selectedAlliance = alliances.find(a => a.id === selectedAllianceId);

  if (!selectedAllianceId) {
    return (
      <TableContainer>
        <TableHeader title="Staggers" subtitle="Please select an alliance from the dropdown above to view stagger eligibility." />
      </TableContainer>
    );
  }


  // Show loading state if we're still fetching alliances
  if (loading && alliances.length === 0) {
    return (
      <TableContainer>
        <TableHeader title="Staggers" subtitle="Loading alliances..." />
      </TableContainer>
    );
  }

  return (
    <TableContainer>
      <TableHeader 
        title="Staggers" 
        subtitle={`Showing stagger eligibility between ${selectedAlliance?.name} and defending alliance`}
      >
        <FilterControls>
          <FilterSelect
            label="Target Defending Alliance"
            value={targetDefendingAllianceId}
            options={alliances.filter(alliance => alliance.id !== selectedAllianceId).map(alliance => ({
              label: `${alliance.name} (${alliance.nationCount} nations)`,
              value: alliance.id
            }))}
            onChange={(value) => setTargetDefendingAllianceId(typeof value === 'number' ? value : null)}
            placeholder="Choose defending alliance..."
            minWidth="320px"
          />
        </FilterControls>

        {targetDefendingAllianceId && (
          <FilterControls>
            <FilterCheckbox
              label="Hide nations in anarchy"
              checked={hideAnarchy}
              onChange={setHideAnarchy}
            />
            <FilterCheckbox
              label="Hide nations in peace mode"
              checked={hidePeaceMode}
              onChange={setHidePeaceMode}
            />
            <FilterCheckbox
              label="Hide non-priority defending nations"
              checked={hideNonPriority}
              onChange={setHideNonPriority}
            />
          </FilterControls>
        )}
      </TableHeader>

      {targetDefendingAllianceId && (
        <ReusableTable
          data={tableData}
          columns={columns}
          loading={loading}
          error={error}
          emptyMessage="No eligible stagger targets found with current filters."
          rowKey={(row) => `defending-${row.defendingNation.id}`}
        />
      )}

      {!targetDefendingAllianceId && selectedAllianceId && (
        <div style={{ 
          backgroundColor: '#eff6ff', 
          color: '#1e40af', 
          padding: '20px', 
          borderRadius: '8px',
          marginTop: '20px',
          border: '1px solid #dbeafe'
        }}>
          <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#1e40af' }}>How to use Staggers:</h4>
          <ol style={{ fontSize: '14px', lineHeight: '1.6', paddingLeft: '20px', margin: 0 }}>
            <li style={{ marginBottom: '6px' }}>Select a target defending alliance from the dropdown above</li>
            <li style={{ marginBottom: '6px' }}>The system will show all war mode nations in that alliance with open defensive war slots</li>
            <li style={{ marginBottom: '6px' }}>For each defending nation, it will show all nations from your selected alliance that can declare war</li>
            <li style={{ marginBottom: '6px' }}>Eligible attackers must have strength within 75%-133% of the defending nation's strength</li>
            <li style={{ marginBottom: '6px' }}>Use the checkboxes to filter out nations in anarchy or peace mode</li>
            <li style={{ marginBottom: '0' }}>Current war counts and war slots are displayed to help plan staggering</li>
          </ol>
        </div>
      )}
    </TableContainer>
  );
};

export default StaggersTable;
