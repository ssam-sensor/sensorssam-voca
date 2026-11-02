'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Word } from '@/types/database';
import { speakText } from '@/lib/audio';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { useVocaStore } from '@/store/useVocaStore';
import {
  Volume2,
  Eye,
  EyeOff,
  RotateCw,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Gauge,
  Bookmark
} from 'lucide-react';

interface FlashcardStudyProps {
  words: Word[];
  wordbookId?: string;
  customTitle?: string;
  initialFilterMode?: 'all' | 'bookmarked' | 'spelling' | 'idiom';
  onBack: () => void;
  onStartQuiz: (customWords?: Word[]) => void;
}

export const FlashcardStudy: React.FC<FlashcardStudyProps> = ({
  words,
  wordbookId,
  customTitle,
  initialFilterMode = 'all',
  onBack,
  onStartQuiz
}) => {
  const activeWbId = wordbookId || words[0]?.wordbook_id;
  // Track active study duration with 3-min idle threshold and record wordbook activity
  useStudyTimer(true, activeWbId);

  const {
    bookmarkedWordIds,
    toggleBookmarkWord,
    clearBookmarkedWords,
    words: allWordsRecord
  } = useVocaStore();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Initial mount ref to prevent TTS audio auto-play on first screen load
  const isInitialMount = useRef(true);

  // Filters & Visibility
  const [filterMode, setFilterMode] = useState<'all' | 'bookmarked' | 'spelling' | 'idiom'>(initialFilterMode);
  const [bookmarkScope, setBookmarkScope] = useState<'chapter' | 'all'>('chapter');
  const [hideWord, setHideWord] = useState(false);
  const [hideMeaning, setHideMeaning] = useState(false);

  // TTS Speech Speed: 'normal' (1.0x) vs 'slow' (0.75x)
  const [speechSpeed, setSpeechSpeed] = useState<'normal' | 'slow'>('normal');

  // Auto Play
  const [isAutoplay, setIsAutoplay] = useState(false);
  const [autoplaySpeed, setAutoplaySpeed] = useState(3); // seconds

  // All words across all loaded wordbooks
  const allWordsList = useMemo(() => Object.values(allWordsRecord).flat(), [allWordsRecord]);

  // Current chapter bookmarked words
  const chapterBookmarkedWords = useMemo(() => {
    return words.filter(w => bookmarkedWordIds.includes(w.id));
  }, [words, bookmarkedWordIds]);

  // All chapters bookmarked words
  const allBookmarkedWords = useMemo(() => {
    const map = new Map<string, Word>();
    allWordsList.forEach(w => {
      if (bookmarkedWordIds.includes(w.id)) {
        map.set(w.id, w);
      }
    });
    // Also include words from current props that might be bookmarked
    words.forEach(w => {
      if (bookmarkedWordIds.includes(w.id)) {
        map.set(w.id, w);
      }
    });
    return Array.from(map.values());
  }, [allWordsList, words, bookmarkedWordIds]);

  const activeBookmarkedWords = bookmarkScope === 'all' ? allBookmarkedWords : chapterBookmarkedWords;

  // Filtered words list
  const filteredWords = useMemo(() => {
    if (filterMode === 'bookmarked') {
      return activeBookmarkedWords;
    }
    if (filterMode === 'spelling') return words.filter(w => w.is_spelling_priority);
    if (filterMode === 'idiom') return words.filter(w => w.is_idiom);
    return words;
  }, [filterMode, words, activeBookmarkedWords]);

  // Ensure currentIndex stays within bounds when filteredWords shrinks
  useEffect(() => {
    if (currentIndex >= filteredWords.length && filteredWords.length > 0) {
      setCurrentIndex(filteredWords.length - 1);
    }
  }, [filteredWords.length, currentIndex]);

  const currentWord = filteredWords[currentIndex] || filteredWords[0];
  const isCurrentBookmarked = currentWord ? bookmarkedWordIds.includes(currentWord.id) : false;
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
  }, [currentIndex, filterMode, bookmarkScope, speechSpeed]);

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
      setCurrentIndex(Math.max(0, filteredWords.length - 1));
    }
  };

  // Keyboard Navigation: ← 이전, → 다음, Space 뒤집기, B 다시 볼 단어 체크, V 발음
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsFlipped(prev => !prev);
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        if (currentWord) {
          toggleBookmarkWord(currentWord.id);
        }
      } else if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        if (currentWord) {
          speakText(currentWord.word, ttsRate);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, filteredWords.length, currentWord, ttsRate]);

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
            className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 font-bold shrink-0 py-1"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{customTitle || '챕터 목록'}</span>
          </button>

          <button
            onClick={() => onStartQuiz(filterMode === 'bookmarked' ? filteredWords : undefined)}
            className="sm:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{filterMode === 'bookmarked' ? '체크 단어 시험' : '시험 시작'}</span>
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
            onClick={() => { setFilterMode('bookmarked'); setCurrentIndex(0); }}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all shrink-0 flex items-center gap-1 ${
              filterMode === 'bookmarked'
                ? 'bg-amber-600 text-white shadow-xs'
                : chapterBookmarkedWords.length > 0
                  ? 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300/70'
                  : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bookmark className={`w-3.5 h-3.5 ${filterMode === 'bookmarked' || chapterBookmarkedWords.length > 0 ? 'fill-current' : ''}`} />
            <span>다시 볼 단어 ({chapterBookmarkedWords.length})</span>
          </button>

          <button
            onClick={() => { setFilterMode('spelling'); setCurrentIndex(0); }}
            className={`px-2.5 py-1 rounded-lg font-bold transition-colors shrink-0 ${
              filterMode === 'spelling' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
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
          onClick={() => onStartQuiz(filterMode === 'bookmarked' ? filteredWords : undefined)}
          className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all active:scale-95 shrink-0"
        >
          <Sparkles className="w-4 h-4" />
          <span>{filterMode === 'bookmarked' ? `체크 단어 시험 (${filteredWords.length}개)` : '시험 시작하기'}</span>
        </button>
      </div>

      {/* Bookmarked Dedicated Sub-bar (when in bookmarked mode) */}
      {filterMode === 'bookmarked' && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-amber-50/90 p-3 sm:p-3.5 rounded-2xl border border-amber-200 text-xs shadow-2xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-extrabold text-amber-900 flex items-center gap-1.5">
              <Bookmark className="w-4 h-4 fill-amber-600 text-amber-600" />
              다시 볼 단어 집중 공부
            </span>

            {/* Scope toggle: Current Chapter vs All Chapters */}
            <div className="flex items-center bg-white/90 p-0.5 rounded-lg border border-amber-300 text-[11px]">
              <button
                onClick={() => { setBookmarkScope('chapter'); setCurrentIndex(0); }}
                className={`px-2.5 py-0.5 rounded-md font-bold transition-colors ${
                  bookmarkScope === 'chapter' ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                현재 챕터 ({chapterBookmarkedWords.length})
              </button>
              <button
                onClick={() => { setBookmarkScope('all'); setCurrentIndex(0); }}
                className={`px-2.5 py-0.5 rounded-md font-bold transition-colors ${
                  bookmarkScope === 'all' ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                전체 챕터 ({allBookmarkedWords.length})
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => {
                if (activeBookmarkedWords.length === 0) return;
                if (confirm(`현재 화면에 표시된 체크 단어 ${activeBookmarkedWords.length}개의 체크를 모두 해제하시겠습니까?`)) {
                  clearBookmarkedWords(activeBookmarkedWords.map(w => w.id));
                }
              }}
              disabled={activeBookmarkedWords.length === 0}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-amber-200 hover:border-rose-200 font-bold text-[11px] transition-colors disabled:opacity-40"
            >
              체크 일괄 해제
            </button>

            <button
              onClick={() => onStartQuiz(activeBookmarkedWords)}
              disabled={activeBookmarkedWords.length === 0}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] shadow-xs transition-colors disabled:opacity-40"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>체크 단어 시험 ({activeBookmarkedWords.length}개)</span>
            </button>
          </div>
        </div>
      )}

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

      {/* Empty State when no words match */}
      {!currentWord || filteredWords.length === 0 ? (
        filterMode === 'bookmarked' ? (
          <div className="p-10 sm:p-14 text-center rounded-3xl bg-white border border-slate-200 text-slate-500 space-y-4 shadow-xs">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-2xs">
              <Bookmark className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-800">
                {bookmarkScope === 'chapter' ? '이 챕터에 체크된 단어가 없습니다' : '체크된 단어가 없습니다'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                플래시카드를 넘기며 다시 보고 싶은 단어의 <span className="font-bold text-amber-700">[다시 보기 🔖]</span> 버튼(단축키: B)을 눌러보세요.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {bookmarkScope === 'chapter' && allBookmarkedWords.length > 0 && (
                <button
                  onClick={() => setBookmarkScope('all')}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-colors"
                >
                  전체 챕터 체크 단어 보기 ({allBookmarkedWords.length}개)
                </button>
              )}
              <button
                onClick={() => setFilterMode('all')}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors"
              >
                전체 단어 보기 ({words.length}개)
              </button>
            </div>
          </div>
        ) : (
          <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 text-slate-500 space-y-4 shadow-sm">
            <p>선택한 조건에 맞는 단어가 없습니다.</p>
            <button
              onClick={() => setFilterMode('all')}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-sm"
            >
              전체 단어 보기
            </button>
          </div>
        )
      ) : (
        <>
          {/* Main Interactive Flashcard (3D Flip Effect) */}
          <div className="perspective-1000 min-h-[320px] sm:min-h-[380px] flex items-center justify-center">
            <div
              onClick={() => setIsFlipped(!isFlipped)}
              className={`w-full min-h-[320px] sm:min-h-[380px] p-5 sm:p-8 rounded-3xl border cursor-pointer transition-all duration-500 transform-style-3d relative flex flex-col justify-between shadow-md select-none ${
                isCurrentBookmarked ? 'ring-2 ring-amber-400/80 ' : ''
              } ${
                isFlipped
                  ? 'bg-gradient-to-br from-white via-blue-50/40 to-white border-blue-200 shadow-blue-500/10'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-slate-200/50'
              }`}
            >
              {/* Card Top Indicator */}
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-mono font-bold">
                    {currentIndex + 1} / {filteredWords.length}
                  </span>

                  {isCurrentBookmarked && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 text-[10px] sm:text-[11px] font-bold animate-in fade-in">
                      <Bookmark className="w-3 h-3 fill-amber-600 text-amber-600" />
                      다시 볼 단어
                    </span>
                  )}

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

                <div className="flex items-center gap-1.5 sm:gap-2">
                  {/* Bookmark / Review Again Toggle Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleBookmarkWord(currentWord.id);
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      isCurrentBookmarked
                        ? 'bg-amber-100 text-amber-800 border-amber-300 ring-2 ring-amber-300/70 shadow-xs'
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200'
                    }`}
                    title={isCurrentBookmarked ? '다시 볼 단어에서 제거 (단축키: B)' : '다시 볼 단어로 체크 (단축키: B)'}
                  >
                    <Bookmark className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isCurrentBookmarked ? 'fill-amber-600 text-amber-600' : 'text-slate-400'}`} />
                    <span className="hidden xs:inline">{isCurrentBookmarked ? '체크됨' : '다시 보기'}</span>
                    <span className="xs:hidden">{isCurrentBookmarked ? '체크' : '다시'}</span>
                  </button>

                  {/* TTS Speech Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      speakText(currentWord.word, ttsRate);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100 text-blue-600 hover:bg-slate-200 transition-colors text-xs font-bold border border-slate-200"
                    title={`발음 듣기 (${speechSpeed === 'normal' ? '1.0x' : '0.75x'}) (단축키: V)`}
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>{speechSpeed === 'normal' ? '1.0x' : '0.75x'}</span>
                  </button>
                </div>
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
                      <div className="pt-3 sm:pt-4 border-t border-slate-200 text-left max-w-2xl mx-auto bg-slate-50 p-3.5 sm:p-5 rounded-2xl border border-slate-200 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm sm:text-lg font-bold text-slate-800 leading-relaxed italic">
                            &quot;{(() => {
                              const sentence = currentWord.example_sentence;
                              const target = currentWord.word.trim();
                              if (!sentence || !target) return sentence;
                              const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                              const regex = new RegExp(`(\\b${escaped}\\w*|${escaped})`, 'gi');
                              const parts = sentence.split(regex);
                              return parts.map((part, i) =>
                                part.toLowerCase().startsWith(target.toLowerCase()) ? (
                                  <span key={i} className="text-blue-600 font-extrabold underline decoration-blue-300 underline-offset-4">
                                    {part}
                                  </span>
                                ) : (
                                  part
                                )
                              );
                            })()}&quot;
                          </p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              speakText(currentWord.example_sentence!, ttsRate);
                            }}
                            className="p-1.5 rounded-xl bg-white text-blue-600 hover:bg-blue-50 border border-slate-200 shadow-2xs shrink-0 transition-colors"
                            title="예문 발음 듣기"
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>
                        </div>
                        {currentWord.example_translation && (
                          <p className="text-xs sm:text-sm font-medium text-slate-600 leading-relaxed pt-1.5 border-t border-slate-200/60">
                            ↳ {currentWord.example_translation}
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
                <div className="flex items-center gap-3">
                  <span className="hidden sm:inline text-[11px] text-slate-400">
                    단축키: ← 이전 | → 다음 | Space 뒤집기 | B 체크 | V 발음
                  </span>
                  <span className="flex items-center gap-1 text-slate-500 font-bold">
                    <RotateCw className="w-3.5 h-3.5 text-blue-600" /> 터치하여 뒤집기
                  </span>
                </div>
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
        </>
      )}
    </div>
  );
};
