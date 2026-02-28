import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiCallWithErrorHandling, API_ENDPOINTS } from '../utils/api.js';
import PageContainer from '../components/PageContainer.js';
import { useAuth } from '../contexts/AuthContext.js';
import { UserRole } from '../contexts/AuthContext.js';

interface Capability {
  id: number;
  name: string;
  description: string | null;
}

const ROLES: UserRole[] = [UserRole.ADMIN, UserRole.ALLIANCE_MANAGER, UserRole.WAR_MANAGER, UserRole.USER];

const RoleCapabilitiesPage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading, hasCapability } = useAuth();
  const navigate = useNavigate();
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [roleCapabilityIds, setRoleCapabilityIds] = useState<Record<string, number[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !hasCapability('manage_users')) {
      navigate('/aid');
    }
  }, [isAuthenticated, hasCapability, authLoading, navigate]);

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        setError(null);
        const [capRes, ...roleReses] = await Promise.all([
          apiCallWithErrorHandling(API_ENDPOINTS.adminCapabilities),
          ...ROLES.map((role) => apiCallWithErrorHandling(API_ENDPOINTS.adminRoleCapabilities(role))),
        ]);
        if (!capRes.success || !capRes.capabilities) throw new Error('Failed to load capabilities');
        setCapabilities(capRes.capabilities);
        const byRole: Record<string, number[]> = {};
        roleReses.forEach((res: any, i) => {
          if (res.success && Array.isArray(res.capabilityIds)) {
            byRole[ROLES[i]] = res.capabilityIds;
          } else {
            byRole[ROLES[i]] = [];
          }
        });
        setRoleCapabilityIds(byRole);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    if (isAuthenticated && hasCapability('manage_users')) {
      fetch();
    }
  }, [isAuthenticated, hasCapability]);

  const toggle = (role: string, capabilityId: number) => {
    const current = roleCapabilityIds[role] ?? [];
    const next = current.includes(capabilityId)
      ? current.filter((id) => id !== capabilityId)
      : [...current, capabilityId];
    setRoleCapabilityIds((prev) => ({ ...prev, [role]: next }));
  };

  const saveRole = async (role: string) => {
    try {
      setSaving(role);
      setError(null);
      await apiCallWithErrorHandling(API_ENDPOINTS.adminRoleCapabilities(role), {
        method: 'PUT',
        body: JSON.stringify({ capabilityIds: roleCapabilityIds[role] ?? [] }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(null);
    }
  };

  if (authLoading || !isAuthenticated) return null;
  if (!hasCapability('manage_users')) return null;

  return (
    <PageContainer>
      <h1 className="text-2xl font-bold text-gray-100 mb-2">Role capabilities</h1>
      <p className="text-gray-400 text-sm mb-4">
        Assign capabilities to roles. Backend protects all routes; changing these affects what each role can do.
      </p>
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded text-red-200">{error}</div>
      )}
      {loading ? (
        <div className="text-gray-400">Loading...</div>
      ) : (
        <div className="space-y-6">
          {ROLES.map((role) => (
            <div key={role} className="border border-gray-700 rounded-lg p-4 bg-gray-800/50">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-200">{role}</h2>
                <button
                  type="button"
                  onClick={() => saveRole(role)}
                  disabled={saving === role}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm text-white"
                >
                  {saving === role ? 'Saving...' : 'Save'}
                </button>
              </div>
              <div className="flex flex-wrap gap-4">
                {capabilities.map((cap) => (
                  <label key={cap.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(roleCapabilityIds[role] ?? []).includes(cap.id)}
                      onChange={() => toggle(role, cap.id)}
                      className="rounded border-gray-500"
                    />
                    <span className="text-gray-300">{cap.name}</span>
                    {cap.description && (
                      <span className="text-gray-500 text-sm">({cap.description})</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
};

export default RoleCapabilitiesPage;
