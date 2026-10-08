'use client';

import React, { useState } from 'react';
import { useVocaStore } from '@/store/useVocaStore';
import { Wordbook, Word } from '@/types/database';
import { Edit3, Plus, Trash2, X, Check, Volume2, AlertCircle, Sparkles } from 'lucide-react';
import { speakText } from '@/lib/audio';

interface WordEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  wordbook: Wordbook;
}

export const WordEditModal: React.FC<WordEditModalProps> = ({ isOpen, onClose, wordbook }) => {
  const { words, addWord, updateWord, deleteWord } = useVocaStore();

  const currentWords = words[wordbook.id] || [];

  // Editing state: wordId -> Word object being edited
  const [editingWordId, setEditingWordId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Word>>({});

  // New word form state
  const [newWord, setNewWord] = useState({
    word: '',
    pronunciation: '',
    pos: '명사',
    meaning: '',
    example_sentence: '',
    example_translation: '',
    is_spelling_priority: true,
    is_idiom: false
  });

  const [isAdding, setIsAdding] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartEdit = (w: Word) => {
    setEditingWordId(w.id);
    setEditForm({ ...w });
  };

  const handleSaveEdit = async () => {
    if (!editingWordId || !editForm.word?.trim() || !editForm.meaning?.trim()) {
      alert('단어와 뜻을 모두 입력해 주세요.');
      return;
    }

    await updateWord(editForm as Word);
    setEditingWordId(null);
    setEditForm({});
    setStatusMsg('단어 정보가 수정되었습니다.');
    setTimeout(() => setStatusMsg(null), 2000);
  };

  const handleDeleteWord = async (wordId: string, wordStr: string) => {
    if (confirm(`'${wordStr}' 단어를 정말 삭제하시겠습니까?`)) {
      await deleteWord(wordId, wordbook.id);
      setStatusMsg('단어가 삭제되었습니다.');
      setTimeout(() => setStatusMsg(null), 2000);
    }
  };

  const handleAddNewWord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.word.trim() || !newWord.meaning.trim()) {
      alert('추가할 단어와 뜻을 작성해 주세요.');
      return;
    }

    await addWord(wordbook.id, {
      word: newWord.word.trim(),
      pronunciation: newWord.pronunciation.trim() || null,
      pos: newWord.pos.trim() || null,
      meaning: newWord.meaning.trim(),
      example_sentence: newWord.example_sentence.trim() || null,
      example_translation: newWord.example_translation.trim() || null,
      is_spelling_priority: Boolean(newWord.is_spelling_priority),
      is_idiom: Boolean(newWord.is_idiom)
    });

    setNewWord({
      word: '',
      pronunciation: '',
      pos: '명사',
      meaning: '',
      example_sentence: '',
      example_translation: '',
      is_spelling_priority: true,
      is_idiom: false
    });
    setIsAdding(false);
    setStatusMsg('새 단어가 추가되었습니다.');
    setTimeout(() => setStatusMsg(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden text-slate-800 flex flex-col max-h-[95vh] sm:max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 bg-slate-50/90">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-xs font-mono font-bold">
                {wordbook.chapter}
              </span>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-800 truncate">
                {wordbook.title} 단어 편집 및 수정
              </h2>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
              총 <strong className="text-blue-700 font-bold">{currentWords.length}개</strong> 단어 등록됨
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Toast */}
        {statusMsg && (
          <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{statusMsg}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 bg-slate-50/40">
          
          {/* Add New Word Toggle Form */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-blue-600" />
                <span>이 챕터에 새 단어 추가하기</span>
              </h3>
              <button
                onClick={() => setIsAdding(!isAdding)}
                className="text-xs font-bold text-blue-600 hover:text-blue-700"
              >
                {isAdding ? '닫기' : '+ 단어 1개 추가'}
              </button>
            </div>

            {isAdding && (
              <form onSubmit={handleAddNewWord} className="space-y-3 pt-2 border-t border-slate-100 animate-in fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                  <div className="sm:col-span-3">
                    <label className="text-[10px] font-bold text-slate-600 mb-0.5 block">단어 *</label>
                    <input
                      type="text"
                      value={newWord.word}
                      onChange={(e) => setNewWord({ ...newWord, word: e.target.value })}
                      placeholder="예: resilient"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-600 mb-0.5 block">발음기호</label>
                    <input
                      type="text"
                      value={newWord.pronunciation}
                      onChange={(e) => setNewWord({ ...newWord, pronunciation: e.target.value })}
                      placeholder="예: rizíljənt"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-600 mb-0.5 block">품사</label>
                    <input
                      type="text"
                      value={newWord.pos}
                      onChange={(e) => setNewWord({ ...newWord, pos: e.target.value })}
                      placeholder="형용사"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <label className="text-[10px] font-bold text-slate-600 mb-0.5 block">한글 뜻 *</label>
                    <input
                      type="text"
                      value={newWord.meaning}
                      onChange={(e) => setNewWord({ ...newWord, meaning: e.target.value })}
                      placeholder="예: 회복력 있는; 회복 빠른"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-emerald-800 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <input
                    type="text"
                    value={newWord.example_sentence}
                    onChange={(e) => setNewWord({ ...newWord, example_sentence: e.target.value })}
                    placeholder="예문 (English sentence)"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-[11px] text-slate-700"
                  />
                  <input
                    type="text"
                    value={newWord.example_translation}
                    onChange={(e) => setNewWord({ ...newWord, example_translation: e.target.value })}
                    placeholder="예문 해석 (Korean translation)"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-[11px] text-slate-700"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer font-bold text-amber-800">
                      <input
                        type="checkbox"
                        checked={newWord.is_spelling_priority}
                        onChange={(e) => setNewWord({ ...newWord, is_spelling_priority: e.target.checked })}
                        className="rounded border-slate-300 text-blue-600"
                      />
                      <span>Part 1 스펠링 필수</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer font-bold text-purple-800">
                      <input
                        type="checkbox"
                        checked={newWord.is_idiom}
                        onChange={(e) => setNewWord({ ...newWord, is_idiom: e.target.checked })}
                        className="rounded border-slate-300 text-blue-600"
                      />
                      <span>숙어 (Idiom)</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs"
                  >
                    단어 저장
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Word List Items */}
          <div className="space-y-3">
            {currentWords.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-white border border-dashed border-slate-300 text-slate-500 text-xs">
                이 챕터에 아직 등록된 단어가 없습니다. 위 버튼을 눌러 단어를 추가해 보세요.
              </div>
            ) : (
              currentWords.map((w, idx) => {
                const isEditingThis = editingWordId === w.id;

                if (isEditingThis) {
                  return (
                    <div key={w.id} className="p-4 rounded-2xl bg-blue-50/60 border-2 border-blue-400 space-y-3 animate-in fade-in">
                      <div className="flex items-center justify-between text-xs font-bold text-blue-900 border-b border-blue-200/60 pb-2">
                        <span>단어 #{idx + 1} 수정 중</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleSaveEdit}
                            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
                          >
                            <Check className="w-3.5 h-3.5" /> 저장
                          </button>
                          <button
                            onClick={() => setEditingWordId(null)}
                            className="px-2.5 py-1 rounded-lg bg-slate-200 text-slate-700 text-xs font-semibold"
                          >
                            취소
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                        <div className="sm:col-span-3">
                          <label className="text-[10px] font-bold text-slate-600 block mb-0.5">단어</label>
                          <input
                            type="text"
                            value={editForm.word || ''}
                            onChange={(e) => setEditForm({ ...editForm, word: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 font-bold"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[10px] font-bold text-slate-600 block mb-0.5">발음기호</label>
                          <input
                            type="text"
                            value={editForm.pronunciation || ''}
                            onChange={(e) => setEditForm({ ...editForm, pronunciation: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 font-mono"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[10px] font-bold text-slate-600 block mb-0.5">품사</label>
                          <input
                            type="text"
                            value={editForm.pos || ''}
                            onChange={(e) => setEditForm({ ...editForm, pos: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300"
                          />
                        </div>
                        <div className="sm:col-span-5">
                          <label className="text-[10px] font-bold text-slate-600 block mb-0.5">뜻</label>
                          <input
                            type="text"
                            value={editForm.meaning || ''}
                            onChange={(e) => setEditForm({ ...editForm, meaning: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 font-bold text-emerald-800"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <input
                          type="text"
                          value={editForm.example_sentence || ''}
                          onChange={(e) => setEditForm({ ...editForm, example_sentence: e.target.value })}
                          placeholder="예문"
                          className="w-full px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-[11px]"
                        />
                        <input
                          type="text"
                          value={editForm.example_translation || ''}
                          onChange={(e) => setEditForm({ ...editForm, example_translation: e.target.value })}
                          placeholder="예문 해석"
                          className="w-full px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-[11px]"
                        />
                      </div>

                      <div className="flex items-center gap-4 text-xs pt-1">
                        <label className="flex items-center gap-1.5 cursor-pointer font-bold text-amber-800">
                          <input
                            type="checkbox"
                            checked={editForm.is_spelling_priority || false}
                            onChange={(e) => setEditForm({ ...editForm, is_spelling_priority: e.target.checked })}
                            className="rounded border-slate-300 text-blue-600"
                          />
                          <span>Part 1 스펠링 필수</span>
                        </label>

                        <label className="flex items-center gap-1.5 cursor-pointer font-bold text-purple-800">
                          <input
                            type="checkbox"
                            checked={editForm.is_idiom || false}
                            onChange={(e) => setEditForm({ ...editForm, is_idiom: e.target.checked })}
                            className="rounded border-slate-300 text-blue-600"
                          />
                          <span>숙어 (Idiom)</span>
                        </label>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={w.id}
                    className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-slate-800 text-base">{w.word}</span>
                        {w.pronunciation && (
                          <span className="text-xs text-slate-400 font-mono">[{w.pronunciation}]</span>
                        )}
                        {w.pos && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-600">
                            {w.pos}
                          </span>
                        )}
                        {w.is_spelling_priority && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                            Part 1 필수
                          </span>
                        )}
                        {w.is_idiom && (
                          <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200 text-[10px] font-bold">
                            숙어
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-bold text-emerald-800">{w.meaning}</p>

                      {w.example_sentence && (
                        <p className="text-[11px] text-slate-500 italic pt-0.5">
                          &quot;{w.example_sentence}&quot; {w.example_translation ? `- ${w.example_translation}` : ''}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                      <button
                        onClick={() => speakText(w.word)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-colors"
                        title="발음 듣기"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleStartEdit(w)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                        <span>수정</span>
                      </button>

                      <button
                        onClick={() => handleDeleteWord(w.id, w.word)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors"
                        title="단어 삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-t border-slate-100 bg-slate-50/90">
          <span className="text-xs text-slate-500 font-medium">
            수정 및 추가 내역이 실시간 DB와 자동 동기화됩니다.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shadow-xs transition-all"
          >
            닫기
          </button>
        </div>

      </div>
    </div>
  );
};
