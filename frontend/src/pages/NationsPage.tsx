import React from 'react';
import { useParams } from 'react-router-dom';
import NationEditor from '../components/NationEditor';
import PageContainer from '../components/PageContainer';

const NationsPage: React.FC = () => {
  const { allianceId } = useParams<{ allianceId: string }>();

  if (!allianceId) {
    return (
      <PageContainer className="text-center p-10 text-gray-400">
        Please select an alliance to use the Nation Editor.
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <NationEditor allianceId={parseInt(allianceId)} />
    </PageContainer>
  );
};

export default NationsPage;
