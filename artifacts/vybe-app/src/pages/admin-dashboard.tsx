import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  useGetAdminOverview,
  useListAdminUsers,
  useGetAdminUser,
  useUpdateAdminUser,
  useDeleteAdminUser,
  useListAdminBattles,
  useUpdateAdminBattle,
  useListAdminReports,
  useUpdateAdminReport,
  useListAdminAudit,
  useGetAdminAnalytics,
  useListAdminNotifications,
  useGetAdminSettings,
  useUpdateAdminSettings,
  useGetAdminMonetization,
  getListAdminUsersQueryKey,
  getGetAdminUserQueryKey,
  getListAdminReportsQueryKey,
  getListAdminBattlesQueryKey,
  getListAdminAuditQueryKey,
  getGetAdminSettingsQueryKey,
  getGetAdminMonetizationQueryKey,
  getListAdminNotificationsQueryKey,
  AdminRangeParameter,
  AdminUserUpdateAction,
  AdminUserUpdateRole,
  AdminReportUpdateStatus,
  AdminReportPriority,
  AdminSettings,
  AdminSettingsUpdate
} from "@workspace/api-client-react";
import {
  LayoutDashboard, Users, ShieldAlert, Swords, BarChart3,
  CircleDollarSign, Bell, Activity as ActivityIcon, Settings,
  Search, ChevronLeft, ChevronRight, X, AlertTriangle, 
  Loader2, ArrowUpRight, LogOut
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, 
  CartesianGrid, BarChart, Bar
} from "recharts";
import "../admin.css";

// -----------------------------------------------------------------------------
// Custom Modal Component
// -----------------------------------------------------------------------------
interface AdminActionModalProps {
  isOpen: boolean;
  title: string;
  consequences: string;
  reasonLabel?: string;
  requireReason?: boolean;
  requireConfirmText?: string;
  isDestructive?: boolean;
  isPending: boolean;
  onClose: () => void;
  onConfirm: (reason: string, confirmText: string) => void;
}

