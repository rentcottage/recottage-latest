import { useState, useEffect, useCallback } from 'react';

const USER_MGMT_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-user-management`;
const SUPABASE_ANON_KEY = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;

function adminFetchHeaders() {
  return {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    // Server-side admin secret, held in sessionStorage by AdminGate after login.
    'x-admin-password': sessionStorage.getItem('rc_admin_pw') ?? '',
  } as const;
}

interface UserRecord {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  phone_verified: boolean;
  role: string;
  provider: string;
  created_at: string;
  last_sign_in_at: string | null;
  confirmed: boolean;
}

interface BlockedEmail {
  id: string;
  email: string;
  blocked_reason: string | null;
  blocked_at: string;
  source: string;
}

interface DeleteModalState {
  user: UserRecord;
  reason: string;
}

function formatDate(str: string | null) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function formatDateTime(str: string | null) {
  if (!str) return '—';
  return new Date(str).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function UserManagementPanel() {
  const [activeTab, setActiveTab] = useState<'users' | 'blocked'>('users');
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [blockedEmails, setBlockedEmails] = useState<BlockedEmail[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteModal, setDeleteModal] = useState<DeleteModalState | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [blockEmailInput, setBlockEmailInput] = useState('');
  const [blockReasonInput, setBlockReasonInput] = useState('');
  const [blockLoading, setBlockLoading] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(USER_MGMT_URL, {
        method: 'POST',
        headers: adminFetchHeaders(),
        body: JSON.stringify({ action: 'fetch-users' }),
      });
      const data = await res.json();
      if (data.success) setUsers(data.users ?? []);
      else showToast('Failed to load users', 'error');
    } catch {
      showToast('Network error loading users', 'error');
    }
    setLoading(false);
  }, []);

  const fetchBlocked = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(USER_MGMT_URL, {
        method: 'POST',
        headers: adminFetchHeaders(),
        body: JSON.stringify({ action: 'fetch-blocked' }),
      });
      const data = await res.json();
      if (data.success) setBlockedEmails(data.blocked ?? []);
      else showToast('Failed to load blocked emails', 'error');
    } catch {
      showToast('Network error loading blocked emails', 'error');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    else fetchBlocked();
  }, [activeTab, fetchUsers, fetchBlocked]);

  const handleDeleteUser = async () => {
    if (!deleteModal) return;
    setActionLoading(deleteModal.user.id);
    try {
      const res = await fetch(USER_MGMT_URL, {
        method: 'POST',
        headers: adminFetchHeaders(),
        body: JSON.stringify({
          action: 'delete-user',
          userId: deleteModal.user.id,
          email: deleteModal.user.email,
          reason: deleteModal.reason.trim() || 'Deleted by admin',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setUsers((prev) => prev.filter((u) => u.id !== deleteModal.user.id));
        showToast(`User deleted and email blocked successfully.`, 'success');
        setDeleteModal(null);
      } else {
        showToast(data.error ?? 'Failed to delete user', 'error');
      }
    } catch {
      showToast('Network error. Please try again.', 'error');
    }
    setActionLoading(null);
  };

  const handleUnblock = async (email: string) => {
    setActionLoading(email);
    try {
      const res = await fetch(USER_MGMT_URL, {
        method: 'POST',
        headers: adminFetchHeaders(),
        body: JSON.stringify({ action: 'unblock-email', email }),
      });
      const data = await res.json();
      if (data.success) {
        setBlockedEmails((prev) => prev.filter((b) => b.email !== email));
        showToast('Email unblocked successfully.', 'success');
      } else {
        showToast(data.error ?? 'Failed to unblock', 'error');
      }
    } catch {
      showToast('Network error. Please try again.', 'error');
    }
    setActionLoading(null);
  };

  const handleManualBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockEmailInput.trim()) return;
    setBlockLoading(true);
    try {
      const res = await fetch(USER_MGMT_URL, {
        method: 'POST',
        headers: adminFetchHeaders(),
        body: JSON.stringify({
          action: 'block-email',
          email: blockEmailInput.trim(),
          reason: blockReasonInput.trim() || 'Manually blocked by admin',
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`${blockEmailInput.trim()} has been blocked.`, 'success');
        setBlockEmailInput('');
        setBlockReasonInput('');
        fetchBlocked();
      } else {
        showToast(data.error ?? 'Failed to block email', 'error');
      }
    } catch {
      showToast('Network error. Please try again.', 'error');
    }
    setBlockLoading(false);
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      !q ||
      u.email.toLowerCase().includes(q) ||
      u.full_name.toLowerCase().includes(q) ||
      u.phone.toLowerCase().includes(q)
    );
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center">
            <i className="ri-user-settings-line text-gray-600 text-lg"></i>
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">User Management</h2>
            <p className="text-xs text-gray-400 mt-0.5">Delete users and manage blocked emails</p>
          </div>
        </div>
        <button
          onClick={() => activeTab === 'users' ? fetchUsers() : fetchBlocked()}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 cursor-pointer whitespace-nowrap"
        >
          <i className="ri-refresh-line text-sm"></i>
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 pt-4 pb-0">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'users' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <i className="ri-user-line text-xs"></i>
            All Users
            <span className={`text-xs font-semibold ${activeTab === 'users' ? 'text-gray-600' : 'text-gray-400'}`}>
              {users.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('blocked')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'blocked' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <i className="ri-forbid-2-line text-xs"></i>
            Blocked Emails
            <span className={`text-xs font-semibold ${activeTab === 'blocked' ? 'text-red-500' : 'text-gray-400'}`}>
              {blockedEmails.length}
            </span>
          </button>
        </div>
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="p-6">
          {/* Search */}
          <div className="relative mb-5">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <i className="ri-search-line text-gray-400 text-sm"></i>
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email or phone…"
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300"
            />
          </div>

          {!loading && users.length > 0 && (
            <p className="text-xs text-gray-400 mb-3">
              <span className="font-semibold text-green-600">{users.filter((u) => u.phone_verified).length}</span> of {users.length} users have a verified phone
            </p>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <div className="w-5 h-5 flex items-center justify-center animate-spin mr-2">
                <i className="ri-loader-4-line text-xl"></i>
              </div>
              <span className="text-sm">Loading users…</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <div className="w-10 h-10 flex items-center justify-center mb-2">
                <i className="ri-user-search-line text-3xl"></i>
              </div>
              <p className="text-sm">No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['Name', 'Email', 'Phone', 'Role', 'Provider', 'Registered', 'Last Sign In', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">{u.full_name || '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-700">{u.email}</p>
                        {!u.confirmed && (
                          <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                            Unconfirmed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-600">{u.phone || '—'}</p>
                        {u.phone && (
                          <span className={`text-xs px-1.5 py-0.5 rounded mt-0.5 inline-flex items-center gap-1 ${
                            u.phone_verified ? 'text-green-700 bg-green-50' : 'text-amber-600 bg-amber-50'
                          }`}>
                            <i className={u.phone_verified ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'}></i>
                            {u.phone_verified ? 'Verified' : 'Not verified'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          u.role === 'admin' ? 'bg-red-100 text-red-700' :
                          u.role === 'host' ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <i className={`text-sm ${
                            u.provider === 'google' ? 'ri-google-fill text-red-500' :
                            u.provider === 'facebook' ? 'ri-facebook-fill text-blue-600' :
                            'ri-mail-line text-gray-400'
                          }`}></i>
                          <span className="text-xs text-gray-500 capitalize">{u.provider}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-gray-500">{formatDate(u.created_at)}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-gray-500">{formatDate(u.last_sign_in_at)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setDeleteModal({ user: u, reason: '' })}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap transition-colors"
                        >
                          <i className="ri-delete-bin-line text-xs"></i>
                          Delete &amp; Block
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Blocked Emails Tab */}
      {activeTab === 'blocked' && (
        <div className="p-6">
          {/* Manual block form */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 mb-6">
            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
              <i className="ri-forbid-2-line text-red-500"></i>
              Manually Block an Email
            </h3>
            <form onSubmit={handleManualBlock} className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                required
                value={blockEmailInput}
                onChange={(e) => setBlockEmailInput(e.target.value)}
                placeholder="email@example.com"
                className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              <input
                type="text"
                value={blockReasonInput}
                onChange={(e) => setBlockReasonInput(e.target.value)}
                placeholder="Reason (optional)"
                className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              <button
                type="submit"
                disabled={blockLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg cursor-pointer whitespace-nowrap transition-colors"
              >
                {blockLoading ? (
                  <div className="w-4 h-4 flex items-center justify-center animate-spin">
                    <i className="ri-loader-4-line"></i>
                  </div>
                ) : (
                  <i className="ri-forbid-2-line text-sm"></i>
                )}
                Block Email
              </button>
            </form>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <div className="w-5 h-5 flex items-center justify-center animate-spin mr-2">
                <i className="ri-loader-4-line text-xl"></i>
              </div>
              <span className="text-sm">Loading blocked emails…</span>
            </div>
          ) : blockedEmails.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <div className="w-10 h-10 flex items-center justify-center mb-2">
                <i className="ri-shield-check-line text-3xl text-green-400"></i>
              </div>
              <p className="text-sm font-medium text-gray-500">No blocked emails</p>
              <p className="text-xs mt-1">All emails are currently allowed to register.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['Email', 'Reason', 'Source', 'Blocked At', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {blockedEmails.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">{b.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-600 max-w-[220px] truncate" title={b.blocked_reason ?? ''}>
                          {b.blocked_reason || '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          b.source === 'deleted_from_supabase'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {b.source === 'deleted_from_supabase' ? 'User Deleted' : b.source}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-gray-500">{formatDateTime(b.blocked_at)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleUnblock(b.email)}
                          disabled={actionLoading === b.email}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap transition-colors disabled:opacity-50"
                        >
                          {actionLoading === b.email ? (
                            <div className="w-3 h-3 flex items-center justify-center animate-spin">
                              <i className="ri-loader-4-line"></i>
                            </div>
                          ) : (
                            <i className="ri-shield-check-line text-xs"></i>
                          )}
                          Unblock
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center">
                  <i className="ri-delete-bin-line text-red-500 text-lg"></i>
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Delete User &amp; Block Email</h3>
                  <p className="text-xs text-gray-400 mt-0.5">This action cannot be undone</p>
                </div>
              </div>
              <button
                onClick={() => setDeleteModal(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors"
              >
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>

            <div className="px-6 py-5">
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-5">
                <p className="text-sm font-semibold text-red-800 mb-1">{deleteModal.user.full_name || 'User'}</p>
                <p className="text-sm text-red-600">{deleteModal.user.email}</p>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                This will permanently delete the user from Supabase Auth and add their email to the blocked list. They will never be able to register again with this email.
              </p>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
                  Reason for deletion (optional)
                </label>
                <textarea
                  value={deleteModal.reason}
                  onChange={(e) => setDeleteModal((prev) => prev ? { ...prev, reason: e.target.value } : null)}
                  maxLength={300}
                  rows={3}
                  placeholder="e.g. Violated terms of service, fraudulent activity…"
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-red-300 text-gray-800 placeholder-gray-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
              <button
                onClick={() => setDeleteModal(null)}
                disabled={!!actionLoading}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 cursor-pointer whitespace-nowrap transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={!!actionLoading}
                className="flex items-center gap-2 px-5 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl cursor-pointer whitespace-nowrap transition-colors"
              >
                {actionLoading === deleteModal.user.id ? (
                  <div className="w-4 h-4 flex items-center justify-center animate-spin">
                    <i className="ri-loader-4-line"></i>
                  </div>
                ) : (
                  <i className="ri-delete-bin-line text-sm"></i>
                )}
                Delete &amp; Block Email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl text-sm font-medium text-white transition-all ${
            toast.type === 'success' ? 'bg-gray-900' : 'bg-red-500'
          }`}
        >
          <div className="w-4 h-4 flex items-center justify-center">
            <i className={toast.type === 'success' ? 'ri-check-line' : 'ri-error-warning-line'}></i>
          </div>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
