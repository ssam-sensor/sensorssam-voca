'use client';

import React, { useState } from 'react';
import { useVocaStore } from '@/store/useVocaStore';
import { Wordbook, Word } from '@/types/database';
import { FlashcardStudy } from '@/components/student/FlashcardStudy';
import { QuizSuite } from '@/components/student/QuizSuite';
import { IncorrectNotesView } from '@/components/student/IncorrectNotesView';
import { WordbookFormModal } from '@/components/tutor/WordbookFormModal';
import {
  BookOpen,
  Sparkles,
  AlertCircle,
  UserCheck,
  Plus,
  Trash2,
  Lock,
  CheckSquare,
  Square,
  Users
} from 'lucide-react';

export const StudentDashboard: React.FC = () => {
  const {
    wordbooks,
    words,
    activeWordbookId,
    setActiveWordbookId,
    incorrectNotes,
    deleteWordbook,
    availableTutors,
    linkedTutorIds,
    toggleLinkedTutorId
  } = useVocaStore();

  const [activeTab, setActiveTab] = useState<'study' | 'quiz' | 'incorrect'>('study');
  const [customQuizWords, setCustomQuizWords] = useState<Word[] | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);

  const selectedWb = wordbooks.find(w => w.id === activeWordbookId) || wordbooks[0];
  const currentWords = words[selectedWb?.id] || [];

  const unresolvedWrongCount = incorrectNotes.filter(n => !n.is_resolved).length;

  const handleDeleteWordbook = async (wb: Wordbook, e: React.MouseEvent) => {
    e.stopPropagation();

    // Students CANNOT delete tutor-created wordbooks!
    if (!wb.is_student_created && wb.creator_role !== 'student') {
      alert('튜터가 배정한 단어장은 학생이 삭제할 수 없습니다.\n학생 본인이 새로 생성한 [개인 단어장]만 삭제 가능합니다.');
      return;
    }

    if (confirm(`'${wb.title} [${wb.chapter}]' 개인 단어장을 삭제하시겠습니까?`)) {
      await deleteWordbook(wb.id);
    }
  };

  // Handle custom quiz for wrong answers
  if (customQuizWords) {
    const dummyWb: Wordbook = {
      id: 'wb-custom-wrong',
      title: '오답 집중 재시험',
      chapter: 'REVIEW'
    };

    return (
      <QuizSuite
        wordbook={dummyWb}
        words={customQuizWords}
        onFinish={() => setCustomQuizWords(null)}
      />
    );
  }

  if (activeTab === 'quiz') {
    return (
      <QuizSuite
        wordbook={selectedWb}
        words={currentWords}
        onFinish={() => setActiveTab('study')}
      />
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-6xl mx-auto">
      
      {/* 1. Multi-Tutor Selection Panel (복수 튜터 연동 선택) */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-800">
                담당 튜터 복수 선택 & 배정 단어장 연동
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                체크한 튜터(교사)들의 단어장이 학생 학습 목록에 자동으로 합산됩니다. (다대다 N:M 연동)
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsFormModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>+ 학생 스스로 새 단어장 등록</span>
          </button>
        </div>

        {/* Tutor Checkboxes Carousel */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {availableTutors.length === 0 ? (
            <p className="text-xs text-slate-400 font-medium py-1 italic">
              현재 가입된 튜터 계정이 없습니다. (튜터로 회원가입 시 목록에 표시됩니다)
            </p>
          ) : (
            availableTutors.map((tutor) => {
              const isChecked = linkedTutorIds.includes(tutor.id);
              return (
                <button
                  key={tutor.id}
                  onClick={() => toggleLinkedTutorId(tutor.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    isChecked
                      ? 'bg-indigo-50 border-indigo-400 text-indigo-900 shadow-2xs ring-1 ring-indigo-300'
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {isChecked ? (
                    <CheckSquare className="w-4 h-4 text-indigo-600 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                  <span>{tutor.name}</span>
                  {tutor.title && (
                    <span className="text-[10px] font-normal text-slate-400 font-mono">({tutor.title})</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Top Banner & Selected Chapter Header */}
      {selectedWb ? (
        <div className="bg-white p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1.5 w-full sm:w-auto">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="inline-block px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] sm:text-xs font-bold">
                  학생 맞춤 어휘 학습
                </span>

                {/* Creator Badge */}
                {selectedWb.is_student_created ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] sm:text-xs font-bold">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    학생 개인 단어장
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 text-[11px] sm:text-xs font-bold">
                    <Lock className="w-3 h-3 text-indigo-600 shrink-0" />
                    {selectedWb.tutor_name || '튜터 배정'}
                  </span>
                )}
              </div>

              <h1 className="text-xl sm:text-3xl font-extrabold text-slate-800 tracking-tight leading-snug">
                {selectedWb.title} <span className="text-blue-600 font-mono">[{selectedWb.chapter}]</span>
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                총 {currentWords.length}개 단어 (스펠링 필수: {currentWords.filter(w=>w.is_spelling_priority).length}개)
              </p>
            </div>

            <div className="w-full sm:w-auto flex items-center gap-2">
              <button
                onClick={() => setActiveTab('quiz')}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all active:scale-95"
              >
                <Sparkles className="w-4 h-4" />
                <span>AI 테스트 치르기</span>
              </button>
            </div>
          </div>

          {/* Chapter Selection Carousel with Deletion Rules */}
          <div className="space-y-2 pt-3 sm:pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 block">
                배정 & 개인 단어장 목록 (총 {wordbooks.length}개)
              </label>
              <span className="text-[11px] text-slate-400 font-medium">
                * 개인 단어장 삭제 가능
              </span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              {wordbooks.map((wb) => {
                const isActive = wb.id === selectedWb.id;
                const isStudentCreated = Boolean(wb.is_student_created || wb.creator_role === 'student' || wb.tutor_name === '학생 (개인 단어장)');

                return (
                  <div
                    key={wb.id}
                    onClick={() => setActiveWordbookId(wb.id)}
                    className={`px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-3 border cursor-pointer ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs border-blue-600'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col items-start gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 shrink-0" />
                        <span>{wb.title.split(' ')[0]} {wb.chapter}</span>
                      </div>
                      <span className={`text-[10px] font-semibold ${isActive ? 'text-blue-100' : isStudentCreated ? 'text-emerald-700' : 'text-indigo-600'}`}>
                        {isStudentCreated ? '개인 단어장' : (wb.tutor_name || '튜터 배정')}
                      </span>
                    </div>

                    {/* Delete button (Only enabled for student-created wordbooks) */}
                    {isStudentCreated ? (
                      <button
                        onClick={(e) => handleDeleteWordbook(wb, e)}
                        className={`p-1 rounded-lg transition-colors ${
                          isActive ? 'text-blue-200 hover:text-white hover:bg-blue-700' : 'text-slate-400 hover:text-rose-600 hover:bg-slate-200'
                        }`}
                        title="개인 단어장 삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <span className="p-1 text-slate-300 cursor-not-allowed" title="튜터 등록 단어장 (삭제 불가)">
                        <Lock className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 text-slate-500 text-xs shadow-xs space-y-3">
          <p>선택된 튜터의 단어장이 없습니다. 상단에서 튜터를 선택하거나 스스로 단어장을 추가해보세요!</p>
          <button
            onClick={() => setIsFormModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>새 단어장 직접 추가하기</span>
          </button>
        </div>
      )}

      {/* Main Mode Sub-Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-2 sm:gap-6 text-xs font-bold">
        <button
          onClick={() => setActiveTab('study')}
          className={`flex-1 sm:flex-initial pb-3 border-b-2 flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 transition-colors ${
            activeTab === 'study'
              ? 'border-blue-600 text-blue-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4 shrink-0" />
          <span>플래시카드 학습</span>
        </button>

        <button
          onClick={() => setActiveTab('incorrect')}
          className={`flex-1 sm:flex-initial pb-3 border-b-2 flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 transition-colors relative ${
            activeTab === 'incorrect'
              ? 'border-rose-600 text-rose-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>오답 노트</span>
          {unresolvedWrongCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-extrabold">
              {unresolvedWrongCount}
            </span>
          )}
        </button>
      </div>

      {/* Content Area */}
      {activeTab === 'study' && (
        <FlashcardStudy
          words={currentWords}
          onBack={() => {}}
          onStartQuiz={() => setActiveTab('quiz')}
        />
      )}

      {activeTab === 'incorrect' && (
        <IncorrectNotesView
          onStartCustomQuiz={(wrongWords) => setCustomQuizWords(wrongWords)}
        />
      )}

      {/* Student Personal Wordbook Form Modal */}
      <WordbookFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
      />
    </div>
  );
};
