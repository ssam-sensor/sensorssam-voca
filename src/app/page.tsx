'use client';

import React, { useEffect, useState } from 'react';
import { useVocaStore } from '@/store/useVocaStore';
import { Navbar } from '@/components/Navbar';
import { WordbookList } from '@/components/tutor/WordbookList';
import { StudentManager } from '@/components/tutor/StudentManager';
import { StudentDashboard } from '@/components/student/StudentDashboard';
import { RoleSelectModal } from '@/components/RoleSelectModal';
import { Layers, Users, GraduationCap, Loader2, BookOpen } from 'lucide-react';

export default function Home() {
  const { userRole, loadInitialData, isLoading, isVerifiedWithInviteCode } = useVocaStore();
  const [tutorTab, setTutorTab] = useState<'wordbooks' | 'students'>('wordbooks');

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-xs text-slate-500 font-mono font-bold">SensorSsam Voca 로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col selection:bg-blue-500 selection:text-white">
      <Navbar />

      {/* Invite Code Verification Modal for initial / unverified users */}
      <RoleSelectModal isOpen={!isVerifiedWithInviteCode} />

      {/* Protected Main Workspace View */}
      {isVerifiedWithInviteCode ? (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          
          {/* Role Banner / Switcher Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl border ${
                userRole === 'tutor'
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`}>
                {userRole === 'tutor' ? <GraduationCap className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-slate-800">
                    {userRole === 'tutor' ? '튜터 (교사/학부모) 모드' : '학생 (학습/시험) 모드'}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    userRole === 'tutor' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    ACTIVE
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  {userRole === 'tutor'
                    ? '단어장 챕터 등록, AI 이미지/PDF 교재 추출, 시험지 인쇄 및 학생 성적 관리를 담당합니다.'
                    : '등록된 챕터를 플래시카드로 학습하고 AI 맞춤 시험을 진행합니다.'}
                </p>
              </div>
            </div>

            {/* Tutor Mode Sub-Tabs */}
            {userRole === 'tutor' && (
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                <button
                  onClick={() => setTutorTab('wordbooks')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-colors ${
                    tutorTab === 'wordbooks'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>단어장 관리</span>
                </button>

                <button
                  onClick={() => setTutorTab('students')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-colors ${
                    tutorTab === 'students'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>학생 & 시험 현황</span>
                </button>
              </div>
            )}
          </div>

          {/* Main Workspace View */}
          {userRole === 'tutor' ? (
            tutorTab === 'wordbooks' ? <WordbookList /> : <StudentManager />
          ) : (
            <StudentDashboard />
          )}

        </main>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <p className="text-sm font-semibold text-slate-500">
            초대 코드를 입력하여 회원 가입 및 본인 인증을 진행해 주세요.
          </p>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500 font-medium">
        <p>SensorSsam Voca - AI-Powered Vocabulary Tutor</p>
        <p className="mt-1 text-[11px] text-slate-400">Supports Supabase DB, Google OAuth & Gemini 3.8 Flash Multimodal OCR</p>
      </footer>
    </div>
  );
}

