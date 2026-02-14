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

interface InterallianceAidPageProps {
  selectedAllianceId?: number | null;
}

const InterallianceAidPage: React.FC<InterallianceAidPageProps> = ({ selectedAllianceId }) => {
  const { alliances, loading: alliancesLoading } = useAlliances();
  const [searchParams, setSearchParams] = useSearchParams();
  const [alliance1Id, setAlliance1Id] = useState<number | null>(null);
  const [alliance2Id, setAlliance2Id] = useState<number | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [data, setData] = useState<InterallianceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize alliance IDs and dates from URL parameters or props
  useEffect(() => {
    const alliance1Param = searchParams.get('alliance1');
    const alliance2Param = searchParams.get('alliance2');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    
    if (alliance1Param) {
      const id = parseInt(alliance1Param);
      if (!isNaN(id)) {
        setAlliance1Id(id);
      }
    } else if (selectedAllianceId && !alliance1Id) {
      // Default to selectedAllianceId if no URL param and nothing set yet
      setAlliance1Id(selectedAllianceId);
      // Also update URL to reflect the default
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set('alliance1', selectedAllianceId.toString());
      setSearchParams(newSearchParams, { replace: true });
    }
    
    if (alliance2Param) {
      const id = parseInt(alliance2Param);
      if (!isNaN(id)) {
        setAlliance2Id(id);
      }
    }
    
    if (startDateParam) {
      setStartDate(startDateParam);
    }
    
    if (endDateParam) {
      setEndDate(endDateParam);
    }
  }, [selectedAllianceId, searchParams]); // Add selectedAllianceId to dependencies

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

  const updateStartDate = (date: string) => {
    setStartDate(date);
    const newSearchParams = new URLSearchParams(searchParams);
    if (date) {
      newSearchParams.set('startDate', date);
    } else {
      newSearchParams.delete('startDate');
    }
    setSearchParams(newSearchParams, { replace: true });
  };

  const updateEndDate = (date: string) => {
    setEndDate(date);
    const newSearchParams = new URLSearchParams(searchParams);
    if (date) {
      newSearchParams.set('endDate', date);
    } else {
      newSearchParams.delete('endDate');
    }
    setSearchParams(newSearchParams, { replace: true });
  };

  const clearDates = () => {
    setStartDate('');
    setEndDate('');
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.delete('startDate');
    newSearchParams.delete('endDate');
    setSearchParams(newSearchParams, { replace: true });
  };

  // Fetch data when both alliances are selected
  useEffect(() => {
    if (alliance1Id && alliance2Id && alliance1Id !== alliance2Id) {
      fetchInterallianceData();
    } else {
      setData(null);
    }
  }, [alliance1Id, alliance2Id, startDate, endDate]);

  const fetchInterallianceData = async () => {
    if (!alliance1Id || !alliance2Id) return;

    try {
      setLoading(true);
      setError(null);

      // Convert dates from YYYY-MM-DD (HTML5 format) to MM/DD/YYYY (backend format)
      let formattedStartDate: string | undefined = undefined;
      let formattedEndDate: string | undefined = undefined;
      
      if (startDate) {
        const [year, month, day] = startDate.split('-');
        formattedStartDate = `${month}/${day}/${year}`;
      }
      
      if (endDate) {
        const [year, month, day] = endDate.split('-');
        formattedEndDate = `${month}/${day}/${year}`;
      }

      const result = await apiCallWithErrorHandling(
        API_ENDPOINTS.interallianceAid(alliance1Id, alliance2Id, formattedStartDate, formattedEndDate)
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
    if (statusLower === 'approved') return 'bg-purple-900 text-purple-200';
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

    // Sort offers by date (most recent first)
    const sortedOffers = [...offers].sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB.getTime() - dateA.getTime(); // Descending order (newest first)
    });

    return (
      <>
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse border border-gray-700 text-sm bg-gray-800 table-fixed">
            <thead>
              <tr className="bg-gray-700">
                <th className="p-3 border border-gray-600 text-left text-white font-bold w-[16%]">Sender</th>
                <th className="p-3 border border-gray-600 text-left text-white font-bold w-[16%]">Recipient</th>
                <th className="p-3 border border-gray-600 text-center text-white font-bold w-[10%]">Type</th>
                <th className="p-3 border border-gray-600 text-center text-white font-bold w-[12%]">Aid Amount</th>
                <th className="p-3 border border-gray-600 text-center text-white font-bold w-[10%]">Status</th>
                <th className="p-3 border border-gray-600 text-left text-white font-bold w-[24%]">Reason</th>
                <th className="p-3 border border-gray-600 text-center text-white font-bold w-[12%]">Date</th>
              </tr>
            </thead>
            <tbody>
              {sortedOffers.map((offer) => (
                <tr key={offer.aidId} className="bg-gray-800 hover:bg-gray-700">
                  <td className="p-2 border border-gray-700 text-gray-200 w-[16%] overflow-hidden">
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap">
                      <a
                        href={`https://www.cybernations.net/search_aid.asp?search=${offer.senderId}&Extended=1`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline font-bold"
                        title={offer.senderNation}
                      >
                        {offer.senderNation}
                      </a>
                    </div>
                    <div className="text-gray-400 text-xs overflow-hidden text-ellipsis whitespace-nowrap" title={offer.senderRuler}>
                      {offer.senderRuler}
                    </div>
                  </td>
                  <td className="p-2 border border-gray-700 text-gray-200 w-[16%] overflow-hidden">
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap">
                      <a
                        href={`https://www.cybernations.net/search_aid.asp?search=${offer.recipientId}&Extended=1`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline font-bold"
                        title={offer.recipientNation}
                      >
                        {offer.recipientNation}
                      </a>
                    </div>
                    <div className="text-gray-400 text-xs overflow-hidden text-ellipsis whitespace-nowrap" title={offer.recipientRuler}>
                      {offer.recipientRuler}
                    </div>
                  </td>
                  <td className="p-2 border border-gray-700 text-center w-[10%]">
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
                  <td className="p-2 border border-gray-700 text-center text-gray-200 font-bold w-[12%]">
                    {formatAidValue(offer.money, offer.technology, offer.soldiers)}
                  </td>
                  <td className="p-2 border border-gray-700 text-center w-[10%]">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${getStatusColor(offer.status)}`}>
                      {offer.status}
                    </span>
                  </td>
                  <td className="p-2 border border-gray-700 text-gray-300 text-xs w-[24%]">
                    <div className="line-clamp-2" title={offer.reason || '-'}>
                      {offer.reason || '-'}
                    </div>
                  </td>
                  <td className="p-2 border border-gray-700 text-center text-gray-400 text-xs w-[12%] whitespace-nowrap">
                    {offer.date}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-2">
          {sortedOffers.map((offer) => (
            <div key={offer.aidId} className="bg-gray-700 rounded p-2 border border-gray-600">
              <div className="flex justify-between items-start gap-2 mb-1">
                <div className="flex-1 min-w-0">
                  <a
                    href={`https://www.cybernations.net/search_aid.asp?search=${offer.senderId}&Extended=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline font-bold text-sm truncate block"
                  >
                    {offer.senderNation}
                  </a>
                  <div className="text-xs text-gray-400">→</div>
                  <a
                    href={`https://www.cybernations.net/search_aid.asp?search=${offer.recipientId}&Extended=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline text-sm truncate block"
                  >
                    {offer.recipientNation}
                  </a>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                      offer.type === 'tech'
                        ? 'bg-blue-900 text-blue-200'
                        : 'bg-green-900 text-green-200'
                    }`}
                  >
                    {offer.type === 'tech' ? '🔬' : '💰'}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${getStatusColor(offer.status)}`}>
                    {offer.status}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center text-xs">
                <div className="font-bold text-gray-200">
                  {formatAidValue(offer.money, offer.technology, offer.soldiers)}
                </div>
                <div className="text-gray-500">
                  {offer.date}
                </div>
              </div>

              {offer.reason && (
                <div className="text-xs text-gray-400 mt-1 line-clamp-1">
                  {offer.reason}
                </div>
              )}
            </div>
          ))}
        </div>
      </>
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

      {/* Date Range Selection */}
      <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
        <h3 className="text-lg font-semibold mb-4">Date Filter (Optional)</h3>
        <p className="text-sm text-gray-400 mb-3">
          Filter offers by start date. End date is optional to set an upper bound.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Start Date
              <span className="text-gray-400 text-xs ml-2">(12:00 AM Central Time)</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => updateStartDate(e.target.value)}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              End Date (Optional)
              <span className="text-gray-400 text-xs ml-2">(11:59 PM Central Time)</span>
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => updateEndDate(e.target.value)}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
            />
          </div>
        </div>
        {startDate && (
          <div className="mt-3 text-sm text-gray-400">
            <span className="font-medium">Filter active:</span>{' '}
            {endDate 
              ? `Showing aid offers sent between ${startDate} and ${endDate}`
              : `Showing aid offers sent on or after ${startDate}`
            }
            {' (Central Time)'}
            <button
              onClick={clearDates}
              className="ml-3 text-blue-400 hover:text-blue-300 underline"
            >
              Clear dates
            </button>
          </div>
        )}
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
              {/* Total Offers */}
              <div className="text-center p-4 bg-gray-700 rounded">
                <div className="text-3xl font-bold text-blue-400 mb-2">{data.totalOffers}</div>
                <div className="text-sm text-gray-400 mb-3">Total Aid Offers</div>
                <div className="text-xs text-gray-300 space-y-1">
                  <div className="flex justify-between items-center px-2">
                    <span className="text-gray-400">{data.alliance1.name} →</span>
                    <span className="font-bold">{data.alliance1ToAlliance2.length}</span>
                  </div>
                  <div className="flex justify-between items-center px-2">
                    <span className="text-gray-400">{data.alliance2.name} →</span>
                    <span className="font-bold">{data.alliance2ToAlliance1.length}</span>
                  </div>
                </div>
              </div>

              {/* Cash Offers */}
              <div className="text-center p-4 bg-gray-700 rounded">
                <div className="text-3xl font-bold text-green-400 mb-2">{data.cashOffers}</div>
                <div className="text-sm text-gray-400 mb-3">💰 Cash Offers</div>
                <div className="text-xs text-gray-300 space-y-1">
                  <div className="flex justify-between items-center px-2">
                    <span className="text-gray-400">{data.alliance1.name} →</span>
                    <span className="font-bold">
                      {data.alliance1ToAlliance2.filter(o => o.type === 'cash').length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center px-2">
                    <span className="text-gray-400">{data.alliance2.name} →</span>
                    <span className="font-bold">
                      {data.alliance2ToAlliance1.filter(o => o.type === 'cash').length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tech Offers */}
              <div className="text-center p-4 bg-gray-700 rounded">
                <div className="text-3xl font-bold text-purple-400 mb-2">{data.techOffers}</div>
                <div className="text-sm text-gray-400 mb-3">🔬 Tech Offers</div>
                <div className="text-xs text-gray-300 space-y-1">
                  <div className="flex justify-between items-center px-2">
                    <span className="text-gray-400">{data.alliance1.name} →</span>
                    <span className="font-bold">
                      {data.alliance1ToAlliance2.filter(o => o.type === 'tech').length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center px-2">
                    <span className="text-gray-400">{data.alliance2.name} →</span>
                    <span className="font-bold">
                      {data.alliance2ToAlliance1.filter(o => o.type === 'tech').length}
                    </span>
                  </div>
                </div>
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

          {/* Combined Per-Nation Summary */}
          <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold mb-4">Nations Summary</h3>
            
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse border border-gray-700 text-sm bg-gray-800">
                <thead>
                  <tr className="bg-gray-700">
                    <th className="p-2 border border-gray-600 text-left text-white font-bold">Nation</th>
                    <th className="p-2 border border-gray-600 text-left text-white font-bold">Alliance</th>
                    <th className="p-2 border border-gray-600 text-center text-white font-bold" colSpan={2}>Sent</th>
                    <th className="p-2 border border-gray-600 text-center text-white font-bold" colSpan={2}>Received</th>
                    <th className="p-2 border border-gray-600 text-center text-white font-bold">Total</th>
                  </tr>
                  <tr className="bg-gray-700">
                    <th className="p-2 border border-gray-600"></th>
                    <th className="p-2 border border-gray-600"></th>
                    <th className="p-2 border border-gray-600 text-center text-white text-xs">💰 Cash</th>
                    <th className="p-2 border border-gray-600 text-center text-white text-xs">🔬 Tech</th>
                    <th className="p-2 border border-gray-600 text-center text-white text-xs">💰 Cash</th>
                    <th className="p-2 border border-gray-600 text-center text-white text-xs">🔬 Tech</th>
                    <th className="p-2 border border-gray-600"></th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Aggregate offers by nation across all offers
                    const nationStats = new Map<number, { 
                      nationName: string; 
                      nationId: number; 
                      allianceName: string;
                      cashSent: number; 
                      techSent: number;
                      cashReceived: number;
                      techReceived: number;
                    }>();
                    
                    // Process all offers to build complete statistics
                    const allOffers = [...data.alliance1ToAlliance2, ...data.alliance2ToAlliance1];
                    
                    allOffers.forEach(offer => {
                      // Track sender stats
                      if (!nationStats.has(offer.senderId)) {
                        nationStats.set(offer.senderId, {
                          nationName: offer.senderNation,
                          nationId: offer.senderId,
                          allianceName: offer.senderId === offer.senderId ? 
                            (data.alliance1ToAlliance2.some(o => o.senderId === offer.senderId) ? data.alliance1.name : data.alliance2.name) : '',
                          cashSent: 0,
                          techSent: 0,
                          cashReceived: 0,
                          techReceived: 0
                        });
                      }
                      const senderStats = nationStats.get(offer.senderId)!;
                      if (offer.type === 'cash') {
                        senderStats.cashSent++;
                      } else {
                        senderStats.techSent++;
                      }

                      // Track receiver stats
                      if (!nationStats.has(offer.recipientId)) {
                        nationStats.set(offer.recipientId, {
                          nationName: offer.recipientNation,
                          nationId: offer.recipientId,
                          allianceName: data.alliance1ToAlliance2.some(o => o.recipientId === offer.recipientId) ? data.alliance2.name : data.alliance1.name,
                          cashSent: 0,
                          techSent: 0,
                          cashReceived: 0,
                          techReceived: 0
                        });
                      }
                      const receiverStats = nationStats.get(offer.recipientId)!;
                      if (offer.type === 'cash') {
                        receiverStats.cashReceived++;
                      } else {
                        receiverStats.techReceived++;
                      }
                    });

                    const sortedNations = Array.from(nationStats.values()).sort((a, b) => {
                      // Sort by total offers (sent + received), then by alliance name, then by nation name
                      const totalA = a.cashSent + a.techSent + a.cashReceived + a.techReceived;
                      const totalB = b.cashSent + b.techSent + b.cashReceived + b.techReceived;
                      if (totalB !== totalA) return totalB - totalA;
                      if (a.allianceName !== b.allianceName) return a.allianceName.localeCompare(b.allianceName);
                      return a.nationName.localeCompare(b.nationName);
                    });

                    if (sortedNations.length === 0) {
                      return (
                        <tr>
                          <td colSpan={7} className="p-4 text-center text-gray-400">
                            No offers found
                          </td>
                        </tr>
                      );
                    }

                    return sortedNations.map(nation => {
                      const total = nation.cashSent + nation.techSent + nation.cashReceived + nation.techReceived;
                      return (
                        <tr key={nation.nationId} className="bg-gray-800 hover:bg-gray-700">
                          <td className="p-2 border border-gray-700 text-gray-200">
                            <a
                              href={`https://www.cybernations.net/search_aid.asp?search=${nation.nationId}&Extended=1`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:underline"
                            >
                              {nation.nationName}
                            </a>
                          </td>
                          <td className="p-2 border border-gray-700 text-gray-300 text-xs">
                            {nation.allianceName}
                          </td>
                          <td className="p-2 border border-gray-700 text-center text-green-400 font-bold">
                            {nation.cashSent || '-'}
                          </td>
                          <td className="p-2 border border-gray-700 text-center text-blue-400 font-bold">
                            {nation.techSent || '-'}
                          </td>
                          <td className="p-2 border border-gray-700 text-center text-green-400 font-bold">
                            {nation.cashReceived || '-'}
                          </td>
                          <td className="p-2 border border-gray-700 text-center text-blue-400 font-bold">
                            {nation.techReceived || '-'}
                          </td>
                          <td className="p-2 border border-gray-700 text-center text-gray-200 font-bold">
                            {total}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-2">
              {(() => {
                // Aggregate offers by nation across all offers (same logic as desktop)
                const nationStats = new Map<number, { 
                  nationName: string; 
                  nationId: number; 
                  allianceName: string;
                  cashSent: number; 
                  techSent: number;
                  cashReceived: number;
                  techReceived: number;
                }>();
                
                const allOffers = [...data.alliance1ToAlliance2, ...data.alliance2ToAlliance1];
                
                allOffers.forEach(offer => {
                  if (!nationStats.has(offer.senderId)) {
                    nationStats.set(offer.senderId, {
                      nationName: offer.senderNation,
                      nationId: offer.senderId,
                      allianceName: data.alliance1ToAlliance2.some(o => o.senderId === offer.senderId) ? data.alliance1.name : data.alliance2.name,
                      cashSent: 0,
                      techSent: 0,
                      cashReceived: 0,
                      techReceived: 0
                    });
                  }
                  const senderStats = nationStats.get(offer.senderId)!;
                  if (offer.type === 'cash') {
                    senderStats.cashSent++;
                  } else {
                    senderStats.techSent++;
                  }

                  if (!nationStats.has(offer.recipientId)) {
                    nationStats.set(offer.recipientId, {
                      nationName: offer.recipientNation,
                      nationId: offer.recipientId,
                      allianceName: data.alliance1ToAlliance2.some(o => o.recipientId === offer.recipientId) ? data.alliance2.name : data.alliance1.name,
                      cashSent: 0,
                      techSent: 0,
                      cashReceived: 0,
                      techReceived: 0
                    });
                  }
                  const receiverStats = nationStats.get(offer.recipientId)!;
                  if (offer.type === 'cash') {
                    receiverStats.cashReceived++;
                  } else {
                    receiverStats.techReceived++;
                  }
                });

                const sortedNations = Array.from(nationStats.values()).sort((a, b) => {
                  const totalA = a.cashSent + a.techSent + a.cashReceived + a.techReceived;
                  const totalB = b.cashSent + b.techSent + b.cashReceived + b.techReceived;
                  if (totalB !== totalA) return totalB - totalA;
                  if (a.allianceName !== b.allianceName) return a.allianceName.localeCompare(b.allianceName);
                  return a.nationName.localeCompare(b.nationName);
                });

                if (sortedNations.length === 0) {
                  return (
                    <div className="text-center text-gray-400 py-4">
                      No offers found
                    </div>
                  );
                }

                return sortedNations.map(nation => {
                  const total = nation.cashSent + nation.techSent + nation.cashReceived + nation.techReceived;
                  return (
                    <div key={nation.nationId} className="bg-gray-700 rounded p-2 border border-gray-600">
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex-1 min-w-0">
                          <a
                            href={`https://www.cybernations.net/search_aid.asp?search=${nation.nationId}&Extended=1`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline font-bold text-sm truncate block"
                          >
                            {nation.nationName}
                          </a>
                          <div className="text-xs text-gray-400 truncate">{nation.allianceName}</div>
                        </div>
                        <div className="text-base font-bold text-gray-200 ml-2">
                          {total}
                        </div>
                      </div>
                      
                      <div className="flex gap-2 text-xs">
                        <div className="flex-1 bg-gray-800 rounded px-2 py-1">
                          <div className="text-gray-400">Sent</div>
                          <div className="flex justify-between">
                            <span className="text-green-400">💰 {nation.cashSent || 0}</span>
                            <span className="text-blue-400">🔬 {nation.techSent || 0}</span>
                          </div>
                        </div>
                        <div className="flex-1 bg-gray-800 rounded px-2 py-1">
                          <div className="text-gray-400">Rcvd</div>
                          <div className="flex justify-between">
                            <span className="text-green-400">💰 {nation.cashReceived || 0}</span>
                            <span className="text-blue-400">🔬 {nation.techReceived || 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </>
      )}
    </PageContainer>
  );
};

export default InterallianceAidPage;

