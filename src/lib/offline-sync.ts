import { getSupabaseClient } from './supabase';

export interface PendingQuizSyncItem {
  id: string;
  student_id?: string | null;
  wordbook_id: string;
  total_score: number;
  max_score: number;
  wrong_words?: { wordId: string; wrongAnswer: string }[];
  timestamp: number;
}

const STORAGE_KEY = 'vocat_pending_quiz_sync';

// UUID validation helper
const isUuid = (id?: string | null): boolean => {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
};

/**
 * Get all pending quiz items from localStorage
 */
export function getPendingQuizItems(): PendingQuizSyncItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('[OfflineSync] Failed to read pending items:', err);
    return [];
  }
}

/**
 * Enqueue a completed quiz result when offline or when DB insert fails
 */
export function enqueuePendingQuizResult(
  data: Omit<PendingQuizSyncItem, 'id' | 'timestamp'>
): void {
  if (typeof window === 'undefined') return;

  const current = getPendingQuizItems();
  const newItem: PendingQuizSyncItem = {
    ...data,
    id: `sync-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now()
  };

  const updated = [...current, newItem];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    console.log(`[OfflineSync] Enqueued quiz result for offline sync. Queue length: ${updated.length}`);
    window.dispatchEvent(new CustomEvent('vocat-pending-sync-updated', { detail: { count: updated.length } }));
  } catch (err) {
    console.error('[OfflineSync] Failed to enqueue quiz result:', err);
  }
}

let isSyncing = false;

/**
 * Sync all pending quiz results to Supabase when online
 */
export async function syncPendingQuizResults(): Promise<{ syncedCount: number; errors: number }> {
  if (typeof window === 'undefined' || isSyncing) return { syncedCount: 0, errors: 0 };
  if (!navigator.onLine) {
    return { syncedCount: 0, errors: 0 };
  }

  const items = getPendingQuizItems();
  if (items.length === 0) return { syncedCount: 0, errors: 0 };

  const client = getSupabaseClient();
  if (!client) {
    console.warn('[OfflineSync] Supabase client not available, skipping sync');
    return { syncedCount: 0, errors: items.length };
  }

  isSyncing = true;
  console.log(`[OfflineSync] Starting auto-sync of ${items.length} pending quiz result(s)...`);

  const remaining: PendingQuizSyncItem[] = [];
  let syncedCount = 0;
  let errors = 0;

  for (const item of items) {
    try {
      const dbStudentId = isUuid(item.student_id) ? item.student_id : null;
      const dbWordbookId = isUuid(item.wordbook_id) ? item.wordbook_id : null;

      if (!dbWordbookId) {
        // If wordbook is not a valid DB UUID (e.g. sample or custom), remove it to avoid blocking queue
        syncedCount++;
        continue;
      }

      // 1. Insert quiz_results record
      const { error: qrErr } = await client.from('quiz_results').insert({
        ...(dbStudentId ? { student_id: dbStudentId } : {}),
        wordbook_id: dbWordbookId,
        total_score: item.total_score,
        max_score: item.max_score
      });

      if (qrErr) throw qrErr;

      // 2. Insert or update incorrect notes if any
      if (item.wrong_words && item.wrong_words.length > 0) {
        for (const wrong of item.wrong_words) {
          if (!isUuid(wrong.wordId)) continue;
          try {
            await client.from('incorrect_notes').insert({
              ...(dbStudentId ? { student_id: dbStudentId } : {}),
              word_id: wrong.wordId,
              wrong_count: 1,
              last_wrong_answer: wrong.wrongAnswer,
              is_resolved: false
            });
          } catch (incErr) {
            console.warn('[OfflineSync] Error syncing incorrect note item:', incErr);
          }
        }
      }

      syncedCount++;
      console.log(`[OfflineSync] Successfully synced quiz item: ${item.id}`);
    } catch (err) {
      console.error('[OfflineSync] Failed syncing item, keeping in queue:', item.id, err);
      remaining.push(item);
      errors++;
    }
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
  } catch (err) {
    console.error('[OfflineSync] Failed updating queue:', err);
  }

  isSyncing = false;

  window.dispatchEvent(
    new CustomEvent('vocat-pending-sync-updated', { detail: { count: remaining.length, syncedCount } })
  );

  return { syncedCount, errors };
}

/**
 * Initialize offline sync event listeners
 */
export function initOfflineSync(
  onStatusChange?: (isOnline: boolean, pendingCount: number) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = async () => {
    console.log('[OfflineSync] Connection restored (Online)!');
    const result = await syncPendingQuizResults();
    if (onStatusChange) {
      onStatusChange(true, getPendingQuizItems().length);
    }
  };

  const handleOffline = () => {
    console.log('[OfflineSync] Connection lost (Offline)!');
    if (onStatusChange) {
      onStatusChange(false, getPendingQuizItems().length);
    }
  };

  const handleFocus = () => {
    if (navigator.onLine && getPendingQuizItems().length > 0) {
      syncPendingQuizResults();
    }
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  window.addEventListener('focus', handleFocus);

  // Initial sync check if already online
  if (navigator.onLine && getPendingQuizItems().length > 0) {
    syncPendingQuizResults();
  }

  if (onStatusChange) {
    onStatusChange(navigator.onLine, getPendingQuizItems().length);
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    window.removeEventListener('focus', handleFocus);
  };
}
