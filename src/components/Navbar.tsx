'use client';

import React, { useState } from 'react';
import { useVocaStore } from '@/store/useVocaStore';
import { BookOpen, User, GraduationCap, LogIn, ShieldCheck, Edit3, X, Check } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { accountRole, userRole, setUserRole, userEmail, userName, updateProfileName, signInWithGoogle, signOutUser } = useVocaStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputName, setInputName] = useState(userName || '');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  const isLoggedIn = Boolean(userEmail);

  const handleAuthToggle = async () => {
    if (isLoggedIn) {
      if (confirm('로그아웃 하시겠습니까?')) {
        await signOutUser();
      }
    } else {
      await signInWithGoogle();
    }
  };

  const handleOpenNicknameModal = () => {
    setInputName(userName || '');
    setIsModalOpen(true);
  };

  const handleSaveNickname = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = inputName.trim();
    if (!val) {
      alert('별명(닉네임)을 입력해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      await updateProfileName(val);
      setIsModalOpen(false);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (err) {
      console.error('Failed to save nickname:', err);
      alert('별명 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md text-slate-800 shadow-xs">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-1.5 sm:gap-3">
        
        {/* Logo & Brand */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <div className="p-1.5 sm:p-2.5 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 shrink-0">
            <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            {/* Mobile 2-line layout */}
            <div className="sm:hidden flex flex-col leading-none">
              <span className="font-extrabold text-[10px] text-slate-800 tracking-tight">SensorSsam</span>
              <span className="font-black text-[9px] text-blue-600 tracking-wider uppercase mt-0.5">VOCA</span>
            </div>
            {/* Desktop 1-line layout */}
            <div className="hidden sm:flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight text-slate-800">
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

        {/* Center: Role Switcher Pill with Student Access Restriction */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shadow-inner shrink-0">
          <button
            onClick={() => {
              if (accountRole === 'student' && isLoggedIn) {
                alert('학생 전용 계정은 튜터 관리 화면에 진입할 수 없습니다.');
                return;
              }
              setUserRole('tutor');
            }}
            className={`flex items-center gap-1 px-2 sm:px-3.5 py-1 sm:py-1.5 rounded-lg text-xs font-bold transition-all ${
              userRole === 'tutor'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/60'
            }`}
            title={userRole === 'student' ? '학생 계정은 튜터 화면 접근 불가' : '튜터 모드로 전환'}
          >
            <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="hidden sm:inline">튜터 모드</span>
            <span className="sm:hidden">튜터</span>
          </button>

          <button
            onClick={() => setUserRole('student')}
            className={`flex items-center gap-1 px-2 sm:px-3.5 py-1 sm:py-1.5 rounded-lg text-xs font-bold transition-all ${
              userRole === 'student'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/60'
            }`}
          >
            <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="hidden sm:inline">학생 모드</span>
            <span className="sm:hidden">학생</span>
          </button>
        </div>

        {/* Right: Google OAuth Button & Role Badge */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {isLoggedIn && (
            <button
              onClick={handleOpenNicknameModal}
              className="flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl border border-blue-200 shadow-2xs transition-colors"
              title="별명(닉네임) 수정"
            >
              <Edit3 className="w-3.5 h-3.5 text-blue-600" />
              <span>{userName ? `별명: ${userName}` : '[별명 수정]'}</span>
            </button>
          )}

          <button
            onClick={handleAuthToggle}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-800 transition-colors shadow-xs shrink-0 max-w-[140px] sm:max-w-none"
            title={isLoggedIn ? (userName ? `${userName} (별명)` : '구글 로그인 회원') : '구글 로그인'}
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
            <span className="hidden sm:inline font-bold truncate">
              {isLoggedIn ? (userName || '로그인 됨') : '구글 로그인'}
            </span>
            <span className="sm:hidden font-bold truncate max-w-[60px]">
              {isLoggedIn ? (userName || '로그인') : '로그인'}
            </span>
            {isLoggedIn ? (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            ) : (
              <LogIn className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            )}
          </button>
        </div>
      </div>

      {/* Nickname Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-blue-600" />
                <span>별명(닉네임) 설정 & 저장</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              튜터 및 학생 목록, 단어장에서 노출될 별명을 입력해 주세요.<br />
              <span className="text-blue-600 font-bold">* 이메일 주소는 타인에게 일절 노출되지 않습니다.</span>
            </p>

            <form onSubmit={handleSaveNickname} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  새 별명 입력
                </label>
                <input
                  type="text"
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  placeholder="예: 센서쌤, 열공학생, EnglishMaster"
                  maxLength={20}
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSaving ? '저장 중...' : '별명 저장하기'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {showSuccessToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-lg text-xs font-bold flex items-center gap-2 animate-in slide-in-from-bottom-5 duration-200">
          <Check className="w-4 h-4 text-emerald-200" />
          <span>별명이 성공적으로 저장되어 반영되었습니다!</span>
        </div>
      )}
    </header>
  );
};
