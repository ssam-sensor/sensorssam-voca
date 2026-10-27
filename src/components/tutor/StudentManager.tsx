'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useVocaStore } from '@/store/useVocaStore';
import { SAMPLE_WORDBOOKS } from '@/lib/sample-data';
import { StudentReportModal } from '@/components/tutor/StudentReportModal';
import { calculateStudentStudyStats } from '@/lib/study-analytics';
import { formatDuration, getLocalDateStr } from '@/lib/date-utils';
import { AttendanceCalendar } from '@/components/study/AttendanceCalendar';
import { Users, Award, BookOpen, AlertTriangle, FileSpreadsheet, UserCheck, ChevronRight, CheckCircle2, Clock } from 'lucide-react';

export const StudentManager: React.FC = () => {
  const { quizResults, incorrectNotes, availableStudents, studyLogs, allWordbooks, wordbooks } = useVocaStore();

  const [isReportOpen, setIsReportOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  // Helper to resolve wordbook details using quiz_results' wordbook_id
  const getWordbookInfo = (wordbookId?: string | null) => {
    if (!wordbookId) return null;
    if (wordbookId === 'wb-custom-wrong') {
      return { title: '오답 집중 재시험', chapter: 'REVIEW', tutor_name: null };
    }
    const targetId = wordbookId.trim().toLowerCase();
    const candidateList = [
      ...(allWordbooks || []),
      ...(wordbooks || []),
      ...(SAMPLE_WORDBOOKS || [])
    ];
    return candidateList.find(
      w => (w.id || '').trim().toLowerCase() === targetId || (w.title || '').trim().toLowerCase() === targetId
    );
  };

  // Fallback default student list if DB profiles is empty
  const defaultStudents = availableStudents.length > 0
    ? availableStudents
    : [{ id: 'sample-student-01', name: '김학생', email: 'student_01@sensorssam.com' }];

  useEffect(() => {
    if (defaultStudents.length > 0 && !selectedStudentId) {
      setSelectedStudentId(defaultStudents[0].id);
    }
  }, [defaultStudents, selectedStudentId]);

  const activeStudent = defaultStudents.find(s => s.id === selectedStudentId) || defaultStudents[0];
  const selectedStudentName = activeStudent?.name || '학생';

  const [todayDateStr, setTodayDateStr] = useState<string>('');
  useEffect(() => {
    setTodayDateStr(getLocalDateStr(new Date()));
  }, []);

  // Calculate comprehensive student study statistics (study time + attendance + lessons)
  const studentStats = useMemo(() => {
    return calculateStudentStudyStats({
      studentId: activeStudent?.id,
      studyLogs,
      quizResults,
      allWordbooks,
      wordbooks,
      todayDateStr
    });
  }, [activeStudent?.id, studyLogs, quizResults, allWordbooks, wordbooks, todayDateStr]);

  // Filter quiz results for selected student
  const studentQuizResults = quizResults.filter(
    q => q.student_id === activeStudent?.id || !q.student_id || selectedStudentId === 'sample-student-01'
  );

  const unresolvedWrongCount = incorrectNotes.filter(
    n => !n.is_resolved && (n.student_id === activeStudent?.id || !n.student_id || selectedStudentId === 'sample-student-01')
  ).length;

  return (
    <div className="space-y-6">
      
      {/* 0. Student Selector Carousel / Dropdown (가입된 전체 학생 선택) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-800">
              가입된 담당 학생 목록 (총 {defaultStudents.length}명)
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            * 학생을 선택하면 개별 성적 및 출석/공부시간 리포트가 조회됩니다
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {defaultStudents.map((st) => {
            const isSelected = st.id === selectedStudentId;
            return (
              <button
                key={st.id}
                onClick={() => setSelectedStudentId(st.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm ring-2 ring-blue-200'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <UserCheck className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                <span>{st.name}</span>
                {st.email && (
                  <span className={`text-[10px] font-normal ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                    ({st.email.split('@')[0]})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. Student Profile Card & Report Launch Banner */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center font-bold">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-slate-800">{selectedStudentName}</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                담당 학생
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              1:1 맞춤 Voca 튜터링 관리 중 | 최근 활동: {studentQuizResults.length > 0 ? new Date(studentQuizResults[0].created_at).toLocaleDateString('ko-KR') : '응시 내역 없음'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsReportOpen(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all active:scale-95 shrink-0"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>종합 학습 평가 보고서 보기</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Student Overview Stats (출석일수 + 공부시간 + 시험성적) */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1">
          <p className="text-xs text-slate-500 font-medium">총 공부한 시간</p>
          <h3 className="text-2xl font-extrabold text-indigo-700">{formatDuration(studentStats.totalStudySeconds)}</h3>
          <p className="text-[11px] text-slate-400">
            오늘 {formatDuration(studentStats.todayStudySeconds)} · 이번 주 {formatDuration(studentStats.weeklyStudySeconds)}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1">
          <p className="text-xs text-slate-500 font-medium">이번 주 출석 일수</p>
          <h3 className="text-2xl font-extrabold text-blue-700">{studentStats.weeklyAttendanceDays} <span className="text-xs text-slate-500 font-bold">/ 7일</span></h3>
          <p className="text-[11px] text-slate-400">총 누적 {studentStats.totalAttendanceDays}일 출석 인정</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1">
          <p className="text-xs text-slate-500 font-medium">평균 시험 정답률</p>
          <h3 className="text-2xl font-extrabold text-emerald-700">{studentStats.averageScorePct}%</h3>
          <p className="text-[11px] text-slate-400">총 {studentStats.totalQuizzesTaken}회 평가 응시</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1">
          <p className="text-xs text-slate-500 font-medium">미해결 오답 단어</p>
          <h3 className="text-2xl font-extrabold text-rose-700">{unresolvedWrongCount}개</h3>
          <p className="text-[11px] text-slate-400">집중 복습 진행 필요</p>
        </div>
      </div>

      {/* 2.5 Attendance & Daily Lesson Calendar (출석 및 일자별 수행 과 확인 달력) */}
      <AttendanceCalendar
        stats={studentStats}
        studentName={selectedStudentName}
      />

      {/* 3. Roster & Quiz Log */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-800">
              {selectedStudentName} 학생의 시험 제출 내역 및 오답 현황
            </h3>
          </div>
        </div>

        {studentQuizResults.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            선택한 학생의 시험 제출 기록이 아직 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {studentQuizResults.map((result) => {
              const scorePct = Math.round((result.total_score / (result.max_score || 1)) * 100);
              const matchedWb = getWordbookInfo(result.wordbook_id);
              const isIdUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result.wordbook_id || '');
              const fallbackTitle = (result.wordbook_id && !isIdUuid && !result.wordbook_id.startsWith('wb-'))
                ? result.wordbook_id
                : '지정 단어장';
              const wordbookTitle = matchedWb?.title || result.wordbook_title || (result.wordbook_id === 'wb-custom-wrong' ? '오답 집중 재시험' : fallbackTitle);
              const wordbookChapter = matchedWb?.chapter || result.wordbook_chapter || (result.wordbook_id === 'wb-custom-wrong' ? 'REVIEW' : '');

              return (
                <div key={result.id} className="p-4 sm:px-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <BookOpen className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="font-bold text-sm text-slate-800">
                        {wordbookTitle}
                      </span>
                      {wordbookChapter && (
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-xs font-mono font-bold">
                          {wordbookChapter}
                        </span>
                      )}
                      {matchedWb?.tutor_name && (
                        <span className="text-[11px] text-slate-400 font-medium">
                          ({matchedWb.tutor_name})
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      응시일: {new Date(result.created_at).toLocaleString('ko-KR')}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-lg font-extrabold text-slate-800">
                        {result.total_score} <span className="text-slate-400 text-xs font-normal">/ {result.max_score}</span>
                      </span>
                      <div className="text-[11px] font-bold text-emerald-700">
                        {scorePct}% 정답
                      </div>
                    </div>

                    <button
                      onClick={() => setIsReportOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                      <span>보고서</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Student Comprehensive Evaluation Report Modal */}
      <StudentReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        studentName={selectedStudentName}
        studentId={activeStudent?.id}
      />
    </div>
  );
};


