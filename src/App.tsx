import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Header } from './components/Header.js';
import { BackgroundEffects } from './components/BackgroundEffects.js';
import { ToastProvider, useToast } from './components/Toast.js';
import { StepOneForm } from './components/UserFlow/StepOneForm.js';
import { StepTwoMessengerGuild } from './components/UserFlow/StepTwoMessengerGuild.js';
import { AdminLoginModal } from './components/Admin/AdminLoginModal.js';
import { AdminDashboard } from './components/Admin/AdminDashboard.js';
import { SpotifyMusicPlayer } from './components/SpotifyMusicPlayer.js';
import { SpotifyPlayerProvider } from './context/SpotifyPlayerContext.js';
import { AdminUser, UserSubmission } from './types.js';

interface SessionSubmissionData {
  id: string;
  clientToken: string;
}

const PERSISTENT_SUBMISSION_SESSION_KEY = 'guild_user_active_submission_session';
const LEGACY_SESSION_STORAGE_KEY = 'guild_user_active_session_sub';
const ADMIN_TOKEN_KEY = 'guild_admin_jwt_token';

const AppContent: React.FC = () => {
  const { showToast } = useToast();
  const [currentView, setCurrentView] = useState<'user' | 'admin'>('user');
  const [userStep, setUserStep] = useState<1 | 2>(1);
  const [gameName, setGameName] = useState<string>('');
  const [gameUid, setGameUid] = useState<string>('');
  const [submittedRecord, setSubmittedRecord] = useState<UserSubmission | null>(null);
  const [isEditingDraft, setIsEditingDraft] = useState<boolean>(false);
  const [flowKey, setFlowKey] = useState<number>(() => Date.now());

  // Admin Auth State (Verified against server)
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isAdminLoginModalOpen, setIsAdminLoginModalOpen] = useState<boolean>(false);

  // Ref to track modal open state synchronously for popstate handlers
  const isLoginModalOpenRef = useRef(isAdminLoginModalOpen);
  isLoginModalOpenRef.current = isAdminLoginModalOpen;

  // 1. Restore current user's submission on page refresh or browser restart from persistent storage
  useEffect(() => {
    try {
      const rawSession =
        localStorage.getItem(PERSISTENT_SUBMISSION_SESSION_KEY) ||
        sessionStorage.getItem(PERSISTENT_SUBMISSION_SESSION_KEY) ||
        sessionStorage.getItem(LEGACY_SESSION_STORAGE_KEY);

      if (!rawSession) {
        // Fresh session: clean slate
        return;
      }

      const sessionData: SessionSubmissionData = JSON.parse(rawSession);
      if (!sessionData || !sessionData.id || !sessionData.clientToken) {
        localStorage.removeItem(PERSISTENT_SUBMISSION_SESSION_KEY);
        sessionStorage.removeItem(PERSISTENT_SUBMISSION_SESSION_KEY);
        sessionStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
        return;
      }

      fetch(`/api/submissions/${encodeURIComponent(sessionData.id)}`, {
        headers: {
          'X-Submission-Token': sessionData.clientToken,
        },
      })
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error('Unauthorized or expired session');
        })
        .then((data) => {
          if (data.success && data.data) {
            setSubmittedRecord({
              ...data.data,
              clientToken: sessionData.clientToken,
            });
            setGameName(data.data.gameName);
            setGameUid(data.data.gameUid);
            setUserStep(2);

            // Synchronize persistent session identifiers
            localStorage.setItem(PERSISTENT_SUBMISSION_SESSION_KEY, JSON.stringify(sessionData));
            sessionStorage.setItem(PERSISTENT_SUBMISSION_SESSION_KEY, JSON.stringify(sessionData));

            if (window.location.hash !== '#admin-dashboard' && window.location.hash !== '#admin-login') {
              window.history.replaceState({ view: 'user', step: 2, modal: null }, '', '#status');
            }
          } else {
            localStorage.removeItem(PERSISTENT_SUBMISSION_SESSION_KEY);
            sessionStorage.removeItem(PERSISTENT_SUBMISSION_SESSION_KEY);
            sessionStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
          }
        })
        .catch(() => {
          localStorage.removeItem(PERSISTENT_SUBMISSION_SESSION_KEY);
          sessionStorage.removeItem(PERSISTENT_SUBMISSION_SESSION_KEY);
          sessionStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
        });
    } catch {
      localStorage.removeItem(PERSISTENT_SUBMISSION_SESSION_KEY);
      sessionStorage.removeItem(PERSISTENT_SUBMISSION_SESSION_KEY);
      sessionStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
    }
  }, []);

  // 2. Validate and Restore Admin Session on Mount
  useEffect(() => {
    const storedToken =
      sessionStorage.getItem(ADMIN_TOKEN_KEY) ||
      localStorage.getItem(ADMIN_TOKEN_KEY) ||
      localStorage.getItem('guild_admin_token'); // clean legacy key

    const isDashboardHash = window.location.hash === '#admin-dashboard';
    const isLoginHash = window.location.hash === '#admin-login';

    if (storedToken) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${storedToken}` },
      })
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error('Session invalid');
        })
        .then((data) => {
          if (data.success && data.user) {
            setAdminToken(storedToken);
            setAdminUser(data.user);
            sessionStorage.setItem(ADMIN_TOKEN_KEY, storedToken);

            if (isDashboardHash) {
              setCurrentView('admin');
            }
          } else {
            throw new Error('Invalid user payload');
          }
        })
        .catch(() => {
          // Clear invalid/stale tokens
          localStorage.removeItem(ADMIN_TOKEN_KEY);
          sessionStorage.removeItem(ADMIN_TOKEN_KEY);
          localStorage.removeItem('guild_admin_token');
          setAdminToken(null);
          setAdminUser(null);
          if (isDashboardHash) {
            window.history.replaceState({ view: 'user', step: 1, modal: null }, '', window.location.pathname);
            setIsAdminLoginModalOpen(true);
          }
        });
    } else if (isDashboardHash) {
      // Direct unauthenticated navigation to #admin-dashboard -> redirect to user portal + open login
      window.history.replaceState({ view: 'user', step: 1, modal: null }, '', window.location.pathname);
      setIsAdminLoginModalOpen(true);
    } else if (isLoginHash) {
      setIsAdminLoginModalOpen(true);
    }
  }, []);

  // 3. Handle Browser Back / Forward navigation (popstate)
  useEffect(() => {
    if (!window.history.state) {
      window.history.replaceState({ view: 'user', step: 1, modal: null }, '', window.location.pathname);
    }

    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      const currentHash = window.location.hash;

      if (currentHash === '#admin-login' || (state && state.modal === 'admin-login')) {
        setIsAdminLoginModalOpen(true);
      } else {
        setIsAdminLoginModalOpen(false);
      }

      if (currentHash === '#admin-dashboard' || (state && state.view === 'admin')) {
        if (adminToken && adminUser) {
          setCurrentView('admin');
        } else {
          setCurrentView('user');
          setIsAdminLoginModalOpen(true);
        }
      } else {
        setCurrentView('user');
        if (currentHash === '#status' || currentHash === '#step-2' || (state && state.step === 2)) {
          setUserStep(2);
        } else {
          setUserStep(1);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [adminToken, adminUser]);

  // Open Admin Login modal - Always opens login screen
  const handleOpenAdminLogin = useCallback(() => {
    window.history.pushState(
      { view: currentView, step: userStep, modal: 'admin-login' },
      '',
      '#admin-login'
    );
    setIsAdminLoginModalOpen(true);
  }, [currentView, userStep]);

  // Close Admin Login modal
  const handleCloseAdminLoginModal = useCallback(() => {
    setIsAdminLoginModalOpen(false);
    if (window.location.hash === '#admin-login') {
      window.history.back();
    }
  }, []);

  // Successful Login
  const handleAdminLoginSuccess = (token: string, user: AdminUser) => {
    setAdminToken(token);
    setAdminUser(user);
    sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    setIsAdminLoginModalOpen(false);

    window.history.pushState({ view: 'admin', step: userStep, modal: null }, '', '#admin-dashboard');
    setCurrentView('admin');
  };

  // Logout Admin
  const handleLogout = () => {
    setAdminToken(null);
    setAdminUser(null);
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem('guild_admin_token');
    sessionStorage.removeItem('guild_admin_token');

    setCurrentView('user');
    window.history.replaceState({ view: 'user', step: userStep, modal: null }, '', window.location.pathname);
    showToast('Admin logged out successfully', 'info');
  };

  // Step 1 -> Step 2 upon successful submission
  const handleStepOneSuccess = (submission: UserSubmission) => {
    if (submission.clientToken) {
      const sessionData: SessionSubmissionData = {
        id: submission.id,
        clientToken: submission.clientToken,
      };
      localStorage.setItem(PERSISTENT_SUBMISSION_SESSION_KEY, JSON.stringify(sessionData));
      sessionStorage.setItem(PERSISTENT_SUBMISSION_SESSION_KEY, JSON.stringify(sessionData));
    }

    setSubmittedRecord(submission);
    setGameName(submission.gameName);
    setGameUid(submission.gameUid);
    setIsEditingDraft(false);
    setUserStep(2);
    window.history.pushState({ view: 'user', step: 2, modal: null }, '', '#status');
  };

  // Live status update callback from Step 2
  const handleUpdateSubmission = (updated: UserSubmission) => {
    setSubmittedRecord((prev) => ({
      ...updated,
      clientToken: prev?.clientToken || updated.clientToken,
    }));
    setGameName(updated.gameName);
    setGameUid(updated.gameUid);
  };

  // Step 2 -> Back to Step 1 to edit in-flight info
  const handleStepTwoBack = () => {
    setIsEditingDraft(true);
    setUserStep(1);
    if (window.location.hash === '#status' || window.location.hash === '#step-2') {
      window.history.back();
    } else {
      window.history.pushState({ view: 'user', step: 1, modal: null }, '', window.location.pathname);
    }
  };

  // Reset user flow for a new user / fresh submission
  const handleResetUserFlow = () => {
    localStorage.removeItem(PERSISTENT_SUBMISSION_SESSION_KEY);
    sessionStorage.removeItem(PERSISTENT_SUBMISSION_SESSION_KEY);
    sessionStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
    setSubmittedRecord(null);
    setGameName('');
    setGameUid('');
    setIsEditingDraft(false);
    setUserStep(1);
    setFlowKey(Date.now());
    window.history.pushState({ view: 'user', step: 1, modal: null }, '', window.location.pathname);
  };

  return (
    <div className="relative min-h-screen flex flex-col font-sans selection:bg-blue-500/30 selection:text-blue-200">
      {/* Background Atmosphere */}
      <BackgroundEffects />

      {/* Public User Navigation Header (with Admin Login icon button) */}
      {currentView === 'user' && (
        <Header onOpenAdminLogin={handleOpenAdminLogin} />
      )}

      {/* Main Content Container */}
      <main
        className={`flex-1 flex flex-col w-full max-w-full overflow-x-hidden ${
          currentView === 'user' ? 'justify-center px-2 sm:px-4 py-4 sm:py-12 items-center' : 'p-0'
        }`}
      >
        <AnimatePresence mode="wait">
          {currentView === 'user' ? (
            <motion.div
              key={`user-view-${userStep}-${flowKey}`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="w-full flex flex-col items-center"
            >
              {userStep === 1 ? (
                <StepOneForm
                  key={`step-1-${flowKey}`}
                  initialGameName={isEditingDraft ? gameName : ''}
                  initialGameUid={isEditingDraft ? gameUid : ''}
                  onSuccess={handleStepOneSuccess}
                />
              ) : (
                <StepTwoMessengerGuild
                  submission={submittedRecord}
                  gameName={gameName}
                  gameUid={gameUid}
                  onBack={handleStepTwoBack}
                  onReset={handleResetUserFlow}
                  onUpdateSubmission={handleUpdateSubmission}
                />
              )}
            </motion.div>
          ) : (
            <motion.div
              key="admin-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="w-full flex-1"
            >
              {adminToken && adminUser ? (
                <AdminDashboard
                  adminToken={adminToken}
                  adminUser={adminUser}
                  onLogout={handleLogout}
                />
              ) : (
                <div className="text-center py-20">
                  <p className="text-slate-400">Admin authorization required.</p>
                  <button
                    onClick={handleOpenAdminLogin}
                    className="mt-4 px-6 py-2.5 rounded-xl gradient-btn text-sm font-semibold cursor-pointer"
                  >
                    Open Login
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 text-center text-xs text-[#64748b] border-t border-white/[0.05] bg-[#05070a]/60 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="font-semibold tracking-[1px] text-slate-400">
            GUILD SYSTEM &copy; {new Date().getFullYear()}
          </div>
          <div className="text-[11px] text-[#64748b]">
            Free Fire Community & Verification Portal
          </div>
        </div>
      </footer>

      {/* Admin Login Modal */}
      <AdminLoginModal
        isOpen={isAdminLoginModalOpen}
        onClose={handleCloseAdminLoginModal}
        onLoginSuccess={handleAdminLoginSuccess}
      />

      {/* Global Spotify Background Music Player */}
      <SpotifyMusicPlayer />
    </div>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <SpotifyPlayerProvider>
        <AppContent />
      </SpotifyPlayerProvider>
    </ToastProvider>
  );
}
