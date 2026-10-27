/**
 * SpeechSynthesis TTS helper with full Offline & Mobile PWA support.
 */

let cachedVoices: SpeechSynthesisVoice[] = [];

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  cachedVoices = window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
}

export function speakText(text: string, rate: number = 1.0, onEnd?: () => void): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('SpeechSynthesis is not supported in this browser.');
    if (onEnd) onEnd();
    return;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = rate; // 1.0 (Normal) or 0.75 (Slow)

  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  const voices = cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices();

  // Voice Selection Strategy:
  // If offline, prioritize localService voices (installed natively on device) to prevent network-voice timeouts
  let englishVoice: SpeechSynthesisVoice | undefined;

  if (isOffline) {
    englishVoice = voices.find(v => v.lang.startsWith('en') && v.localService === true) ||
                   voices.find(v => v.lang.startsWith('en') && (v.name.includes('Samantha') || v.name.includes('David') || v.name.includes('Local') || v.name.includes('Zira') || v.name.includes('Android')));
  } else {
    englishVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('David'))) ||
                   voices.find(v => v.lang.startsWith('en'));
  }

  if (englishVoice) {
    utterance.voice = englishVoice;
  }

  // Fallback retry if voice fails offline
  let hasEnded = false;
  const finish = () => {
    if (!hasEnded) {
      hasEnded = true;
      if (onEnd) onEnd();
    }
  };

  utterance.onend = finish;
  utterance.onerror = (e) => {
    console.warn('[Audio TTS] Playback notice/error:', e.error);
    // If voice was specified and it failed (common with remote voices when going offline), retry without custom voice
    if (utterance.voice && (e.error === 'network' || e.error === 'voice-unavailable' || e.error === 'audio-busy')) {
      try {
        const fallbackUtterance = new SpeechSynthesisUtterance(text);
        fallbackUtterance.lang = 'en-US';
        fallbackUtterance.rate = rate;
        fallbackUtterance.onend = finish;
        fallbackUtterance.onerror = finish;
        window.speechSynthesis.speak(fallbackUtterance);
        return;
      } catch (retryErr) {
        console.warn('[Audio TTS] Fallback retry error:', retryErr);
      }
    }
    finish();
  };

  // Resume paused synthesis on mobile browsers
  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
  }

  window.speechSynthesis.speak(utterance);
}

export function stopSpeech(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

