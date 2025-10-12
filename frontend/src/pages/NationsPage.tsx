import React from 'react';
import { useParams } from 'react-router-dom';
import NationEditor from '../components/NationEditor';

const NationsPage: React.FC = () => {
  const { allianceId } = useParams<{ allianceId: string }>();

  if (!allianceId) {
    return (
      <div className="text-center p-10 text-gray-600 mt-20">
        Please select an alliance to use the Nation Editor.
      </div>
    );
  }

  return (
    <div className="mt-20">
      <NationEditor allianceId={parseInt(allianceId)} />
    </div>
  );
};

export default NationsPage;
