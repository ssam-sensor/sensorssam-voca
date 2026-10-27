/**
 * Utility functions for local date formatting and duration calculations.
 * Prevents UTC vs KST timezone discrepancies (such as toISOString() shifting dates by 9 hours).
 */

export const getLocalDateStr = (d: Date | string = new Date()): string => {
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) {
    // If invalid date string, attempt direct YYYY-MM-DD extraction
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) {
      return d.slice(0, 10);
    }
    const fallback = new Date();
    return `${fallback.getFullYear()}-${String(fallback.getMonth() + 1).padStart(2, '0')}-${String(fallback.getDate()).padStart(2, '0')}`;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatDuration = (sec: number): string => {
  if (!sec || sec <= 0) return '0분';
  if (sec < 60) return `${sec}초`;
  const totalMins = Math.floor(sec / 60);
  const hours = Math.floor(totalMins / 60);
  const remMins = totalMins % 60;

  if (hours > 0) {
    return remMins > 0 ? `${hours}시간 ${remMins}분` : `${hours}시간`;
  }
  return `${totalMins}분`;
};

export const formatKoreanDate = (dateStr: string, includeDayOfWeek: boolean = true): string => {
  if (!dateStr) return '';
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length < 3) return dateStr;
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];

  if (!includeDayOfWeek) {
    return `${year}년 ${parseInt(month, 10)}월 ${parseInt(day, 10)}일`;
  }

  const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dayOfWeek = days[d.getDay()] || '';
  return `${year}년 ${parseInt(month, 10)}월 ${parseInt(day, 10)}일 (${dayOfWeek})`;
};

export const getDaysInMonth = (year: number, month: number): number => {
  // month is 0-indexed (0 = Jan, 11 = Dec)
  return new Date(year, month + 1, 0).getDate();
};

export const getFirstDayOfWeek = (year: number, month: number): number => {
  // 0: Sunday, 1: Monday, ... 6: Saturday
  return new Date(year, month, 1).getDay();
};
