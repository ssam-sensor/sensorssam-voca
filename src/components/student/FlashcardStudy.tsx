'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Word } from '@/types/database';
import { speakText } from '@/lib/audio';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { Volume2, Eye, EyeOff, RotateCw, Play, Pause, ChevronLeft, ChevronRight, Sparkles, Gauge } from 'lucide-react';

interface FlashcardStudyProps {
  words: Word[];
  onBack: () => void;
  onStartQuiz: () => void;
}

export const FlashcardStudy: React.FC<FlashcardStudyProps> = ({ words, onBack, onStartQuiz }) => {
  // Track active study duration with 3-min idle threshold
  useStudyTimer(true);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Initial mount ref to prevent TTS audio auto-play on first screen load
  const isInitialMount = useRef(true);

  // Filters & Visibility
  const [filterMode, setFilterMode] = useState<'all' | 'spelling' | 'idiom'>('all');
  const [hideWord, setHideWord] = useState(false);
  const [hideMeaning, setHideMeaning] = useState(false);

  // TTS Speech Speed: 'normal' (1.0x) vs 'slow' (0.75x)
  const [speechSpeed, setSpeechSpeed] = useState<'normal' | 'slow'>('normal');

  // Auto Play
  const [isAutoplay, setIsAutoplay] = useState(false);
  const [autoplaySpeed, setAutoplaySpeed] = useState(3); // seconds

  // Filtered words list
  const filteredWords = words.filter(w => {
    if (filterMode === 'spelling') return w.is_spelling_priority;
    if (filterMode === 'idiom') return w.is_idiom;
    return true;
  });

  const currentWord = filteredWords[currentIndex] || filteredWords[0];
  const ttsRate = speechSpeed === 'normal' ? 1.0 : 0.75;

  // Auto speech on word change (skips initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      setIsFlipped(false);
      return;
    }

    if (currentWord && !hideWord) {
      speakText(currentWord.word, ttsRate);
    }
    setIsFlipped(false);
  }, [currentIndex, filterMode, speechSpeed]);

  // Autoplay Effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isAutoplay && filteredWords.length > 0) {
      timer = setInterval(() => {
        setIsFlipped(prev => !prev);
        if (isFlipped) {
          setCurrentIndex(prev => (prev + 1) % filteredWords.length);
        }
      }, autoplaySpeed * 1000);
    }
    return () => clearInterval(timer);
  }, [isAutoplay, isFlipped, autoplaySpeed, filteredWords.length]);

  if (!currentWord || filteredWords.length === 0) {
    return (
      <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 text-slate-500 space-y-4 shadow-sm">
        <p>선택한 조건에 맞는 단어가 없습니다.</p>
        <button
          onClick={() => setFilterMode('all')}
          className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-sm"
        >
          전체 단어 보기
        </button>
      </div>
    );
  }

  const handleNext = () => {
    if (currentIndex < filteredWords.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    } else {
      setCurrentIndex(filteredWords.length - 1);
    }
  };

  // Helper for POS chip styles
  const getPosBadgeStyle = (posStr?: string | null) => {
    const pos = (posStr || '').toLowerCase();
    if (pos.includes('명사')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (pos.includes('동사')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (pos.includes('형용사')) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (pos.includes('숙어')) return 'bg-purple-50 text-purple-700 border-purple-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
      {/* Top Bar Navigation & Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between sm:justify-start gap-2">
          <button
            onClick={onBack}
            className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 font-bold shrink-0"
          >
            <ChevronLeft className="w-4 h-4" /> 챕터 목록
          </button>

          <button
            onClick={onStartQuiz}
            className="sm:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>시험 시작</span>
          </button>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs overflow-x-auto scrollbar-none">
          <button
            onClick={() => { setFilterMode('all'); setCurrentIndex(0); }}
            className={`px-2.5 py-1 rounded-lg font-bold transition-colors shrink-0 ${
              filterMode === 'all' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            전체 ({words.length})
          </button>
          <button
            onClick={() => { setFilterMode('spelling'); setCurrentIndex(0); }}
            className={`px-2.5 py-1 rounded-lg font-bold transition-colors shrink-0 ${
              filterMode === 'spelling' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            스펠링 ({words.filter(w=>w.is_spelling_priority).length})
          </button>
          <button
            onClick={() => { setFilterMode('idiom'); setCurrentIndex(0); }}
            className={`px-2.5 py-1 rounded-lg font-bold transition-colors shrink-0 ${
              filterMode === 'idiom' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            숙어 ({words.filter(w=>w.is_idiom).length})
          </button>
        </div>

        <button
          onClick={onStartQuiz}
          className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all active:scale-95 shrink-0"
        >
          <Sparkles className="w-4 h-4" />
          <span>시험 시작하기</span>
        </button>
      </div>

      {/* Visibility Toggles, Speech Speed Control & Autoplay */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 text-xs bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-around sm:justify-start gap-4 py-0.5">
          <button
            onClick={() => setHideWord(!hideWord)}
            className={`flex items-center gap-1.5 font-bold transition-colors ${
              hideWord ? 'text-amber-700' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {hideWord ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span>단어 가리기</span>
          </button>

          <button
            onClick={() => setHideMeaning(!hideMeaning)}
            className={`flex items-center gap-1.5 font-bold transition-colors ${
              hideMeaning ? 'text-amber-700' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {hideMeaning ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span>뜻 가리기</span>
          </button>
        </div>

        {/* Speed Control Pill & Autoplay */}
        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
          {/* TTS Speed Toggle (보통 1.0x vs 느리게 0.75x) */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px]">
            <button
              onClick={() => setSpeechSpeed('normal')}
              className={`px-2 py-1 rounded-md font-bold transition-colors flex items-center gap-1 ${
                speechSpeed === 'normal' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Volume2 className="w-3 h-3" /> 1.0x
            </button>
            <button
              onClick={() => setSpeechSpeed('slow')}
              className={`px-2 py-1 rounded-md font-bold transition-colors flex items-center gap-1 ${
                speechSpeed === 'slow' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Gauge className="w-3 h-3" /> 0.75x
            </button>
          </div>

          <button
            onClick={() => setIsAutoplay(!isAutoplay)}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg border font-bold transition-colors ${
              isAutoplay ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-600'
            }`}
          >
            {isAutoplay ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>자동 ({autoplaySpeed}초)</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Flashcard (3D Flip Effect) */}
      <div className="perspective-1000 min-h-[320px] sm:min-h-[380px] flex items-center justify-center">
        <div
          onClick={() => setIsFlipped(!isFlipped)}
          className={`w-full min-h-[320px] sm:min-h-[380px] p-5 sm:p-8 rounded-3xl border cursor-pointer transition-all duration-500 transform-style-3d relative flex flex-col justify-between shadow-md select-none ${
            isFlipped
              ? 'bg-gradient-to-br from-white via-blue-50/40 to-white border-blue-200 shadow-blue-500/10'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-slate-200/50'
          }`}
        >
          {/* Card Top Indicator */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-mono font-bold">
                {currentIndex + 1} / {filteredWords.length}
              </span>
              {currentWord.is_spelling_priority && (
                <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] sm:text-[11px] font-bold">
                  Part 1 필수
                </span>
              )}
              {currentWord.is_idiom && (
                <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[10px] sm:text-[11px] font-bold">
                  숙어
                </span>
              )}
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                speakText(currentWord.word, ttsRate);
              }}
              className="flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100 text-blue-600 hover:bg-slate-200 transition-colors text-xs font-bold border border-slate-200"
              title={`발음 듣기 (${speechSpeed === 'normal' ? '1.0x' : '0.75x'})`}
            >
              <Volume2 className="w-4 h-4" />
              <span>{speechSpeed === 'normal' ? '1.0x' : '0.75x'}</span>
            </button>
          </div>

          {/* Card Middle: Main Word & Meaning & Expanded Examples */}
          <div className="py-6 sm:py-8 text-center space-y-3 sm:space-y-4">
            {!isFlipped ? (
              // FRONT SIDE
              <div className="space-y-2 sm:space-y-3">
                <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-800 break-words">
                  {hideWord ? '••••••••' : currentWord.word}
                </h2>
                {currentWord.pronunciation && !hideWord && (
                  <p className="text-slate-500 font-mono text-sm sm:text-base">
                    [{currentWord.pronunciation}]
                  </p>
                )}
                {currentWord.pos && (
                  <span className={`inline-block px-3 py-0.5 sm:py-1 rounded-full text-xs font-bold border ${getPosBadgeStyle(currentWord.pos)}`}>
                    {currentWord.pos}
                  </span>
                )}
                <p className="text-[11px] sm:text-xs text-slate-400 pt-2 animate-pulse font-medium">
                  (카드 터치시 뜻 & 예문 확인)
                </p>
              </div>
            ) : (
              // BACK SIDE (Flipped) - Enlarge Font Size for High Readability
              <div className="space-y-3 sm:space-y-5 animate-in fade-in zoom-in-95 duration-200">
                <span className={`inline-block px-3 py-0.5 sm:py-1 rounded-full text-xs font-bold border ${getPosBadgeStyle(currentWord.pos)}`}>
                  {currentWord.pos || '뜻'}
                </span>
                <h3 className="text-2xl sm:text-4xl font-extrabold text-blue-700 tracking-tight leading-snug break-words">
                  {hideMeaning ? '••••••••' : currentWord.meaning}
                </h3>

                {currentWord.example_sentence && (
                  <div className="pt-3 sm:pt-5 border-t border-slate-200 text-left max-w-2xl mx-auto space-y-1.5 sm:space-y-2 bg-slate-50 p-3.5 sm:p-5 rounded-2xl border border-slate-200 text-xs sm:text-base">
                    <p className="text-sm sm:text-xl font-bold text-slate-800 leading-relaxed italic">
                      &quot;{currentWord.example_sentence}&quot;
                    </p>
                    {currentWord.example_translation && (
                      <p className="text-xs sm:text-base font-medium text-slate-700 leading-relaxed pt-1.5 border-t border-slate-200/60">
                        {currentWord.example_translation}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Card Bottom Indicator */}
          <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-200 pt-3 sm:pt-4 font-medium">
            <span>{isFlipped ? '뒷면 (뜻 & 예문)' : '앞면 (단어)'}</span>
            <span className="flex items-center gap-1 text-slate-500 font-bold">
              <RotateCw className="w-3.5 h-3.5 text-blue-600" /> 터치하여 뒤집기
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between gap-3 sm:gap-4">
        <button
          onClick={handlePrev}
          className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-3.5 sm:py-3 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors shadow-xs active:scale-95 min-h-[48px]"
        >
          <ChevronLeft className="w-4 h-4" /> 이전 단어
        </button>

        <button
          onClick={handleNext}
          className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-3.5 sm:py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-sm active:scale-95 min-h-[48px]"
        >
          다음 단어 <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
