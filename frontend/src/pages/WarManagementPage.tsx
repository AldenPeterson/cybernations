import React from 'react';
import { useParams } from 'react-router-dom';
import WarManagementTable from '../components/WarManagementTable';
import PageContainer from '../components/PageContainer';

const WarManagementPage: React.FC = () => {
  const { allianceId } = useParams<{ allianceId: string }>();

  if (!allianceId) {
    return (
      <PageContainer className="text-center p-10 text-gray-400">
        Please select an alliance to view war management.
      </PageContainer>
    );
  }

  return (
    <PageContainer className="max-w-none w-full">
      <WarManagementTable allianceId={parseInt(allianceId)} />
    </PageContainer>
  );
};

export default WarManagementPage;
