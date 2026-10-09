import { GoogleGenAI } from '@google/genai';
import { VocaBatchItem } from '@/types/database';

export function getGeminiApiKey(): string {
  // 1. Primary Priority: Web server environment variable (process.env.NEXT_PUBLIC_GEMINI_API_KEY)
  const envKey = (process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '').trim();
  if (envKey.length > 0) {
    return envKey;
  }

  // 2. Secondary Fallback: User local storage override (only used if server env key is not set)
  if (typeof window !== 'undefined') {
    const customKey = localStorage.getItem('vocat_gemini_api_key');
    if (customKey && customKey.trim().length > 0) return customKey.trim();
  }

  return '';
}

/**
 * Candidate models ordered by reliability & fallback priority
 */
const FALLBACK_MODEL_CHAIN = [
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite'
];

/**
 * Helper function to call Gemini API with automatic model fallback & transient error retries
 */
async function callGeminiWithFallback(
  ai: GoogleGenAI,
  params: {
    contents: any;
    config?: any;
  }
): Promise<any> {
  let lastError: any = null;

  for (const model of FALLBACK_MODEL_CHAIN) {
    try {
      const response = await ai.models.generateContent({
        model,
        ...params
      });
      return response;
    } catch (err: any) {
      lastError = err;
      console.warn(`[Gemini API Warning] Model '${model}' call failed:`, err?.message || err);
      // Continue to next candidate model
      continue;
    }
  }

  // Handle ultimate failure after all fallback candidates failed
  const finalErrRaw = String(lastError?.message || lastError || '');
  const finalErrStr = finalErrRaw.toLowerCase();

  if (finalErrStr.includes('api_key') || finalErrStr.includes('invalid') || finalErrStr.includes('400') || finalErrStr.includes('403')) {
    throw new Error('입력하신 Gemini API 키가 올바르지 않거나 권한이 없습니다. Google AI Studio에서 발급받은 API 키를 확인해 주세요.');
  }

  if (
    finalErrStr.includes('503') ||
    finalErrStr.includes('high demand') ||
    finalErrStr.includes('unavailable') ||
    finalErrStr.includes('overloaded') ||
    finalErrStr.includes('429') ||
    finalErrStr.includes('resource_exhausted')
  ) {
    throw new Error('구글 AI 서버 한도 초과 또는 트래픽 급증입니다. 3~5초 후 다시 시도해 주세요.');
  }

  if (
    finalErrStr.includes('404') ||
    finalErrStr.includes('not_found') ||
    finalErrStr.includes('api_key') ||
    finalErrStr.includes('invalid') ||
    finalErrStr.includes('400') ||
    finalErrStr.includes('403')
  ) {
    throw new Error('Gemini API 키가 올바르지 않거나 권한이 없습니다. Google AI Studio(https://aistudio.google.com/app/apikey)에서 AIza로 시작하는 무료 API 키를 발급받아 새로 입력해 주세요.');
  }

  throw new Error('Gemini AI 서비스 호출 중 오류가 발생했습니다. API 키 상태를 확인해 주세요.');
}

/**
 * Compresses large camera photos before sending to Gemini API route
 * Prevents 413 Payload Too Large / Network Timeouts
 */
export async function compressImageBase64(
  base64Data: string,
  mimeType: string
): Promise<{ base64Data: string; mimeType: string }> {
  if (typeof window === 'undefined' || !mimeType || !mimeType.startsWith('image/')) {
    return { base64Data, mimeType };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const maxDim = 1600;
      let width = img.width;
      let height = img.height;

      if (width <= maxDim && height <= maxDim && base64Data.length < 1000000) {
        return resolve({ base64Data, mimeType });
      }

      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve({ base64Data, mimeType });

      ctx.drawImage(img, 0, 0, width, height);
      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const compressedBase64 = compressedDataUrl.split(',')[1] || base64Data;
      resolve({ base64Data: compressedBase64, mimeType: 'image/jpeg' });
    };

    img.onerror = () => resolve({ base64Data, mimeType });
    img.src = `data:${mimeType};base64,${base64Data}`;
  });
}

/**
 * Helper function to call server-side Next.js API route (/api/gemini)
 */
async function callServerGeminiApi(payload: any): Promise<any> {
  const customApiKey = getGeminiApiKey();
  let res: Response;
  try {
    res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        customApiKey: customApiKey || undefined
      })
    });
  } catch (netErr: any) {
    throw new Error('웹 서버에 연결할 수 없습니다. 인터넷 네트워크 연결 상태를 확인해 주세요.');
  }

  let data: any = {};
  try {
    data = await res.json();
  } catch (e) {
    throw new Error(`서버 응답 오류 (HTTP ${res.status}): 요청 처리 중 오류가 발생했습니다.`);
  }

  if (!res.ok || data.error) {
    throw new Error(data.error || 'Gemini AI 서비스 처리 중 오류가 발생했습니다.');
  }
  return data;
}

/**
 * Extract word list from book image/PDF file using Gemini Multimodal OCR
 * Supports 'all' (entire page) or 'marked' (only circled/highlighted/underlined words)
 */
export async function extractWordsFromMultimodalFile(
  base64Data: string,
  mimeType: string,
  mode: 'all' | 'marked' = 'all'
): Promise<string> {
  const compressed = await compressImageBase64(base64Data, mimeType);
  const data = await callServerGeminiApi({
    action: 'extract_multimodal',
    base64Data: compressed.base64Data,
    mimeType: compressed.mimeType,
    mode
  });
  return data.result || '';
}

