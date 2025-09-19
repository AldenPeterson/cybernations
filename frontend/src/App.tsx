import { useState, useEffect } from 'react'
import './App.css'
import AidDashboard from './components/AidDashboard'

interface User {
  id: number;
  name: string;
  email: string;
}

function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users'>('dashboard');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users');
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

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
  if (error) return <div>Error: {error}</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>CyberNations - Full Stack App</h1>
      
      {/* Tab Navigation */}
      <div style={{ marginBottom: '20px', borderBottom: '1px solid #ddd' }}>
        <button 
          onClick={() => setActiveTab('dashboard')}
          style={{ 
            padding: '10px 20px', 
            marginRight: '10px',
            backgroundColor: activeTab === 'dashboard' ? '#007bff' : '#f8f9fa',
            color: activeTab === 'dashboard' ? 'white' : '#333',
            border: '1px solid #ddd',
            borderRadius: '4px 4px 0 0',
            cursor: 'pointer'
          }}
        >
          Aid Dashboard
        </button>
        <button 
          onClick={() => setActiveTab('users')}
          style={{ 
            padding: '10px 20px',
            backgroundColor: activeTab === 'users' ? '#007bff' : '#f8f9fa',
            color: activeTab === 'users' ? 'white' : '#333',
            border: '1px solid #ddd',
            borderRadius: '4px 4px 0 0',
            cursor: 'pointer'
          }}
        >
          Users & Tools
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' ? (
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
            <button onClick={fetchUsers} style={{ 
              padding: '10px 20px',
              marginRight: '10px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}>
              Refresh Users
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

          <h2>Users from Backend API:</h2>
          <div style={{ display: 'grid', gap: '10px' }}>
            {users.map(user => (
              <div key={user.id} style={{ 
                border: '1px solid #ddd', 
                padding: '15px', 
                borderRadius: '8px',
                backgroundColor: '#f9f9f9'
              }}>
                <h3>{user.name}</h3>
                <p>Email: {user.email}</p>
                <p>ID: {user.id}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
