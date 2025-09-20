import React, { useState, useEffect } from 'react';

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
      const response = await fetch('/api/small-aid-offers');
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
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading small aid offers...</div>;
  }

  if (error) {
    return <div style={{ padding: '20px', color: 'red' }}>Error: {error}</div>;
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Shame Offers (&lt; 6M &amp; &lt; 100 Tech)</h1>
      <p style={{ marginBottom: '20px', color: '#666' }}>
        Showing all small aid offers across all alliances ({globalSmallAidOffers.length} total)
      </p>
      
      {globalSmallAidOffers.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse', 
              border: '1px solid #ddd',
              fontSize: '14px',
              backgroundColor: 'white'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#343a40' }}>
                <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left', color: 'white', fontWeight: 'bold' }}>Sender</th>
                <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left', color: 'white', fontWeight: 'bold' }}>Sender Alliance</th>
                <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left', color: 'white', fontWeight: 'bold' }}>Recipient</th>
                <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left', color: 'white', fontWeight: 'bold' }}>Recipient Alliance</th>
                <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'center', color: 'white', fontWeight: 'bold' }}>Aid Value</th>
                <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left', color: 'white', fontWeight: 'bold' }}>Reason</th>
                <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'center', color: 'white', fontWeight: 'bold' }}>Date</th>
                </tr>
              </thead>
              <tbody>
              {globalSmallAidOffers?.map((offer) => (
                <tr key={offer.aidId} style={{ backgroundColor: 'white' }}>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    <a 
                      href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${offer.declaringNation?.id || ''}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ 
                              color: '#007bff', 
                        textDecoration: 'none',
                        fontWeight: 'bold'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                          >
                      {offer.declaringNation?.name || 'Unknown'}
                          </a>
                        <br />
                    <small style={{ color: '#666' }}>{offer.declaringNation?.ruler || 'Unknown'}</small>
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #ddd', fontWeight: 'bold', color: '#1976d2' }}>
                    {offer.declaringNation?.alliance || 'Unknown'}
                    </td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    <a 
                      href={`https://www.cybernations.net/nation_drill_display.asp?Nation_ID=${offer.receivingNation?.id || ''}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ 
                        color: '#007bff', 
                        textDecoration: 'none',
                        fontWeight: 'bold'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                              >
                      {offer.receivingNation?.name || 'Unknown'}
                    </a>
                    <br />
                    <small style={{ color: '#666' }}>{offer.receivingNation?.ruler || 'Unknown'}</small>
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #ddd', fontWeight: 'bold', color: '#7b1fa2' }}>
                    {offer.receivingNation?.alliance || 'Unknown'}
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>
                              <span style={{ 
                                color: '#2c5530', 
                                fontWeight: 'bold',
                                backgroundColor: '#e8f5e8',
                      padding: '4px 8px',
                      borderRadius: '4px'
                              }}>
                      {formatAidValue(offer.money, offer.technology, offer.soldiers)}
                              </span>
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #ddd', fontSize: '13px' }}>
                    {offer.reason || 'No reason provided'}
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center', fontSize: '13px' }}>
                    {new Date(offer.date).toLocaleDateString()}
                      </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          {loading ? 'Loading small aid offers...' : 'No small aid offers found.'}
        </div>
      )}
    </div>
  );
};

export default AidDashboard;