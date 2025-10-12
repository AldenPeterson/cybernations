import React, { useState, useEffect } from 'react';
import { apiCall, API_ENDPOINTS } from '../utils/api';
import { tableClasses } from '../styles/tableClasses';

interface SmallAidOffer {
  aidId: number;
  declaringNation: {
    id: number;
    name: string;
    ruler: string;
    alliance: string;
    allianceId: number;
  };
  receivingNation: {
    id: number;
    name: string;
    ruler: string;
    alliance: string;
    allianceId: number;
  };
  money: number;
  technology: number;
  soldiers: number;
  reason: string;
  date: string;
}

const AidDashboard: React.FC = () => {
  const [globalSmallAidOffers, setGlobalSmallAidOffers] = useState<SmallAidOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGlobalSmallAidOffers();
  }, []);

  const fetchGlobalSmallAidOffers = async () => {
    try {
      setLoading(true);
      const response = await apiCall(API_ENDPOINTS.smallAidOffers);
      const data = await response.json();
      
      if (data.success) {
        setGlobalSmallAidOffers(data.smallAidOffers || []);
      } else {
        setError(data.error);
        setGlobalSmallAidOffers([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch global small aid offers');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const formatAidValue = (money: number, tech: number, soldiers: number): string => {
    const parts = [];
    if (money > 0) parts.push(`$${formatNumber(money)}`);
    if (tech > 0) parts.push(`${tech}T`);
    if (soldiers > 0) parts.push(`${formatNumber(soldiers)}S`);
    return parts.join(' / ') || 'Empty';
  };

  if (loading) {
    return <div className={tableClasses.loadingContainer}><div className={tableClasses.loadingText}>Loading small aid offers...</div></div>;
  }

  if (error) {
    return <div className="p-5 text-error">Error: {error}</div>;
  }

  return (
    <div className="p-5 font-sans">
      <h1 className="text-3xl font-bold mb-2 text-gray-200">Shame Offers (&lt; 6M &amp; &lt; 100 Tech)</h1>
      <p className="mb-5 text-gray-400">
        Showing all small aid offers across all alliances ({globalSmallAidOffers.length} total)
      </p>
      
      {globalSmallAidOffers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-600 text-sm bg-gray-800">
              <thead>
                <tr className="bg-gray-700">
                <th className="p-3 border border-gray-600 text-left text-white font-bold">Sender</th>
                <th className="p-3 border border-gray-600 text-left text-white font-bold">Sender Alliance</th>
                <th className="p-3 border border-gray-600 text-left text-white font-bold">Recipient</th>
                <th className="p-3 border border-gray-600 text-left text-white font-bold">Recipient Alliance</th>
                <th className="p-3 border border-gray-600 text-center text-white font-bold">Aid Value</th>
                <th className="p-3 border border-gray-600 text-left text-white font-bold">Reason</th>
                <th className="p-3 border border-gray-600 text-center text-white font-bold">Date</th>
                </tr>
              </thead>
              <tbody>
              {globalSmallAidOffers?.map((offer) => (
                <tr key={offer.aidId} className="bg-gray-800 hover:bg-gray-700">
                  <td className="p-2.5 border border-gray-600">
                    <a 
                      href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${offer.declaringNation?.id || ''}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary no-underline font-bold hover:underline"
                    >
                      {offer.declaringNation?.name || 'Unknown'}
                    </a>
                    <br />
                    <small className="text-gray-400">{offer.declaringNation?.ruler || 'Unknown'}</small>
                  </td>
                  <td className="p-2.5 border border-gray-600 font-bold text-blue-400">
                    {offer.declaringNation?.alliance || 'Unknown'}
                  </td>
                  <td className="p-2.5 border border-gray-600">
                    <a 
                      href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${offer.receivingNation?.id || ''}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary no-underline font-bold hover:underline"
                    >
                      {offer.receivingNation?.name || 'Unknown'}
                    </a>
                    <br />
                    <small className="text-gray-400">{offer.receivingNation?.ruler || 'Unknown'}</small>
                  </td>
                  <td className="p-2.5 border border-gray-600 font-bold text-purple-400">
                    {offer.receivingNation?.alliance || 'Unknown'}
                  </td>
                  <td className="p-2.5 border border-gray-600 text-center">
                    <span className="text-green-300 font-bold bg-green-900/30 px-2 py-1 rounded">
                      {formatAidValue(offer.money, offer.technology, offer.soldiers)}
                    </span>
                  </td>
                  <td className="p-2.5 border border-gray-600 text-xs text-gray-200">
                    {offer.reason || 'No reason provided'}
                  </td>
                  <td className="p-2.5 border border-gray-600 text-center text-xs text-gray-200">
                    {new Date(offer.date).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>
      ) : (
        <div className={tableClasses.emptyState}>
          <p className={tableClasses.emptyStateText}>
            {loading ? 'Loading small aid offers...' : 'No small aid offers found.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default AidDashboard;