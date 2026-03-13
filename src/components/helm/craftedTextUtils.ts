import { SLL_DISTINCTIONS } from '../../lib/sllDefinitions';

/** Replace [[sll:key]] markers with the plain term text for clipboard use */
export function stripSLLMarkers(text: string): string {
  return text.replace(/\[\[sll:(\w+)\]\]/g, (_, key) => SLL_DISTINCTIONS[key]?.term || key);
}

/**
 * Extract the crafted suggestion from a Cyrano/Higgins AI response.
 * Returns { before, crafted, after } or null if no crafted block found.
 */
export function extractCraftedText(content: string): { before: string; crafted: string; after: string } | null {
  const leadInPatterns = [
    /(?:one way (?:you could |to )?(?:say|put|express) (?:it )?(?:is)?)\s*:?\s*\n/i,
    /(?:here(?:'s| is) (?:one way|how|a way|a version|what)(?: (?:you could|to) (?:say|put|express)(?: (?:it|this))?)?)\s*:?\s*\n/i,
    /(?:you (?:could|might) (?:say|try)(?: something like)?)\s*:?\s*\n/i,
    /(?:try (?:something like|this))\s*:?\s*\n/i,
    /(?:consider (?:saying|something like))\s*:?\s*\n/i,
  ];

  let leadMatch: RegExpMatchArray | null = null;
  for (const pattern of leadInPatterns) {
    leadMatch = content.match(pattern);
    if (leadMatch) break;
  }
  if (!leadMatch || leadMatch.index === undefined) return null;

  const leadEnd = leadMatch.index + leadMatch[0].length;
  const afterLeadIn = content.slice(leadEnd);
  const trimmedAfter = afterLeadIn.trimStart();
  const whitespaceLen = afterLeadIn.length - trimmedAfter.length;

  // Check if crafted text is wrapped in quotes (smart or regular)
  if (/^["\u201C]/.test(trimmedAfter)) {
    const closeQuoteMatch = trimmedAfter.match(/^["\u201C]([\s\S]+?)["\u201D]\s*(?:\n|$)/);
    if (closeQuoteMatch) {
      const crafted = closeQuoteMatch[1].trim();
      if (crafted.length >= 10) {
        return {
          before: content.slice(0, leadEnd).trimEnd(),
          crafted: stripSLLMarkers(crafted),
          after: afterLeadIn.slice(whitespaceLen + closeQuoteMatch[0].length).trim(),
        };
      }
    }
  }

  // Not quoted — take first paragraph (up to double newline)
  const doubleNewlineIdx = afterLeadIn.search(/\n\s*\n/);

  let crafted: string;
  let after: string;

  if (doubleNewlineIdx === -1) {
    crafted = afterLeadIn.trim();
    after = '';
  } else {
    crafted = afterLeadIn.slice(0, doubleNewlineIdx).trim();
    after = afterLeadIn.slice(doubleNewlineIdx).trim();
  }

  crafted = crafted.replace(/^["\u201C]/, '').replace(/["\u201D]$/, '');
  if (crafted.length < 10) return null;

  return {
    before: content.slice(0, leadEnd).trimEnd(),
    crafted: stripSLLMarkers(crafted),
    after,
  };
}
