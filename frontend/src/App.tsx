import { useState } from 'react'
import './App.css'
import AidDashboard from './components/AidDashboard'
import AllianceDashboard from './components/AllianceDashboard'

function App() {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'by-alliance' | 'shame-offers' | 'admin-tools'>('by-alliance');

  const checkHealth = async () => {
    try {
      const response = await fetch('/health');
      const data = await response.json();
      alert(`Backend Status: ${data.status}`);
    } catch (err) {
      alert('Backend is not responding');
    }
  };

  const decodeStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/stats/decode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`Decode successful! ${data.message}`);
        console.log('Decode results:', data.results);
      } else {
        alert(`Decode failed: ${data.error}`);
      }
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>CyberNations Aid Management Dashboard</h1>
      
      {/* Tab Navigation */}
      <div style={{ marginBottom: '20px', borderBottom: '1px solid #ddd' }}>
        <button 
          onClick={() => setActiveTab('by-alliance')}
          style={{ 
            padding: '10px 20px', 
            marginRight: '10px',
            backgroundColor: activeTab === 'by-alliance' ? '#007bff' : '#f8f9fa',
            color: activeTab === 'by-alliance' ? 'white' : '#333',
            border: '1px solid #ddd',
            borderRadius: '4px 4px 0 0',
            cursor: 'pointer'
          }}
        >
          By Alliance
        </button>
        <button 
          onClick={() => setActiveTab('shame-offers')}
          style={{ 
            padding: '10px 20px', 
            marginRight: '10px',
            backgroundColor: activeTab === 'shame-offers' ? '#007bff' : '#f8f9fa',
            color: activeTab === 'shame-offers' ? 'white' : '#333',
            border: '1px solid #ddd',
            borderRadius: '4px 4px 0 0',
            cursor: 'pointer'
          }}
        >
          Shame Offers
        </button>
        <button 
          onClick={() => setActiveTab('admin-tools')}
          style={{ 
            padding: '10px 20px',
            backgroundColor: activeTab === 'admin-tools' ? '#007bff' : '#f8f9fa',
            color: activeTab === 'admin-tools' ? 'white' : '#333',
            border: '1px solid #ddd',
            borderRadius: '4px 4px 0 0',
            cursor: 'pointer'
          }}
        >
          Admin Tools
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'by-alliance' ? (
        <AllianceDashboard />
      ) : activeTab === 'shame-offers' ? (
        <AidDashboard />
      ) : (
        <div>
          <div style={{ marginBottom: '20px' }}>
            <button onClick={checkHealth} style={{ 
              padding: '10px 20px', 
              marginRight: '10px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}>
              Check Backend Health
            </button>
            <button onClick={decodeStats} style={{ 
              padding: '10px 20px',
              backgroundColor: '#ff6b35',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}>
              Decode Stats (Extract Zips)
            </button>
          </div>

          <h2>Admin Tools</h2>
          <p>Use the tools above to manage the backend and extract data files.</p>
        </div>
      )}
    </div>
  )
}

export default App