function AdminActionModal({
  isOpen, 
  title, 
  consequences, 
  reasonLabel = "Reason", 
  requireReason = false, 
  requireConfirmText, 
  isDestructive, 
  isPending, 
  onClose, 
  onConfirm
}: AdminActionModalProps) {
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setReason("");
      setConfirmText("");
      setError("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (requireReason && reason.trim().length < 3) {
      setError("Please provide a valid reason (at least 3 characters).");
      return;
    }
    if (requireConfirmText && confirmText !== requireConfirmText) {
      setError(`Please type ${requireConfirmText} to confirm.`);
      return;
    }
    onConfirm(reason.trim(), confirmText);
  };

  return (
    <div className="admin-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title" data-testid="admin-action-modal">
      <div className="admin-modal">
        <div className="admin-modal-header">
          <h2 id="modal-title">{title}</h2>
          <button className="admin-exit-btn" onClick={onClose} disabled={isPending} data-testid="btn-modal-close">
            <X size={16} />
          </button>
        </div>
        <div className="admin-modal-body">
          <div className={`admin-modal-consequences ${isDestructive ? 'danger' : ''}`}>
            <strong>Consequences:</strong> {consequences}
          </div>
          
          {(requireReason || reasonLabel === "Resolution Note (optional)") && (
            <div className="admin-modal-field">
              <label htmlFor="modal-reason">{reasonLabel} {requireReason ? '*' : ''}</label>
              <textarea 
                id="modal-reason" 
                value={reason} 
                onChange={e => { setReason(e.target.value); setError(""); }} 
                disabled={isPending}
                data-testid="input-modal-reason"
              />
            </div>
          )}
          
          {requireConfirmText && (
            <div className="admin-modal-field">
              <label htmlFor="modal-confirm">Type <strong>{requireConfirmText}</strong> to confirm *</label>
              <input 
                id="modal-confirm" 
                type="text" 
                value={confirmText} 
                onChange={e => { setConfirmText(e.target.value); setError(""); }} 
                disabled={isPending}
                data-testid="input-modal-confirm"
                placeholder={requireConfirmText}
              />
            </div>
          )}

          {error && (
            <div className="admin-modal-error" data-testid="text-modal-error">
              <AlertTriangle size={14} /> {error}
            </div>
          )}
        </div>
        <div className="admin-modal-footer">
          <button className="admin-btn-outline" onClick={onClose} disabled={isPending} data-testid="btn-modal-cancel">
            Cancel
          </button>
          <button className={`admin-btn-solid ${isDestructive ? 'danger' : ''}`} onClick={handleConfirm} disabled={isPending} data-testid="btn-modal-confirm">
            {isPending ? <Loader2 className="spin" size={16} /> : "Confirm Action"}
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Tabs
// -----------------------------------------------------------------------------

type Tab = "Overview" | "Users" | "Moderation" | "Battles" | "Analytics" | "Monetization" | "Notifications" | "Audit" | "Settings";

export function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Overview");

  const renderContent = () => {
    switch(activeTab) {
      case "Overview": return <AdminOverviewTab />;
      case "Users": return <AdminUsersTab />;
      case "Moderation": return <AdminModerationTab />;
      case "Battles": return <AdminBattlesTab />;
      case "Analytics": return <AdminAnalyticsTab />;
      case "Monetization": return <AdminMonetizationTab />;
      case "Notifications": return <AdminNotificationsTab />;
      case "Audit": return <AdminAuditTab />;
      case "Settings": return <AdminSettingsTab />;
      default: return null;
    }
  };

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-mark"><span /></div>
          <span>VYBE ADMIN</span>
        </div>
        <nav className="admin-nav">
          <NavItem icon={LayoutDashboard} label="Overview" isActive={activeTab === "Overview"} onClick={() => setActiveTab("Overview")} />
          <NavItem icon={Users} label="Users" isActive={activeTab === "Users"} onClick={() => setActiveTab("Users")} />
          <NavItem icon={ShieldAlert} label="Moderation" isActive={activeTab === "Moderation"} onClick={() => setActiveTab("Moderation")} />
          <NavItem icon={Swords} label="Battles" isActive={activeTab === "Battles"} onClick={() => setActiveTab("Battles")} />
          <NavItem icon={BarChart3} label="Analytics" isActive={activeTab === "Analytics"} onClick={() => setActiveTab("Analytics")} />
          <NavItem icon={CircleDollarSign} label="Monetization" isActive={activeTab === "Monetization"} onClick={() => setActiveTab("Monetization")} />
          <NavItem icon={Bell} label="Notifications" isActive={activeTab === "Notifications"} onClick={() => setActiveTab("Notifications")} />
          <NavItem icon={ActivityIcon} label="Audit" isActive={activeTab === "Audit"} onClick={() => setActiveTab("Audit")} />
          <NavItem icon={Settings} label="Settings" isActive={activeTab === "Settings"} onClick={() => setActiveTab("Settings")} />
        </nav>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <h1 data-testid={`admin-title-${activeTab.toLowerCase()}`}>{activeTab}</h1>
          <Link href="/" className="admin-exit-btn" data-testid="btn-exit-admin">
            <LogOut size={16} />
          </Link>
        </header>
        <div className="admin-content-scroll">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon: Icon, label, isActive, onClick }: any) {
  return (
    <button 
      className={`admin-nav-item ${isActive ? "active" : ""}`} 
      onClick={onClick}
      data-testid={`admin-nav-${label.toLowerCase()}`}
    >
      <Icon />
      <span>{label}</span>
    </button>
  );
}

function AdminLoading() {
  return (
    <div className="admin-state-box">
      <Loader2 className="spin" size={24} color="var(--violet)" />
      <span>Loading data...</span>
    </div>
  );
}

function AdminError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="admin-state-box error">
      <AlertTriangle size={24} color="#d94632" />
      <span>Failed to load data.</span>
      <button className="admin-btn-outline" onClick={onRetry} data-testid="btn-retry-error">Try Again</button>
    </div>
  );
}

function AdminPagination({ page, totalPages, onPageChange }: any) {
  return (
    <div className="admin-pagination">
      <button disabled={page <= 1} onClick={() => onPageChange(page - 1)} data-testid="btn-page-prev">
        <ChevronLeft size={14} /> Prev
      </button>
      <span>Page {page} of {totalPages}</span>
      <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} data-testid="btn-page-next">
        Next <ChevronRight size={14} />
      </button>
    </div>
  );
}

