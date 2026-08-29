import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, Gamepad2, Calendar, Clock, Shield, CheckCircle2, XCircle, Clock4 } from 'lucide-react';
import { UserSubmission, SubmissionStatus } from '../../types.js';

interface UserDetailModalProps {
  submission: UserSubmission | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus: (id: string, status: SubmissionStatus) => void;
}

export const UserDetailModal: React.FC<UserDetailModalProps> = ({
  submission,
  isOpen,
  onClose,
  onUpdateStatus,
}) => {
  if (!isOpen || !submission) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-[#05070a]/85 backdrop-blur-md"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-md glass-card p-6 sm:p-7 text-white space-y-6 z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">User Submission Details</h3>
                <p className="text-[11px] text-[#64748b] font-mono">ID: {submission.id}</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-[#94a3b8] hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Information Grid */}
          <div className="space-y-3 text-xs">
            
            {/* Game ID Name */}
            <div className="p-3.5 rounded-xl bg-[rgba(0,0,0,0.25)] border border-white/[0.08] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[#94a3b8] shrink-0">
                <User className="w-4 h-4 text-blue-400" />
                <span>Game ID:</span>
              </div>
              <span className="font-bold text-white text-sm break-words text-right">{submission.gameName}</span>
            </div>

            {/* Game UID */}
            <div className="p-3.5 rounded-xl bg-[rgba(0,0,0,0.25)] border border-white/[0.08] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[#94a3b8] shrink-0">
                <Gamepad2 className="w-4 h-4 text-purple-400" />
                <span>Game UID:</span>
              </div>
              <span className="font-mono font-bold text-blue-400 text-sm break-all select-all text-right">{submission.gameUid}</span>
            </div>

            {/* Status */}
            <div className="p-3.5 rounded-xl bg-[rgba(0,0,0,0.25)] border border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-[#94a3b8]">
                <Clock4 className="w-4 h-4 text-amber-400" />
                <span>Current Status:</span>
              </div>
              <span
                className={`px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  submission.status === 'Approved'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : submission.status === 'Rejected'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {submission.status}
              </span>
            </div>

            {/* Submission Date & Time */}
            <div className="p-3.5 rounded-xl bg-[rgba(0,0,0,0.25)] border border-white/[0.08] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-[#94a3b8]">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  <span>Submission Date:</span>
                </div>
                <span className="font-medium text-slate-200">{submission.submissionDate}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-[#94a3b8]">
                  <Clock className="w-3.5 h-3.5 text-purple-400" />
                  <span>Submission Time:</span>
                </div>
                <span className="font-medium text-slate-200">{submission.submissionTime}</span>
              </div>
            </div>

          </div>

          {/* Action Buttons: Only show Approve/Reject when Pending */}
          {submission.status === 'Pending' ? (
            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={() => {
                  onUpdateStatus(submission.id, 'Approved');
                  onClose();
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-emerald-950/40 active:scale-[0.98]"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Approve</span>
              </button>

              <button
                onClick={() => {
                  onUpdateStatus(submission.id, 'Rejected');
                  onClose();
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-rose-950/40 active:scale-[0.98]"
              >
                <XCircle className="w-4 h-4" />
                <span>Reject</span>
              </button>
            </div>
          ) : (
            <div className="pt-2 space-y-3">
              <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between text-xs">
                <span className="text-[#94a3b8]">Status Decision:</span>
                <span
                  className={`font-bold flex items-center gap-1.5 ${
                    submission.status === 'Approved' ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {submission.status === 'Approved' ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5" />
                  )}
                  {submission.status} (Locked / Final)
                </span>
              </div>

              <button
                onClick={onClose}
                className="w-full py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          )}

        </motion.div>
      </div>
    </AnimatePresence>
  );
};

