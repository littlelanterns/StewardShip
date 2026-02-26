import { sendChatMessage } from './ai';

/**
 * Parse freeform text into a list of item strings using AI.
 * Falls back to line splitting if AI parsing fails.
 */
export async function parseBulkItems(
  inputText: string,
  listTitle: string,
  userId: string,
): Promise<string[]> {
  const trimmed = inputText.trim();
  if (!trimmed) return [];

  try {
    const systemPrompt = `You are a helpful assistant that parses text into list items. The user is adding items to a list called "${listTitle}". Extract individual items from their input text. Return ONLY a JSON array of strings, no other text. Example: ["item 1", "item 2", "item 3"]. If the input is already a clear list (one item per line, comma-separated, numbered, etc.), parse accordingly. If it's a paragraph or sentence, extract the distinct items mentioned.`;

    const response = await sendChatMessage(
      systemPrompt,
      [{ role: 'user', content: trimmed }],
      512,
      userId,
    );

    // Try to parse JSON from the response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
        return parsed.filter((item) => item.trim().length > 0);
      }
    }
  } catch {
    // AI parsing failed — fall back to line splitting
  }

  // Fallback: split by newlines, commas, or numbered list patterns
  return trimmed
    .split(/[\n,]/)
    .map((line) => line.replace(/^\s*[-*•]\s*/, '').replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter((line) => line.length > 0);
}
