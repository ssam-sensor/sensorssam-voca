'use client';

import React, { useState, useEffect } from 'react';
import { StudentStudyStats, DayStudySummary } from '@/lib/study-analytics';
import { formatDuration, formatKoreanDate, getDaysInMonth, getFirstDayOfWeek, getLocalDateStr } from '@/lib/date-utils';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  BookOpen,
  Award,
  Sparkles,
  Info
} from 'lucide-react';

interface AttendanceCalendarProps {
  stats: StudentStudyStats;
  studentName?: string;
  isCompact?: boolean;
}

export const AttendanceCalendar: React.FC<AttendanceCalendarProps> = ({
  stats,
  studentName = '학생',
  isCompact = false
}) => {
  // Use latest attended date string or default year/month
  const latestAttendedStr = stats.attendedDates.length > 0 ? stats.attendedDates[0] : '';
  const initialYear = latestAttendedStr ? parseInt(latestAttendedStr.slice(0, 4), 10) : 2026;
  const initialMonth = latestAttendedStr ? parseInt(latestAttendedStr.slice(5, 7), 10) - 1 : 9;

  const [todayStr, setTodayStr] = useState<string>('');
  const [currentYear, setCurrentYear] = useState<number>(initialYear);
  const [currentMonth, setCurrentMonth] = useState<number>(initialMonth); // 0-indexed
  const [selectedDate, setSelectedDate] = useState<string>(latestAttendedStr);

  useEffect(() => {
    const now = new Date();
    const tStr = getLocalDateStr(now);
    setTodayStr(tStr);

    if (!selectedDate) {
      setSelectedDate(latestAttendedStr || tStr);
    }

    if (!latestAttendedStr) {
      setCurrentYear(now.getFullYear());
      setCurrentMonth(now.getMonth());
    }
  }, [latestAttendedStr]);

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayOfWeek = getFirstDayOfWeek(currentYear, currentMonth);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentYear(prev => prev - 1);
      setCurrentMonth(11);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentYear(prev => prev + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleGoToday = () => {
    const now = new Date();
    const tStr = getLocalDateStr(now);
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
    setSelectedDate(tStr);
  };

  const currentYearMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

  // Count attendance in this specific calendar month
  const monthAttendanceDays = Object.keys(stats.daySummaries).filter(
    d => d.startsWith(currentYearMonthStr) && stats.daySummaries[d].isAttended
  ).length;

  const selectedDaySummary: DayStudySummary | undefined = stats.daySummaries[selectedDate];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all">
      {/* 1. Header Bar: Month Title, Nav, & Summary Stat Chips */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/60">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600 text-white shadow-xs">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900">
                  {currentYear}년 {currentMonth + 1}월 출석 & 학습 달력
                </h3>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {studentName}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                날짜를 클릭하면 그 날 공부한 과(Wordbook)와 상세 시험 성적을 확인할 수 있습니다.
              </p>
            </div>
          </div>

          {/* Month Navigation Controls */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              onClick={handleGoToday}
              className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-blue-600 hover:bg-white rounded-lg border border-slate-200 transition-colors"
            >
              오늘
            </button>
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white hover:text-blue-600 transition-colors"
              title="이전 달"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-700 min-w-16 text-center">
              {currentYear}.{String(currentMonth + 1).padStart(2, '0')}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white hover:text-blue-600 transition-colors"
              title="다음 달"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. Top Metric Highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mt-4 pt-3 border-t border-slate-200/80">
          <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <p className="text-[11px] font-bold text-slate-400">총 누적 공부 시간</p>
            <p className="text-base sm:text-lg font-extrabold text-indigo-700 mt-0.5">
              {formatDuration(stats.totalStudySeconds)}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <p className="text-[11px] font-bold text-slate-400">총 출석 일수</p>
            <p className="text-base sm:text-lg font-extrabold text-blue-700 mt-0.5">
              {stats.totalAttendanceDays}일 출석
            </p>
          </div>

          <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <p className="text-[11px] font-bold text-slate-400">이달 출석 일수</p>
            <p className="text-base sm:text-lg font-extrabold text-emerald-700 mt-0.5">
              {monthAttendanceDays}일 <span className="text-xs font-medium text-slate-400">/ {daysInMonth}일</span>
            </p>
          </div>

          <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <p className="text-[11px] font-bold text-slate-400">오늘 공부한 시간</p>
            <p className="text-base sm:text-lg font-extrabold text-violet-700 mt-0.5">
              {formatDuration(stats.todayStudySeconds)}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Monthly Calendar Grid */}
      <div className="p-3 sm:p-5">
        {/* Day-of-week header */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center text-xs font-bold text-slate-500">
          <div className="text-rose-500 py-1">일</div>
          <div className="py-1">월</div>
          <div className="py-1">화</div>
          <div className="py-1">수</div>
          <div className="py-1">목</div>
          <div className="py-1">금</div>
          <div className="text-blue-500 py-1">토</div>
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {/* Empty padding cells for first week */}
          {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
            <div key={`empty-${idx}`} className="min-h-16 sm:min-h-24 rounded-xl bg-slate-50/50 opacity-40 border border-transparent" />
          ))}

          {/* Days in Month */}
          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const dayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const summary = stats.daySummaries[dayStr];
            const isAttended = Boolean(summary?.isAttended);
            const isToday = dayStr === todayStr;
            const isSelected = dayStr === selectedDate;
            const lessonCount = summary?.lessons.length || 0;
            const totalQuizzes = summary?.totalQuizzesTaken || 0;

            const dayOfWeek = (firstDayOfWeek + idx) % 7;
            const isSunday = dayOfWeek === 0;
            const isSaturday = dayOfWeek === 6;

            return (
              <div
                key={dayStr}
                onClick={() => setSelectedDate(dayStr)}
                className={`min-h-16 sm:min-h-24 p-1.5 sm:p-2 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex flex-col justify-between text-left select-none relative ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-300 shadow-xs'
                    : isAttended
                    ? 'border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50/60 hover:border-emerald-300'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                } ${isToday && !isSelected ? 'ring-2 ring-amber-400 border-amber-300' : ''}`}
              >
                {/* Day Number & Badges */}
                <div className="flex items-start justify-between">
                  <span
                    className={`text-xs sm:text-sm font-extrabold ${
                      isToday
                        ? 'w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-blue-600 text-white flex items-center justify-center -ml-0.5 -mt-0.5 text-xs'
                        : isSunday
                        ? 'text-rose-500'
                        : isSaturday
                        ? 'text-blue-500'
                        : 'text-slate-700'
                    }`}
                  >
                    {dayNum}
                  </span>

                  {isAttended && (
                    <span className="flex items-center gap-0.5 text-[9px] sm:text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-600 shrink-0" />
                      <span className="hidden sm:inline">출석</span>
                    </span>
                  )}
                </div>

                {/* Day Study Content Badges */}
                <div className="mt-1 space-y-1">
                  {isAttended ? (
                    <>
                      {/* Study duration pill */}
                      <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-indigo-700">
                        <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-indigo-500 shrink-0" />
                        <span>{formatDuration(summary.totalSeconds)}</span>
                      </div>

                      {/* Lesson title chip */}
                      {lessonCount > 0 && (
                        <div className="hidden sm:block">
                          <div className="text-[10px] font-bold text-slate-700 truncate bg-white/90 px-1.5 py-0.5 rounded border border-slate-200/80 shadow-2xs">
                            {summary.lessons[0].chapter || summary.lessons[0].title}
                            {lessonCount > 1 ? ` 외 ${lessonCount - 1}` : ''}
                          </div>
                        </div>
                      )}

                      {/* Quiz result chip on mobile */}
                      {totalQuizzes > 0 && (
                        <div className="sm:hidden text-[9px] font-extrabold text-blue-700">
                          시험 {totalQuizzes}회
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="h-4" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Selected Date Detail Panel ("그 날마다 무슨 과 했는지 확인") */}
      <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50/70">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <h4 className="text-sm font-extrabold text-slate-800">
              {formatKoreanDate(selectedDate)} 상세 학습 기록
            </h4>
          </div>

          {selectedDaySummary?.isAttended ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>출석 인정 (공부 시간: {formatDuration(selectedDaySummary.totalSeconds)})</span>
            </span>
          ) : (
            <span className="text-xs font-medium text-slate-400">
              학습 및 출석 기록 없음
            </span>
          )}
        </div>

        {selectedDaySummary && selectedDaySummary.isAttended ? (
          <div className="space-y-3">
            {/* Studied Lessons List ("무슨 과 했는지") */}
            {selectedDaySummary.lessons.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-600">
                  📚 수행한 학습 과(단어장) 목록 (총 {selectedDaySummary.lessons.length}개 과):
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {selectedDaySummary.lessons.map(lesson => (
                    <div
                      key={lesson.wordbookId}
                      className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <BookOpen className="w-4 h-4 text-blue-600 shrink-0" />
                            <span className="text-xs font-extrabold text-slate-900">
                              {lesson.title}
                            </span>
                            {lesson.chapter && (
                              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-mono font-bold">
                                {lesson.chapter}
                              </span>
                            )}
                          </div>
                          {lesson.tutorName && (
                            <p className="text-[10px] text-slate-400 font-medium">
                              담당: {lesson.tutorName}
                            </p>
                          )}
                        </div>

                        {lesson.bestScorePct !== undefined && (
                          <div className="text-right shrink-0">
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              최고 {lesson.bestScorePct}%
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Activity breakdown */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5 text-amber-500" />
                          <span>시험 {lesson.quizCount}회 응시 완료</span>
                        </div>
                        <span className="text-blue-600 font-bold">
                          학습 완료
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-white border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  이 날 플래시카드 복습 및 자율 어휘 암기 활동을 {formatDuration(selectedDaySummary.totalSeconds)} 동안 진행하였습니다.
                </span>
              </div>
            )}

            {/* Individual Quiz Submission Details if any */}
            {selectedDaySummary.quizResults.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <p className="text-xs font-bold text-slate-600">
                  📝 상세 평가 응시 내역 ({selectedDaySummary.quizResults.length}건):
                </p>
                <div className="divide-y divide-slate-100 bg-white rounded-xl border border-slate-200 overflow-hidden">
                  {selectedDaySummary.quizResults.map((q, qIdx) => {
                    const scorePct = Math.round((q.total_score / (q.max_score || 1)) * 100);
                    const qTime = new Date(q.created_at);
                    const timeText = !isNaN(qTime.getTime())
                      ? qTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                      : '';
                    return (
                      <div key={q.id || qIdx} className="p-2.5 sm:px-3.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-400 text-[11px]">#{qIdx + 1}</span>
                          <span className="font-bold text-slate-800">
                            {q.wordbook_title || '지정 단어장'} {q.wordbook_chapter ? `[${q.wordbook_chapter}]` : ''}
                          </span>
                          {timeText && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              ({timeText})
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-extrabold text-slate-800">
                            {q.total_score} <span className="text-slate-400 font-normal">/ {q.max_score}</span>
                          </span>
                          <span className={`text-[11px] font-bold ${scorePct >= 80 ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {scorePct}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 text-center rounded-xl bg-white border border-slate-200/80 text-xs text-slate-400 font-medium">
            선택한 날짜 ({formatKoreanDate(selectedDate)})에는 출석 및 학습 기록이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
};
