'use client';

import React, { useState } from 'react';
import { Wordbook, Word } from '@/types/database';
import { Printer, Download, X, Eye, FileText, CheckCircle } from 'lucide-react';

interface WorksheetPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  wordbook: Wordbook;
  words: Word[];
}

export const WorksheetPrintModal: React.FC<WorksheetPrintModalProps> = ({
  isOpen,
  onClose,
  wordbook,
  words
}) => {
  const [mode, setMode] = useState<'study' | 'quiz' | 'answer'>('study');

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200 print:p-0 print:static print:bg-white">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden text-slate-800 flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:border-none print:bg-white print:text-black">
        
        {/* Header - Screen only */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-base font-extrabold text-slate-800">시험지 및 학습지 인쇄/출력</h2>
              <p className="text-xs text-slate-500">{wordbook.title} - {wordbook.chapter}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Print Options Pill Bar - Screen only */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between print:hidden">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setMode('study')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'study' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              전체 학습지 (단어 + 뜻)
            </button>
            <button
              onClick={() => setMode('quiz')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'quiz' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              시험지 (뜻 빈칸)
            </button>
            <button
              onClick={() => setMode('answer')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'answer' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              정답지 (Answer Key)
            </button>
          </div>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>프린트 / PDF 인쇄</span>
          </button>
        </div>

        {/* Printable Paper View */}
        <div className="p-8 overflow-y-auto bg-white text-slate-800 flex-1 print:p-0">
          <div className="border-b-2 border-slate-800 pb-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-800">
                  {wordbook.title}
                </h1>
                <p className="text-sm font-semibold text-slate-600">
                  CHAPTER: {wordbook.chapter} | {mode === 'study' ? '학습용 단어장' : mode === 'quiz' ? '단어 암기 평가 시험지' : '정답 해설지'}
                </p>
              </div>
              <div className="text-right text-xs text-slate-500 border border-slate-300 p-2 rounded">
                <p>이름: ________________</p>
                <p className="mt-1">점수: _______ / {words.length}</p>
              </div>
            </div>
          </div>

          {/* Printable Table */}
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-800 bg-slate-100">
                <th className="py-2.5 px-3 w-12 text-center font-bold">No.</th>
                <th className="py-2.5 px-3 w-1/4 font-bold">단어 (Word)</th>
                <th className="py-2.5 px-3 w-1/5 font-bold">발음 (Pronunciation)</th>
                <th className="py-2.5 px-3 font-bold">뜻 (Meaning)</th>
              </tr>
            </thead>
            <tbody>
              {words.map((item, idx) => (
                <tr key={item.id} className="border-b border-slate-200">
                  <td className="py-3 px-3 text-center font-semibold text-slate-500">{idx + 1}</td>
                  <td className="py-3 px-3 font-bold text-slate-800 text-sm">
                    {item.word}
                    {item.is_spelling_priority && (
                      <span className="ml-1 text-[10px] text-amber-600 font-normal">[필수]</span>
                    )}
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-500 text-xs">
                    {item.pronunciation ? `${item.pronunciation}` : '-'}
                  </td>
                  <td className="py-3 px-3">
                    {mode === 'quiz' ? (
                      <div className="h-6 border-b border-dotted border-slate-400 w-full" />
                    ) : (
                      <div>
                        <span className="font-semibold text-slate-700">{item.meaning}</span>
                        {item.example_sentence && (
                          <p className="text-[11px] text-slate-500 italic mt-0.5">
                            ex) {item.example_sentence}
                          </p>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-8 pt-4 border-t border-slate-300 text-center text-[11px] text-slate-500 font-medium">
            SensorSsam Voca - AI-Powered Vocabulary Tutor
          </div>
        </div>

      </div>
    </div>
  );
};
