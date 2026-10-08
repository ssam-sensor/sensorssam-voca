'use client';

import React, { useState } from 'react';
import { useVocaStore } from '@/store/useVocaStore';
import { Wordbook } from '@/types/database';
import { WordbookFormModal } from '@/components/tutor/WordbookFormModal';
import { WorksheetPrintModal } from '@/components/tutor/WorksheetPrintModal';
import { Plus, Trash2, Printer, Search, Layers, ArrowRight } from 'lucide-react';

export const WordbookList: React.FC = () => {
  const { wordbooks, words, deleteWordbook, setActiveWordbookId, setUserRole } = useVocaStore();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [printModalWb, setPrintModalWb] = useState<Wordbook | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredWordbooks = wordbooks.filter(wb =>
    wb.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    wb.chapter.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            단어장 및 챕터(Day) 관리
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            교재 사진/PDF 업로드, AI 주제별 생성 및 엑셀 일괄 등록을 통해 단어장을 제작하세요.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => setIsFormOpen(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>새 챕터 단어장 등록</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="단어장 제목 또는 챕터 검색 (예: SensorSsam, DAY 15)..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-slate-800 placeholder-slate-400 shadow-xs"
        />
      </div>

      {/* Grid List */}
      {filteredWordbooks.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white border border-dashed border-slate-300 text-slate-500 text-xs shadow-xs">
          검색된 단어장이 없습니다. 상단 <strong>&apos;새 챕터 단어장 등록&apos;</strong> 버튼을 눌러 추가해주세요.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredWordbooks.map((wb) => {
            const wbWords = words[wb.id] || [];
            const spellingPriorityCount = wbWords.filter(w => w.is_spelling_priority).length;
            const idiomCount = wbWords.filter(w => w.is_idiom).length;

            return (
              <div
                key={wb.id}
                className="bg-white border border-slate-200 hover:border-blue-400 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="inline-block px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-xs font-mono font-bold">
                        {wb.chapter}
                      </span>
                      <h3 className="font-extrabold text-slate-800 text-base mt-2 group-hover:text-blue-600 transition-colors">
                        {wb.title}
                      </h3>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm(`'${wb.title} ${wb.chapter}' 단어장을 삭제하시겠습니까?`)) {
                          deleteWordbook(wb.id);
                        }
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors"
                      title="단어장 삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-600 pt-1 font-medium">
                    <span>등록 단어: <strong className="text-slate-800">{wbWords.length}개</strong></span>
                    <span>•</span>
                    <span className="text-amber-700 font-bold">스펠링 필수: {spellingPriorityCount}</span>
                    <span>•</span>
                    <span className="text-purple-700 font-bold">숙어: {idiomCount}</span>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setPrintModalWb(wb)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5 text-blue-600" />
                    <span>시험지 출력</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveWordbookId(wb.id);
                      setUserRole('student');
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition-colors"
                  >
                    <span>학생용 학습 이동</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      <WordbookFormModal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} />

      {/* Print Modal */}
      {printModalWb && (
        <WorksheetPrintModal
          isOpen={Boolean(printModalWb)}
          onClose={() => setPrintModalWb(null)}
          wordbook={printModalWb}
          words={words[printModalWb.id] || []}
        />
      )}
    </div>
  );
};
