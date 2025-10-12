import React from 'react';
import { useParams } from 'react-router-dom';
import DefendingWarsTable from '../components/DefendingWarsTable';

const DefendingWarsPage: React.FC = () => {
  const { allianceId } = useParams<{ allianceId: string }>();

  if (!allianceId) {
    return (
      <div className="text-center p-10 text-gray-600 mt-20">
        Please select an alliance to view defending wars.
      </div>
    );
  }

  return (
    <div className="mt-20 px-5 max-w-none w-full">
      <DefendingWarsTable allianceId={parseInt(allianceId)} />
    </div>
  );
};

export default DefendingWarsPage;
