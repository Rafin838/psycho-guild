import React from 'react';
import { motion } from 'motion/react';
import {
  Settings,
  Shield,
  MessageCircle,
  Database,
  Download,
  Key,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { useToast } from '../Toast.js';
import { UserSubmission, AdminUser } from '../../types.js';

interface AdminSettingsProps {
  adminUser: AdminUser | null;
  submissions: UserSubmission[];
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({
  adminUser,
  submissions,
}) => {
  const { showToast } = useToast();

  const handleExportData = () => {
    try {
      const dataStr = JSON.stringify(submissions, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `guild_system_submissions_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('Database exported successfully as JSON', 'success', 'Export Complete');
    } catch {
      showToast('Failed to export data', 'error');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-400" />
          <span>System & Guild Configuration</span>
        </h2>
        <p className="text-xs text-[#94a3b8] mt-1">
          Manage guild constants, community connection channels, and export persistent records
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Guild Configuration */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-white/[0.08]">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Guild Identity</h3>
              <p className="text-[11px] text-[#94a3b8]">Current game community identifiers</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-[#94a3b8] block mb-1">Active Guild ID</span>
              <div className="px-3.5 py-2.5 rounded-xl bg-[rgba(0,0,0,0.25)] border border-blue-500/30 font-mono font-bold text-blue-400 text-sm flex items-center justify-between">
                <span>3103478372</span>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                  Active
                </span>
              </div>
            </div>

            <div>
              <span className="text-[#94a3b8] block mb-1">Messenger Group Target</span>
              <div className="px-3.5 py-2.5 rounded-xl bg-[rgba(0,0,0,0.25)] border border-white/[0.08] text-slate-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-blue-400" />
                  <span className="font-medium text-xs">Free Fire Guild Messenger Group</span>
                </div>
                <a
                  href="https://m.me/j/PUycSb3HlRElrjmE/?send_source=gc%3Acopy_invite_link_t"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:text-blue-300 p-1"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Account & Security */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-white/[0.08]">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Admin Security</h3>
              <p className="text-[11px] text-[#94a3b8]">Authentication & server session</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-[#94a3b8] block mb-1">Authenticated Admin Email</span>
              <div className="px-3.5 py-2.5 rounded-xl bg-[rgba(0,0,0,0.25)] border border-white/[0.08] text-slate-200 font-medium">
                {adminUser?.email || 'Active Admin Session'}
              </div>
            </div>

            <div>
              <span className="text-[#94a3b8] block mb-1">Session Token Status</span>
              <div className="px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>JWT Secure Token Active (Server-Side Verified)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Database & Persistence Export */}
        <div className="glass-card p-5 space-y-4 md:col-span-2">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Data Storage & Backup</h3>
                <p className="text-[11px] text-[#94a3b8]">
                  Persistent disk database tracking {submissions.length} total records
                </p>
              </div>
            </div>

            <button
              onClick={handleExportData}
              className="gradient-btn px-4 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON Backup</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-[rgba(0,0,0,0.25)] border border-white/[0.08]">
              <span className="text-[#94a3b8] block mb-1">Storage Engine</span>
              <span className="font-mono text-blue-400">Supabase Postgres</span>
            </div>
            <div className="p-3 rounded-xl bg-[rgba(0,0,0,0.25)] border border-white/[0.08]">
              <span className="text-[#94a3b8] block mb-1">Real-time Engine</span>
              <span className="text-emerald-300 font-semibold">Smart Real-Time Polling</span>
            </div>
            <div className="p-3 rounded-xl bg-[rgba(0,0,0,0.25)] border border-white/[0.08]">
              <span className="text-[#94a3b8] block mb-1">Server Engine</span>
              <span className="font-mono text-purple-400">Vercel Serverless Functions</span>
            </div>
          </div>
        </div>

      </div>
    </motion.div>
  );
};

