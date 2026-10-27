import { QuizResult, StudyLog, Wordbook } from '@/types/database';
import { SAMPLE_WORDBOOKS } from '@/lib/sample-data';
import { getLocalDateStr } from '@/lib/date-utils';

export interface DailyActivityItem {
  type: 'quiz' | 'study';
  timeStr: string;
  score?: number;
  maxScore?: number;
  durationSeconds?: number;
  wordbookTitle?: string;
  wordbookChapter?: string;
}

export interface DailyLessonActivity {
  wordbookId: string;
  title: string;
  chapter: string;
  tutorName?: string;
  quizCount: number;
  bestScorePct?: number;
  studySeconds: number;
  activities: DailyActivityItem[];
}

export interface DayStudySummary {
  date: string; // YYYY-MM-DD
  isAttended: boolean;
  totalSeconds: number;
  lessons: DailyLessonActivity[];
  quizResults: QuizResult[];
  totalQuizzesTaken: number;
  avgScorePct: number;
}

export interface StudentStudyStats {
  totalStudySeconds: number;
  todayStudySeconds: number;
  weeklyStudySeconds: number;
  monthlyStudySeconds: number;
  totalAttendanceDays: number;
  weeklyAttendanceDays: number;
  monthlyAttendanceDays: number;
  daySummaries: Record<string, DayStudySummary>;
  attendedDates: string[]; // sorted descending
  totalQuizzesTaken: number;
  averageScorePct: number;
}

interface CalculateOptions {
  studentId?: string;
  studyLogs: StudyLog[];
  quizResults: QuizResult[];
  allWordbooks?: Wordbook[];
  wordbooks?: Wordbook[];
  todayDateStr?: string;
}

/**
 * Resolves wordbook title and chapter safely from available wordbook lists.
 */
