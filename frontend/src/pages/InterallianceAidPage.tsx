import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiCallWithErrorHandling, API_ENDPOINTS } from '../utils/api';
import { useAlliances } from '../contexts/AlliancesContext';
import PageContainer from '../components/PageContainer';

interface Alliance {
  id: number;
  name: string;
  nationCount: number;
}

interface AidOffer {
  senderId: number;
  senderNation: string;
  senderRuler: string;
  recipientId: number;
  recipientNation: string;
  recipientRuler: string;
  aidId: number;
  money: number;
  technology: number;
  soldiers: number;
  reason: string;
  date: string;
  status: string;
  type: 'cash' | 'tech';
}

interface InterallianceData {
  alliance1: { id: number; name: string };
  alliance2: { id: number; name: string };
  totalOffers: number;
  cashOffers: number;
  techOffers: number;
  alliance1ToAlliance2: AidOffer[];
  alliance2ToAlliance1: AidOffer[];
}

const InterallianceAidPage: React.FC = () => {
  const { alliances, loading: alliancesLoading } = useAlliances();
  const [searchParams, setSearchParams] = useSearchParams();
  const [alliance1Id, setAlliance1Id] = useState<number | null>(null);
  const [alliance2Id, setAlliance2Id] = useState<number | null>(null);
  const [data, setData] = useState<InterallianceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize alliance IDs from URL parameters
  useEffect(() => {
    const alliance1Param = searchParams.get('alliance1');
    const alliance2Param = searchParams.get('alliance2');
    
    if (alliance1Param) {
      const id = parseInt(alliance1Param);
      if (!isNaN(id)) {
        setAlliance1Id(id);
      }
    }
    
    if (alliance2Param) {
      const id = parseInt(alliance2Param);
      if (!isNaN(id)) {
        setAlliance2Id(id);
      }
    }
  }, []); // Only run on mount

  // Update URL when alliance selections change
  const updateAlliance1Id = (id: number | null) => {
    setAlliance1Id(id);
    const newSearchParams = new URLSearchParams(searchParams);
    if (id) {
      newSearchParams.set('alliance1', id.toString());
    } else {
      newSearchParams.delete('alliance1');
    }
    setSearchParams(newSearchParams, { replace: true });
  };

  const updateAlliance2Id = (id: number | null) => {
    setAlliance2Id(id);
    const newSearchParams = new URLSearchParams(searchParams);
    if (id) {
      newSearchParams.set('alliance2', id.toString());
    } else {
      newSearchParams.delete('alliance2');
    }
    setSearchParams(newSearchParams, { replace: true });
  };

  // Fetch data when both alliances are selected
  useEffect(() => {
    if (alliance1Id && alliance2Id && alliance1Id !== alliance2Id) {
      fetchInterallianceData();
    } else {
      setData(null);
    }
  }, [alliance1Id, alliance2Id]);

  const fetchInterallianceData = async () => {
    if (!alliance1Id || !alliance2Id) return;

    try {
      setLoading(true);
      setError(null);

      const result = await apiCallWithErrorHandling(
        API_ENDPOINTS.interallianceAid(alliance1Id, alliance2Id)
      );

      if (result.success) {
        setData({
          alliance1: result.alliance1,
          alliance2: result.alliance2,
          totalOffers: result.totalOffers,
          cashOffers: result.cashOffers,
          techOffers: result.techOffers,
          alliance1ToAlliance2: result.alliance1ToAlliance2,
          alliance2ToAlliance1: result.alliance2ToAlliance1
        });
      } else {
        setError(result.error || 'Failed to fetch interalliance data');
      }
    } catch (err) {
      console.error('Error fetching interalliance data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch interalliance data');
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

  const getStatusColor = (status: string): string => {
    const statusLower = status.toLowerCase();
    if (statusLower === 'pending') return 'bg-yellow-900 text-yellow-200';
    if (statusLower === 'accepted') return 'bg-green-900 text-green-200';
    if (statusLower === 'active') return 'bg-blue-900 text-blue-200';
    if (statusLower === 'cancelled') return 'bg-red-900 text-red-200';
    if (statusLower === 'expired') return 'bg-gray-700 text-gray-300';
    return 'bg-gray-800 text-gray-300';
  };

  const renderOffersList = (offers: AidOffer[], direction: 'sent' | 'received') => {
    if (offers.length === 0) {
      return (
        <div className="text-center text-gray-400 py-8">
          No {direction === 'sent' ? 'outgoing' : 'incoming'} aid offers
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-700 text-sm bg-gray-800">
          <thead>
            <tr className="bg-gray-700">
              <th className="p-3 border border-gray-600 text-left text-white font-bold">Sender</th>
              <th className="p-3 border border-gray-600 text-left text-white font-bold">Recipient</th>
              <th className="p-3 border border-gray-600 text-center text-white font-bold">Type</th>
              <th className="p-3 border border-gray-600 text-center text-white font-bold">Aid Amount</th>
              <th className="p-3 border border-gray-600 text-center text-white font-bold">Status</th>
              <th className="p-3 border border-gray-600 text-left text-white font-bold">Reason</th>
              <th className="p-3 border border-gray-600 text-center text-white font-bold">Date</th>
            </tr>
          </thead>
          <tbody>
            {offers.map((offer) => (
              <tr key={offer.aidId} className="bg-gray-800 hover:bg-gray-700">
                <td className="p-2 border border-gray-700 text-gray-200">
                  <a
                    href={`https://www.cybernations.net/search_aid.asp?search=${offer.senderId}&Extended=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline font-bold"
                  >
                    {offer.senderNation}
                  </a>
                  <br />
                  <span className="text-gray-400 text-xs">{offer.senderRuler}</span>
                </td>
                <td className="p-2 border border-gray-700 text-gray-200">
                  <a
                    href={`https://www.cybernations.net/search_aid.asp?search=${offer.recipientId}&Extended=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline font-bold"
                  >
                    {offer.recipientNation}
                  </a>
                  <br />
                  <span className="text-gray-400 text-xs">{offer.recipientRuler}</span>
                </td>
                <td className="p-2 border border-gray-700 text-center">
                  <span
                    className={`px-2 py-1 rounded text-xs font-bold ${
                      offer.type === 'tech'
                        ? 'bg-blue-900 text-blue-200'
                        : 'bg-green-900 text-green-200'
                    }`}
                  >
                    {offer.type === 'tech' ? '🔬 Tech' : '💰 Cash'}
                  </span>
                </td>
                <td className="p-2 border border-gray-700 text-center text-gray-200 font-bold">
                  {formatAidValue(offer.money, offer.technology, offer.soldiers)}
                </td>
                <td className="p-2 border border-gray-700 text-center">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${getStatusColor(offer.status)}`}>
                    {offer.status}
                  </span>
                </td>
                <td className="p-2 border border-gray-700 text-gray-300 text-xs">
                  {offer.reason || '-'}
                </td>
                <td className="p-2 border border-gray-700 text-center text-gray-400 text-xs">
                  {offer.date}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  if (alliancesLoading) {
    return (
      <PageContainer className="p-5 text-center">
        Loading alliances...
      </PageContainer>
    );
  }

  return (
    <PageContainer className="p-5">
      <h1 className="text-2xl font-bold mb-6">Interalliance Aid</h1>

      {/* Alliance Selection */}
      <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
        <h3 className="text-lg font-semibold mb-4">Select Two Alliances</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Alliance 1</label>
            <select
              value={alliance1Id || ''}
              onChange={(e) => updateAlliance1Id(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
            >
              <option value="">Select an alliance...</option>
              {alliances
                .filter((a: Alliance) => a.id !== alliance2Id)
                .map((alliance: Alliance) => (
                  <option key={alliance.id} value={alliance.id}>
                    {alliance.name} ({alliance.nationCount} nations)
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Alliance 2</label>
            <select
              value={alliance2Id || ''}
              onChange={(e) => updateAlliance2Id(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
            >
              <option value="">Select an alliance...</option>
              {alliances
                .filter((a: Alliance) => a.id !== alliance1Id)
                .map((alliance: Alliance) => (
                  <option key={alliance.id} value={alliance.id}>
                    {alliance.name} ({alliance.nationCount} nations)
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center p-10 text-gray-400">
          Loading interalliance data...
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="text-center p-10 text-red-400">
          Error: {error}
        </div>
      )}

      {/* No Selection State */}
      {!alliance1Id || !alliance2Id ? (
        <div className="text-center p-10 text-gray-400">
          Please select two different alliances to view interalliance aid data.
        </div>
      ) : null}

      {/* Same Alliance Warning */}
      {alliance1Id && alliance2Id && alliance1Id === alliance2Id && (
        <div className="text-center p-10 text-yellow-400">
          Please select two different alliances.
        </div>
      )}

      {/* Data Display */}
      {data && !loading && !error && (
        <>
          {/* Summary Statistics */}
          <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold mb-4">Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-700 rounded">
                <div className="text-3xl font-bold text-blue-400">{data.totalOffers}</div>
                <div className="text-sm text-gray-400 mt-1">Total Aid Offers</div>
              </div>
              <div className="text-center p-4 bg-gray-700 rounded">
                <div className="text-3xl font-bold text-green-400">{data.cashOffers}</div>
                <div className="text-sm text-gray-400 mt-1">💰 Cash Offers</div>
              </div>
              <div className="text-center p-4 bg-gray-700 rounded">
                <div className="text-3xl font-bold text-purple-400">{data.techOffers}</div>
                <div className="text-sm text-gray-400 mt-1">🔬 Tech Offers</div>
              </div>
            </div>
          </div>

          {/* Alliance 1 to Alliance 2 */}
          <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold mb-4">
              {data.alliance1.name} → {data.alliance2.name}
              <span className="ml-3 text-sm font-normal text-gray-400">
                ({data.alliance1ToAlliance2.length} offers)
              </span>
            </h3>
            {renderOffersList(data.alliance1ToAlliance2, 'sent')}
          </div>

          {/* Alliance 2 to Alliance 1 */}
          <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold mb-4">
              {data.alliance2.name} → {data.alliance1.name}
              <span className="ml-3 text-sm font-normal text-gray-400">
                ({data.alliance2ToAlliance1.length} offers)
              </span>
            </h3>
            {renderOffersList(data.alliance2ToAlliance1, 'received')}
          </div>
        </>
      )}
    </PageContainer>
  );
};

export default InterallianceAidPage;

