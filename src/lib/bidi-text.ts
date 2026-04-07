/**
 * Wraps Latin/number sequences in Unicode BiDi isolation characters
 * so English terms (e.g. "IVS 2025", "S570", "DRC") display correctly
 * inside Arabic paragraphs without breaking word order.
 *
 * LRI = U+2066 (Left-to-Right Isolate)
 * PDI = U+2069 (Pop Directional Isolate)
 */
const LRI = '\u2066';
const PDI = '\u2069';

// Matches sequences of Latin letters, digits, punctuation, and spaces between them
// e.g. "IVS 2025", "S570", "DRC", "IVSC", "15%", "3.5"
const LATIN_SEQUENCE = /([A-Za-z0-9][A-Za-z0-9\s.,:%/\-()]*[A-Za-z0-9%)]|[A-Za-z0-9]+)/g;

export function isolateBidiText(text: string): string {
  if (!text) return text;
  return text.replace(LATIN_SEQUENCE, `${LRI}$1${PDI}`);
}
