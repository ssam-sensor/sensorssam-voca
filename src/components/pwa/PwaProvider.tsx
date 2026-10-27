'use client';

import React, { useEffect, useState } from 'react';
import { initOfflineSync, getPendingQuizItems, syncPendingQuizResults } from '@/lib/offline-sync';
import { WifiOff, Wifi, RefreshCw, Download, CheckCircle2, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PwaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [showSyncSuccessToast, setShowSyncSuccessToast] = useState<boolean>(false);
  const [syncedAmount, setSyncedAmount] = useState<number>(0);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState<boolean>(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Initial Online Status
    setIsOnline(navigator.onLine);
    setPendingCount(getPendingQuizItems().length);

    // 2. Register Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('[PWA] Service Worker registered successfully with scope:', reg.scope);
          })
          .catch((err) => {
            console.warn('[PWA] Service Worker registration failed:', err);
          });
      });
    }

    // 3. Setup Offline Sync and Network Status Listener
    const cleanupSync = initOfflineSync((online, count) => {
      setIsOnline(online);
      setPendingCount(count);
    });

    // 4. Custom sync updated event listener
    const handleSyncUpdated = (e: any) => {
      const count = e.detail?.count ?? getPendingQuizItems().length;
      const synced = e.detail?.syncedCount ?? 0;
      setPendingCount(count);

      if (synced > 0) {
        setSyncedAmount(synced);
        setShowSyncSuccessToast(true);
        setTimeout(() => {
          setShowSyncSuccessToast(false);
        }, 4000);
      }
    };

    window.addEventListener('vocat-pending-sync-updated', handleSyncUpdated);

    // 5. BeforeInstallPrompt (PWA Install to Home Screen)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      cleanupSync();
      window.removeEventListener('vocat-pending-sync-updated', handleSyncUpdated);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] Install prompt outcome: ${outcome}`);
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  const handleManualSync = async () => {
    if (!navigator.onLine) {
      alert('현재 오프라인 상태입니다. 인터넷에 연결된 후 동기화를 진행해 주세요.');
      return;
    }
    const res = await syncPendingQuizResults();
    if (res.syncedCount > 0) {
      setSyncedAmount(res.syncedCount);
      setShowSyncSuccessToast(true);
      setTimeout(() => setShowSyncSuccessToast(false), 4000);
    } else {
      alert('동기화할 대기 중인 오프라인 퀴즈 결과가 없습니다.');
    }
  };

  return (
    <>
      {children}

      {/* Floating Offline Status Banner */}
      {!isOnline && !isBannerDismissed && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-4 z-50 max-w-md bg-slate-900/95 text-white p-3.5 rounded-2xl shadow-2xl border border-slate-700/60 backdrop-blur-md flex items-center justify-between gap-3 animate-in slide-in-from-bottom duration-300"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <WifiOff className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold truncate">오프라인 학습 모드 동작 중</p>
              <p className="text-[11px] text-slate-300 truncate">
                {pendingCount > 0
                  ? `저장 대기 퀴즈 기록 ${pendingCount}건 (온라인 복구 시 자동 동기화)`
                  : '이미 저장된 단어장 플래시카드 & 퀴즈 응시 가능'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsBannerDismissed(true)}
            className="text-slate-400 hover:text-white p-1 rounded-lg shrink-0"
            title="배너 닫기"
            aria-label="오프라인 알림 닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </aside>
      )}

      {/* Sync Success Floating Toast */}
      {showSyncSuccessToast && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 max-w-sm bg-emerald-600 text-white p-3.5 rounded-2xl shadow-xl flex items-center gap-2.5 animate-in slide-in-from-bottom duration-300"
        >
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-100" />
          <div className="text-xs font-semibold">
            <p className="font-bold">온라인 동기화 완료!</p>
            <p className="text-emerald-100 text-[11px]">
              오프라인에서 완료한 퀴즈 결과 {syncedAmount}건이 서버에 저장되었습니다.
            </p>
          </div>
        </aside>
      )}

      {/* Online Notification Pill (Shows when there are pending items waiting to sync) */}
      {isOnline && pendingCount > 0 && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed bottom-4 left-4 z-40 bg-blue-600 text-white px-3.5 py-2 rounded-xl shadow-lg flex items-center gap-2 text-xs font-bold animate-in fade-in"
        >
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>오프라인 퀴즈 결과 동기화 중 ({pendingCount}건)...</span>
          <button
            onClick={handleManualSync}
            className="ml-1 px-2 py-0.5 bg-blue-700 hover:bg-blue-800 rounded text-[10px] font-bold"
          >
            지금 동기화
          </button>
        </aside>
      )}

      {/* PWA Install Quick Button (Only shown when browser allows installation and not yet installed) */}
      {isInstallable && (
        <button
          onClick={handleInstallClick}
          className="fixed top-3 right-3 z-40 hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 text-white text-xs font-bold border border-slate-700/80 shadow-lg hover:bg-slate-800 transition-all backdrop-blur-md"
          title="스마트폰/PC 홈 화면에 SensorSsam Voca 앱 설치하기"
        >
          <Download className="w-3.5 h-3.5 text-blue-400" />
          <span>앱 설치</span>
        </button>
      )}
    </>
  );
};
