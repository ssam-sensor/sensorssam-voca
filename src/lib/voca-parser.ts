import { VocaBatchItem } from '@/types/database';

/**
 * Parses raw text input into structured VocaBatchItems.
 * Supports CSV (comma up to 4 fields), TSV (tab), Pipe (|), or Colon (:) formats:
 * Format 1 (Comma): Word, Pronunciation, POS, Meaning (Extra commas merged into Meaning)
 * Format 2 (TSV): Word \t Pronunciation \t POS \t Meaning \t Example \t Translation
 * Note: Semicolons (;) are NEVER used as column splitters to preserve multi-POS & multi-meaning!
 */
export function parseVocaText(rawText: string): VocaBatchItem[] {
  const lines = rawText.split(/\r?\n/).filter(line => line.trim().length > 0);
  const items: VocaBatchItem[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip comment or header lines
    if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.toLowerCase().startsWith('word\t') || trimmedLine.toLowerCase().startsWith('word,')) {
      continue;
    }

    let parts: string[] = [];

    if (trimmedLine.includes('\t')) {
      parts = trimmedLine.split('\t');
    } else if (trimmedLine.includes('|')) {
      parts = trimmedLine.split('|');
    } else if (trimmedLine.includes(',')) {
      // Split by comma with max 4 fields
      const rawParts = trimmedLine.split(',');
      if (rawParts.length <= 4) {
        parts = rawParts;
      } else {
        // Field 1: Word, Field 2: Pronunciation, Field 3: POS. Fields 4+ merged into Meaning
        const wordPart = rawParts[0];
        const pronPart = rawParts[1];
        const posPart = rawParts[2];
        const meaningPart = rawParts.slice(3).join(', ');
        parts = [wordPart, pronPart, posPart, meaningPart];
      }
    } else if (trimmedLine.includes(':')) {
      parts = trimmedLine.split(':');
    } else {
      parts = [trimmedLine];
    }

    parts = parts.map(p => p.trim());

    if (!parts[0]) continue;

    const word = parts[0];
    let pronunciation = (parts[1] || '').replace(/^\[|\]$/g, '').trim();
    const pos = parts[2] || '';
    const meaning = parts.length <= 2 ? (parts[1] || '') : (parts[3] || '');
    const example_sentence = parts[4] || '';
    const example_translation = parts[5] || '';

    const is_spelling_priority_val = parts[6]?.toLowerCase();
    const is_spelling_priority = parts[6] 
      ? (is_spelling_priority_val === 'true' || is_spelling_priority_val === '1' || is_spelling_priority_val === 'y' || is_spelling_priority_val === 'yes')
      : true; // Default true for spelling test eligibility

    const is_idiom_val = parts[7]?.toLowerCase();
    const is_idiom = parts[7]
      ? (is_idiom_val === 'true' || is_idiom_val === '1' || is_idiom_val === 'y' || is_idiom_val === 'yes')
      : word.includes(' ');

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
 * Format words back to TSV or VocaT text format for copying/exporting.
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
