import React from 'react';
import { useParams } from 'react-router-dom';
import DefendingWarsTable from '../components/DefendingWarsTable';
import PageContainer from '../components/PageContainer';

const DefendingWarsPage: React.FC = () => {
  const { allianceId } = useParams<{ allianceId: string }>();

  if (!allianceId) {
    return (
      <PageContainer className="text-center p-10 text-gray-400">
        Please select an alliance to view defending wars.
      </PageContainer>
    );
  }

  return (
    <PageContainer className="max-w-none w-full">
      <DefendingWarsTable allianceId={parseInt(allianceId)} />
    </PageContainer>
  );
};

export default DefendingWarsPage;
