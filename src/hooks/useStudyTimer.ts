import { useEffect, useRef } from 'react';
import { useVocaStore } from '@/store/useVocaStore';

/**
 * Custom hook to track active student study time with a 3-minute idle auto-pause threshold.
 * Flushes accumulated study seconds and wordbook activity to store/DB periodically and on unmount.
 */
export function useStudyTimer(isActive: boolean = true, wordbookId?: string): void {
  const { addStudyTime } = useVocaStore();
  const accumulatedSecondsRef = useRef<number>(0);
  const lastActivityRef = useRef<number>(0);
  const wordbookIdRef = useRef<string | undefined>(wordbookId);

  // Keep wordbookIdRef updated without restarting timer
  useEffect(() => {
    wordbookIdRef.current = wordbookId;
  }, [wordbookId]);

  useEffect(() => {
    if (!isActive) return;

    lastActivityRef.current = Date.now();

    // Reset last activity timestamp on user interaction
    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', handleActivity);
      window.addEventListener('keydown', handleActivity);
      window.addEventListener('touchstart', handleActivity);
      window.addEventListener('scroll', handleActivity);
    }

    // 1-second ticker (accumulates in ref without triggering unnecessary component re-renders)
    const timer = setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current;
      // 3 minutes (180,000 ms) idle threshold
      if (idleMs <= 180000) {
        accumulatedSecondsRef.current += 1;
      }
    }, 1000);

    // Periodic flush to store & DB every 15 seconds
    const flushInterval = setInterval(() => {
      if (accumulatedSecondsRef.current > 0) {
        addStudyTime(accumulatedSecondsRef.current, wordbookIdRef.current);
        accumulatedSecondsRef.current = 0;
      }
    }, 15000);

    // Tab close / unmount flush
    const handleUnload = () => {
      if (accumulatedSecondsRef.current > 0) {
        addStudyTime(accumulatedSecondsRef.current, wordbookIdRef.current);
        accumulatedSecondsRef.current = 0;
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleUnload);
    }

    return () => {
      clearInterval(timer);
      clearInterval(flushInterval);

      if (typeof window !== 'undefined') {
        window.removeEventListener('mousemove', handleActivity);
        window.removeEventListener('keydown', handleActivity);
        window.removeEventListener('touchstart', handleActivity);
        window.removeEventListener('scroll', handleActivity);
        window.removeEventListener('beforeunload', handleUnload);
      }

      if (accumulatedSecondsRef.current > 0) {
        addStudyTime(accumulatedSecondsRef.current, wordbookIdRef.current);
        accumulatedSecondsRef.current = 0;
      }
    };
  }, [isActive, addStudyTime]);
}
