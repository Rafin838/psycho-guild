import React from 'react';
import { User } from 'lucide-react';

interface HeaderProps {
  onOpenAdminLogin: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenAdminLogin,
}) => {
  return (
    <header className="w-full sticky top-0 z-40 backdrop-blur-xl bg-[#05070a]/80 border-b border-white/[0.08] transition-all duration-300">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
        
        {/* Brand Logo - Sleek Interface Style */}
        <div className="flex items-center gap-2.5 sm:gap-3 text-left select-none">
          <span className="text-lg sm:text-2xl font-extrabold tracking-[1.5px] sm:tracking-[2px] gradient-text">
            GUILD SYSTEM
          </span>
        </div>

        {/* Right Action: Admin Login Icon Button Only */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onOpenAdminLogin}
            id="admin-login-button"
            className="admin-icon-btn group"
            title="Admin Login"
            aria-label="Admin Login"
          >
            <User className="w-5 h-5 text-slate-200 group-hover:text-blue-400 transition-colors" />
          </button>
        </div>

      </div>
    </header>
  );
};

