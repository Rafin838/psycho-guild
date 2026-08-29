import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  RotateCcw,
} from 'lucide-react';
import { UserSubmission } from '../../types.js';

interface StepTwoMessengerGuildProps {
  submission: UserSubmission | null;
  gameName: string;
  gameUid: string;
  onBack: () => void;
  onReset: () => void;
  onUpdateSubmission?: (updated: UserSubmission) => void;
}

const MESSENGER_INVITE_URL = 'https://m.me/j/PUycSb3HlRElrjmE/?send_source=gc%3Acopy_invite_link_t';

export const StepTwoMessengerGuild: React.FC<StepTwoMessengerGuildProps> = ({
  submission,
  gameName,
  gameUid,
  onBack,
  onReset,
  onUpdateSubmission,
}) => {
  const [localSubmission, setLocalSubmission] = useState<UserSubmission | null>(submission);

  // Synchronize when parent prop updates
  useEffect(() => {
    setLocalSubmission(submission);
  }, [submission]);

  const activeId = localSubmission?.id || submission?.id;
  const activeToken = localSubmission?.clientToken || submission?.clientToken;
  const displayName = localSubmission?.gameName || submission?.gameName || gameName;
  const displayUid = localSubmission?.gameUid || submission?.gameUid || gameUid;
  const displayStatus = localSubmission?.status || submission?.status || 'Pending';

  // Live polling mechanism to fetch latest database status from Netlify API
  const fetchLatestStatus = useCallback(async () => {
    if (!activeId) return;
    try {
      const headers: Record<string, string> = {};
      if (activeToken) {
        headers['X-Submission-Token'] = activeToken;
      }

      const res = await fetch(`/api/submissions/${encodeURIComponent(activeId)}`, {
        headers,
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const updatedData: UserSubmission = {
            ...json.data,
            clientToken: activeToken,
          };
          setLocalSubmission(updatedData);
          if (onUpdateSubmission) {
            onUpdateSubmission(updatedData);
          }
        }
      }
    } catch {
      // Ignore background network interruption
    }
  }, [activeId, activeToken, onUpdateSubmission]);

  useEffect(() => {
    // Immediate initial status check
    fetchLatestStatus();

    // If status is finalized as Approved or Rejected, cease polling completely
    if (displayStatus === 'Approved' || displayStatus === 'Rejected') {
      return;
    }

    // Automatically poll every 3 seconds while status is Pending
    const interval = setInterval(() => {
      fetchLatestStatus();
    }, 3000);

    // Refresh immediately when window/tab regains focus
    const handleFocus = () => {
      fetchLatestStatus();
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [fetchLatestStatus, displayStatus]);

  // Messenger Group Join Click
  const handleJoinMessenger = () => {
    window.open(MESSENGER_INVITE_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-[480px] mx-auto"
    >
      <div className="glass-card p-6 sm:p-8 text-white relative z-10 space-y-6">
        
        {/* Header row with Back button & Player indicator */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#94a3b8] hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>পরিবর্তন করুন</span>
          </button>

          <div className="text-right">
            <span className="text-[11px] font-medium text-[#64748b]">খেলোয়াড়: </span>
            <span className="text-xs font-bold text-white">{displayName}</span>
          </div>
        </div>

        {/* Main Page Title */}
        <div className="text-center space-y-1.5">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Join Messenger Group Now
          </h2>
          <p className="text-xs sm:text-sm text-[#94a3b8]">
            রিকোয়েস্ট যাচাইকরণের জন্য আমাদের অফিসিয়াল গ্রুপে জয়েন করুন
          </p>
        </div>

        {/* Primary Messenger Join Button */}
        <button
          onClick={handleJoinMessenger}
          className="w-full relative group overflow-hidden rounded-xl p-[1px] focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer shadow-lg shadow-blue-500/20"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#00c6ff] to-[#0072ff] rounded-xl transition-all duration-300 group-hover:opacity-90" />
          <div className="relative px-6 py-4 rounded-xl bg-gradient-to-r from-[#0084ff] to-[#0062ff] flex items-center justify-center gap-3 text-white font-bold text-base transition-all duration-200 group-hover:scale-[0.99] active:scale-[0.97]">
            <MessageCircle className="w-6 h-6 fill-white text-[#0062ff] shrink-0 drop-shadow" />
            <span>Join Messenger Group</span>
            <ExternalLink className="w-4 h-4 opacity-80 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>
        </button>

        {/* User Submission Status Card with Live State */}
        <div
          className={`p-4 rounded-xl border transition-all duration-300 ${
            displayStatus === 'Approved'
              ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
              : displayStatus === 'Rejected'
              ? 'bg-rose-500/10 border-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.15)]'
              : 'bg-amber-500/10 border-amber-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {displayStatus === 'Approved' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 animate-bounce" />
              ) : displayStatus === 'Rejected' ? (
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              ) : (
                <Clock className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
              )}
              <div>
                <span className="text-[11px] font-medium text-[#94a3b8] block">Your Submission Status / রিকোয়েস্ট স্ট্যাটাস</span>
                <span
                  className={`text-sm font-bold tracking-wide uppercase ${
                    displayStatus === 'Approved'
                      ? 'text-emerald-400'
                      : displayStatus === 'Rejected'
                      ? 'text-rose-400'
                      : 'text-amber-400'
                  }`}
                >
                  {displayStatus === 'Approved'
                    ? 'অনুমোদিত (APPROVED)'
                    : displayStatus === 'Rejected'
                    ? 'বাতিলকৃত (REJECTED)'
                    : 'বিচারাধীন (PENDING)'}
                </span>
              </div>
            </div>

            {displayStatus === 'Pending' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-400/10 text-amber-300 border border-amber-400/20 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                Live Sync
              </span>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-1.5 text-xs text-[#94a3b8]">
            <div className="flex items-center justify-between">
              <span>Game Name: <strong className="text-white">{displayName}</strong></span>
              {localSubmission?.submissionTime && (
                <span>সময়: <strong className="text-white">{localSubmission.submissionTime}</strong></span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span>Game UID: <strong className="text-white font-mono">{displayUid}</strong></span>
              {localSubmission?.submissionDate && (
                <span>তারিখ: <strong className="text-slate-300">{localSubmission.submissionDate}</strong></span>
              )}
            </div>
          </div>
        </div>

        {/* Notice Info Box */}
        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1.5 text-xs text-[#94a3b8] leading-relaxed">
          <div className="flex items-start gap-2">
            <span className="text-blue-400 font-bold">•</span>
            <p>
              গ্রুপে জয়েন করে আপনার ফ্রি ফায়ার গেম নেম (<strong>{displayName}</strong>) ও UID মেসেজ করুন।
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-emerald-400 font-bold">•</span>
            <p>এডমিন আপনার আবেদন যাচাই করে গিল্ডে যুক্ত করে নেবেন।</p>
          </div>
        </div>

        {/* Reset / New Submission Option */}
        <div className="pt-2 text-center">
          <button
            onClick={onReset}
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#64748b] hover:text-[#94a3b8] transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>নতুন আবেদন ফর্ম খুলুন</span>
          </button>
        </div>

      </div>
    </motion.div>
  );
};
