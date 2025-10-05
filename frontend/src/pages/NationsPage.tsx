import React from 'react';
import { useParams } from 'react-router-dom';
import NationEditor from '../components/NationEditor';

const NationsPage: React.FC = () => {
  const { allianceId } = useParams<{ allianceId: string }>();

  if (!allianceId) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#666', marginTop: '80px' }}>
        Please select an alliance to use the Nation Editor.
      </div>
    );
  }

  return (
    <div style={{ marginTop: '80px' }}>
      <NationEditor allianceId={parseInt(allianceId)} />
    </div>
  );
};

export default NationsPage;