function KpiCard({ label, value, alert }: any) {
  return (
    <div className={`admin-kpi-card ${alert ? 'alert' : ''}`} data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AdminOverviewTab() {
  const [range, setRange] = useState<AdminRangeParameter>("7d");
  const { data, isLoading, isError, refetch } = useGetAdminOverview({ range }, { query: { queryKey: ["admin-overview", range] } });

  if (isLoading) return <AdminLoading />;
  if (isError || !data) return <AdminError onRetry={() => refetch()} />;

  const { kpis, trend, topBattles, topUsers, dataAvailability } = data;

  return (
    <div className="admin-overview">
      <div className="admin-toolbar justify-end mb-4">
        <select value={range} onChange={(e) => setRange(e.target.value as AdminRangeParameter)} data-testid="select-overview-range">
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="90d">Last 90 Days</option>
          <option value="all">All Time</option>
        </select>
      </div>

      <div className="admin-kpi-grid">
        <KpiCard label="Total Users" value={kpis.totalUsers.toLocaleString()} />
        <KpiCard label="Active Users" value={kpis.activeUsers.toLocaleString()} />
        <KpiCard label="New Registrations" value={kpis.newRegistrations.toLocaleString()} />
        <KpiCard label="Online Users" value={dataAvailability.onlineUsers && kpis.onlineUsers != null ? kpis.onlineUsers.toLocaleString() : <span className="admin-null">N/A</span>} />
        <KpiCard label="Total Battles" value={kpis.totalBattles.toLocaleString()} />
        <KpiCard label="Active Battles" value={kpis.activeBattles.toLocaleString()} />
        <KpiCard label="Submissions" value={kpis.submissions.toLocaleString()} />
        <KpiCard label="Open Reports" value={kpis.openReports} alert={kpis.openReports > 0} />
      </div>

      <div className="admin-card mt-4">
        <h3>Activity Trend</h3>
        <div className="admin-chart-container">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--violet)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--violet)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
              <XAxis dataKey="date" tick={{fontSize: 10, fill: "var(--muted)"}} axisLine={false} tickLine={false} />
              <YAxis tick={{fontSize: 10, fill: "var(--muted)"}} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid var(--line)', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
              <Area type="monotone" dataKey="users" stroke="var(--violet)" strokeWidth={2} fillOpacity={1} fill="url(#colorUsers)" />
              <Area type="monotone" dataKey="battles" stroke="var(--lime)" strokeWidth={2} fill="transparent" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="admin-grid-2 mt-4">
        <div className="admin-card">
          <h3>Top Battles</h3>
          <table className="admin-table compact">
            <thead>
              <tr><th>Battle</th><th>Participants</th></tr>
            </thead>
            <tbody>
              {topBattles.map(b => (
                <tr key={b.id}>
                  <td><strong>{b.title}</strong></td>
                  <td>{b.participantCount}</td>
                </tr>
              ))}
              {topBattles.length === 0 && <tr><td colSpan={2} className="admin-empty">No battles found.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="admin-card">
          <h3>Top Users</h3>
          <table className="admin-table compact">
            <thead>
              <tr><th>User</th><th>XP</th></tr>
            </thead>
            <tbody>
              {topUsers.map(u => (
                <tr key={u.id}>
                  <td><strong>{u.displayName}</strong><br/><small>@{u.username}</small></td>
                  <td>{u.xp.toLocaleString()}</td>
                </tr>
              ))}
              {topUsers.length === 0 && <tr><td colSpan={2} className="admin-empty">No users found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AdminUsersTab() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isError, refetch } = useListAdminUsers({ 
    page, 
    pageSize, 
    search: debouncedSearch || undefined 
  }, { query: { queryKey: getListAdminUsersQueryKey({ page, pageSize, search: debouncedSearch || undefined }) } });

  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  if (selectedUser) {
    return <AdminUserDetailView userId={selectedUser} onBack={() => setSelectedUser(null)} />;
  }

  return (
    <div className="admin-panel">
      <div className="admin-toolbar">
        <div className="admin-search">
          <Search size={14} />
          <input 
            type="text" 
            placeholder="Search users..." 
            value={search} 
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            data-testid="input-admin-user-search"
          />
        </div>
      </div>
      <div className="admin-table-container">
        {isLoading ? <AdminLoading /> : isError ? <AdminError onRetry={() => refetch()} /> : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>XP / Wins</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map(user => (
                <tr key={user.id} onClick={() => setSelectedUser(user.id)} className="clickable-row" data-testid={`row-user-${user.id}`}>
                  <td>
                    <div className="admin-user-cell">
                      <img src={user.avatarUrl || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3C/svg%3E"} alt="" className="admin-avatar-sm" />
                      <div>
                        <strong data-testid={`text-username-${user.id}`}>{user.displayName}</strong>
                        <span>@{user.username}</span>
                      </div>
                    </div>
                  </td>
                  <td><span className={`admin-badge role-${user.role.toLowerCase()}`}>{user.role}</span></td>
                  <td><span className={`admin-badge status-${user.status.toLowerCase()}`}>{user.status}</span></td>
                  <td>
                    <div className="admin-stats-cell">
                      <strong>{user.xp.toLocaleString()} XP</strong>
                      <span>{user.wins}W - {user.losses}L</span>
                    </div>
                  </td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button className="admin-icon-btn" onClick={(e) => { e.stopPropagation(); setSelectedUser(user.id); }} data-testid={`btn-user-details-${user.id}`}>
                      <ArrowUpRight size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {data?.items.length === 0 && (
                <tr><td colSpan={6} className="admin-empty">No users found.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      {data && data.totalPages > 1 && (
        <AdminPagination page={page} totalPages={data.totalPages} onPageChange={setPage} />
      )}
    </div>
  );
}

function AdminUserDetailView({ userId, onBack }: { userId: string, onBack: () => void }) {
  const queryClient = useQueryClient();
  const { data: user, isLoading, isError, refetch } = useGetAdminUser(userId, { query: { queryKey: getGetAdminUserQueryKey(userId) } });
  
  const [modalState, setModalState] = useState<{
    type: typeof AdminUserUpdateAction[keyof typeof AdminUserUpdateAction] | 'DELETE';
    role?: AdminUserUpdateRole;
  } | null>(null);

  const updateMut = useUpdateAdminUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAdminUserQueryKey(userId) });
        queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
        setModalState(null);
      }
    }
  });

  const deleteMut = useDeleteAdminUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
        setModalState(null);
        onBack();
      }
    }
  });

  if (isLoading) return <AdminLoading />;
  if (isError || !user) return <AdminError onRetry={() => refetch()} />;

  const handleConfirmModal = (reason: string, confirmText: string) => {
    if (!modalState) return;
    if (modalState.type === 'DELETE') {
      deleteMut.mutate({ userId, data: { reason, confirmation: confirmText } });
    } else {
      updateMut.mutate({ userId, data: { action: modalState.type as any, role: modalState.role, reason, confirmation: confirmText } });
    }
  };

  const getModalTitle = () => {
    switch (modalState?.type) {
      case 'DELETE': return 'Delete User Account';
      case 'BLOCK': return 'Block User';
      case 'UNBLOCK': return 'Unblock User';
      case 'CHANGE_ROLE': return 'Change User Role';
      case 'RESET_STATS': return 'Reset Ranking Stats';
      default: return 'Confirm Action';
    }
  };

  const getModalConsequences = () => {
    switch (modalState?.type) {
      case 'DELETE': return 'This action will soft-delete the user. Their account will be deactivated and hidden, but audit logs and related data will be preserved.';
      case 'BLOCK': return 'The user will be immediately logged out and prevented from accessing the platform.';
      case 'UNBLOCK': return 'The user will regain access to the platform and can log in normally.';
      case 'CHANGE_ROLE': return `The user's permissions will be updated to ${modalState.role}. This grants or revokes administrative rights immediately.`;
      case 'RESET_STATS': return "The user's XP, wins, losses, rank and streak will be reset to zero. The action is recorded in the immutable administrator audit log.";
      default: return '';
    }
  };

  return (
    <div className="admin-detail-view">
      <AdminActionModal
        isOpen={!!modalState}
        title={getModalTitle()}
        consequences={getModalConsequences()}
        requireReason={true}
        requireConfirmText={modalState?.type}
        isDestructive={modalState?.type === 'DELETE' || modalState?.type === 'BLOCK'}
        isPending={updateMut.isPending || deleteMut.isPending}
        onClose={() => setModalState(null)}
        onConfirm={handleConfirmModal}
      />

      <div className="admin-detail-header">
        <button className="admin-back-btn" onClick={onBack} data-testid="btn-user-detail-back">
          <ChevronLeft size={16} /> Back to Users
        </button>
        <div className="admin-detail-actions">
          {user.status === 'ACTIVE' && (
            <button className="admin-btn-outline danger" onClick={() => setModalState({ type: 'BLOCK' })} data-testid="btn-user-block">Block User</button>
          )}
          {user.status === 'BLOCKED' && (
            <button className="admin-btn-outline success" onClick={() => setModalState({ type: 'UNBLOCK' })} data-testid="btn-user-unblock">Unblock User</button>
          )}
          {user.role === 'USER' && (
            <button className="admin-btn-outline" onClick={() => setModalState({ type: 'CHANGE_ROLE', role: 'ADMIN' })} data-testid="btn-user-promote">Promote to Admin</button>
          )}
          {user.role === 'ADMIN' && (
            <button className="admin-btn-outline" onClick={() => setModalState({ type: 'CHANGE_ROLE', role: 'USER' })} data-testid="btn-user-demote">Demote to User</button>
          )}
          <button className="admin-btn-solid danger" onClick={() => setModalState({ type: 'DELETE' })} data-testid="btn-user-delete">Delete Account</button>
          <button className="admin-btn-outline danger" onClick={() => setModalState({ type: 'RESET_STATS' })} data-testid="btn-user-reset-stats">Reset Ranking Stats</button>
        </div>
      </div>
      
      <div className="admin-detail-grid">
        <div className="admin-card">
          <h3>Profile Information</h3>
          <div className="admin-kv-list">
            <div className="admin-kv"><span>ID</span><strong data-testid="text-user-id">{user.id}</strong></div>
            <div className="admin-kv"><span>Email</span><strong data-testid="text-user-email">{user.email}</strong></div>
            <div className="admin-kv"><span>Country</span><strong>{user.country}</strong></div>
            <div className="admin-kv"><span>Status</span><strong className={`status-${user.status.toLowerCase()}`}>{user.status}</strong></div>
            <div className="admin-kv"><span>Role</span><strong className={`role-${user.role.toLowerCase()}`}>{user.role}</strong></div>
            <div className="admin-kv"><span>Subscription</span><strong>{user.subscriptionStatus === 'NOT_CONNECTED' ? <span className="admin-null">N/A</span> : user.subscriptionStatus}</strong></div>
          </div>
        </div>

        <div className="admin-card">
          <h3>Game Stats</h3>
          <div className="admin-kv-list">
            <div className="admin-kv"><span>League</span><strong>{user.league}</strong></div>
            <div className="admin-kv"><span>XP</span><strong>{user.xp.toLocaleString()}</strong></div>
            <div className="admin-kv"><span>Wins</span><strong>{user.wins}</strong></div>
            <div className="admin-kv"><span>Losses</span><strong>{user.losses}</strong></div>
            <div className="admin-kv"><span>Last Active</span><strong>{new Date(user.lastActiveAt).toLocaleString()}</strong></div>
            <div className="admin-kv"><span>Created At</span><strong>{new Date(user.createdAt).toLocaleString()}</strong></div>
          </div>
        </div>
      </div>

      <div className="admin-card mt-4">
        <h3>Audit Log</h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Action</th>
              <th>Reason</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {user.audit.map(log => (
              <tr key={log.id} data-testid={`row-audit-${log.id}`}>
                <td>{new Date(log.createdAt).toLocaleString()}</td>
                <td><strong>{log.action}</strong></td>
                <td>{log.reason || <span className="admin-null">No reason</span>}</td>
                <td>{log.result}</td>
              </tr>
            ))}
            {user.audit.length === 0 && <tr><td colSpan={4} className="admin-empty">No audit history.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminModerationTab() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("");
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useListAdminReports({ page, pageSize: 20, status: status || undefined }, { query: { queryKey: getListAdminReportsQueryKey({ page, pageSize: 20, status: status || undefined }) } });
  
  const [modalState, setModalState] = useState<{ reportId: string; newStatus: typeof AdminReportUpdateStatus[keyof typeof AdminReportUpdateStatus]; priority: typeof AdminReportPriority[keyof typeof AdminReportPriority] } | null>(null);

  const updateMut = useUpdateAdminReport({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminReportsQueryKey() });
        setModalState(null);
      }
    }
  });

  const handleConfirmModal = (reason: string) => {
    if (!modalState) return;
    updateMut.mutate({ reportId: modalState.reportId, data: { status: modalState.newStatus, priority: modalState.priority, resolutionNote: reason } });
  };

  return (
    <div className="admin-panel">
      <AdminActionModal
        isOpen={!!modalState}
        title={modalState?.newStatus === 'RESOLVED' ? 'Resolve Report' : 'Reject Report'}
        consequences="This will update the report status and keep an audit log of the resolution."
        reasonLabel="Resolution Note (optional)"
        requireReason={false}
        isDestructive={modalState?.newStatus === 'REJECTED'}
        isPending={updateMut.isPending}
        onClose={() => setModalState(null)}
        onConfirm={handleConfirmModal}
      />

      <div className="admin-toolbar">
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} data-testid="select-report-status">
          <option value="">All Statuses</option>
          <option value="NEW">New</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESOLVED">Resolved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>
      <div className="admin-table-container">
        {isLoading ? <AdminLoading /> : isError ? <AdminError onRetry={() => refetch()} /> : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Target</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map(report => (
                <tr key={report.id} data-testid={`row-report-${report.id}`}>
                  <td><strong>{report.targetType}</strong><br/><small>{report.targetId}</small></td>
                  <td><strong>{report.reason}</strong><br/><small>{report.description || <span className="admin-null">No description</span>}</small></td>
                  <td><span className={`admin-badge status-${report.status.toLowerCase()}`}>{report.status}</span></td>
                  <td>{new Date(report.createdAt).toLocaleDateString()}</td>
                  <td>
                    {report.status !== 'RESOLVED' && (
                       <button className="admin-btn-outline success mr-2" onClick={() => setModalState({ reportId: report.id, newStatus: 'RESOLVED', priority: report.priority as any })} data-testid={`btn-resolve-${report.id}`}>Resolve</button>
                    )}
                    {report.status !== 'REJECTED' && (
                       <button className="admin-btn-outline danger" onClick={() => setModalState({ reportId: report.id, newStatus: 'REJECTED', priority: report.priority as any })} data-testid={`btn-reject-${report.id}`}>Reject</button>
                    )}
                  </td>
                </tr>
              ))}
              {data?.items.length === 0 && <tr><td colSpan={5} className="admin-empty">No reports found.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
      {data && data.totalPages > 1 && <AdminPagination page={page} totalPages={data.totalPages} onPageChange={setPage} />}
    </div>
  );
}

function AdminBattlesTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useListAdminBattles({ page, pageSize: 20, search: debouncedSearch || undefined }, { query: { queryKey: getListAdminBattlesQueryKey({ page, pageSize: 20, search: debouncedSearch || undefined }) } });
  
  const [modalState, setModalState] = useState<{ battleId: string } | null>(null);

  const updateMut = useUpdateAdminBattle({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminBattlesQueryKey() });
        setModalState(null);
      }
    }
  });

  const handleConfirmModal = (reason: string, confirmText: string) => {
    if (!modalState) return;
    updateMut.mutate({ battleId: modalState.battleId, data: { contentStatus: "HIDDEN", reason, confirmation: confirmText } });
  };

  return (
    <div className="admin-panel">
      <AdminActionModal
        isOpen={!!modalState}
        title="Hide Battle"
        consequences="This battle will be immediately hidden from the platform. Users will no longer be able to discover or interact with it."
        requireReason={true}
        requireConfirmText="MODERATE"
        isDestructive={true}
        isPending={updateMut.isPending}
        onClose={() => setModalState(null)}
        onConfirm={handleConfirmModal}
      />

      <div className="admin-toolbar">
        <div className="admin-search">
          <Search size={14} />
          <input 
            type="text" 
            placeholder="Search battles..." 
            value={search} 
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            data-testid="input-battle-search"
          />
        </div>
      </div>
      <div className="admin-table-container">
        {isLoading ? <AdminLoading /> : isError ? <AdminError onRetry={() => refetch()} /> : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title / Category</th>
                <th>Status</th>
                <th>Content Status</th>
                <th>Participants</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map(battle => (
                <tr key={battle.id} data-testid={`row-battle-${battle.id}`}>
                  <td><strong>{battle.title}</strong><br/><small>{battle.category}</small></td>
                  <td><span className={`admin-badge status-${battle.status.toLowerCase()}`}>{battle.status}</span></td>
                  <td><span className={`admin-badge status-${battle.contentStatus.toLowerCase()}`}>{battle.contentStatus}</span></td>
                  <td>{battle.participantCount} / {battle.totalVotes} votes</td>
                  <td>
                    {battle.contentStatus === 'ACTIVE' && (
                       <button className="admin-btn-outline danger" onClick={() => setModalState({ battleId: battle.id })} data-testid={`btn-hide-battle-${battle.id}`}>Hide</button>
                    )}
                  </td>
                </tr>
              ))}
              {data?.items.length === 0 && <tr><td colSpan={5} className="admin-empty">No battles found.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
      {data && data.totalPages > 1 && <AdminPagination page={page} totalPages={data.totalPages} onPageChange={setPage} />}
    </div>
  );
}

