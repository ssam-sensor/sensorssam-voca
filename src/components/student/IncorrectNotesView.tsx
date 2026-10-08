'use client';

import React, { useState } from 'react';
import { useVocaStore } from '@/store/useVocaStore';
import { speakText } from '@/lib/audio';
import { AlertCircle, CheckCircle2, RotateCw, Volume2, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { Word } from '@/types/database';

interface IncorrectNotesViewProps {
  onStartCustomQuiz: (words: Word[]) => void;
}

export const IncorrectNotesView: React.FC<IncorrectNotesViewProps> = ({ onStartCustomQuiz }) => {
  const { incorrectNotes, resolveIncorrectNote, words } = useVocaStore();

  const [filterResolved, setFilterResolved] = useState<'unresolved' | 'resolved' | 'all'>('unresolved');
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);

  // Hydrate word details for each incorrect note
  const allWords = Object.values(words).flat();

  const hydratedNotes = incorrectNotes.map(note => {
    const wordObj = note.word || allWords.find(w => w.id === note.word_id);
    return { ...note, word: wordObj };
  }).filter(n => n.word !== undefined);

  const filteredNotes = hydratedNotes.filter(n => {
    if (filterResolved === 'unresolved') return !n.is_resolved;
    if (filterResolved === 'resolved') return n.is_resolved;
    return true;
  });

  const handleRetestWrongWords = () => {
    const wrongWordsToRetest = filteredNotes.map(n => n.word!).filter(Boolean);
    if (wrongWordsToRetest.length === 0) {
      alert('재시험을 볼 오답 단어가 없습니다.');
      return;
    }
    onStartCustomQuiz(wrongWordsToRetest);
  };

  const toggleExpand = (id: string) => {
    setExpandedNoteId(prev => prev === id ? null : id);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600" />
            마이 오답 노트 (Incorrect Answer Notebook)
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            시험에서 자주 틀렸던 단어를 모아 집중 복습하고 다시 오답 테스트를 치르세요.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={handleRetestWrongWords}
            disabled={filteredNotes.length === 0}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-bold text-xs shadow-sm transition-all active:scale-95"
          >
            <RotateCw className="w-4 h-4" />
            <span>오답만 집중 다시 풀기 ({filteredNotes.length}개)</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200 w-fit text-xs font-bold">
        <button
          onClick={() => setFilterResolved('unresolved')}
          className={`px-3.5 py-1.5 rounded-lg transition-colors ${
            filterResolved === 'unresolved' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          미해결 오답만 ({hydratedNotes.filter(n => !n.is_resolved).length})
        </button>
        <button
          onClick={() => setFilterResolved('resolved')}
          className={`px-3.5 py-1.5 rounded-lg transition-colors ${
            filterResolved === 'resolved' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          완료된 오답 ({hydratedNotes.filter(n => n.is_resolved).length})
        </button>
        <button
          onClick={() => setFilterResolved('all')}
          className={`px-3.5 py-1.5 rounded-lg transition-colors ${
            filterResolved === 'all' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          전체 ({hydratedNotes.length})
        </button>
      </div>

      {/* Notes Grid List */}
      {filteredNotes.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white border border-dashed border-slate-300 text-slate-500 text-xs space-y-2 shadow-xs">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
          <p className="font-bold text-slate-800">오답 노드가 깨끗합니다!</p>
          <p>틀린 단어가 없거나 선택한 조건에 해당되는 오답이 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredNotes.map((note) => {
            const w = note.word!;
            const isExpanded = expandedNoteId === note.id;

            return (
              <div
                key={note.id}
                className={`p-5 rounded-2xl border transition-all space-y-3 relative ${
                  note.is_resolved
                    ? 'bg-slate-50/80 border-slate-200 opacity-70'
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-extrabold text-slate-800">{w.word}</h3>
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">
                        {note.wrong_count}회 오답
                      </span>
                    </div>

                    {w.pronunciation && (
                      <p className="text-xs font-mono text-slate-500">[{w.pronunciation}]</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => speakText(w.word)}
                      className="p-2 rounded-xl bg-slate-100 text-blue-600 hover:bg-slate-200 transition-colors"
                      title="발음 듣기"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => resolveIncorrectNote(note.id)}
                      className={`p-2 rounded-xl border transition-colors ${
                        note.is_resolved
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-white border-slate-200 text-slate-400 hover:text-emerald-600 hover:bg-slate-50'
                      }`}
                      title={note.is_resolved ? '해결 취소' : '마스터 완료 처리'}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Meanings & Expandable Details */}
                <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-blue-700 text-sm">
                      {w.pos ? `[${w.pos}] ` : ''}{w.meaning}
                    </p>

                    <button
                      onClick={() => toggleExpand(note.id)}
                      className="text-slate-400 hover:text-slate-700 flex items-center gap-1 font-semibold text-[11px]"
                    >
                      <span>{isExpanded} AI 해설</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {note.last_wrong_answer && (
                    <p className="text-rose-600 text-[11px] font-medium">
                      최근 입력 오답: <span className="line-through">{note.last_wrong_answer}</span>
                    </p>
                  )}

                  {(isExpanded || w.example_sentence) && (
                    <div className="pt-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                      {w.example_sentence && (
                        <p className="font-bold text-slate-800 italic">&quot;{w.example_sentence}&quot;</p>
                      )}
                      {w.example_translation && (
                        <p className="text-slate-600 font-medium">{w.example_translation}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
