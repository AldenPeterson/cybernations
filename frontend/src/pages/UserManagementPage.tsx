import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiCallWithErrorHandling, API_ENDPOINTS } from '../utils/api';
import PageContainer from '../components/PageContainer';
import { useAuth, UserRole } from '../contexts/AuthContext';
import { useAlliances } from '../contexts/AlliancesContext';

interface User {
  id: number;
  email: string;
  rulerName: string | null;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  managedAllianceIds: number[];
}

const UserManagementPage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading, hasCapability } = useAuth();
  const { alliances } = useAlliances();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editedUsers, setEditedUsers] = useState<Map<number, Partial<User>>>(new Map());
  const [saving, setSaving] = useState<number | null>(null);
  const [allianceModalOpen, setAllianceModalOpen] = useState<number | null>(null);
  const [allianceSearchQuery, setAllianceSearchQuery] = useState<string>('');

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !hasCapability('manage_users')) {
      navigate('/aid');
    }
  }, [isAuthenticated, hasCapability, authLoading, navigate]);

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiCallWithErrorHandling(API_ENDPOINTS.users);
        if (response.success) {
          setUsers(response.users);
        } else {
          throw new Error(response.error || 'Failed to load users');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load users';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated && hasCapability('manage_users')) {
      fetchUsers();
    }
  }, [isAuthenticated, hasCapability]);

  const handleEdit = (userId: number) => {
    setEditingUserId(userId);
    const user = users.find((u) => u.id === userId);
    if (user) {
      setEditedUsers(new Map([[userId, { ...user }]]));
    }
  };

  const handleCancel = (userId: number) => {
    setEditingUserId(null);
    const newEdited = new Map(editedUsers);
    newEdited.delete(userId);
    setEditedUsers(newEdited);
  };

  const handleFieldChange = (userId: number, field: keyof User, value: any) => {
    const newEdited = new Map(editedUsers);
    const edited = newEdited.get(userId) || users.find((u) => u.id === userId)!;
    newEdited.set(userId, { ...edited, [field]: value });
    setEditedUsers(newEdited);
  };

  const handleSave = async (userId: number) => {
    const edited = editedUsers.get(userId);
    if (!edited) return;

    try {
      setSaving(userId);
      setError(null);

      const updateData: any = {};
      const originalUser = users.find((u) => u.id === userId)!;

      if (edited.email !== undefined && edited.email !== originalUser.email) {
        updateData.email = edited.email;
      }
      if (edited.rulerName !== undefined && edited.rulerName !== originalUser.rulerName) {
        updateData.rulerName = edited.rulerName || null;
      }
      if (edited.role !== undefined && edited.role !== originalUser.role) {
        updateData.role = edited.role;
      }
      if (
        edited.managedAllianceIds !== undefined &&
        JSON.stringify(edited.managedAllianceIds.sort()) !==
          JSON.stringify(originalUser.managedAllianceIds.sort())
      ) {
        updateData.managedAllianceIds = edited.managedAllianceIds;
      }

      // Only send update if there are changes
      if (Object.keys(updateData).length === 0) {
        handleCancel(userId);
        return;
      }

      const response = await apiCallWithErrorHandling(API_ENDPOINTS.updateUser(userId), {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      if (response.success) {
        // Update the user in the list
        setUsers(users.map((u) => (u.id === userId ? response.user : u)));
        handleCancel(userId);
      } else {
        throw new Error(response.error || 'Failed to update user');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update user';
      setError(msg);
    } finally {
      setSaving(null);
    }
  };

  const toggleAlliance = (userId: number, allianceId: number) => {
    const edited = editedUsers.get(userId) || users.find((u) => u.id === userId)!;
    const currentIds = edited.managedAllianceIds || [];
    const newIds = currentIds.includes(allianceId)
      ? currentIds.filter((id) => id !== allianceId)
      : [...currentIds, allianceId];
    handleFieldChange(userId, 'managedAllianceIds', newIds);
  };

  const handleOpenAllianceModal = (userId: number) => {
    setAllianceModalOpen(userId);
    setAllianceSearchQuery('');
    // Initialize edited user if not already editing
    if (!editedUsers.has(userId)) {
      const user = users.find((u) => u.id === userId);
      if (user) {
        setEditedUsers(new Map([[userId, { ...user }]]));
      }
    }
  };

  const handleCloseAllianceModal = () => {
    setAllianceModalOpen(null);
    setAllianceSearchQuery('');
  };

  const handleSaveAlliances = async (userId: number) => {
    const edited = editedUsers.get(userId);
    if (!edited) return;

    try {
      setSaving(userId);
      setError(null);

      const originalUser = users.find((u) => u.id === userId)!;
      const updateData: any = {};

      // Check if managedAllianceIds changed
      if (
        edited.managedAllianceIds !== undefined &&
        JSON.stringify(edited.managedAllianceIds.sort()) !==
          JSON.stringify(originalUser.managedAllianceIds.sort())
      ) {
        updateData.managedAllianceIds = edited.managedAllianceIds;
      }

      // If no changes, just close modal
      if (Object.keys(updateData).length === 0) {
        handleCloseAllianceModal();
        return;
      }

      const response = await apiCallWithErrorHandling(API_ENDPOINTS.updateUser(userId), {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      if (response.success) {
        // Update the user in the list
        setUsers(users.map((u) => (u.id === userId ? response.user : u)));
        handleCloseAllianceModal();
      } else {
        throw new Error(response.error || 'Failed to update user');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update user';
      setError(msg);
    } finally {
      setSaving(null);
    }
  };

  const handleSelectAllAlliances = (userId: number) => {
    const allAllianceIds = alliances.map((a) => a.id);
    handleFieldChange(userId, 'managedAllianceIds', allAllianceIds);
  };

  const handleDeselectAllAlliances = (userId: number) => {
    handleFieldChange(userId, 'managedAllianceIds', []);
  };

  // Filter alliances based on search query
  const filteredAlliances = alliances.filter((alliance) =>
    alliance.name.toLowerCase().includes(allianceSearchQuery.toLowerCase())
  );

  // Show loading state while auth is being checked
  if (authLoading) {
    return (
      <PageContainer>
        <div className="text-center p-10 text-gray-600 mt-20">
          Loading...
        </div>
      </PageContainer>
    );
  }

  if (!isAuthenticated || !hasCapability('manage_users')) {
    return null;
  }

  return (
    <PageContainer>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-100 mb-6">User Management</h1>
        
        {error && (
          <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading users...</div>
        ) : (
          <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">ID</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Email</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Ruler Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Role</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Managed Alliances</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Created</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {users.map((user) => {
                    const isEditing = editingUserId === user.id;
                    const edited = editedUsers.get(user.id) || user;
                    const isSaving = saving === user.id;

                    return (
                      <tr key={user.id} className="hover:bg-gray-750">
                        <td className="px-4 py-3 text-sm text-gray-300">{user.id}</td>
                        <td className="px-4 py-3 text-sm">
                          {isEditing ? (
                            <input
                              type="email"
                              value={edited.email}
                              onChange={(e) => handleFieldChange(user.id, 'email', e.target.value)}
                              className="w-full px-2 py-1 bg-gray-700 text-gray-200 border border-gray-600 rounded focus:outline-none focus:border-primary"
                            />
                          ) : (
                            <span className="text-gray-300">{user.email}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {isEditing ? (
                            <input
                              type="text"
                              value={edited.rulerName || ''}
                              onChange={(e) =>
                                handleFieldChange(user.id, 'rulerName', e.target.value || null)
                              }
                              placeholder="Ruler name (optional)"
                              className="w-full px-2 py-1 bg-gray-700 text-gray-200 border border-gray-600 rounded focus:outline-none focus:border-primary"
                            />
                          ) : (
                            <span className="text-gray-300">{user.rulerName || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {isEditing ? (
                            <select
                              value={edited.role}
                              onChange={(e) =>
                                handleFieldChange(user.id, 'role', e.target.value as UserRole)
                              }
                              className="w-full px-2 py-1 bg-gray-700 text-gray-200 border border-gray-600 rounded focus:outline-none focus:border-primary"
                            >
                              <option value={UserRole.USER}>USER</option>
                              <option value={UserRole.ALLIANCE_MANAGER}>ALLIANCE_MANAGER</option>
                              <option value={UserRole.WAR_MANAGER}>WAR_MANAGER</option>
                              <option value={UserRole.ADMIN}>ADMIN</option>
                            </select>
                          ) : (
                            <span
                              className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                                user.role === UserRole.ADMIN
                                  ? 'bg-red-900/50 text-red-200'
                                  : user.role === UserRole.ALLIANCE_MANAGER
                                  ? 'bg-blue-900/50 text-blue-200'
                                  : user.role === UserRole.WAR_MANAGER
                                  ? 'bg-orange-900/50 text-orange-200'
                                  : 'bg-gray-700 text-gray-300'
                              }`}
                            >
                              {user.role}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex flex-wrap gap-1 items-center">
                            {user.managedAllianceIds.length > 0 ? (
                              <>
                                {user.managedAllianceIds.slice(0, 2).map((allianceId) => {
                                  const alliance = alliances.find((a) => a.id === allianceId);
                                  return (
                                    <span
                                      key={allianceId}
                                      className="inline-block px-2 py-1 bg-blue-900/50 text-blue-200 rounded text-xs"
                                    >
                                      {alliance?.name || `Alliance ${allianceId}`}
                                    </span>
                                  );
                                })}
                                {user.managedAllianceIds.length > 2 && (
                                  <span className="text-gray-400 text-xs">
                                    +{user.managedAllianceIds.length - 2} more
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-gray-500 text-xs">None</span>
                            )}
                            <button
                              onClick={() => handleOpenAllianceModal(user.id)}
                              className="ml-2 px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
                            >
                              {isEditing ? 'Edit' : 'Manage'}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-400">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {isEditing ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSave(user.id)}
                                disabled={isSaving}
                                className="px-3 py-1 bg-primary text-white rounded hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                              >
                                {isSaving ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={() => handleCancel(user.id)}
                                disabled={isSaving}
                                className="px-3 py-1 bg-gray-600 text-gray-200 rounded hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleEdit(user.id)}
                              className="px-3 py-1 bg-primary text-white rounded hover:bg-primary/80 text-xs"
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Managed Alliances Modal */}
        {allianceModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
              <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-100">
                  Manage Alliances for {users.find((u) => u.id === allianceModalOpen)?.email}
                </h2>
                <button
                  onClick={handleCloseAllianceModal}
                  className="text-gray-400 hover:text-gray-200 transition-colors"
                  disabled={saving === allianceModalOpen}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="px-6 py-4 flex-1 overflow-hidden flex flex-col">
                {/* Search and Actions */}
                <div className="mb-4 space-y-2">
                  <input
                    type="text"
                    placeholder="Search alliances..."
                    value={allianceSearchQuery}
                    onChange={(e) => setAllianceSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 text-gray-200 border border-gray-600 rounded focus:outline-none focus:border-primary"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSelectAllAlliances(allianceModalOpen)}
                      className="px-3 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => handleDeselectAllAlliances(allianceModalOpen)}
                      className="px-3 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
                    >
                      Deselect All
                    </button>
                    <div className="ml-auto text-sm text-gray-400">
                      {editedUsers.get(allianceModalOpen)?.managedAllianceIds?.length || 0} of{' '}
                      {alliances.length} selected
                    </div>
                  </div>
                </div>

                {/* Alliances List */}
                <div className="flex-1 overflow-y-auto border border-gray-600 rounded bg-gray-700 p-2">
                  {filteredAlliances.length > 0 ? (
                    <div className="space-y-1">
                      {filteredAlliances.map((alliance) => {
                        const edited = editedUsers.get(allianceModalOpen) || users.find((u) => u.id === allianceModalOpen)!;
                        const isSelected = edited.managedAllianceIds?.includes(alliance.id) || false;
                        return (
                          <label
                            key={alliance.id}
                            className="flex items-center space-x-3 py-2 px-3 cursor-pointer hover:bg-gray-600 rounded transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleAlliance(allianceModalOpen, alliance.id)}
                              className="rounded border-gray-500 text-primary focus:ring-primary w-4 h-4"
                            />
                            <div className="flex-1">
                              <span className="text-gray-200 font-medium">{alliance.name}</span>
                              <span className="text-gray-400 text-xs ml-2">
                                ({alliance.nationCount} nations)
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      No alliances found matching "{allianceSearchQuery}"
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
                <button
                  onClick={handleCloseAllianceModal}
                  disabled={saving === allianceModalOpen}
                  className="px-4 py-2 bg-gray-600 text-gray-200 rounded hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSaveAlliances(allianceModalOpen)}
                  disabled={saving === allianceModalOpen}
                  className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving === allianceModalOpen ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
};

export default UserManagementPage;

