'use client';

import React, { useState, useEffect } from 'react';
import { useVocaStore } from '@/store/useVocaStore';
import { generateStudentEvaluationFeedback } from '@/lib/gemini';
import {
  Printer,
  X,
  Award,
  BookOpen,
  Calendar,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle2,
  RefreshCw,
  Target
} from 'lucide-react';

interface StudentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName?: string;
}

export const StudentReportModal: React.FC<StudentReportModalProps> = ({
  isOpen,
  onClose,
  studentName = '김학생 (student_01)'
}) => {
  const { quizResults, incorrectNotes, words, wordbooks, settings } = useVocaStore();

  const [aiFeedback, setAiFeedback] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);

  // Flatten all registered words
  const allWordsList = Object.values(words).flat();

  // 1) Overview calculations
  const totalQuizzes = quizResults.length;
  
  // Recent 7 days quiz count
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent7DaysQuizzes = quizResults.filter(q => new Date(q.created_at).getTime() >= sevenDaysAgo).length;

  // Unique study days count
  const uniqueStudyDays = new Set(
    quizResults.map(q => new Date(q.created_at).toISOString().split('T')[0])
  ).size;

  // Average score %
  const avgScorePct = totalQuizzes > 0
    ? Math.round(
        quizResults.reduce((acc, q) => acc + (q.total_score / (q.max_score || 1)) * 100, 0) / totalQuizzes
      )
    : 0;

  // Word mastery rate (Words with no active unresolved wrong notes)
  const unresolvedWrongWordIds = new Set(incorrectNotes.filter(n => !n.is_resolved).map(n => n.word_id));
  const masteredWordsCount = allWordsList.filter(w => !unresolvedWrongWordIds.has(w.id)).length;
  const masteryPct = allWordsList.length > 0
    ? Math.round((masteredWordsCount / allWordsList.length) * 100)
    : 100;

  // 2) Part-wise & POS Breakdown
  const spellingPriorityWords = allWordsList.filter(w => w.is_spelling_priority);
  const spellingWrongCount = spellingPriorityWords.filter(w => unresolvedWrongWordIds.has(w.id)).length;
  const spellingAccuracyPct = spellingPriorityWords.length > 0
    ? Math.max(0, Math.round(100 - (spellingWrongCount / spellingPriorityWords.length) * 100))
    : 85;

  const nonSpellingWords = allWordsList.filter(w => !w.is_spelling_priority);
  const nonSpellingWrongCount = nonSpellingWords.filter(w => unresolvedWrongWordIds.has(w.id)).length;
  const meaningAccuracyPct = nonSpellingWords.length > 0
    ? Math.max(0, Math.round(100 - (nonSpellingWrongCount / nonSpellingWords.length) * 100))
    : 90;

  // POS Weakness Distribution
  const posCounts: Record<string, number> = {
    명사: 0,
    동사: 0,
    형용사: 0,
    숙어: 0,
    기타: 0
  };

  incorrectNotes.forEach(note => {
    const w = note.word || allWordsList.find(item => item.id === note.word_id);
    const posStr = (w?.pos || '').toLowerCase();

    if (posStr.includes('명사')) posCounts['명사'] += note.wrong_count;
    else if (posStr.includes('동사')) posCounts['동사'] += note.wrong_count;
    else if (posStr.includes('형용사')) posCounts['형용사'] += note.wrong_count;
    else if (posStr.includes('숙어') || w?.is_idiom) posCounts['숙어'] += note.wrong_count;
    else posCounts['기타'] += note.wrong_count;
  });

  const totalWrongCountAll = Object.values(posCounts).reduce((a, b) => a + b, 0) || 1;

  // Sort weak POS
  const weakPosList = Object.entries(posCounts)
    .filter(([_, count]) => count > 0)
    .sort(([_, a], [__, b]) => b - a)
    .map(([pos]) => pos);

  // 3) High-priority wrong words (wrong_count >= 2 or top wrong words)
  const hydratedNotes = incorrectNotes.map(n => ({
    ...n,
    word: n.word || allWordsList.find(w => w.id === n.word_id)
  })).filter(n => n.word !== undefined);

  const topWrongWordsList = hydratedNotes
    .sort((a, b) => b.wrong_count - a.wrong_count)
    .slice(0, 10);

  // 4) Gemini AI Coaching Feedback Generation
  const fetchAiFeedback = async () => {
    setIsAiLoading(true);
    try {
      const result = await generateStudentEvaluationFeedback({
        studentName,
        totalQuizzes,
        avgScorePct,
        masteryPct,
        spellingAccuracyPct,
        meaningAccuracyPct,
        weakPos: weakPosList,
        topWrongWords: topWrongWordsList.map(n => ({
          word: n.word!.word,
          pos: n.word!.pos,
          meaning: n.word!.meaning,
          wrongCount: n.wrong_count
        }))
      });
      setAiFeedback(result);
    } catch (err) {
      console.error('Failed generating AI feedback:', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAiFeedback();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const currentDateStr = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200 print:p-0 print:static print:bg-white">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden text-slate-800 flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:w-full print:rounded-none">
        
        {/* Modal Header & Action Buttons - Hidden in Print */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-800">학생 종합 학습 평가 보고서</h2>
              <p className="text-xs text-slate-500">1:1 맞춤 진단 보고서 (학부모 상담 및 성적 평가용)</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>보고서 인쇄 / PDF 저장</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Report View Container */}
        <div className="p-8 overflow-y-auto bg-white space-y-6 flex-1 print:p-0 print:overflow-visible">
          
          {/* Paper Title Banner */}
          <div className="border-b-2 border-slate-800 pb-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-xs font-mono font-bold">
                    EVALUATION REPORT
                  </span>
                  <span className="text-xs text-slate-500 font-semibold">SensorSsam Voca Tutoring</span>
                </div>
                <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight mt-2">
                  종합 어휘 학습 성과 평가서
                </h1>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  학생별 스펠링 인출 능력, 의미 파악도 및 1:1 AI 맞춤 처방 리포트
                </p>
              </div>

              <div className="text-right space-y-1 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs text-slate-700">
                <p><strong>학생명:</strong> <span className="font-bold text-slate-900">{studentName}</span></p>
                <p><strong>담당 튜터:</strong> SensorSsam</p>
                <p><strong>발행일자:</strong> {currentDateStr}</p>
              </div>
            </div>
          </div>

          {/* SECTION 1: Overview Cards */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Target className="w-4 h-4 text-blue-600" />
              1. 종합 학습 성과 (Overview Stats)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                  <span>총 학습 일수 / 7일 응시</span>
                  <Calendar className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-2xl font-extrabold text-slate-800">
                  {uniqueStudyDays}일 <span className="text-xs font-bold text-blue-600">({recent7DaysQuizzes}회 응시)</span>
                </div>
                <p className="text-[11px] text-slate-500">누적 평가 횟수: 총 {totalQuizzes}회</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                  <span>전체 평균 정답률</span>
                  <Award className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-extrabold text-emerald-700">
                  {avgScorePct}%
                </div>
                <p className="text-[11px] text-slate-500">
                  {avgScorePct >= 80 ? '상위 우수 (Mastered)' : '집중 복습 권장'}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                  <span>단어 누적 정복률</span>
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-2xl font-extrabold text-indigo-700">
                  {masteryPct}%
                </div>
                <p className="text-[11px] text-slate-500">
                  등록 {allWordsList.length}개 중 {masteredWordsCount}개 완전 마스터
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 2: Part & POS Detailed Analysis */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              2. 파트별 세부 성취도 & 품사별 오답 분석
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Part 1 vs Part 2 Accuracy Comparison */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-xs">
                <h4 className="text-sm font-bold text-slate-800">평가 영역별 정답률 비교</h4>
                
                <div className="space-y-3 text-xs">
                  <div>
                    <div className="flex items-center justify-between font-bold mb-1">
                      <span className="text-amber-800">Part 1: 스펠링 필수 암기 (철자 인출)</span>
                      <span className="text-amber-900 font-extrabold">{spellingAccuracyPct}%</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${spellingAccuracyPct}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between font-bold mb-1">
                      <span className="text-blue-800">Part 2: 4지선다 / 어휘 의미 선택</span>
                      <span className="text-blue-900 font-extrabold">{meaningAccuracyPct}%</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full" style={{ width: `${meaningAccuracyPct}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* POS Weakness Visual Distribution */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-xs">
                <h4 className="text-sm font-bold text-slate-800">품사별 오답 발생 비중</h4>

                <div className="space-y-2 text-xs">
                  {Object.entries(posCounts).map(([posName, count]) => {
                    const pct = Math.round((count / totalWrongCountAll) * 100);
                    return (
                      <div key={posName} className="space-y-1">
                        <div className="flex justify-between font-semibold text-slate-700">
                          <span>{posName}</span>
                          <span>{count}회 오답 ({pct}%)</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              posName === '명사' ? 'bg-blue-500' :
                              posName === '동사' ? 'bg-emerald-500' :
                              posName === '형용사' ? 'bg-amber-500' :
                              posName === '숙어' ? 'bg-purple-500' : 'bg-slate-400'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: High Priority Review Words Table */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                3. 집중 복습 요망 단어 리스트 (오답 횟수 상위 단어)
              </h3>
              <span className="text-xs font-bold text-rose-700">
                총 {topWrongWordsList.length}개 대상
              </span>
            </div>

            {topWrongWordsList.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-500 font-semibold">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                모든 단어를 감점 없이 완벽하게 소화하고 있습니다!
              </div>
            ) : (
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                      <th className="py-2.5 px-3 w-10 text-center">No.</th>
                      <th className="py-2.5 px-3 w-1/4">단어 (Word)</th>
                      <th className="py-2.5 px-3 w-1/6">품사</th>
                      <th className="py-2.5 px-3 w-1/4">한글 뜻 (Meaning)</th>
                      <th className="py-2.5 px-3 w-16 text-center">오답 횟수</th>
                      <th className="py-2.5 px-3">대표 예문</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {topWrongWordsList.map((item, idx) => {
                      const w = item.word!;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-500">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-800 text-sm">
                            {w.word}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {w.pos || '-'}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-emerald-800">
                            {w.meaning}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-block px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold text-[11px] border border-rose-200">
                              {item.wrong_count}회
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 italic text-[11px]">
                            {w.example_sentence ? `"${w.example_sentence}"` : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* SECTION 4: Gemini AI Tutor Coaching Comment */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" />
                4. AI 튜터 맞춤 코칭 소견 (Gemini 3.8 Flash AI)
              </h3>

              <button
                onClick={fetchAiFeedback}
                disabled={isAiLoading}
                className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 print:hidden"
              >
                <RefreshCw className={`w-3 h-3 ${isAiLoading ? 'animate-spin' : ''}`} />
                <span>AI 소견 재생성</span>
              </button>
            </div>

            <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2 relative">
              {isAiLoading ? (
                <div className="flex items-center gap-2 text-xs text-amber-800 font-semibold py-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-600" />
                  <span>Gemini AI가 학생의 성적 데이터를 분석하여 1:1 맞춤 피드백 코멘트를 작성하고 있습니다...</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    [1:1 학습 지도 및 복습 권장 가이드]
                  </p>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium whitespace-pre-line">
                    {aiFeedback}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer Signature Block for Print */}
          <div className="pt-8 border-t border-slate-300 text-center text-xs text-slate-500 space-y-1 font-medium">
            <p>SensorSsam Voca Tutoring - AI-Powered Vocabulary Assessment Report</p>
            <p className="text-[11px] text-slate-400">본 평가 보고서는 학생의 어휘 습득 추이를 바탕으로 자동 작성된 학습 가이드입니다.</p>
          </div>

        </div>
      </div>
    </div>
  );
};
