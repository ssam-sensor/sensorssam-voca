import { useEffect, useRef, useState } from 'react';
import { useVocaStore } from '@/store/useVocaStore';

/**
 * Custom hook to track active student study time with a 3-minute idle auto-pause threshold.
 * Flushes accumulated study seconds to store/Supabase DB every 30s and on unmount.
 */
export function useStudyTimer(isActive: boolean = true) {
  const { addStudyTime } = useVocaStore();
  const accumulatedSecondsRef = useRef<number>(0);
  const lastActivityRef = useRef<number>(Date.now());
  const [activeSeconds, setActiveSeconds] = useState<number>(0);

  useEffect(() => {
    if (!isActive) return;

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

    // 1-second ticker
    const timer = setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current;
      // 3 minutes (180,000 ms) idle threshold
      if (idleMs <= 180000) {
        accumulatedSecondsRef.current += 1;
        setActiveSeconds(prev => prev + 1);
      }
    }, 1000);

    // Periodic flush to DB every 30 seconds
    const flushInterval = setInterval(() => {
      if (accumulatedSecondsRef.current > 0) {
        addStudyTime(accumulatedSecondsRef.current);
        accumulatedSecondsRef.current = 0;
      }
    }, 30000);

    // Tab close / unmount flush
    const handleUnload = () => {
      if (accumulatedSecondsRef.current > 0) {
        addStudyTime(accumulatedSecondsRef.current);
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
        addStudyTime(accumulatedSecondsRef.current);
        accumulatedSecondsRef.current = 0;
      }
    };
  }, [isActive, addStudyTime]);

  return activeSeconds;
}
