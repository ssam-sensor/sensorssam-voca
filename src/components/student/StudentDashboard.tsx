'use client';

import React, { useState } from 'react';
import { useVocaStore } from '@/store/useVocaStore';
import { Wordbook, Word } from '@/types/database';
import { FlashcardStudy } from '@/components/student/FlashcardStudy';
import { QuizSuite } from '@/components/student/QuizSuite';
import { IncorrectNotesView } from '@/components/student/IncorrectNotesView';
import { BookOpen, Sparkles, AlertCircle, UserCheck } from 'lucide-react';

export const StudentDashboard: React.FC = () => {
  const { wordbooks, words, activeWordbookId, setActiveWordbookId, quizResults, incorrectNotes } = useVocaStore();

  const [activeTab, setActiveTab] = useState<'study' | 'quiz' | 'incorrect'>('study');
  const [customQuizWords, setCustomQuizWords] = useState<Word[] | null>(null);

  const selectedWb = wordbooks.find(w => w.id === activeWordbookId) || wordbooks[0];
  const currentWords = words[selectedWb?.id] || [];

  const unresolvedWrongCount = incorrectNotes.filter(n => !n.is_resolved).length;

  if (!selectedWb) {
    return (
      <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 text-slate-500 text-xs shadow-xs">
        등록된 단어장이 없습니다. 튜터 모드에서 단어장을 생성해주세요.
      </div>
    );
  }

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
      {/* Top Banner & Chapter Selector */}
      <div className="bg-white p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1.5 w-full sm:w-auto">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="inline-block px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] sm:text-xs font-bold">
                학생 학습 & 스마트 테스트
              </span>

              {/* N:M Tutor Attribution Badge */}
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] sm:text-xs font-bold">
                <UserCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                담당: {selectedWb.tutor_name || 'SensorSsam'}
              </span>
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

        {/* Chapter Selection Carousel with N:M Tutor Badges */}
        <div className="space-y-2 pt-3 sm:pt-4 border-t border-slate-100">
          <label className="text-xs font-bold text-slate-700 block">
            담당 튜터별 배정 단어장 (N:M 다대다 연동)
          </label>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {wordbooks.map((wb) => {
              const isActive = wb.id === selectedWb.id;
              return (
                <button
                  key={wb.id}
                  onClick={() => setActiveWordbookId(wb.id)}
                  className={`px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs font-bold shrink-0 transition-all flex flex-col items-start gap-0.5 sm:gap-1 border ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs border-blue-600'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 shrink-0" />
                    <span>{wb.title.split(' ')[0]} {wb.chapter}</span>
                  </div>
                  <span className={`text-[10px] font-semibold ${isActive ? 'text-blue-100' : 'text-indigo-600'}`}>
                    담당: {wb.tutor_name || 'SensorSsam'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

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
    </div>
  );
};
