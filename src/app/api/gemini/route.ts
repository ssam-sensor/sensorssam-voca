import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const FALLBACK_MODEL_CHAIN = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b'
];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function executeGeminiWithRetry(
  ai: GoogleGenAI,
  generateParamsFunc: (model: string) => any,
  maxRetries = 2
): Promise<string> {
  let lastErr: any = null;

  for (const model of FALLBACK_MODEL_CHAIN) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await ai.models.generateContent(generateParamsFunc(model));
        const text = response.text || '';
        if (text) return text;
      } catch (err: any) {
        lastErr = err;
        const errStr = String(err?.message || err || '').toLowerCase();
        const is503 =
          errStr.includes('503') ||
          errStr.includes('unavailable') ||
          errStr.includes('capacity') ||
          errStr.includes('429') ||
          errStr.includes('overloaded') ||
          errStr.includes('resource_exhausted');

        console.warn(
          `[Gemini Route Retry] model=${model} attempt=${attempt} err=${errStr.slice(0, 120)}`
        );

        if (is503 && attempt < maxRetries) {
          await sleep(1000 * (attempt + 1));
          continue;
        } else {
          // Break inner attempt loop and try next model in FALLBACK_MODEL_CHAIN
          break;
        }
      }
    }
  }

  const finalErrRaw = String(lastErr?.message || lastErr || '');
  const finalErrStr = finalErrRaw.toLowerCase();

  if (
    finalErrStr.includes('503') ||
    finalErrStr.includes('capacity') ||
    finalErrStr.includes('unavailable') ||
    finalErrStr.includes('resource_exhausted') ||
    finalErrStr.includes('overloaded') ||
    finalErrStr.includes('429')
  ) {
    throw new Error('구글 AI 서버 트래픽(503 한도)이 일시적으로 급증했습니다. 3~5초 후 다시 시도해 주세요.');
  }

  if (
    finalErrStr.includes('api_key') ||
    finalErrStr.includes('invalid') ||
    finalErrStr.includes('400') ||
    finalErrStr.includes('403') ||
    finalErrStr.includes('permission_denied') ||
    finalErrStr.includes('unauthenticated')
  ) {
    throw new Error(
      '웹 서버에 설정된 GEMINI_API_KEY가 올바르지 않거나 권한이 없습니다. Google AI Studio(https://aistudio.google.com/app/apikey)에서 키 상태를 확인해 주세요.'
    );
  }

  throw new Error(finalErrRaw || 'Gemini AI 서비스 처리 중 오류가 발생했습니다.');
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawKey = (
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      body.customApiKey ||
      ''
    );
    const apiKey = rawKey.replace(/^["']|["']$/g, '').trim();

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            '웹 서버에 GEMINI_API_KEY 환경변수가 설정되지 않았습니다. 웹서버 설정(.env.local 또는 서버 환경변수)에서 GEMINI_API_KEY를 등록해 주세요.'
        },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const { action } = body;

    // 1. Extract words from multimodal file (Image/PDF)
    if (action === 'extract_multimodal') {
      const { base64Data, mimeType, mode } = body;

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
        const resultText = await executeGeminiWithRetry(ai, (model) => ({
          model,
          contents: [
            {
              inlineData: {
                mimeType: mimeType || 'image/png',
                data: base64Data
              }
            },
            { text: promptText }
          ]
        }));

        return NextResponse.json({ result: resultText });
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
      }
    }

    // 2. Auto generate wordbook
    if (action === 'generate_wordbook') {
      const { topicOrText, wordCount = 10 } = body;
      const prompt = `You are an expert English Vocabulary Tutor creating a SensorSsam Voca dataset for Korean students.
Topic / Reference Text: "${topicOrText}"
Number of words to generate: ${wordCount}

Generate a JSON object with the following structure:
{
  "title": "Short Course / Book Title",
  "chapter": "DAY 01",
  "words": [
    {
      "word": "English word or idiom",
      "pronunciation": "Phonetic symbols WITHOUT square brackets",
      "pos": "Part of speech in Korean",
      "meaning": "Korean meaning",
      "example_sentence": "Natural English sentence",
      "example_translation": "Natural Korean translation",
      "is_spelling_priority": true or false,
      "is_idiom": true or false
    }
  ]
}

Return ONLY valid raw JSON without markdown codeblock wrapper or extra text.`;

      try {
        const resultText = await executeGeminiWithRetry(ai, (model) => ({
          model,
          contents: prompt,
          config: {
            temperature: 0.3,
            responseMimeType: 'application/json'
          }
        }));

        const cleaned = resultText.replace(/```json\n?|\n?```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return NextResponse.json({
          title: parsed.title || 'AI 맞춤 단어장',
          chapter: parsed.chapter || 'DAY 01',
          words: parsed.words || []
        });
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
      }
    }

    // 3. Context Cloze Quiz Generator
    if (action === 'generate_cloze_quiz') {
      const { words } = body;
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
        const resultText = await executeGeminiWithRetry(ai, (model) => ({
          model,
          contents: prompt,
          config: {
            temperature: 0.2,
            responseMimeType: 'application/json'
          }
        }));

        const cleaned = resultText.replace(/```json\n?|\n?```/g, '').trim();
        const questions = JSON.parse(cleaned);
        return NextResponse.json({ questions });
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
      }
    }

    // 4. Student Evaluation Feedback Generator
    if (action === 'generate_student_feedback') {
      const { stats } = body;
      const prompt = `You are an expert English Vocabulary Tutor creating a personalized learning evaluation summary for a student and their parents.
Student Name: ${stats.studentName}
Total Quizzes Taken: ${stats.totalQuizzes}
Average Quiz Accuracy: ${stats.avgScorePct}%
Vocabulary Mastery Rate: ${stats.masteryPct}%
Part 1 Spelling Accuracy: ${stats.spellingAccuracyPct}%
Part 2 Meaning Accuracy: ${stats.meaningAccuracyPct}%
Weakest Parts of Speech (POS): ${stats.weakPos?.join(', ') || '없음'}
Top Repeatedly Failed Words: ${stats.topWrongWords?.map((w: any) => `${w.word}(${w.meaning}, ${w.wrongCount}회 오답)`).join(', ')}

Write a professional, encouraging, diagnostic 3-4 line evaluation comment in Korean for the student's report card.
Guidelines:
1. Briefly evaluate their current vocabulary strengths (e.g. spelling vs. meaning recall).
2. Point out specific weak areas (e.g. verbs/idioms or specific words).
3. Provide 1-2 actionable daily study advice tips for the upcoming week.
4. Keep tone polite, professional, and clear (no markdown headers, concise 3-4 sentences).`;

      try {
        const resultText = await executeGeminiWithRetry(ai, (model) => ({
          model,
          contents: prompt,
          config: {
            temperature: 0.3
          }
        }));

        return NextResponse.json({ feedback: resultText.trim() });
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
      }
    }

    return NextResponse.json({ error: '알 수 없는 요청 형식입니다.' }, { status: 400 });
  } catch (error: any) {
    console.error('[Gemini Route Error]:', error);
    return NextResponse.json(
      { error: error?.message || '서버 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

