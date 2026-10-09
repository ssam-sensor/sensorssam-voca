'use client';

import React, { useState } from 'react';
import { useVocaStore } from '@/store/useVocaStore';
import { UserRole } from '@/types/database';
import { KeyRound, ShieldCheck, GraduationCap, User, AlertCircle, LogOut, ArrowRight, LogIn, UserPlus } from 'lucide-react';

interface RoleSelectModalProps {
  isOpen: boolean;
}

export const RoleSelectModal: React.FC<RoleSelectModalProps> = ({ isOpen }) => {
  const { verifyInviteCode, signOutUser, userRole, signInWithGoogle } = useVocaStore();

  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [selectedRole, setSelectedRole] = useState<UserRole>(userRole || 'student');
  const [nickname, setNickname] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!nickname.trim()) {
      setErrorMsg('화면에 표시할 별명/닉네임을 입력해 주세요.');
      return;
    }

    if (!inviteCode.trim()) {
      setErrorMsg('올바른 초대 코드가 아닙니다. 센서쌤에게 가입 코드를 확인하세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await verifyInviteCode(inviteCode, selectedRole, nickname);
      if (!res.success) {
        setErrorMsg(res.error || '올바른 초대 코드가 아닙니다. 센서쌤에게 가입 코드를 확인하세요.');
        setIsSubmitting(false);
        return;
      }

      // Check if active Google OAuth session exists
      const currentEmail = useVocaStore.getState().userEmail;
      if (!currentEmail) {
        // Trigger Google OAuth sign-in to complete registration and store profile in DB!
        await signInWithGoogle();
      }
    } catch (err: any) {
      setErrorMsg(err.message || '인증 처리 중 오류가 발생했습니다.');
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setErrorMsg(err.message || '구글 로그인 시도 중 오류가 발생했습니다.');
    }
  };

  const handleSignOut = async () => {
    if (confirm('구글 로그인 세션을 정리하시겠습니까?')) {
      await signOutUser();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden text-slate-800">
        
        {/* Top Mode Selector Tabs */}
        <div className="flex border-b border-slate-100 bg-slate-100/70 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => { setAuthMode('signin'); setErrorMsg(null); }}
            className={`flex-1 py-2.5 rounded-2xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
              authMode === 'signin'
                ? 'bg-white text-blue-700 shadow-sm border border-slate-200/80'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>기존 회원 로그인</span>
          </button>

          <button
            type="button"
            onClick={() => { setAuthMode('signup'); setErrorMsg(null); }}
            className={`flex-1 py-2.5 rounded-2xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
              authMode === 'signup'
                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/80'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>신규 회원가입 (초대코드)</span>
          </button>
        </div>

        {/* Mode 1: Sign In (Instant Google Auth, NO invite code required) */}
        {authMode === 'signin' ? (
          <div className="p-6 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-sm">
                <LogIn className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-extrabold text-slate-800">
                센서쌤 어휘 회원 로그인
              </h2>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                이미 가입한 회원은 가입 코드 입력 없이 구글 계정으로 즉시 바로 로그인할 수 있습니다.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12.24 10.285V13.4h6.887c-.58 2.319-2.733 4.05-5.32 4.05-3.327 0-6.023-2.696-6.023-6.023s2.696-6.023 6.023-6.023c1.472 0 2.812.533 3.847 1.413l2.404-2.404C18.57 2.973 15.58 2 12.24 2 6.586 2 2 6.586 2 12.24s4.586 10.24 10.24 10.24c5.856 0 10.027-4.116 10.027-10.027 0-.693-.075-1.373-.207-2.023H12.24z" />
                </svg>
                <span>Google 계정으로 바로 로그인</span>
              </button>
            </div>

            <div className="border-t border-slate-100 pt-4 text-center">
              <button
                type="button"
                onClick={() => { setAuthMode('signup'); setErrorMsg(null); }}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                아직 가입 전이신가요? 신규 회원가입 진행하기 (초대 코드) &rarr;
              </button>
            </div>
          </div>
        ) : (
          /* Mode 2: Sign Up (Requires Invite Code & Role Selection) */
          <form onSubmit={handleSignUpSubmit} className="p-6 space-y-5">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-sm">
                <KeyRound className="w-6 h-6" />
              </div>
              <h2 className="text-sm font-extrabold text-slate-800">
                신규 회원가입 & 초대 코드 인증
              </h2>
              <p className="text-[11px] text-slate-500">
                최초 1회 센서쌤 초대 코드를 입력하여 튜터/학생 역할을 등록합니다.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* 1. Role Selection Radio Pills */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                1. 회원 역할 선택 (튜터 / 학생)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedRole('tutor')}
                  className={`p-3.5 rounded-2xl border text-left font-bold text-xs transition-all flex flex-col justify-between gap-2 ${
                    selectedRole === 'tutor'
                      ? 'bg-blue-50 border-blue-600 text-blue-900 shadow-xs ring-1 ring-blue-600'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-blue-600" />
                    <span>튜터 (교사/학부모)</span>
                  </div>
                  <span className="text-[10px] font-normal text-slate-500">단어장 등록 & 성적 관리</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedRole('student')}
                  className={`p-3.5 rounded-2xl border text-left font-bold text-xs transition-all flex flex-col justify-between gap-2 ${
                    selectedRole === 'student'
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-900 shadow-xs ring-1 ring-emerald-600'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-emerald-600" />
                    <span>학생 (학습/시험)</span>
                  </div>
                  <span className="text-[10px] font-normal text-slate-500">플래시카드 & 스마트 AI 테스트</span>
                </button>
              </div>
            </div>

            {/* 2. Nickname Input */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                2. 별명 / 닉네임 (화면 표기용 이름) <span className="text-indigo-600">*</span>
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder={selectedRole === 'tutor' ? '예: 센서쌤, 박선생 튜터' : '예: 김철수'}
                className="w-full px-4 py-3 rounded-xl bg-white border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 text-slate-800 placeholder-slate-400 font-bold"
              />
              <p className="text-[11px] text-slate-500">
                * 이메일 대신 단어장 및 튜터 목록에 표시될 이름입니다.
              </p>
            </div>

            {/* 3. Invite Code Input */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                3. 가입용 초대 코드 (비밀 패스코드) <span className="text-blue-600">*</span>
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={inviteCode}
                  onChange={(e) => {
                    setInviteCode(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="초대 코드 입력"
                  className="w-full px-4 py-3 rounded-xl bg-white border border-slate-300 text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-slate-800 placeholder-slate-400 font-bold"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                * 센서쌤에게 전달받은 가입 코드를 입력하세요.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 space-y-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>확인 및 회원가입 진행</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => { setAuthMode('signin'); setErrorMsg(null); }}
                className="w-full py-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              >
                &larr; 이미 가입하셨나요? 로그인 화면으로 돌아가기
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
