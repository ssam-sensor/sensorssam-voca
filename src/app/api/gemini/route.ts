import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const FALLBACK_MODEL_CHAIN = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash'
];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const apiKey = (
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      body.customApiKey ||
      ''
    ).trim();

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

      let resultText = '';
      let lastError: any = null;

      for (const model of FALLBACK_MODEL_CHAIN) {
        try {
          const response = await ai.models.generateContent({
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
          });
          resultText = response.text || '';
          if (resultText) break;
        } catch (e: any) {
          lastError = e;
          console.warn(`[Gemini Route Warning] model ${model} failed:`, e?.message || e);
        }
      }

      if (!resultText && lastError) {
        const errStr = String(lastError?.message || lastError || '').toLowerCase();
        if (errStr.includes('api_key') || errStr.includes('invalid') || errStr.includes('400') || errStr.includes('403') || errStr.includes('404')) {
          return NextResponse.json(
            { error: '웹 서버에 설정된 GEMINI_API_KEY가 올바르지 않거나 권한이 없습니다. Google AI Studio에서 키 상태를 확인해 주세요.' },
            { status: 400 }
          );
        }
        return NextResponse.json(
          { error: lastError?.message || '교재 이미지 단어 추출 중 오류가 발생했습니다.' },
          { status: 500 }
        );
      }

      return NextResponse.json({ result: resultText });
    }

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

      let resultText = '';
      let lastError: any = null;

      for (const model of FALLBACK_MODEL_CHAIN) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              temperature: 0.3,
              responseMimeType: 'application/json'
            }
          });
          resultText = response.text || '';
          if (resultText) break;
        } catch (e: any) {
          lastError = e;
        }
      }

      if (!resultText && lastError) {
        return NextResponse.json(
          { error: lastError?.message || 'AI 단어장 생성 중 오류가 발생했습니다.' },
          { status: 500 }
        );
      }

      const cleaned = resultText.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return NextResponse.json({
        title: parsed.title || 'AI 맞춤 단어장',
        chapter: parsed.chapter || 'DAY 01',
        words: parsed.words || []
      });
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
