import React from 'react';
import { useParams } from 'react-router-dom';
import DefendingWarsTable from '../components/DefendingWarsTable';

const DefendingWarsPage: React.FC = () => {
  const { allianceId } = useParams<{ allianceId: string }>();

  if (!allianceId) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#666', marginTop: '80px' }}>
        Please select an alliance to view defending wars.
      </div>
    );
  }

  return (
    <div style={{ marginTop: '80px', padding: '0 20px', maxWidth: 'none', width: '100%' }}>
      <DefendingWarsTable allianceId={parseInt(allianceId)} />
    </div>
  );
};

export default DefendingWarsPage;