function AdminAnalyticsTab() {
  const [range, setRange] = useState<AdminRangeParameter>("30d");
  const { data, isLoading, isError, refetch } = useGetAdminAnalytics({ range }, { query: { queryKey: ["admin-analytics", range] } });

  if (isLoading) return <AdminLoading />;
  if (isError || !data) return <AdminError onRetry={() => refetch()} />;

  return (
    <div className="admin-analytics">
      <div className="admin-toolbar justify-end mb-4">
        <select value={range} onChange={(e) => setRange(e.target.value as AdminRangeParameter)} data-testid="select-analytics-range">
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="90d">Last 90 Days</option>
          <option value="all">All Time</option>
        </select>
      </div>

      <div className="admin-kpi-grid">
        <KpiCard label="DAU" value={data.dau.toLocaleString()} />
        <KpiCard label="MAU" value={data.mau.toLocaleString()} />
        <KpiCard label="Retention" value={data.retention != null ? `${data.retention}%` : <span className="admin-null">N/A</span>} />
        <KpiCard label="Registrations" value={data.registrations.toLocaleString()} />
      </div>

      <div className="admin-card mt-4">
        <h3>Engagement Funnel</h3>
        <div className="admin-chart-container">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
              <XAxis dataKey="date" tick={{fontSize: 10, fill: "var(--muted)"}} axisLine={false} tickLine={false} />
              <YAxis tick={{fontSize: 10, fill: "var(--muted)"}} axisLine={false} tickLine={false} />
              <Tooltip cursor={{fill: 'rgba(0,0,0,0.04)'}} contentStyle={{ borderRadius: '12px', border: '1px solid var(--line)' }} />
              <Bar dataKey="users" fill="var(--violet)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="submissions" fill="var(--lime)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function AdminMonetizationTab() {
  const { data, isLoading, isError, refetch } = useGetAdminMonetization({ query: { queryKey: getGetAdminMonetizationQueryKey() } });

  if (isLoading) return <AdminLoading />;
  if (isError || !data) return <AdminError onRetry={() => refetch()} />;

  return (
    <div className="admin-monetization">
      {!data.connected && (
        <div className="admin-alert warning mb-4">
          <AlertTriangle size={16} />
          <span>Monetization provider ({data.provider || 'Stripe'}) is not connected or keys are missing. Data is unavailable.</span>
        </div>
      )}

      <div className="admin-kpi-grid">
        <KpiCard label="Monthly Recurring Revenue" value={data.mrr != null ? `$${data.mrr}` : <span className="admin-null">N/A</span>} />
        <KpiCard label="Total Revenue" value={data.revenue != null ? `$${data.revenue}` : <span className="admin-null">N/A</span>} />
        <KpiCard label="Active Subscriptions" value={data.activeSubscriptions != null ? data.activeSubscriptions : <span className="admin-null">N/A</span>} />
        <KpiCard label="Cancelled" value={data.cancelledSubscriptions != null ? data.cancelledSubscriptions : <span className="admin-null">N/A</span>} />
      </div>

      <div className="admin-card mt-4">
        <h3>Provider Status</h3>
        <div className="admin-kv-list">
          <div className="admin-kv"><span>Provider</span><strong>{data.provider || <span className="admin-null">None</span>}</strong></div>
          <div className="admin-kv"><span>Status</span><strong className={data.connected ? 'status-active' : 'status-blocked'}>{data.connected ? 'Connected' : 'Disconnected'}</strong></div>
          <div className="admin-kv"><span>Message</span><strong>{data.message}</strong></div>
          <div className="admin-kv"><span>Top Plan</span><strong>{data.topPlan || <span className="admin-null">N/A</span>}</strong></div>
        </div>
      </div>
    </div>
  );
}

function AdminNotificationsTab() {
  const { data, isLoading, isError, refetch } = useListAdminNotifications({ query: { queryKey: getListAdminNotificationsQueryKey() } });

  if (isLoading) return <AdminLoading />;
  if (isError || !data) return <AdminError onRetry={() => refetch()} />;

  return (
    <div className="admin-panel">
      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Severity</th>
              <th>Notification</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {data.map(notif => (
              <tr key={notif.id} data-testid={`row-notif-${notif.id}`}>
                <td><span className={`admin-badge severity-${notif.severity.toLowerCase()}`}>{notif.severity}</span></td>
                <td><strong>{notif.title}</strong><br/><small>{notif.body}</small></td>
                <td>{new Date(notif.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {data.length === 0 && <tr><td colSpan={3} className="admin-empty">No system notifications.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminAuditTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useListAdminAudit({ page, pageSize: 20 }, { query: { queryKey: getListAdminAuditQueryKey({ page, pageSize: 20 }) } });

  if (isLoading) return <AdminLoading />;
  if (isError || !data) return <AdminError onRetry={() => refetch()} />;

  return (
    <div className="admin-panel">
      <div className="admin-table-container">
        <table className="admin-table compact">
          <thead>
            <tr>
              <th>Date</th>
              <th>Actor ID</th>
              <th>Action</th>
              <th>Target</th>
              <th>Result</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map(log => (
              <tr key={log.id} data-testid={`row-audit-${log.id}`}>
                <td>{new Date(log.createdAt).toLocaleString()}</td>
                <td><code className="admin-code">{log.actorProfileId}</code></td>
                <td><strong>{log.action}</strong></td>
                <td>{log.targetType} {log.targetId ? <code className="admin-code">{log.targetId}</code> : ''}</td>
                <td>{log.result}</td>
                <td>{log.reason || <span className="admin-null">N/A</span>}</td>
              </tr>
            ))}
            {data.items.length === 0 && <tr><td colSpan={6} className="admin-empty">No audit logs found.</td></tr>}
          </tbody>
        </table>
      </div>
      {data.totalPages > 1 && <AdminPagination page={page} totalPages={data.totalPages} onPageChange={setPage} />}
    </div>
  );
}

function AdminSettingsTab() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useGetAdminSettings({ query: { queryKey: getGetAdminSettingsQueryKey() } });
  
  const [isModalOpen, setModalOpen] = useState(false);

  const updateMut = useUpdateAdminSettings({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAdminSettingsQueryKey() });
        setModalOpen(false);
      }
    }
  });

  const [form, setForm] = useState<Partial<AdminSettings>>({});
  
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (isLoading) return <AdminLoading />;
  if (isError || !data) return <AdminError onRetry={() => refetch()} />;

  const handleConfirmModal = (reason: string, confirmText: string) => {
    updateMut.mutate({ data: { ...form, confirmation: confirmText } as AdminSettingsUpdate });
  };

  const toggle = (key: keyof AdminSettings) => {
    setForm(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const hasChanges = Object.keys(form).some(k => form[k as keyof AdminSettings] !== data[k as keyof AdminSettings]);

  return (
    <div className="admin-settings">
      <AdminActionModal
        isOpen={isModalOpen}
        title="Save Global Settings"
        consequences="These changes apply immediately to the entire platform. Modifying maintenance mode or registrations will alter user access instantly."
        requireReason={false}
        requireConfirmText="UPDATE_SETTINGS"
        isDestructive={false}
        isPending={updateMut.isPending}
        onClose={() => setModalOpen(false)}
        onConfirm={handleConfirmModal}
      />

      <div className="admin-card max-w-2xl">
        <h3>Global Platform Settings</h3>
        <p className="admin-description">Changes apply immediately to all users.</p>
        
        <div className="admin-settings-list mt-4">
          <div className="admin-setting-row">
            <div>
              <strong>Maintenance Mode</strong>
              <p>Block all non-admin access to the application.</p>
            </div>
            <button className={`admin-toggle ${form.maintenanceMode ? 'on' : ''}`} onClick={() => toggle('maintenanceMode')} data-testid="toggle-maintenance">
              <span />
            </button>
          </div>
          <div className="admin-setting-row">
            <div>
              <strong>Registrations Enabled</strong>
              <p>Allow new users to sign up.</p>
            </div>
            <button className={`admin-toggle ${form.registrationsEnabled ? 'on' : ''}`} onClick={() => toggle('registrationsEnabled')} data-testid="toggle-registrations">
              <span />
            </button>
          </div>
          <div className="admin-setting-row">
            <div>
              <strong>Auto-assign Moderation</strong>
              <p>Automatically assign incoming reports to active moderators.</p>
            </div>
            <button className={`admin-toggle ${form.moderationAutoAssign ? 'on' : ''}`} onClick={() => toggle('moderationAutoAssign')} data-testid="toggle-moderation">
              <span />
            </button>
          </div>
          <div className="admin-setting-row">
            <div>
              <strong>Admin Notifications</strong>
              <p>Receive alerts for critical system events.</p>
            </div>
            <button className={`admin-toggle ${form.adminNotificationsEnabled ? 'on' : ''}`} onClick={() => toggle('adminNotificationsEnabled')} data-testid="toggle-notifications">
              <span />
            </button>
          </div>
        </div>

        <div className="admin-settings-footer mt-6">
          <small>Last updated: {new Date(data.updatedAt).toLocaleString()}</small>
          <button className="admin-btn-solid" disabled={!hasChanges || updateMut.isPending} onClick={() => setModalOpen(true)} data-testid="btn-save-settings">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
