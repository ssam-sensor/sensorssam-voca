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
  studentId?: string;
}

export const StudentReportModal: React.FC<StudentReportModalProps> = ({
  isOpen,
  onClose,
  studentName,
  studentId
}) => {
  const {
    quizResults,
    incorrectNotes,
    words,
    studyLogs,
    studentId: storeStudentId,
    userName: storeUserName,
    userEmail: storeUserEmail,
    userRole
  } = useVocaStore();

  const [aiFeedback, setAiFeedback] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [currentDateInfo, setCurrentDateInfo] = useState<{
    todayStr: string;
    sevenDaysAgoStr: string;
    currentDateStr: string;
  }>({
    todayStr: '',
    sevenDaysAgoStr: '',
    currentDateStr: ''
  });

  const activeStudentId = studentId || storeStudentId;
  const isStudentRole = userRole === 'student';

  const displayStudentName = studentName || storeUserName || (storeUserEmail ? storeUserEmail.split('@')[0] : '학생');
  const displayStudentEmail = (!studentName || studentName === storeUserName) ? storeUserEmail : '';

  // 1) Strictly filter quiz results for this student
  const targetQuizResults = quizResults.filter(q => {
    if (activeStudentId) {
      if (q.student_id === activeStudentId) return true;
      if (!q.student_id && isStudentRole) return true;
      return false;
    }
    return true;
  });

  // 2) Strictly filter incorrect notes for this student
  const targetIncorrectNotes = incorrectNotes.filter(n => {
    if (activeStudentId) {
      if (n.student_id === activeStudentId) return true;
      if (!n.student_id && isStudentRole) return true;
      return false;
    }
    return true;
  });

  // 3) Strictly filter study logs for this student
  const targetStudyLogs = studyLogs.filter(l => {
    if (activeStudentId) {
      if (l.student_id === activeStudentId) return true;
      if (!l.student_id && isStudentRole) return true;
      return false;
    }
    return true;
  });

  // Overview calculations
  const totalQuizzes = targetQuizResults.length;

  // Recent 7 days calculation for Attendance & Study Time
  const todayStr = currentDateInfo.todayStr;
  const sevenDaysAgoStr = currentDateInfo.sevenDaysAgoStr;
  const currentDateStr = currentDateInfo.currentDateStr;

  const todayLog = targetStudyLogs.find(l => l.study_date === todayStr);
  const todaySeconds = todayLog?.duration_seconds || 0;

  const thisWeekLogs = targetStudyLogs.filter(l => l.study_date >= sevenDaysAgoStr && l.study_date <= todayStr);
  const attendanceDaysThisWeek = new Set(thisWeekLogs.map(l => l.study_date)).size;
  const weeklyTotalSeconds = thisWeekLogs.reduce((acc, l) => acc + (l.duration_seconds || 0), 0);

  const formatDuration = (sec: number) => {
    if (sec <= 0) return '0분';
    if (sec < 60) return `${sec}초`;
    const mins = Math.floor(sec / 60);
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hours > 0) {
      return remMins > 0 ? `${hours}시간 ${remMins}분` : `${hours}시간`;
    }
    return `${mins}분`;
  };

  const todayStudyTimeText = formatDuration(todaySeconds);
  const weeklyStudyTimeText = formatDuration(weeklyTotalSeconds);

  // Average score % across this student's actual quizzes
  const avgScorePct = totalQuizzes > 0
    ? Math.round(
        targetQuizResults.reduce((acc, q) => acc + (q.total_score / (q.max_score || 1)) * 100, 0) / totalQuizzes
      )
    : 0;

  // Flatten registered words
  const allWordsList = Object.values(words).flat();

  // Words tested in quizzes taken by the student
  const testedWordbookIds = new Set(targetQuizResults.map(q => q.wordbook_id));
  const testedWords = testedWordbookIds.size > 0
    ? allWordsList.filter(w => testedWordbookIds.has(w.wordbook_id))
    : allWordsList;

  // Word mastery rate (Tested words with no active unresolved wrong notes)
  const unresolvedWrongWordIds = new Set(targetIncorrectNotes.filter(n => !n.is_resolved).map(n => n.word_id));
  const totalWordsInScope = testedWords.length;
  const unresolvedWrongCountInScope = testedWords.filter(w => unresolvedWrongWordIds.has(w.id)).length;
  const masteredWordsCount = Math.max(0, totalWordsInScope - unresolvedWrongCountInScope);
  const masteryPct = totalQuizzes > 0 && totalWordsInScope > 0
    ? Math.round((masteredWordsCount / totalWordsInScope) * 100)
    : 0;

  // 2) Part 1 (Spelling) vs Part 2 (Meaning) Accuracy Calculation
  let detailedSpellingScore = 0;
  let detailedSpellingMax = 0;
  let detailedMeaningScore = 0;
  let detailedMeaningMax = 0;
  let hasRecordedPartScores = false;

  targetQuizResults.forEach(q => {
    if (q.spelling_max && q.spelling_max > 0) {
      detailedSpellingScore += q.spelling_score || 0;
      detailedSpellingMax += q.spelling_max;
      detailedMeaningScore += q.meaning_score || 0;
      detailedMeaningMax += q.meaning_max || 0;
      hasRecordedPartScores = true;
    }
  });

  let spellingAccuracyPct = 0;
  let meaningAccuracyPct = 0;

  if (hasRecordedPartScores && detailedSpellingMax > 0 && detailedMeaningMax > 0) {
    spellingAccuracyPct = Math.round((detailedSpellingScore / detailedSpellingMax) * 100);
    meaningAccuracyPct = Math.round((detailedMeaningScore / detailedMeaningMax) * 100);
  } else if (totalQuizzes > 0) {
    const totalQuestionsTested = targetQuizResults.reduce((sum, q) => sum + (q.max_score || 0), 0);
    const totalCorrect = targetQuizResults.reduce((sum, q) => sum + (q.total_score || 0), 0);
    const totalWrong = Math.max(0, totalQuestionsTested - totalCorrect);

    let spellingWrongWeight = 0;
    let meaningWrongWeight = 0;

    targetIncorrectNotes.forEach(note => {
      const w = note.word || allWordsList.find(item => item.id === note.word_id);
      const count = note.wrong_count || 1;
      if (w?.is_spelling_priority) {
        spellingWrongWeight += count;
      } else {
        meaningWrongWeight += count;
      }
    });

    const totalSpellingQuestions = Math.round(totalQuestionsTested * 0.4);
    const totalMeaningQuestions = Math.max(1, totalQuestionsTested - totalSpellingQuestions);

    if (totalWrong === 0) {
      spellingAccuracyPct = 100;
      meaningAccuracyPct = 100;
    } else if (spellingWrongWeight + meaningWrongWeight > 0) {
      const ratio = spellingWrongWeight / (spellingWrongWeight + meaningWrongWeight);
      const estSpellingWrong = Math.min(totalSpellingQuestions, Math.round(totalWrong * ratio));
      const estMeaningWrong = Math.min(totalMeaningQuestions, Math.max(0, totalWrong - estSpellingWrong));

      spellingAccuracyPct = totalSpellingQuestions > 0
        ? Math.max(0, Math.round(((totalSpellingQuestions - estSpellingWrong) / totalSpellingQuestions) * 100))
        : avgScorePct;
      meaningAccuracyPct = totalMeaningQuestions > 0
        ? Math.max(0, Math.round(((totalMeaningQuestions - estMeaningWrong) / totalMeaningQuestions) * 100))
        : avgScorePct;
    } else {
      spellingAccuracyPct = avgScorePct;
      meaningAccuracyPct = avgScorePct;
    }
  }

  // POS Weakness Distribution & Rate Calculation
  const getPosCategory = (posStr?: string | null, isIdiom?: boolean): '명사' | '동사' | '형용사' | '숙어' | '기타' => {
    if (isIdiom) return '숙어';
    if (!posStr) return '기타';
    const lower = posStr.toLowerCase().trim();
    if (lower.includes('숙어') || lower.includes('idiom') || lower.includes('phr')) return '숙어';
    if (lower.includes('동사') || lower.includes('verb') || lower.includes('v.')) return '동사';
    if (lower.includes('명사') || lower.includes('noun') || lower.includes('n.')) return '명사';
    if (lower.includes('형용사') || lower.includes('adj')) return '형용사';
    return '기타';
  };

  // 1) Accumulate tested questions for each POS from the student's actual quizzes
  const posTotalQuestions: Record<'명사' | '동사' | '형용사' | '숙어' | '기타', number> = {
    명사: 0,
    동사: 0,
    형용사: 0,
    숙어: 0,
    기타: 0
  };

  const posWrongCounts: Record<'명사' | '동사' | '형용사' | '숙어' | '기타', number> = {
    명사: 0,
    동사: 0,
    형용사: 0,
    숙어: 0,
    기타: 0
  };

  targetQuizResults.forEach(q => {
    const wbWords = words[q.wordbook_id] || allWordsList.filter(w => w.wordbook_id === q.wordbook_id);
    if (wbWords && wbWords.length > 0) {
      const testedSlice = (q.max_score && q.max_score < wbWords.length)
        ? wbWords.slice(0, q.max_score)
        : wbWords;

      testedSlice.forEach(w => {
        const cat = getPosCategory(w.pos, w.is_idiom);
        posTotalQuestions[cat] += 1;
      });
    } else if (q.max_score && q.max_score > 0) {
      const fallbackList = testedWords.length > 0 ? testedWords : allWordsList;
      if (fallbackList.length > 0) {
        const slice = fallbackList.slice(0, q.max_score);
        slice.forEach(w => {
          const cat = getPosCategory(w.pos, w.is_idiom);
          posTotalQuestions[cat] += 1;
        });
      } else {
        posTotalQuestions['기타'] += q.max_score;
      }
    }
  });

  // 2) Accumulate wrong count for each POS from targetIncorrectNotes
  targetIncorrectNotes.forEach(note => {
    const w = note.word || allWordsList.find(item => item.id === note.word_id);
    const cat = getPosCategory(w?.pos, w?.is_idiom);
    posWrongCounts[cat] += note.wrong_count || 1;
  });

  // 3) Calculate per-POS stats: total questions (denominator), wrong count (numerator), and error rate %
  const posStats: Record<'명사' | '동사' | '형용사' | '숙어' | '기타', {
    totalQuestions: number;
    wrongCount: number;
    wrongRatePct: number;
  }> = {
    명사: { totalQuestions: 0, wrongCount: 0, wrongRatePct: 0 },
    동사: { totalQuestions: 0, wrongCount: 0, wrongRatePct: 0 },
    형용사: { totalQuestions: 0, wrongCount: 0, wrongRatePct: 0 },
    숙어: { totalQuestions: 0, wrongCount: 0, wrongRatePct: 0 },
    기타: { totalQuestions: 0, wrongCount: 0, wrongRatePct: 0 }
  };

  (['명사', '동사', '형용사', '숙어', '기타'] as const).forEach(cat => {
    const tested = posTotalQuestions[cat];
    const wrong = posWrongCounts[cat];
    const totalQ = Math.max(tested, wrong);
    const rate = totalQ > 0 ? Math.min(100, Math.round((wrong / totalQ) * 100)) : 0;
    posStats[cat] = {
      totalQuestions: totalQ,
      wrongCount: wrong,
      wrongRatePct: rate
    };
  });

  // Sort weak POS by highest error rate first, then by wrong count
  const weakPosList = (['명사', '동사', '형용사', '숙어', '기타'] as const)
    .filter(cat => posStats[cat].totalQuestions > 0 && posStats[cat].wrongCount > 0)
    .sort((a, b) => {
      if (posStats[b].wrongRatePct !== posStats[a].wrongRatePct) {
        return posStats[b].wrongRatePct - posStats[a].wrongRatePct;
      }
      return posStats[b].wrongCount - posStats[a].wrongCount;
    })
    .map(cat => `${cat}(오답률 ${posStats[cat].wrongRatePct}%)`);

  // 3) High-priority wrong words
  const hydratedNotes = targetIncorrectNotes.map(n => ({
    ...n,
    word: n.word || allWordsList.find(w => w.id === n.word_id)
  })).filter(n => n.word !== undefined);

  const topWrongWordsList = hydratedNotes
    .sort((a, b) => b.wrong_count - a.wrong_count)
    .slice(0, 10);

  // 4) Gemini AI Coaching Feedback Generation
  const fetchAiFeedback = async () => {
    if (totalQuizzes === 0) {
      setAiFeedback('아직 시험 응시 기록이 없습니다. 단어 학습 후 챕터별 시험을 치르면 AI 튜터가 세부 영역별(스펠링 인출 및 4지선다 의미 파악) 강약점과 맞춤 학습 처방을 분석해 드립니다.');
      return;
    }

    setIsAiLoading(true);
    try {
      const result = await generateStudentEvaluationFeedback({
        studentName: displayStudentName,
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
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      const sevenDays = sevenDaysAgo.toISOString().split('T')[0];
      const dateFormatted = now.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      setCurrentDateInfo({
        todayStr: today,
        sevenDaysAgoStr: sevenDays,
        currentDateStr: dateFormatted
      });
      fetchAiFeedback();
    }
  }, [isOpen, activeStudentId, totalQuizzes, avgScorePct]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

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
                <p><strong>학생명:</strong> <span className="font-bold text-slate-900">{displayStudentName}</span></p>
                {displayStudentEmail && (
                  <p><strong>계정:</strong> <span className="text-slate-600 font-mono text-[11px]">{displayStudentEmail}</span></p>
                )}
                <p><strong>담당 튜터:</strong> SensorSsam</p>
                <p><strong>발행일자:</strong> {currentDateStr}</p>
              </div>
            </div>
          </div>

          {/* SECTION 1: Overview Cards */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Target className="w-4 h-4 text-blue-600" />
              1. 출석 및 종합 학습 성과 (Overview Stats)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-1">
                <div className="flex items-center justify-between text-xs text-blue-900 font-extrabold">
                  <span>이번 주 출석 일수</span>
                  <Calendar className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-2xl font-extrabold text-blue-900">
                  {attendanceDaysThisWeek} <span className="text-xs text-slate-500 font-bold">/ 7일 출석</span>
                </div>
                <p className="text-[11px] text-slate-500">주간 출석률 {Math.round((attendanceDaysThisWeek / 7) * 100)}%</p>
              </div>

              <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-1">
                <div className="flex items-center justify-between text-xs text-indigo-900 font-extrabold">
                  <span>오늘 공부한 시간</span>
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-2xl font-extrabold text-indigo-900">
                  {todayStudyTimeText}
                </div>
                <p className="text-[11px] text-slate-500">이번 주 총 {weeklyStudyTimeText}</p>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-1">
                <div className="flex items-center justify-between text-xs text-emerald-900 font-extrabold">
                  <span>전체 평균 정답률</span>
                  <Award className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-extrabold text-emerald-800">
                  {avgScorePct}%
                </div>
                <p className="text-[11px] text-slate-500">
                  총 {totalQuizzes}회 시험 응시 완료
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-1">
                <div className="flex items-center justify-between text-xs text-amber-900 font-extrabold">
                  <span>단어 누적 정복률</span>
                  <BookOpen className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-2xl font-extrabold text-amber-900">
                  {masteryPct}%
                </div>
                <p className="text-[11px] text-slate-500">
                  {totalQuizzes > 0
                    ? `응시 단어 ${totalWordsInScope}개 중 ${masteredWordsCount}개 완전 마스터`
                    : '시험 미응시'}
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 2: Part & POS Detailed Analysis */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              2. 파트별 세부 성취도 & 품사별 오답률 분석
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
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-800">품사별 오답률 분석</h4>
                  <span className="text-[11px] text-slate-400">품사별 출제 문항 대비 오답률</span>
                </div>

                <div className="space-y-2.5 text-xs">
                  {(['명사', '동사', '형용사', '숙어', '기타'] as const).map(posName => {
                    const stat = posStats[posName];
                    return (
                      <div key={posName} className="space-y-1">
                        <div className="flex justify-between items-center font-semibold text-slate-700">
                          <span className="flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                posName === '명사' ? 'bg-blue-500' :
                                posName === '동사' ? 'bg-emerald-500' :
                                posName === '형용사' ? 'bg-amber-500' :
                                posName === '숙어' ? 'bg-purple-500' : 'bg-slate-400'
                              }`}
                            />
                            <span>{posName}</span>
                          </span>
                          <div className="text-right text-[11px] space-x-1.5">
                            {stat.totalQuestions > 0 ? (
                              <>
                                <span className="text-slate-500 font-normal">
                                  {stat.wrongCount} / {stat.totalQuestions}문항
                                </span>
                                <span
                                  className={`font-bold ${
                                    stat.wrongRatePct >= 50
                                      ? 'text-rose-600'
                                      : stat.wrongRatePct >= 20
                                      ? 'text-amber-600'
                                      : stat.wrongRatePct > 0
                                      ? 'text-blue-600'
                                      : 'text-emerald-600'
                                  }`}
                                >
                                  오답률 {stat.wrongRatePct}%
                                </span>
                              </>
                            ) : (
                              <span className="text-slate-400 font-normal">출제 문항 없음</span>
                            )}
                          </div>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              stat.wrongRatePct >= 50
                                ? 'bg-rose-500'
                                : posName === '명사'
                                ? 'bg-blue-500'
                                : posName === '동사'
                                ? 'bg-emerald-500'
                                : posName === '형용사'
                                ? 'bg-amber-500'
                                : posName === '숙어'
                                ? 'bg-purple-500'
                                : 'bg-slate-400'
                            }`}
                            style={{ width: `${stat.totalQuestions > 0 ? stat.wrongRatePct : 0}%` }}
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