/**
 * Auto-generate a wordbook using Gemini AI
 */
export async function generateWordbookWithGemini(
  topicOrText: string,
  wordCount: number = 10
): Promise<{ title: string; chapter: string; words: VocaBatchItem[] }> {
  const data = await callServerGeminiApi({
    action: 'generate_wordbook',
    topicOrText,
    wordCount
  });

  return {
    title: data.title || 'AI 맞춤 단어장',
    chapter: data.chapter || 'DAY 01',
    words: data.words || []
  };
}

/**
 * AI Context Cloze Test Generator
 */
export async function generateContextClozeQuiz(
  words: { word: string; meaning: string }[]
): Promise<{ word: string; sentenceWithBlank: string; options: string[]; answerIndex: number }[]> {
  try {
    const data = await callServerGeminiApi({
      action: 'generate_cloze_quiz',
      words
    });

    if (data.questions && Array.isArray(data.questions)) {
      return data.questions;
    }
    return generateFallbackClozeQuiz(words);
  } catch (err) {
    console.warn('Gemini quiz generation fallback:', err);
    return generateFallbackClozeQuiz(words);
  }
}

function generateFallbackClozeQuiz(words: { word: string; meaning: string }[]) {
  const allWordNames = words.map(w => w.word);

  return words.map(item => {
    const distractors = allWordNames.filter(w => w !== item.word);
    const shuffledDistractors = distractors.sort(() => 0.5 - Math.random()).slice(0, 3);
    const options = [item.word, ...shuffledDistractors].sort(() => 0.5 - Math.random());
    const answerIndex = options.indexOf(item.word);

    return {
      word: item.word,
      sentenceWithBlank: `Please choose the word that means "${item.meaning}": ______`,
      options,
      answerIndex
    };
  });
}

/**
 * AI Student Evaluation Feedback Generator with Fallback Chain
 */
export async function generateStudentEvaluationFeedback(stats: {
  studentName: string;
  totalQuizzes: number;
  avgScorePct: number;
  masteryPct: number;
  spellingAccuracyPct: number;
  meaningAccuracyPct: number;
  weakPos: string[];
  topWrongWords: { word: string; pos?: string | null; meaning: string; wrongCount: number }[];
}): Promise<string> {
  try {
    const data = await callServerGeminiApi({
      action: 'generate_student_feedback',
      stats
    });

    if (data.feedback && typeof data.feedback === 'string') {
      return data.feedback;
    }
    return generateFallbackCoachingFeedback(stats);
  } catch (err) {
    console.warn('Gemini student feedback generation fallback:', err);
    return generateFallbackCoachingFeedback(stats);
  }
}

function generateFallbackCoachingFeedback(stats: {
  avgScorePct: number;
  spellingAccuracyPct: number;
  meaningAccuracyPct: number;
  weakPos: string[];
  topWrongWords: { word: string }[];
}): string {
  let feedback = `현재 평균 정답률 ${stats.avgScorePct}%로 성실한 단어 학습을 이어나가고 있습니다. `;
  
  if (stats.spellingAccuracyPct < stats.meaningAccuracyPct) {
    feedback += `한글 뜻 선택(Part 2)에 비해 영단어 스펠링 직접 쓰기(Part 1, 정답률 ${stats.spellingAccuracyPct}%)에서 철자 실수가 다수 발견되었습니다. `;
  } else {
    feedback += `스펠링 인출 능력(Part 1)은 우수하나 다의어 및 문맥 속 단어 뜻 구분(Part 2) 연습이 추가로 권장됩니다. `;
  }

  if (stats.weakPos.length > 0) {
    feedback += `특히 '${stats.weakPos.join(', ')}' 유형에서 오답 빈도가 높으므로 해당 품사 단어들의 예문 학습과 플래시카드 반복 학습이 필요합니다.`;
  } else {
    feedback += `오답 노트에 수록된 고빈도 오답 단어들을 매일 10분씩 집중 재시험 치르기를 권장합니다.`;
  }

  return feedback;
}

/**
 * AI Real-time Meaning Grading Helper
 */
export async function gradeStudentAnswerWithGemini(
  word: string,
  correctMeaning: string,
  pos: string,
  studentAnswer: string
): Promise<{ isCorrect: boolean; score: number; feedback: string }> {
  if (!studentAnswer || !studentAnswer.trim()) {
    return { isCorrect: false, score: 0, feedback: '답안이 입력되지 않았습니다.' };
  }

  try {
    const data = await callServerGeminiApi({
      action: 'grade_ai_test',
      word,
      correctMeaning,
      pos,
      studentAnswer
    });

    return {
      isCorrect: Boolean(data.isCorrect),
      score: Number(data.score || 0),
      feedback: data.feedback || (data.isCorrect ? '정답입니다!' : '오답입니다.')
    };
  } catch (err) {
    console.warn('Gemini AI grading fallback:', err);
    // Intelligent local fallback if offline or AI call fails
    const cleanedStudent = studentAnswer.trim().toLowerCase();
    const meanings = correctMeaning.split(/[;,]/).map(m => m.trim().toLowerCase());
    const match = meanings.some(m => cleanedStudent.includes(m) || m.includes(cleanedStudent));

    return {
      isCorrect: match,
      score: match ? 100 : 0,
      feedback: match
        ? '정답입니다! (로컬 사전 자동 확인)'
        : `오답입니다. 올바른 뜻: ${correctMeaning}`
    };
  }
}

