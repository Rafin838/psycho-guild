import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { UserSubmission } from '../../types.js';

interface DeleteConfirmModalProps {
  submission: UserSubmission | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: (id: string) => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  submission,
  isOpen,
  onClose,
  onConfirmDelete,
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
          className="relative w-full max-w-sm glass-card p-6 text-white space-y-5 text-center z-10"
        >
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 mb-1">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-bold text-white">Delete Submission?</h3>
            <p className="text-xs text-[#94a3b8]">
              Are you sure you want to permanently delete the submission for{' '}
              <strong className="text-white font-semibold">{submission.gameName}</strong> (UID:{' '}
              <span className="font-mono text-blue-400">{submission.gameUid}</span>)? This action cannot be undone.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              onClick={() => {
                onConfirmDelete(submission.id);
                onClose();
              }}
              id="confirm-delete-submission-btn"
              className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-rose-950/40"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </button>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
};

