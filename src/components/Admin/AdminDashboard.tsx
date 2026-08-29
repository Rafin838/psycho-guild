import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  Calendar,
  Clock,
  Database,
  Search,
  Filter,
  RefreshCw,
  Eye,
  CheckCircle2,
  XCircle,
  Trash2,
  LogOut,
  LayoutDashboard,
  UserCheck,
  UserX,
  Clock4,
  Settings,
  Menu,
  X,
  Radio,
  Shield,
  Copy,
  Check,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { UserSubmission, AdminStats, AdminUser, SubmissionStatus } from '../../types.js';
import { useToast } from '../Toast.js';
import { UserDetailModal } from './UserDetailModal.js';
import { DeleteConfirmModal } from './DeleteConfirmModal.js';
import { AdminSettings } from './AdminSettings.js';
import { formatDhakaDate, formatDhakaTime } from '../../utils/timezone.js';

interface AdminDashboardProps {
  adminToken: string;
  adminUser: AdminUser | null;
  onLogout: () => void;
}

type NavTab = 'dashboard' | 'all' | 'pending' | 'approved' | 'rejected' | 'settings';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  adminToken,
  adminUser,
  onLogout,
}) => {
  const { showToast } = useToast();
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [submissions, setSubmissions] = useState<UserSubmission[]>([]);
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    todaySubmissions: 0,
    pendingRequests: 0,
    totalRecords: 0,
    approvedCount: 0,
    rejectedCount: 0,
  });

  // Distinct lifecycle & error states
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Modals state
  const [selectedSubmission, setSelectedSubmission] = useState<UserSubmission | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserSubmission | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [guildIdCopied, setGuildIdCopied] = useState(false);

  const handleAdminCopyGuildId = async () => {
    try {
      await navigator.clipboard.writeText('3103478372');
      setGuildIdCopied(true);
      showToast('Guild ID (3103478372) copied!', 'success');
      setTimeout(() => setGuildIdCopied(false), 2000);
    } catch {
      setGuildIdCopied(true);
      showToast('Guild ID copied!', 'success');
      setTimeout(() => setGuildIdCopied(false), 2000);
    }
  };

  // Fetch Submissions and Stats with cache-busting and explicit error isolation
  const fetchData = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) {
        setIsRefreshing(true);
      }

      try {
        const cacheBuster = `_t=${Date.now()}`;
        const [subRes, statsRes] = await Promise.all([
          fetch(`/api/admin/submissions?${cacheBuster}`, {
            headers: {
              Authorization: `Bearer ${adminToken}`,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              Pragma: 'no-cache',
            },
          }),
          fetch(`/api/admin/stats?${cacheBuster}`, {
            headers: {
              Authorization: `Bearer ${adminToken}`,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              Pragma: 'no-cache',
            },
          }),
        ]);

        if (subRes.status === 401 || statsRes.status === 401) {
          showToast('Session expired. Please log in again.', 'error');
          onLogout();
          return;
        }

        if (!subRes.ok) {
          const errData = await subRes.json().catch(() => null);
          const errMsg = errData?.message || `Database query error (${subRes.status})`;
          throw new Error(errMsg);
        }

        if (!statsRes.ok) {
          const errData = await statsRes.json().catch(() => null);
          const errMsg = errData?.message || `Database stats error (${statsRes.status})`;
          throw new Error(errMsg);
        }

        const subData = await subRes.json();
        const statsData = await statsRes.json();

        const submissionsArray = subData.submissions || subData.data;

        if (subData.success && Array.isArray(submissionsArray)) {
          // Strictly deduplicate by canonical database ID
          const idMap = new Map<string, UserSubmission>();
          for (const item of submissionsArray) {
            if (item && item.id && !idMap.has(item.id)) {
              idMap.set(item.id, item);
            }
          }
          const loadedList = Array.from(idMap.values());
          // Replace list only after successful response arrives
          setSubmissions(loadedList);
          setFetchError(null);
          setHasLoadedOnce(true);
        } else {
          throw new Error(subData?.message || 'Invalid data payload returned from database');
        }

        if (statsData.success && statsData.data) {
          setStats(statsData.data);
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Database/API connection failed';
        console.error('Error fetching admin data:', errorMsg);
        setFetchError(errorMsg);

        if (isManualRefresh) {
          showToast(`Refresh failed: ${errorMsg}`, 'error');
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [adminToken, onLogout, showToast]
  );

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-Time Smart Polling Sync (4s interval)
  useEffect(() => {
    if (!adminToken) return;

    setIsLiveConnected(true);

    const pollInterval = setInterval(() => {
      fetchData(false);
    }, 4000);

    const handleFocus = () => {
      fetchData(false);
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [adminToken, fetchData]);

  // Update Status Action (Approve / Reject)
  const handleUpdateStatus = async (id: string, newStatus: SubmissionStatus) => {
    try {
      const res = await fetch(`/api/admin/submissions/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
          'Cache-Control': 'no-cache, no-store',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to update status');
      }

      showToast(`Request successfully marked as ${newStatus}`, 'success');
      // Optimistically update in place
      setSubmissions((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
      );
      fetchData(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating status';
      showToast(msg, 'error');
      fetchData(false);
    }
  };

  // Delete Action
  const handleConfirmDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/submissions/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Cache-Control': 'no-cache, no-store',
        },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to delete submission');
      }

      showToast('Submission deleted successfully', 'success');
      setSubmissions((prev) => prev.filter((item) => item.id !== id));
      fetchData(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error deleting record';
      showToast(msg, 'error');
    }
  };

  // Sync tab with status filter
  const handleTabChange = (tab: NavTab) => {
    setCurrentTab(tab);
    setMobileMenuOpen(false);
    if (tab === 'pending') setStatusFilter('Pending');
    else if (tab === 'approved') setStatusFilter('Approved');
    else if (tab === 'rejected') setStatusFilter('Rejected');
    else if (tab === 'all' || tab === 'dashboard') setStatusFilter('All');
  };

  // Filtered submissions list
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((item) => {
      const matchesSearch =
        searchQuery === '' ||
        item.gameName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.gameUid.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'All' || item.status.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [submissions, searchQuery, statusFilter]);

  return (
    <div className="w-full min-h-screen flex flex-col">
      {/* TOP ADMIN DASHBOARD HEADER */}
      <header className="w-full sticky top-0 z-40 backdrop-blur-xl bg-[#05070a]/90 border-b border-white/[0.08] transition-all duration-300">
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2.5 sm:gap-4">
          
          {/* Left: Mobile Hamburger & Title Area */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            {/* Mobile Hamburger toggle */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 sm:p-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
              aria-label="Open Sidebar Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <h1 className="text-base sm:text-xl md:text-2xl font-extrabold tracking-tight text-white truncate">
                {currentTab === 'settings'
                  ? 'Guild System Settings'
                  : currentTab === 'pending'
                  ? 'Pending Join Requests'
                  : currentTab === 'approved'
                  ? 'Approved Guild Members'
                  : currentTab === 'rejected'
                  ? 'Rejected Submissions'
                  : 'Admin Dashboard'}
              </h1>
              <p className="text-[11px] sm:text-xs text-[#94a3b8] truncate font-medium">
                Free Fire Guild Community Management • BD Time (Asia/Dhaka)
              </p>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Refresh Button */}
            <button
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
              id="refresh-admin-dashboard-btn"
              className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-white text-xs font-semibold flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              title="Refresh statistics and submissions"
              aria-label="Refresh Dashboard"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
              <span className="hidden xs:inline sm:inline">Refresh</span>
            </button>

            {/* Log Out Button */}
            <button
              onClick={onLogout}
              id="admin-logout-btn"
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-xs font-semibold transition-all cursor-pointer shadow-sm active:scale-95"
              title="Logout Admin"
              aria-label="Logout Admin"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              <span>Log Out</span>
            </button>
          </div>

        </div>
      </header>

      {/* Main Dashboard Container */}
      <div className="w-full max-w-full lg:max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-3 sm:py-6 overflow-x-hidden flex-1">
      
      {/* Sync Warning Banner if background polling failed but previous records exist */}
      {fetchError && submissions.length > 0 && (
        <div className="mb-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate">
              Database Sync Warning: {fetchError}. Showing cached persistent state.
            </span>
          </div>
          <button
            onClick={() => fetchData(true)}
            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-semibold shrink-0 cursor-pointer transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-[#05070a]/80 backdrop-blur-md"
            />
            {/* Drawer Sidebar */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed top-0 bottom-0 left-0 w-72 sm:w-80 max-w-[85vw] bg-[#090e1a] border-r border-white/[0.08] p-5 sm:p-6 flex flex-col justify-between shadow-2xl z-50 overflow-y-auto"
            >
              <div className="space-y-6">
                
                {/* Drawer Header */}
                <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="font-bold text-white text-sm tracking-wide">GUILD ADMIN</h2>
                      <p className="text-[10px] text-[#94a3b8]">Control Center</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                    aria-label="Close sidebar"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Admin Profile in Drawer */}
                <div className="p-3 rounded-xl bg-[rgba(0,0,0,0.3)] border border-white/[0.06] flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0">
                    <Shield className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="overflow-hidden min-w-0">
                    <h4 className="text-xs font-bold text-white truncate">Guild Admin</h4>
                    <p className="text-[11px] text-[#94a3b8] truncate">{adminUser?.email || 'Active Session'}</p>
                  </div>
                </div>

                {/* Guild ID in Drawer */}
                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-blue-400 block tracking-wider">Active Guild ID</span>
                    <span className="text-xs font-mono font-bold text-white">3103478372</span>
                  </div>
                  <button
                    onClick={handleAdminCopyGuildId}
                    className="px-2.5 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {guildIdCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{guildIdCopied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                {/* Navigation in Drawer */}
                <nav className="space-y-1 text-xs font-semibold">
                  <button
                    onClick={() => handleTabChange('dashboard')}
                    className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all cursor-pointer ${
                      currentTab === 'dashboard'
                        ? 'gradient-btn text-white'
                        : 'text-[#94a3b8] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <LayoutDashboard className="w-4 h-4" />
                      <span>Dashboard</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10">{stats.totalRecords}</span>
                  </button>

                  <button
                    onClick={() => handleTabChange('all')}
                    className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all cursor-pointer ${
                      currentTab === 'all'
                        ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                        : 'text-[#94a3b8] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Users className="w-4 h-4 text-blue-400" />
                      <span>All Users</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10">{stats.totalUsers}</span>
                  </button>

                  <button
                    onClick={() => handleTabChange('pending')}
                    className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all cursor-pointer ${
                      currentTab === 'pending'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'text-[#94a3b8] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Clock4 className="w-4 h-4 text-amber-400" />
                      <span>Pending Requests</span>
                    </div>
                    {stats.pendingRequests > 0 ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-300 border border-amber-500/40">
                        {stats.pendingRequests}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10">0</span>
                    )}
                  </button>

                  <button
                    onClick={() => handleTabChange('approved')}
                    className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all cursor-pointer ${
                      currentTab === 'approved'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'text-[#94a3b8] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <UserCheck className="w-4 h-4 text-emerald-400" />
                      <span>Approved Users</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10">{stats.approvedCount}</span>
                  </button>

                  <button
                    onClick={() => handleTabChange('rejected')}
                    className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all cursor-pointer ${
                      currentTab === 'rejected'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'text-[#94a3b8] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <UserX className="w-4 h-4 text-rose-400" />
                      <span>Rejected Users</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10">{stats.rejectedCount}</span>
                  </button>

                  <button
                    onClick={() => handleTabChange('settings')}
                    className={`w-full flex items-center gap-2.5 px-3.5 py-3 rounded-xl transition-all cursor-pointer ${
                      currentTab === 'settings'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'text-[#94a3b8] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Settings className="w-4 h-4 text-purple-400" />
                    <span>Settings</span>
                  </button>
                </nav>
              </div>

              {/* Real-time status & Logout in Drawer */}
              <div className="pt-4 border-t border-white/[0.08] space-y-3">
                <div className="p-2.5 rounded-xl bg-[rgba(0,0,0,0.3)] border border-white/[0.06] flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    <Radio className={`w-3.5 h-3.5 ${isLiveConnected ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
                    <span className="text-slate-300 font-medium">Real-Time Sync</span>
                  </div>
                  <span className={`font-bold ${isLiveConnected ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {isLiveConnected ? 'Online' : 'Polling'}
                  </span>
                </div>

                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        
        {/* DESKTOP SIDEBAR */}
        <div className="hidden lg:block lg:col-span-3">
          <div className="glass-card p-5 sticky top-24 space-y-6">
            
            {/* Admin Profile Box */}
            <div className="p-3.5 rounded-xl bg-[rgba(0,0,0,0.25)] border border-white/[0.08] flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-blue-400" />
              </div>
              <div className="overflow-hidden min-w-0">
                <h4 className="text-xs font-bold text-white truncate">Guild Admin</h4>
                <p className="text-[11px] text-[#94a3b8] truncate">{adminUser?.email || 'Authenticated'}</p>
              </div>
            </div>

            {/* Guild ID Quick Box */}
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-blue-400 block tracking-wider">Active Guild ID</span>
                <span className="text-xs font-mono font-bold text-white">3103478372</span>
              </div>
              <button
                onClick={handleAdminCopyGuildId}
                className="px-2.5 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                title="Copy Guild ID"
              >
                {guildIdCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{guildIdCopied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Sidebar Navigation */}
            <nav className="space-y-1.5 text-xs font-semibold">
              <button
                onClick={() => handleTabChange('dashboard')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                  currentTab === 'dashboard'
                    ? 'gradient-btn text-white'
                    : 'text-[#94a3b8] hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Dashboard</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10">{stats.totalRecords}</span>
              </button>

              <button
                onClick={() => handleTabChange('all')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                  currentTab === 'all'
                    ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                    : 'text-[#94a3b8] hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span>All Users</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10">{stats.totalUsers}</span>
              </button>

              <button
                onClick={() => handleTabChange('pending')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                  currentTab === 'pending'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-[#94a3b8] hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Clock4 className="w-4 h-4 text-amber-400" />
                  <span>Pending Requests</span>
                </div>
                {stats.pendingRequests > 0 ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-300 border border-amber-500/40">
                    {stats.pendingRequests}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10">0</span>
                )}
              </button>

              <button
                onClick={() => handleTabChange('approved')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                  currentTab === 'approved'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-[#94a3b8] hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  <span>Approved Users</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10">{stats.approvedCount}</span>
              </button>

              <button
                onClick={() => handleTabChange('rejected')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                  currentTab === 'rejected'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'text-[#94a3b8] hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <UserX className="w-4 h-4 text-rose-400" />
                  <span>Rejected Users</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10">{stats.rejectedCount}</span>
              </button>

              <button
                onClick={() => handleTabChange('settings')}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                  currentTab === 'settings'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'text-[#94a3b8] hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Settings className="w-4 h-4 text-purple-400" />
                <span>Settings</span>
              </button>

              <button
                onClick={onLogout}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-rose-400 hover:bg-rose-500/10 transition-all pt-3 border-t border-white/5 cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-rose-400" />
                <span>Logout</span>
              </button>
            </nav>

            {/* Live Polling Status indicator */}
            <div className="pt-2">
              <div className="p-2.5 rounded-xl bg-[rgba(0,0,0,0.25)] border border-white/[0.06] flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <Radio className={`w-3.5 h-3.5 ${isLiveConnected ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
                  <span className="text-slate-300 font-medium">Real-Time Sync</span>
                </div>
                <span className={`font-bold ${isLiveConnected ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {isLiveConnected ? 'Online' : 'Polling'}
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* MAIN ADMIN CONTENT AREA */}
        <div className="col-span-1 lg:col-span-9 space-y-4 sm:space-y-6 min-w-0">
          
          {currentTab === 'settings' ? (
            <AdminSettings adminUser={adminUser} submissions={submissions} />
          ) : (
            <>
              {/* 4 STATISTICS CARDS */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                
                {/* 1. Total Users */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card p-3.5 sm:p-5 relative overflow-hidden flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between text-[#94a3b8] mb-2">
                    <span className="text-[11px] sm:text-xs font-semibold tracking-wide truncate">Total Users</span>
                    <div className="p-1.5 sm:p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                      <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                  </div>
                  <div className="text-xl sm:text-3xl font-bold text-white tracking-tight">
                    {stats.totalUsers}
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-[#64748b] font-medium mt-1 truncate">
                    Submitted Players
                  </div>
                </motion.div>

                {/* 2. Today's Submissions (BD Time Asia/Dhaka) */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="glass-card p-3.5 sm:p-5 relative overflow-hidden flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between text-[#94a3b8] mb-2">
                    <span className="text-[11px] sm:text-xs font-semibold tracking-wide truncate">Today (BD)</span>
                    <div className="p-1.5 sm:p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
                      <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                  </div>
                  <div className="text-xl sm:text-3xl font-bold text-white tracking-tight">
                    {stats.todaySubmissions}
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-[#64748b] font-medium mt-1 truncate">
                    Received Today
                  </div>
                </motion.div>

                {/* 3. Pending Requests */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="glass-card p-3.5 sm:p-5 relative overflow-hidden flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between text-[#94a3b8] mb-2">
                    <span className="text-[11px] sm:text-xs font-semibold tracking-wide truncate">Pending</span>
                    <div className="p-1.5 sm:p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                      <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                  </div>
                  <div className="text-xl sm:text-3xl font-bold text-amber-400 tracking-tight">
                    {stats.pendingRequests}
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-amber-400/70 font-medium mt-1 truncate">
                    Awaiting Review
                  </div>
                </motion.div>

                {/* 4. Total Records */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="glass-card p-3.5 sm:p-5 relative overflow-hidden flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between text-[#94a3b8] mb-2">
                    <span className="text-[11px] sm:text-xs font-semibold tracking-wide truncate">Total Records</span>
                    <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                      <Database className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                  </div>
                  <div className="text-xl sm:text-3xl font-bold text-white tracking-tight">
                    {stats.totalRecords}
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-[#64748b] font-medium mt-1 truncate">
                    Database Entries
                  </div>
                </motion.div>

              </div>

              {/* USER SUBMISSIONS SECTION */}
              <div className="glass-card p-3 sm:p-6 space-y-3.5 sm:space-y-5 max-w-full overflow-hidden">
                
                {/* Section Header & Filters */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                  <div>
                    <h2 className="text-base sm:text-xl font-bold text-white flex items-center gap-2">
                      <span>User Submissions</span>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 font-mono">
                        {filteredSubmissions.length}
                      </span>
                    </h2>
                    <p className="text-[11px] sm:text-xs text-[#94a3b8]">
                      Real player join applications in Free Fire Guild
                    </p>
                  </div>

                  {/* Search and Status Dropdown */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
                    
                    {/* Search Field */}
                    <div className="relative w-full sm:w-60 md:w-64">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by Name, UID, or ID..."
                        className="w-full pl-9 pr-8 py-2 rounded-xl glass-input text-xs text-white placeholder:text-slate-500"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
                          aria-label="Clear search"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Status Filter Dropdown */}
                    <div className="relative w-full sm:w-36">
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl glass-input text-xs font-semibold text-white appearance-none cursor-pointer pr-8 bg-[#05070a]"
                      >
                        <option value="All" className="bg-[#05070a] text-white">All Status</option>
                        <option value="Pending" className="bg-[#05070a] text-amber-300">Pending</option>
                        <option value="Approved" className="bg-[#05070a] text-emerald-300">Approved</option>
                        <option value="Rejected" className="bg-[#05070a] text-rose-300">Rejected</option>
                      </select>
                      <Filter className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>

                  </div>
                </div>

                {/* ERROR STATE: Rendered ONLY when fetch fails and no records exist */}
                {fetchError && submissions.length === 0 && !isLoading && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-8 text-center text-rose-300">
                    <div className="flex flex-col items-center gap-3 max-w-md mx-auto">
                      <div className="p-3 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                        <AlertTriangle className="w-7 h-7" />
                      </div>
                      <h3 className="text-base font-bold text-white">Database / API Error</h3>
                      <p className="text-xs text-rose-200/90 leading-relaxed font-mono">
                        {fetchError}
                      </p>
                      <p className="text-[11px] text-[#94a3b8]">
                        Could not load submissions from persistent storage. Please check server status and retry.
                      </p>
                      <button
                        onClick={() => fetchData(true)}
                        className="mt-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-all active:scale-95 shadow-lg shadow-rose-950/50"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Retry Connection</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* MOBILE VIEW: Submission Cards (<= 768px) */}
                {(!fetchError || submissions.length > 0) && (
                  <div className="block md:hidden space-y-3 w-full max-w-full">
                    {isLoading && !hasLoadedOnce ? (
                      <div className="rounded-xl border border-white/[0.08] bg-[rgba(0,0,0,0.25)] p-8 text-center text-slate-400">
                        <div className="flex flex-col items-center gap-2.5">
                          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs font-medium text-slate-300">Loading database records from persistent storage...</span>
                        </div>
                      </div>
                    ) : filteredSubmissions.length === 0 ? (
                      <div className="rounded-xl border border-white/[0.08] bg-[rgba(0,0,0,0.25)] p-8 text-center text-slate-400">
                        <div className="flex flex-col items-center gap-2">
                          <Users className="w-8 h-8 text-slate-500" />
                          <span className="font-semibold text-slate-300 text-sm">
                            {searchQuery || statusFilter !== 'All'
                              ? 'No matching submissions found'
                              : 'No submissions found'}
                          </span>
                          <span className="text-xs text-[#64748b]">
                            {searchQuery || statusFilter !== 'All'
                              ? 'Try changing your search keywords or status filter'
                              : 'New player join requests will appear here automatically'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      filteredSubmissions.map((sub, index) => (
                        <div
                          key={`mobile-card-${sub.id}`}
                          className="w-full rounded-xl p-4 bg-[rgba(0,0,0,0.35)] border border-white/[0.08] space-y-3.5"
                        >
                          {/* Card Header: # and Status */}
                          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-[#64748b] font-bold">
                                #{index + 1}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                                {sub.id}
                              </span>
                            </div>
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                sub.status === 'Approved'
                                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                  : sub.status === 'Rejected'
                                  ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                  : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                sub.status === 'Approved' ? 'bg-emerald-400' : sub.status === 'Rejected' ? 'bg-rose-400' : 'bg-amber-400'
                              }`} />
                              {sub.status}
                            </span>
                          </div>

                          {/* Card Content Fields */}
                          <div className="space-y-2.5 text-xs">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-[#64748b] tracking-wider block mb-0.5">
                                Game ID Name
                              </span>
                              <span className="text-sm font-bold text-white break-words block">
                                {sub.gameName}
                              </span>
                            </div>

                            <div>
                              <span className="text-[10px] uppercase font-bold text-[#64748b] tracking-wider block mb-0.5">
                                Game UID
                              </span>
                              <span className="text-xs font-mono font-bold text-blue-400 break-all select-all block">
                                {sub.gameUid}
                              </span>
                            </div>

                            <div>
                              <span className="text-[10px] uppercase font-bold text-[#64748b] tracking-wider block mb-0.5">
                                Submitted Date (Asia/Dhaka)
                              </span>
                              <div className="text-xs text-slate-300 flex items-center gap-2">
                                <span className="font-mono">{sub.submissionDate || formatDhakaDate(sub.createdAt)}</span>
                                <span className="text-[#64748b]">•</span>
                                <span className="text-[#94a3b8]">{sub.submissionTime || formatDhakaTime(sub.createdAt)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="pt-2 border-t border-white/[0.06] grid grid-cols-2 gap-2 w-full">
                            {/* 1. View Details */}
                            <button
                              onClick={() => {
                                setSelectedSubmission(sub);
                                setIsDetailModalOpen(true);
                              }}
                              className="h-11 px-3 rounded-lg bg-white/10 hover:bg-white/15 active:scale-[0.98] text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer border border-white/10 transition-colors"
                              aria-label={`View details for ${sub.gameName}`}
                            >
                              <Eye className="w-4 h-4 text-blue-400 shrink-0" />
                              <span>Details</span>
                            </button>

                            {sub.status === 'Pending' ? (
                              <>
                                {/* 2. Approve */}
                                <button
                                  onClick={() => handleUpdateStatus(sub.id, 'Approved')}
                                  className="h-11 px-3 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 active:scale-[0.98] text-emerald-300 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer border border-emerald-500/30 transition-colors"
                                  aria-label={`Approve ${sub.gameName}`}
                                >
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                  <span>Approve</span>
                                </button>

                                {/* 3. Reject */}
                                <button
                                  onClick={() => handleUpdateStatus(sub.id, 'Rejected')}
                                  className="h-11 px-3 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 active:scale-[0.98] text-rose-300 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer border border-rose-500/30 transition-colors"
                                  aria-label={`Reject ${sub.gameName}`}
                                >
                                  <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                                  <span>Reject</span>
                                </button>

                                {/* 4. Delete */}
                                <button
                                  onClick={() => {
                                    setDeleteTarget(sub);
                                    setIsDeleteModalOpen(true);
                                  }}
                                  className="h-11 px-3 rounded-lg bg-red-950/40 hover:bg-rose-600/20 active:scale-[0.98] text-red-300 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer border border-rose-500/20 transition-colors"
                                  aria-label={`Delete record for ${sub.gameName}`}
                                >
                                  <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
                                  <span>Delete</span>
                                </button>
                              </>
                            ) : (
                              /* Finalized state: Delete only */
                              <button
                                onClick={() => {
                                  setDeleteTarget(sub);
                                  setIsDeleteModalOpen(true);
                                }}
                                className="h-11 px-3 rounded-lg bg-red-950/40 hover:bg-rose-600/20 active:scale-[0.98] text-red-300 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer border border-rose-500/20 transition-colors"
                                aria-label={`Delete record for ${sub.gameName}`}
                              >
                                <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
                                <span>Delete</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* DESKTOP VIEW: USER SUBMISSIONS TABLE (> 768px) */}
                {(!fetchError || submissions.length > 0) && (
                  <div className="hidden md:block relative w-full max-w-full rounded-xl border border-white/[0.08] bg-[rgba(0,0,0,0.25)] overflow-hidden">
                    <div className="w-full max-w-full overflow-x-auto">
                      <table className="w-full min-w-[680px] lg:min-w-[720px] text-left text-xs text-slate-300 border-collapse">
                        <thead className="bg-[#090e1a] uppercase tracking-wider text-[11px] font-bold text-[#94a3b8] border-b border-white/[0.08]">
                          <tr>
                            <th scope="col" className="px-3.5 sm:px-4 py-3 text-center w-12 shrink-0 whitespace-nowrap">#</th>
                            <th scope="col" className="px-3.5 sm:px-4 py-3 whitespace-nowrap min-w-[150px]">Game ID Name</th>
                            <th scope="col" className="px-3.5 sm:px-4 py-3 whitespace-nowrap min-w-[130px]">Game UID</th>
                            <th scope="col" className="px-3.5 sm:px-4 py-3 whitespace-nowrap min-w-[120px]">Status</th>
                            <th scope="col" className="px-3.5 sm:px-4 py-3 whitespace-nowrap min-w-[140px]">Date (Asia/Dhaka)</th>
                            <th scope="col" className="px-3.5 sm:px-4 py-3 text-right whitespace-nowrap min-w-[140px]">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.06] font-medium">
                          {isLoading && !hasLoadedOnce ? (
                            <tr>
                              <td colSpan={6} className="text-center py-12 text-slate-400">
                                <div className="flex flex-col items-center gap-2.5">
                                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                  <span className="font-medium text-slate-300">Loading database records from persistent storage...</span>
                                </div>
                              </td>
                            </tr>
                          ) : filteredSubmissions.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="text-center py-12 text-slate-400">
                                <div className="flex flex-col items-center gap-2">
                                  <Users className="w-8 h-8 text-slate-500" />
                                  <span className="font-semibold text-slate-300">
                                    {searchQuery || statusFilter !== 'All'
                                      ? 'No matching submissions found'
                                      : 'No submissions found'}
                                  </span>
                                  <span className="text-xs text-[#64748b]">
                                    {searchQuery || statusFilter !== 'All'
                                      ? 'Try changing your search keywords or status filter'
                                      : 'New player join requests will appear here automatically'}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            filteredSubmissions.map((sub, index) => (
                              <tr
                                key={`desktop-row-${sub.id}`}
                                className="hover:bg-white/[0.02] transition-colors"
                              >
                                <td className="px-3.5 sm:px-4 py-3.5 text-center font-mono text-[#64748b] whitespace-nowrap">
                                  {index + 1}
                                </td>

                                <td className="px-3.5 sm:px-4 py-3.5 whitespace-nowrap">
                                  <div className="font-bold text-white text-sm">{sub.gameName}</div>
                                  <div className="text-[10px] font-mono text-slate-500">{sub.id}</div>
                                </td>

                                <td className="px-3.5 sm:px-4 py-3.5 font-mono font-bold text-blue-400 whitespace-nowrap">
                                  {sub.gameUid}
                                </td>

                                <td className="px-3.5 sm:px-4 py-3.5 whitespace-nowrap">
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                      sub.status === 'Approved'
                                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                        : sub.status === 'Rejected'
                                        ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                        : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                    }`}
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                      sub.status === 'Approved' ? 'bg-emerald-400' : sub.status === 'Rejected' ? 'bg-rose-400' : 'bg-amber-400'
                                    }`} />
                                    {sub.status}
                                  </span>
                                </td>

                                <td className="px-3.5 sm:px-4 py-3.5 text-[#94a3b8] whitespace-nowrap">
                                  <div className="font-mono text-slate-300">{sub.submissionDate || formatDhakaDate(sub.createdAt)}</div>
                                  <div className="text-[10px] text-[#64748b]">{sub.submissionTime || formatDhakaTime(sub.createdAt)}</div>
                                </td>

                                <td className="px-3.5 sm:px-4 py-3.5 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-1.5 min-w-[120px]">
                                    
                                    {/* View */}
                                    <button
                                      onClick={() => {
                                        setSelectedSubmission(sub);
                                        setIsDetailModalOpen(true);
                                      }}
                                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center active:scale-95"
                                      title="View Details"
                                      aria-label={`View details for ${sub.gameName}`}
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>

                                    {/* Only render Approve & Reject when Pending */}
                                    {sub.status === 'Pending' && (
                                      <>
                                        {/* Approve */}
                                        <button
                                          onClick={() => handleUpdateStatus(sub.id, 'Approved')}
                                          className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors cursor-pointer shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center active:scale-95"
                                          title="Approve User"
                                          aria-label={`Approve ${sub.gameName}`}
                                        >
                                          <CheckCircle2 className="w-4 h-4" />
                                        </button>

                                        {/* Reject */}
                                        <button
                                          onClick={() => handleUpdateStatus(sub.id, 'Rejected')}
                                          className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center active:scale-95"
                                          title="Reject User"
                                          aria-label={`Reject ${sub.gameName}`}
                                        >
                                          <XCircle className="w-4 h-4" />
                                        </button>
                                      </>
                                    )}

                                    {/* Delete */}
                                    <button
                                      onClick={() => {
                                        setDeleteTarget(sub);
                                        setIsDeleteModalOpen(true);
                                      }}
                                      className="p-2 rounded-lg bg-white/5 hover:bg-rose-600/20 text-[#64748b] hover:text-rose-300 transition-colors cursor-pointer shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center active:scale-95"
                                      title="Delete Record"
                                      aria-label={`Delete record for ${sub.gameName}`}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>

                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>
            </>
          )}

        </div>

      </div>

      {/* MODALS */}
      <UserDetailModal
        submission={selectedSubmission}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedSubmission(null);
        }}
        onUpdateStatus={handleUpdateStatus}
      />

      <DeleteConfirmModal
        submission={deleteTarget}
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeleteTarget(null);
        }}
        onConfirmDelete={handleConfirmDelete}
      />
      </div>
    </div>
  );
};
