import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { UserSubmission } from '../../types.js';
import { useToast } from '../Toast.js';

interface StepOneFormProps {
  initialGameName?: string;
  initialGameUid?: string;
  onSuccess: (submission: UserSubmission) => void;
}

export const StepOneForm: React.FC<StepOneFormProps> = ({
  initialGameName = '',
  initialGameUid = '',
  onSuccess,
}) => {
  const { showToast } = useToast();
  const [gameName, setGameName] = useState(initialGameName);
  const [gameUid, setGameUid] = useState(initialGameUid);
  const [errors, setErrors] = useState<{ gameName?: string; gameUid?: string }>({});
  const [touched, setTouched] = useState<{ gameName?: boolean; gameUid?: boolean }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Sync state if initial props change (e.g. on reset or fresh session)
  useEffect(() => {
    setGameName(initialGameName);
    setGameUid(initialGameUid);
    setErrors({});
    setTouched({});
    setServerError(null);
  }, [initialGameName, initialGameUid]);

  // Synchronous ref to prevent double-submissions from rapid clicks or Enter presses
  const isSubmittingRef = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Guard against simultaneous or double submissions
    if (isSubmittingRef.current || isSubmitting) {
      return;
    }

    const cleanName = gameName.trim();
    const cleanUid = gameUid.trim();

    const newErrors: { gameName?: string; gameUid?: string } = {};

    if (!cleanName) {
      newErrors.gameName = 'দয়া করে আপনার গেম আইডির নাম লিখুন';
    }

    if (!cleanUid) {
      newErrors.gameUid = 'দয়া করে আপনার গেম UID লিখুন';
    } else if (!/^\d+$/.test(cleanUid)) {
      newErrors.gameUid = 'Game UID শুধুমাত্র সংখ্যা (0-9) হতে হবে';
    }

    setErrors(newErrors);
    setTouched({ gameName: true, gameUid: true });
    setServerError(null);

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    // Set synchronous lock
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameName: cleanName,
          gameUid: cleanUid,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success || !result.data) {
        const errorMsg = result.message || 'তথ্য জমা দিতে সমস্যা হয়েছে। আবার চেষ্টা করুন।';
        if (result.duplicateUid || response.status === 409 || errorMsg.includes('Game UID')) {
          setErrors((prev) => ({ ...prev, gameUid: errorMsg }));
          setTouched((prev) => ({ ...prev, gameUid: true }));
        }
        throw new Error(errorMsg);
      }

      showToast('আপনার তথ্য সফলভাবে সংরক্ষিত হয়েছে', 'success');
      onSuccess(result.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'তথ্য জমা দিতে সমস্যা হয়েছে। আবার চেষ্টা করুন।';
      setServerError(msg);
      showToast(msg, 'error');
      // Release lock so user can try again
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-[480px] mx-auto"
    >
      <div className="glass-card p-8 sm:p-10 text-white relative z-10">
        
        {/* Card Title */}
        <h2 className="text-center text-2xl sm:text-[26px] font-bold text-white mb-7 sm:mb-8 tracking-tight">
          আপনার তথ্য দিন
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* FIRST INPUT: Game ID Name */}
          <div className="space-y-2.5">
            <label
              htmlFor="game-name-input"
              className="block text-sm font-medium text-[#94a3b8]"
            >
              আপনার গেম আইডির নাম দিন
            </label>

            <input
              id="game-name-input"
              type="text"
              value={gameName}
              disabled={isSubmitting}
              onChange={(e) => {
                setGameName(e.target.value);
                if (errors.gameName) {
                  setErrors((prev) => ({ ...prev, gameName: undefined }));
                }
              }}
              onBlur={() => setTouched((prev) => ({ ...prev, gameName: true }))}
              placeholder="এখানে আপনার গেম আইডির নাম লিখুন"
              className={`glass-input ${
                errors.gameName && touched.gameName
                  ? 'border-rose-500/70 focus:border-rose-400 bg-rose-950/20'
                  : ''
              } ${isSubmitting ? 'opacity-60 cursor-not-allowed' : ''}`}
              autoComplete="off"
            />

            {errors.gameName && touched.gameName && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-1.5 text-xs text-rose-400 font-medium pt-0.5"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errors.gameName}</span>
              </motion.div>
            )}
          </div>

          {/* SECOND INPUT: Game UID */}
          <div className="space-y-2.5">
            <label
              htmlFor="game-uid-input"
              className="block text-sm font-medium text-[#94a3b8]"
            >
              আপনার গেম UID দিন
            </label>

            <input
              id="game-uid-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={gameUid}
              disabled={isSubmitting}
              onChange={(e) => {
                const numericOnly = e.target.value.replace(/\D/g, '');
                setGameUid(numericOnly);
                if (errors.gameUid) {
                  setErrors((prev) => ({ ...prev, gameUid: undefined }));
                }
                if (serverError) {
                  setServerError(null);
                }
              }}
              onBlur={() => setTouched((prev) => ({ ...prev, gameUid: true }))}
              placeholder="এখানে আপনার গেম UID লিখুন"
              className={`glass-input ${
                errors.gameUid && touched.gameUid
                  ? 'border-rose-500/70 focus:border-rose-400 bg-rose-950/20'
                  : ''
              } ${isSubmitting ? 'opacity-60 cursor-not-allowed' : ''}`}
              autoComplete="off"
            />

            {errors.gameUid && touched.gameUid && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-1.5 text-xs text-rose-400 font-medium pt-0.5"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errors.gameUid}</span>
              </motion.div>
            )}
          </div>

          {/* Server Error Alert */}
          {serverError && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-2 text-xs text-rose-300"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{serverError}</span>
            </motion.div>
          )}

          {/* NEXT BUTTON */}
          <div className="pt-2">
            <button
              type="submit"
              id="next-button"
              disabled={isSubmitting}
              className={`w-full h-14 gradient-btn flex items-center justify-center gap-2 text-lg font-semibold cursor-pointer active:scale-[0.99] ${
                isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>জমা হচ্ছে...</span>
                </>
              ) : (
                <>
                  <span>Next</span>
                  <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </motion.div>
  );
};

