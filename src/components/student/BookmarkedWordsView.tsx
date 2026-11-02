'use client';

import React, { useState, useMemo } from 'react';
import { useVocaStore } from '@/store/useVocaStore';
import { speakText } from '@/lib/audio';
import { Word, Wordbook } from '@/types/database';
import {
  Bookmark,
  RotateCw,
  Sparkles,
  Volume2,
  Trash2,
  Search,
  BookOpen,
  Filter,
  CheckCircle2,
  ChevronRight,
  ExternalLink
} from 'lucide-react';

interface BookmarkedWordsViewProps {
  onStartFlashcards: (words: Word[]) => void;
  onStartQuiz: (words: Word[]) => void;
  onGoToStudy: () => void;
}

interface BookmarkedItem {
  word: Word;
  wordbook?: Wordbook;
}

export const BookmarkedWordsView: React.FC<BookmarkedWordsViewProps> = ({
  onStartFlashcards,
  onStartQuiz,
  onGoToStudy
}) => {
  const {
    bookmarkedWordIds,
    toggleBookmarkWord,
    clearBookmarkedWords,
    words: allWordsRecord,
    allWordbooks,
    wordbooks
  } = useVocaStore();

  const [selectedWbId, setSelectedWbId] = useState<string>('all');
  const [filterType, setFilterType] = useState<'all' | 'spelling' | 'idiom'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Map wordbooks by id
  const wbMap = useMemo(() => {
    const map = new Map<string, Wordbook>();
    [...allWordbooks, ...wordbooks].forEach(wb => {
      if (wb && wb.id) map.set(wb.id, wb);
    });
    return map;
  }, [allWordbooks, wordbooks]);

  // Flatten all words across all wordbooks
  const allWordsList = useMemo(() => {
    return Object.values(allWordsRecord).flat();
  }, [allWordsRecord]);

  // Distinct bookmarked words with wordbook metadata
  const bookmarkedItems: BookmarkedItem[] = useMemo(() => {
    const map = new Map<string, Word>();
    allWordsList.forEach(w => {
      if (bookmarkedWordIds.includes(w.id)) {
        map.set(w.id, w);
      }
    });
    return Array.from(map.values()).map(w => ({
      word: w,
      wordbook: wbMap.get(w.wordbook_id)
    }));
  }, [allWordsList, bookmarkedWordIds, wbMap]);

  // Unique wordbooks present among the bookmarked items
  const availableWbsInBookmarks = useMemo(() => {
    const ids = new Set(bookmarkedItems.map(item => item.word.wordbook_id));
    return Array.from(ids)
      .map(id => wbMap.get(id))
      .filter((wb): wb is Wordbook => Boolean(wb));
  }, [bookmarkedItems, wbMap]);

  // Filtered list
  const filteredItems = useMemo(() => {
    return bookmarkedItems.filter(item => {
      // 1. Wordbook Filter
      if (selectedWbId !== 'all' && item.word.wordbook_id !== selectedWbId) {
        return false;
      }
      // 2. Type Filter
      if (filterType === 'spelling' && !item.word.is_spelling_priority) return false;
      if (filterType === 'idiom' && !item.word.is_idiom) return false;

      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchWord = item.word.word.toLowerCase().includes(q);
        const matchMeaning = item.word.meaning.toLowerCase().includes(q);
        const matchPronun = (item.word.pronunciation || '').toLowerCase().includes(q);
        return matchWord || matchMeaning || matchPronun;
      }

      return true;
    });
  }, [bookmarkedItems, selectedWbId, filterType, searchQuery]);

  const targetWords = useMemo(() => filteredItems.map(i => i.word), [filteredItems]);

  const handleStartFlashcards = () => {
    if (targetWords.length === 0) return;
    onStartFlashcards(targetWords);
  };

  const handleStartQuiz = () => {
    if (targetWords.length === 0) return;
    onStartQuiz(targetWords);
  };

  const handleClearAllFiltered = () => {
    if (targetWords.length === 0) return;
    if (confirm(`현재 선택된 ${targetWords.length}개 단어를 '다시 볼 단어'에서 모두 체크 해제하시겠습니까?`)) {
      clearBookmarkedWords(targetWords.map(w => w.id));
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
    <div className="space-y-4 sm:space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                <Bookmark className="w-5 h-5 fill-amber-500 text-amber-600" />
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-800">
                다시 볼 단어장 (My Review Deck)
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              플래시카드를 넘기며 체크한 단어들을 모아 따로 플래시카드 복습을 하거나 맞춤 시험을 치를 수 있습니다.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleStartFlashcards}
              disabled={targetWords.length === 0}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs shadow-xs transition-all active:scale-95"
            >
              <RotateCw className="w-4 h-4" />
              <span>플래시카드로 공부 ({targetWords.length}개)</span>
            </button>

            <button
              onClick={handleStartQuiz}
              disabled={targetWords.length === 0}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 disabled:opacity-40 text-white font-bold text-xs shadow-xs transition-all active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-amber-200" />
              <span>맞춤 시험 보기 ({targetWords.length}개)</span>
            </button>
          </div>
        </div>

        {/* 2. Filter & Search Controls */}
        <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
          {/* Wordbook & Type Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Wordbook Chapter Selector */}
            <select
              value={selectedWbId}
              onChange={(e) => setSelectedWbId(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">전체 챕터 단어 ({bookmarkedItems.length}개)</option>
              {availableWbsInBookmarks.map(wb => {
                const count = bookmarkedItems.filter(i => i.word.wordbook_id === wb.id).length;
                return (
                  <option key={wb.id} value={wb.id}>
                    {wb.title} [{wb.chapter}] ({count}개)
                  </option>
                );
              })}
            </select>

            {/* Sub Type Filter */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                  filterType === 'all' ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                전체
              </button>
              <button
                onClick={() => setFilterType('spelling')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                  filterType === 'spelling' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                스펠링
              </button>
              <button
                onClick={() => setFilterType('idiom')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                  filterType === 'idiom' ? 'bg-purple-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                숙어
              </button>
            </div>
          </div>

          {/* Search Bar & Clear Action */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="단어 또는 뜻 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
              />
            </div>

            {targetWords.length > 0 && (
              <button
                onClick={handleClearAllFiltered}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 hover:border-rose-200 font-bold text-xs transition-colors shrink-0"
                title="선택된 단어 일괄 체크 해제"
              >
                일괄 해제
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Word Cards Grid */}
      {filteredItems.length === 0 ? (
        <div className="p-12 sm:p-16 text-center rounded-3xl bg-white border border-dashed border-slate-300 text-slate-500 text-xs space-y-4 shadow-xs">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-2xs">
            <Bookmark className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-extrabold text-slate-800">
              {bookmarkedItems.length === 0 ? '체크된 다시 볼 단어가 없습니다' : '조건에 맞는 단어가 없습니다'}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {bookmarkedItems.length === 0
                ? '플래시카드 학습 중에 카드의 [다시 보기 🔖] 버튼(단축키 B)을 누르면 이곳에 모여 언제든지 따로 집중 복습할 수 있습니다.'
                : '검색어나 선택된 챕터 필터를 변경해보세요.'}
            </p>
          </div>
          {bookmarkedItems.length === 0 && (
            <button
              onClick={onGoToStudy}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95"
            >
              <BookOpen className="w-4 h-4" />
              <span>플래시카드 학습하러 가기</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
          {filteredItems.map(({ word, wordbook }) => (
            <div
              key={word.id}
              className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 hover:border-amber-300 hover:shadow-md transition-all space-y-3 relative group"
            >
              {/* Card Header: Chapter badge, POS, Priority tags, Actions */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {wordbook && (
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold font-mono">
                      {wordbook.title.split(' ')[0]} [{wordbook.chapter}]
                    </span>
                  )}
                  {word.pos && (
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getPosBadgeStyle(word.pos)}`}>
                      {word.pos}
                    </span>
                  )}
                  {word.is_spelling_priority && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                      스펠링 필수
                    </span>
                  )}
                  {word.is_idiom && (
                    <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold">
                      숙어
                    </span>
                  )}
                </div>

                {/* Top Action Buttons (TTS, Uncheck) */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => speakText(word.word, 1.0)}
                    className="p-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 text-blue-600 border border-slate-200 transition-colors"
                    title="발음 듣기"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => toggleBookmarkWord(word.id)}
                    className="flex items-center gap-1 px-2 py-1 rounded-xl bg-amber-50 hover:bg-rose-50 text-amber-700 hover:text-rose-600 border border-amber-200 hover:border-rose-200 transition-colors text-[11px] font-bold"
                    title="다시 볼 단어에서 제거"
                  >
                    <Bookmark className="w-3.5 h-3.5 fill-amber-500 text-amber-600" />
                    <span>체크 해제</span>
                  </button>
                </div>
              </div>

              {/* Word & Meaning */}
              <div className="space-y-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    {word.word}
                  </h3>
                  {word.pronunciation && (
                    <span className="text-slate-400 font-mono text-xs">
                      [{word.pronunciation}]
                    </span>
                  )}
                </div>

                <p className="text-base sm:text-lg font-bold text-blue-700 leading-snug">
                  {word.meaning}
                </p>
              </div>

              {/* Example sentence if exists */}
              {word.example_sentence && (
                <div className="pt-2 border-t border-slate-100 bg-slate-50/70 p-2.5 rounded-xl border text-xs space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-slate-700 font-medium italic leading-relaxed">
                      &quot;{word.example_sentence}&quot;
                    </p>
                    <button
                      onClick={() => speakText(word.example_sentence!, 1.0)}
                      className="p-1 rounded-lg bg-white text-blue-600 hover:bg-blue-50 border border-slate-200 shrink-0 transition-colors"
                      title="예문 발음 듣기"
                    >
                      <Volume2 className="w-3 h-3" />
                    </button>
                  </div>
                  {word.example_translation && (
                    <p className="text-slate-500 font-normal">
                      ↳ {word.example_translation}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
