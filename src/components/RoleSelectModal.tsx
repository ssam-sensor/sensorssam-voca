'use client';

import React, { useState } from 'react';
import { useVocaStore } from '@/store/useVocaStore';
import { UserRole } from '@/types/database';
import { KeyRound, ShieldCheck, GraduationCap, User, AlertCircle, LogOut, ArrowRight, Sparkles } from 'lucide-react';

interface RoleSelectModalProps {
  isOpen: boolean;
}

export const RoleSelectModal: React.FC<RoleSelectModalProps> = ({ isOpen }) => {
  const { verifyInviteCode, signOutUser, userRole } = useVocaStore();

  const [selectedRole, setSelectedRole] = useState<UserRole>(userRole || 'student');
  const [inviteCode, setInviteCode] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!inviteCode.trim()) {
      setErrorMsg('올바른 초대 코드가 아닙니다. 센서쌤에게 가입 코드를 확인하세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await verifyInviteCode(inviteCode, selectedRole);
      if (!res.success) {
        setErrorMsg(res.error || '올바른 초대 코드가 아닙니다. 센서쌤에게 가입 코드를 확인하세요.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || '인증 처리 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    if (confirm('구글 로그인 세션을 정리하고 가입 인증을 취소하시겠습니까?')) {
      await signOutUser();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden text-slate-800">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/80 text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-sm">
            <KeyRound className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center justify-center gap-1.5">
              <span className="font-extrabold text-lg text-slate-800">SensorSsam Voca</span>
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                가입 인증
              </span>
            </div>
            <h2 className="text-sm font-bold text-slate-700 mt-1">
              센서쌤에게 전달받은 초대 코드를 입력해 주세요.
            </h2>
          </div>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* Warning Error Toast/Callout */}
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

          {/* 2. Invite Code Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 block">
              2. 가입용 초대 코드 (비밀 패스코드) <span className="text-blue-600">*</span>
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
              * 외부 무단 가입 방지를 위해 전용 초대 코드가 필요합니다.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 space-y-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>확인 및 시작하기</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              className="w-full py-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>구글 세션 정리 / 나가기</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
