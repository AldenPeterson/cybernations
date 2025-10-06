import React from 'react';
import { useParams } from 'react-router-dom';
import StaggersTable from '../components/StaggersTable';

const StaggersPage: React.FC = () => {
  const { allianceId } = useParams<{ allianceId: string }>();

  return (
    <div style={{ marginTop: '80px' }}>
      <StaggersTable selectedAllianceId={allianceId ? parseInt(allianceId) : null} />
    </div>
  );
};

export default StaggersPage;