export const resolveWordbookInfo = (
  wordbookId?: string | null,
  allWordbooks: Wordbook[] = [],
  wordbooks: Wordbook[] = []
): { title: string; chapter: string; tutorName?: string } => {
  if (!wordbookId) {
    return { title: '지정 단어장', chapter: '' };
  }
  if (wordbookId === 'wb-custom-wrong') {
    return { title: '오답 집중 재시험', chapter: 'REVIEW', tutorName: undefined };
  }

  const targetId = wordbookId.trim().toLowerCase();
  const pool = [...allWordbooks, ...wordbooks, ...SAMPLE_WORDBOOKS];
  const matched = pool.find(
    w => (w.id || '').trim().toLowerCase() === targetId || (w.title || '').trim().toLowerCase() === targetId
  );

  if (matched) {
    return {
      title: matched.title,
      chapter: matched.chapter,
      tutorName: matched.tutor_name || undefined
    };
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(wordbookId);
  return {
    title: (!isUuid && !wordbookId.startsWith('wb-')) ? wordbookId : '지정 단어장',
    chapter: ''
  };
};

/**
 * Aggregates student attendance, study time, and daily lesson activity.
 * Seamlessly integrates BOTH study_logs and quiz_results so that test attempts
 * guarantee attendance and credit realistic study time.
 */
export const calculateStudentStudyStats = ({
  studentId,
  studyLogs = [],
  quizResults = [],
  allWordbooks = [],
  wordbooks = [],
  todayDateStr
}: CalculateOptions): StudentStudyStats => {
  // 1. Filter results for this specific student
  const filteredQuizzes = quizResults.filter(q => {
    if (!studentId || studentId === 'sample-student-01') return true;
    return q.student_id === studentId || !q.student_id;
  });

  const filteredLogs = studyLogs.filter(l => {
    if (!studentId || studentId === 'sample-student-01') return true;
    return l.student_id === studentId || !l.student_id;
  });

  const todayStr = todayDateStr || (typeof window !== 'undefined' ? getLocalDateStr(new Date()) : '');

  // Calculate 7-day range (today and 6 previous days) safely
  let sevenDaysAgoStr = '';
  if (todayStr) {
    const parts = todayStr.split('-').map(Number);
    if (parts.length === 3) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      d.setDate(d.getDate() - 6);
      sevenDaysAgoStr = getLocalDateStr(d);
    }
  }

  // Calculate month range (current year and month)
  const currentYearMonth = todayStr ? todayStr.slice(0, 7) : '';

  // Map to collect day summaries
  const daySummaries: Record<string, DayStudySummary> = {};

  const getOrCreateDay = (date: string): DayStudySummary => {
    if (!daySummaries[date]) {
      daySummaries[date] = {
        date,
        isAttended: false,
        totalSeconds: 0,
        lessons: [],
        quizResults: [],
        totalQuizzesTaken: 0,
        avgScorePct: 0
      };
    }
    return daySummaries[date];
  };

  // 2. Process study logs
  filteredLogs.forEach(log => {
    if (!log.study_date) return;
    const dateStr = log.study_date.slice(0, 10);
    const day = getOrCreateDay(dateStr);
    const seconds = log.duration_seconds || 0;
    day.totalSeconds += seconds;
    if (seconds > 0) {
      day.isAttended = true;
    }
  });

  // 3. Process quiz results (guarantee attendance & credit study time)
  filteredQuizzes.forEach(quiz => {
    if (!quiz.created_at) return;
    const dateStr = getLocalDateStr(quiz.created_at);
    const day = getOrCreateDay(dateStr);

    day.isAttended = true;
    day.quizResults.push(quiz);

    const wbInfo = resolveWordbookInfo(quiz.wordbook_id, allWordbooks, wordbooks);
    const title = quiz.wordbook_title || wbInfo.title;
    const chapter = quiz.wordbook_chapter || wbInfo.chapter;
    const scorePct = Math.round((quiz.total_score / (quiz.max_score || 1)) * 100);

    const quizTime = new Date(quiz.created_at);
    const timeStr = !isNaN(quizTime.getTime())
      ? quizTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      : '';

    // Find or create lesson activity inside this day
    let lesson = day.lessons.find(l => l.wordbookId === quiz.wordbook_id);
    if (!lesson) {
      lesson = {
        wordbookId: quiz.wordbook_id,
        title,
        chapter,
        tutorName: wbInfo.tutorName,
        quizCount: 0,
        bestScorePct: scorePct,
        studySeconds: 0,
        activities: []
      };
      day.lessons.push(lesson);
    }

    lesson.quizCount += 1;
    if (scorePct > (lesson.bestScorePct || 0)) {
      lesson.bestScorePct = scorePct;
    }

    lesson.activities.push({
      type: 'quiz',
      timeStr,
      score: quiz.total_score,
      maxScore: quiz.max_score,
      durationSeconds: 120, // default minimum 2 minutes per quiz
      wordbookTitle: title,
      wordbookChapter: chapter
    });
  });

  // 4. Reconcile study time for each day:
  // If student took quizzes, each quiz took real effort (at least 120s).
  // If recorded study duration is lower than realistic quiz time, ensure fair credit.
  Object.values(daySummaries).forEach(day => {
    const quizCount = day.quizResults.length;
    day.totalQuizzesTaken = quizCount;

    if (quizCount > 0) {
      const estimatedQuizSeconds = quizCount * 120; // 2 min per quiz
      if (day.totalSeconds < estimatedQuizSeconds) {
        day.totalSeconds = Math.max(day.totalSeconds, estimatedQuizSeconds);
      }
      const totalScoreSum = day.quizResults.reduce(
        (sum, q) => sum + (q.total_score / (q.max_score || 1)) * 100,
        0
      );
      day.avgScorePct = Math.round(totalScoreSum / quizCount);
    }

    if (day.totalSeconds > 0 || quizCount > 0) {
      day.isAttended = true;
    }
  });

  // 5. Compute aggregate stats
  const allDates = Object.keys(daySummaries);
  const attendedDates = allDates
    .filter(d => daySummaries[d].isAttended)
    .sort((a, b) => b.localeCompare(a));

  const totalStudySeconds = Object.values(daySummaries).reduce((acc, d) => acc + d.totalSeconds, 0);

  const todaySummary = daySummaries[todayStr];
  const todayStudySeconds = todaySummary ? todaySummary.totalSeconds : 0;

  const weeklyDates = allDates.filter(d => d >= sevenDaysAgoStr && d <= todayStr);
  const weeklyStudySeconds = weeklyDates.reduce((acc, d) => acc + daySummaries[d].totalSeconds, 0);
  const weeklyAttendanceDays = weeklyDates.filter(d => daySummaries[d].isAttended).length;

  const monthlyDates = allDates.filter(d => d.startsWith(currentYearMonth));
  const monthlyStudySeconds = monthlyDates.reduce((acc, d) => acc + daySummaries[d].totalSeconds, 0);
  const monthlyAttendanceDays = monthlyDates.filter(d => daySummaries[d].isAttended).length;

  const totalQuizzesTaken = filteredQuizzes.length;
  const averageScorePct = totalQuizzesTaken > 0
    ? Math.round(
        filteredQuizzes.reduce((acc, q) => acc + (q.total_score / (q.max_score || 1)) * 100, 0) / totalQuizzesTaken
      )
    : 0;

  return {
    totalStudySeconds,
    todayStudySeconds,
    weeklyStudySeconds,
    monthlyStudySeconds,
    totalAttendanceDays: attendedDates.length,
    weeklyAttendanceDays,
    monthlyAttendanceDays,
    daySummaries,
    attendedDates,
    totalQuizzesTaken,
    averageScorePct
  };
};
