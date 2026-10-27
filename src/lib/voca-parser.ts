import { VocaBatchItem } from '@/types/database';

/**
 * Checks if a line is a header row (e.g. 단어 | 발음기호 | 품사 | 뜻 | 예문 | 예문해석)
 */
function isHeaderLine(line: string): boolean {
  const lower = line.toLowerCase();
  const headerKeywords = ['word', '단어', 'meaning', '뜻', 'pronunciation', '발음', 'pos', '품사', 'example', '예문', 'translation', '해석'];
  let matchCount = 0;
  for (const kw of headerKeywords) {
    if (lower.includes(kw)) matchCount++;
  }
  return matchCount >= 2;
}

/**
 * 단어장 텍스트 일괄 등록 파싱 함수 (파이프 '|' 구분자 전용)
 * 
 * [파싱 규격 - 총 6개 필드]
 * 단어 | 발음기호 | 품사 | 뜻 | 예문 | 예문해석
 * 
 * [규칙]
 * 1. 열 구분자는 쉼표(,)가 아닌 오직 파이프(|) 기호 전용으로 분리합니다.
 * 2. 텍스트(예문/해석/뜻) 내부에 포함된 쉼표(,)나 세미콜론(;)은 절대 분리 기준이 되지 않고 원본 그대로 보존됩니다.
 * 3. 각 필드의 앞뒤 공백(trim)은 자동으로 안전하게 제거됩니다.
 * 4. 예문이나 해석, 발음기호가 비어 있는 경우(예: 단어||품사|뜻||)에도 인덱스 에러 없이 안전하게 등록됩니다.
 */
export function parseVocaText(rawText: string): VocaBatchItem[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText.split(/\r?\n/).filter(line => line.trim().length > 0);
  const items: VocaBatchItem[] = [];

  for (const line of lines) {
    let trimmedLine = line.trim();

    // 주석(#, //) 및 헤더 행 건너뛰기
    if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('//') || isHeaderLine(trimmedLine)) {
      continue;
    }

    // 마크다운 표 형태처럼 앞뒤가 모두 |로 감싸진 경우 앞뒤 파이프 제거
    if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|') && trimmedLine.length > 2) {
      trimmedLine = trimmedLine.slice(1, -1).trim();
    }

    // 오직 파이프(|) 기호로만 분리 (탭 키 입력 시 호환을 위해 파이프가 없을 때만 탭 지원)
    // 쉼표(,)나 세미콜론(;)은 절대로 분리 기준이 되지 않음!
    let parts: string[] = [];
    if (trimmedLine.includes('|')) {
      parts = trimmedLine.split('|');
    } else if (trimmedLine.includes('\t')) {
      parts = trimmedLine.split('\t');
    } else {
      parts = [trimmedLine];
    }

    // 각 필드의 앞뒤 공백(trim) 및 감싸고 있는 따옴표 안전하게 제거
    parts = parts.map(p => p.trim().replace(/^["']|["']$/g, '').trim());

    const word = parts[0] || '';
    if (!word) {
      // 단어가 비어 있으면 건너뜀
      continue;
    }

    let pronunciation = '';
    let pos = '';
    let meaning = '';
    let example_sentence = '';
    let example_translation = '';
    let is_spelling_priority_val: string | undefined;
    let is_idiom_val: string | undefined;

    if (parts.length === 2) {
      // 단어 | 뜻
      meaning = parts[1] || '';
    } else if (parts.length === 3) {
      // 단어 | 품사 | 뜻
      pos = parts[1] || '';
      meaning = parts[2] || '';
    } else {
      // 표준 6개 필드 규격: 단어 | 발음기호 | 품사 | 뜻 | 예문 | 예문해석
      // 인덱스 초과 에러 방지를 위해 (parts[i] || '') 안전 참조 처리
      pronunciation = (parts[1] || '').replace(/^\[|\]$/g, '').trim();
      pos = parts[2] || '';
      meaning = parts[3] || '';
      example_sentence = parts[4] || '';
      example_translation = parts[5] || '';
      is_spelling_priority_val = parts[6]?.toLowerCase();
      is_idiom_val = parts[7]?.toLowerCase();
    }

    const is_spelling_priority = is_spelling_priority_val
      ? (is_spelling_priority_val === 'true' || is_spelling_priority_val === '1' || is_spelling_priority_val === 'y' || is_spelling_priority_val === 'yes')
      : true;

    const is_idiom = is_idiom_val
      ? (is_idiom_val === 'true' || is_idiom_val === '1' || is_idiom_val === 'y' || is_idiom_val === 'yes')
      : (pos.includes('숙어') || word.includes(' '));

    items.push({
      word,
      pronunciation,
      pos,
      meaning,
      example_sentence,
      example_translation,
      is_spelling_priority,
      is_idiom
    });
  }

  return items;
}

/**
 * Format words to Pipe (|) format for copying/exporting.
 */
export function exportToVocaPipe(items: VocaBatchItem[]): string {
  const headers = ['단어', '발음기호', '품사', '뜻', '예문', '예문해석'];
  const rows = items.map(item => [
    item.word,
    item.pronunciation || '',
    item.pos || '',
    item.meaning,
    item.example_sentence || '',
    item.example_translation || ''
  ].join(' | '));

  return [headers.join(' | '), ...rows].join('\n');
}

/**
 * Format words back to TSV format with full example sentences.
 */
export function exportToVocaTSV(items: VocaBatchItem[]): string {
  const headers = ['Word', 'Pronunciation', 'POS', 'Meaning', 'Example Sentence', 'Example Translation', 'Spelling Priority', 'Is Idiom'];
  const rows = items.map(item => [
    item.word,
    item.pronunciation || '',
    item.pos || '',
    item.meaning,
    item.example_sentence || '',
    item.example_translation || '',
    item.is_spelling_priority ? 'TRUE' : 'FALSE',
    item.is_idiom ? 'TRUE' : 'FALSE'
  ].join('\t'));

  return [headers.join('\t'), ...rows].join('\n');
}
