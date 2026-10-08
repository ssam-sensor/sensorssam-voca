'use client';

import React, { useState } from 'react';
import { useVocaStore } from '@/store/useVocaStore';
import { StudentReportModal } from '@/components/tutor/StudentReportModal';
import { Users, Award, BookOpen, AlertTriangle, FileSpreadsheet, UserCheck, ChevronRight } from 'lucide-react';

export const StudentManager: React.FC = () => {
  const { quizResults, incorrectNotes } = useVocaStore();

  const [isReportOpen, setIsReportOpen] = useState(false);
  const [selectedStudentName, setSelectedStudentName] = useState('김학생 (student_01)');

  const totalQuizzesTaken = quizResults.length;
  const averageScorePct = totalQuizzesTaken > 0
    ? Math.round(
        quizResults.reduce((acc, q) => acc + (q.total_score / (q.max_score || 1)) * 100, 0) / totalQuizzesTaken
      )
    : 0;

  const unresolvedWrongCount = incorrectNotes.filter(n => !n.is_resolved).length;

  return (
    <div className="space-y-6">
      {/* Student Profile Card & Report Launch Banner */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center font-bold">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-slate-800">{selectedStudentName}</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                담당 학생
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              1:1 맞춤 Voca 튜터링 관리 중 | 최근 활동: {quizResults.length > 0 ? new Date(quizResults[0].created_at).toLocaleDateString('ko-KR') : '응시 내역 없음'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsReportOpen(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all active:scale-95 shrink-0"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>종합 학습 평가 보고서 보기</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Student Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">평균 시험 정답률</p>
            <h3 className="text-2xl font-extrabold text-slate-800">{averageScorePct}%</h3>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">응시한 총 시험 횟수</p>
            <h3 className="text-2xl font-extrabold text-slate-800">{totalQuizzesTaken}회</h3>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">학생 미해결 오답 단어</p>
            <h3 className="text-2xl font-extrabold text-rose-700">{unresolvedWrongCount}개</h3>
          </div>
        </div>
      </div>

      {/* Roster & Quiz Log */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-800">학생 시험 제출 내역 및 오답 현황</h3>
          </div>
        </div>

        {quizResults.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            아직 제출된 학생 시험 기록이 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {quizResults.map((result) => {
              const scorePct = Math.round((result.total_score / (result.max_score || 1)) * 100);
              return (
                <div key={result.id} className="p-4 sm:px-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-800">
                        {result.wordbook_title || '단어장'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-xs font-mono font-bold">
                        {result.wordbook_chapter || 'Chapter'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      응시일: {new Date(result.created_at).toLocaleString('ko-KR')}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-lg font-extrabold text-slate-800">
                        {result.total_score} <span className="text-slate-400 text-xs font-normal">/ {result.max_score}</span>
                      </span>
                      <div className="text-[11px] font-bold text-emerald-700">
                        {scorePct}% 정답
                      </div>
                    </div>

                    <button
                      onClick={() => setIsReportOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                      <span>보고서</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Student Comprehensive Evaluation Report Modal */}
      <StudentReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        studentName={selectedStudentName}
      />
    </div>
  );
};

