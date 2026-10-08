'use client';

import React, { useState } from 'react';
import { useVocaStore } from '@/store/useVocaStore';
import { SettingsModal } from '@/components/SettingsModal';
import { BookOpen, User, GraduationCap, Settings, LogIn, Sparkles, ShieldCheck } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { userRole, setUserRole, userEmail, settings, signInWithGoogle, signOutUser } = useVocaStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const isGuest = !userEmail || userEmail === 'guest@sensorssam.com';

  const handleAuthToggle = async () => {
    if (!isGuest) {
      if (confirm('로그아웃 하시겠습니까?')) {
        await signOutUser();
      }
    } else {
      await signInWithGoogle();
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md text-slate-800 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-extrabold text-sm sm:text-lg tracking-tight text-slate-800">
                  SensorSsam Voca
                </span>
                <span className="hidden xs:inline-block text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                  1:1 AI Voca
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block font-medium">
                AI-Powered Vocabulary Tutor
              </p>
            </div>
          </div>

          {/* Center: Role Switcher Pill (Compact on Mobile) */}
          <div className="flex items-center bg-slate-100 p-0.5 sm:p-1 rounded-xl border border-slate-200 shadow-inner">
            <button
              onClick={() => setUserRole('tutor')}
              className={`flex items-center gap-1 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                userRole === 'tutor'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/60'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="hidden sm:inline">튜터 (교사/학부모)</span>
              <span className="sm:hidden">튜터</span>
            </button>

            <button
              onClick={() => setUserRole('student')}
              className={`flex items-center gap-1 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                userRole === 'student'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/60'
              }`}
            >
              <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="hidden sm:inline">학생 (학습/시험)</span>
              <span className="sm:hidden">학생</span>
            </button>
          </div>

          {/* Right: Settings & Google Auth */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* AI Key Status Indicator */}
            {settings.isCustomGeminiConnected && (
              <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                <Sparkles className="w-3 h-3 text-amber-600" />
                Gemini AI
              </span>
            )}

            {/* Settings Button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors relative group shadow-xs"
              title="BYO Settings (Gemini & Supabase)"
            >
              <Settings className="w-4 h-4 group-hover:rotate-45 transition-transform duration-300" />
              {!settings.isCustomSupabaseConnected && !settings.isCustomGeminiConnected && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-600 animate-ping" />
              )}
            </button>

            {/* Google OAuth Simulation Button */}
            <button
              onClick={handleAuthToggle}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-800 transition-colors shadow-xs"
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span className="hidden md:inline">{!isGuest ? userEmail.split('@')[0] : '구글 로그인'}</span>
              {!isGuest ? (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              ) : (
                <LogIn className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              )}
            </button>
          </div>
        </div>
      </header>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
};
