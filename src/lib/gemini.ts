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
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash'
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
 * Extract word list from book image/PDF file using Gemini Multimodal OCR with Fallback Chain
 * Supports 'all' (entire page) or 'marked' (only circled/highlighted/underlined words)
 */
export async function extractWordsFromMultimodalFile(
  base64Data: string,
  mimeType: string,
  mode: 'all' | 'marked' = 'all'
): Promise<string> {
  const apiKey = getGeminiApiKey();
  
  if (!apiKey) {
    throw new Error('Gemini API 키가 설정되지 않았습니다. .env.local 환경 변수 설정을 확인해 주세요.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const promptAll = `제공된 교재 이미지/PDF 페이지에서 표제어, 단어, 숙어를 순서대로 추출하여 아래 포맷에 맞춰 텍스트로만 출력해 줘.

[출력 포맷 규칙]
단어, 발음기호, 품사, 한글 뜻

- 대괄호 [] 없는 발음기호 작성
- 복수 품사 및 복수 뜻은 세미콜론(;)으로 구분
- 마크다운 기호, 번호 매기기, 부가 설명 없이 각 단어를 한 줄씩 위 포맷대로만 출력할 것
- 예시:
opposite, ápəzit, 형용사; 명사, 반대쪽의; 정반대의; 반대의 사람[일/물건]
accompany, əkʌ́mpəni, 동사, 동반하다; 수반하다; 반주하다
keep track of, 숙어, 숙어, ~을 기록하다; ~의 자국을 뒤밟다`;

  const promptMarked = `제공된 교재 이미지/문서에서 손글씨로 '동그라미(원)'가 쳐져 있거나, '형광펜/밑줄'로 하이라이트 표시된 단어 및 숙어만 찾아서 추출해 줘.

[추출 및 작성 규칙]
1. 표시가 없는 일반 단어는 모두 제외하고, 오직 체크/표시된 단어만 추출할 것.
2. 추출된 단어의 발음기호, 품사, 한글 뜻은 교재에 적힌 내용을 그대로 매칭하여 작성할 것.
3. 출력 포맷:
   단어, 발음기호, 품사, 한글 뜻
   - 대괄호 [] 없는 발음기호
   - 복수 품사 및 복수 뜻은 세미콜론(;)으로 구분
   - 마크다운이나 부가 설명 없이 오직 한 줄에 한 단어씩 포맷대로만 출력할 것.
   - 예시:
   opposite, ápəzit, 형용사; 명사, 반대쪽의; 정반대의; 반대의 사람[일/물건]
   accompany, əkʌ́mpəni, 동사, 동반하다; 수반하다; 반주하다
   keep track of, 숙어, 숙어, ~을 기록하다; ~의 자국을 뒤밟다`;

  const promptText = mode === 'marked' ? promptMarked : promptAll;

  try {
    const response = await callGeminiWithFallback(ai, {
      contents: [
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        },
        {
          text: promptText
        }
      ]
    });

    return response.text || '';
  } catch (err: any) {
    console.error('Gemini multimodal OCR error:', err);
    throw err;
  }
}

/**
 * Auto-generate a wordbook using Gemini AI with Fallback Chain
 */
export async function generateWordbookWithGemini(
  topicOrText: string,
  wordCount: number = 10
): Promise<{ title: string; chapter: string; words: VocaBatchItem[] }> {
  const apiKey = getGeminiApiKey();
  
  if (!apiKey) {
    throw new Error('Gemini API 키가 설정되지 않았습니다. .env.local 환경 변수 설정을 확인해 주세요.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `You are an expert English Vocabulary Tutor creating a SensorSsam Voca dataset for Korean students.
Topic / Reference Text: "${topicOrText}"
Number of words to generate: ${wordCount}

Generate a JSON object with the following structure:
{
  "title": "Short Course / Book Title (e.g., CSAT Essential Voca, Tech English)",
  "chapter": "DAY 01",
  "words": [
    {
      "word": "English word or idiom",
      "pronunciation": "Phonetic symbols WITHOUT square brackets (e.g. pə̀ːrsəvíər or æpl)",
      "pos": "Part of speech in Korean (e.g. 동사, 명사, 형용사, 숙어)",
      "meaning": "Korean meaning (semicolon separated if multiple, e.g. 인내하다; 끈기있게 계속하다)",
      "example_sentence": "Natural English sentence containing the word",
      "example_translation": "Natural Korean translation of the example sentence",
      "is_spelling_priority": true or false (true if this word is essential for spelling practice),
      "is_idiom": true or false (true if it is a multi-word idiom or phrase)
    }
  ]
}

Return ONLY valid raw JSON without markdown codeblock wrapper or extra text.`;

  try {
    const response = await callGeminiWithFallback(ai, {
      contents: prompt,
      config: {
        temperature: 0.3,
        responseMimeType: 'application/json'
      }
    });

    const text = response.text || '';
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      title: parsed.title || 'AI 맞춤 단어장',
      chapter: parsed.chapter || 'DAY 01',
      words: parsed.words || []
    };
  } catch (err: any) {
    console.error('Failed to parse Gemini JSON output:', err);
    throw err;
  }
}

/**
 * AI Context Cloze Test Generator
 */
export async function generateContextClozeQuiz(
  words: { word: string; meaning: string }[]
): Promise<{ word: string; sentenceWithBlank: string; options: string[]; answerIndex: number }[]> {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    return generateFallbackClozeQuiz(words);
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Create a context fill-in-the-blank quiz for Korean English learners.
Input Words: ${JSON.stringify(words)}

Return a JSON array of questions:
[
  {
    "word": "target English word",
    "sentenceWithBlank": "Sentence where the target word is replaced by '______'.",
    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
    "answerIndex": 0-3 (index of correct option inside options array)
  }
]

Return ONLY raw JSON array.`;

  try {
    const response = await callGeminiWithFallback(ai, {
      contents: prompt,
      config: {
        temperature: 0.2,
        responseMimeType: 'application/json'
      }
    });

    const text = response.text || '';
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned);
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
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    return generateFallbackCoachingFeedback(stats);
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `You are an expert English Vocabulary Tutor creating a personalized learning evaluation summary for a student and their parents.
Student Name: ${stats.studentName}
Total Quizzes Taken: ${stats.totalQuizzes}
Average Quiz Accuracy: ${stats.avgScorePct}%
Vocabulary Mastery Rate: ${stats.masteryPct}%
Part 1 Spelling Accuracy: ${stats.spellingAccuracyPct}%
Part 2 Meaning Accuracy: ${stats.meaningAccuracyPct}%
Weakest Parts of Speech (POS): ${stats.weakPos.join(', ') || '없음'}
Top Repeatedly Failed Words: ${stats.topWrongWords.map(w => `${w.word}(${w.meaning}, ${w.wrongCount}회 오답)`).join(', ')}

Write a professional, encouraging, diagnostic 3-4 line evaluation comment in Korean for the student's report card.
Guidelines:
1. Briefly evaluate their current vocabulary strengths (e.g. spelling vs. meaning recall).
2. Point out specific weak areas (e.g. verbs/idioms or specific words).
3. Provide 1-2 actionable daily study advice tips for the upcoming week.
4. Keep tone polite, professional, and clear (no markdown headers, concise 3-4 sentences).`;

  try {
    const response = await callGeminiWithFallback(ai, {
      contents: prompt,
      config: {
        temperature: 0.3
      }
    });

    return response.text?.trim() || generateFallbackCoachingFeedback(stats);
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
