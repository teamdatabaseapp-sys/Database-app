/**
 * Legal Content Parser
 *
 * Parses raw legal text strings into typed blocks so the UI can render:
 *   - Numbered subsection headings  →  grey rounded container (Title Case)
 *   - Regular paragraphs / bullets  →  plain body text
 *
 * Detection pattern: a line that starts with a number, a period (or period+space),
 * and at least two more characters — e.g. "1. About This Policy" or
 * "5. EXCEPTIONS" or "1.1 Your Responsibilities"
 *
 * This is PURELY a rendering utility. It never modifies legal text content.
 */

export type LegalBlock =
  | { type: 'heading'; num: string; title: string }
  | { type: 'body'; text: string };

/** Convert ALL_CAPS to Title Case for consistent subsection display */
function toTitleCase(str: string): string {
  // If the string is already mixed case leave it alone
  if (str !== str.toUpperCase()) return str.trim();
  return str
    .toLowerCase()
    // Capitalize first letter of each word, but NOT after apostrophes
    .replace(/(?:^|\s)\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Tests whether a line is a numbered subsection heading.
 * Matches patterns like:
 *   "1. WHAT THIS MEANS"
 *   "12. Compliance and Consumer Protection"
 *   "1.1 Your Responsibilities"
 *   "6.4 Essential Basis of Agreement"
 * Does NOT match things like "• bullet" or regular sentences.
 */
function isSubsectionHeading(line: string): { num: string; title: string } | null {
  const trimmed = line.trim();
  // Pattern: optional leading spaces, number(s) [dot sub-number] dot/space, then text
  const match = trimmed.match(/^(\d+(?:\.\d+)?)[.\s]\s+(.{2,})$/);
  if (!match) return null;

  const num = match[1];
  const rawTitle = match[2].trim();

  // Reject lines that look like they start a sub-bullet list
  // (e.g. "1. Please don't use DataBase to:" — these are intro sentences, not headings)
  // Heuristic: real headings are short (≤ 80 chars) and don't end with a colon
  // that begins a list. We keep anything ≤ 80 chars.
  if (rawTitle.length > 80) return null;

  return { num, title: toTitleCase(rawTitle) };
}

/**
 * Parse a full legal content string into an array of typed blocks.
 * Consecutive body lines are merged into a single body block.
 */
export function parseLegalContent(raw: string): LegalBlock[] {
  const lines = raw.split('\n');
  const blocks: LegalBlock[] = [];
  let bodyBuffer: string[] = [];

  const flushBody = () => {
    const text = bodyBuffer.join('\n').trim();
    if (text) blocks.push({ type: 'body', text });
    bodyBuffer = [];
  };

  for (const line of lines) {
    const heading = isSubsectionHeading(line);
    if (heading) {
      flushBody();
      blocks.push({ type: 'heading', ...heading });
    } else {
      bodyBuffer.push(line);
    }
  }
  flushBody();

  return blocks;
}
