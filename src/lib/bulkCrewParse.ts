import { sendChatMessage } from './ai';
import type { RelationshipType, ImportantDate } from './types';

export interface ParsedCrewMember {
  name: string;
  relationship_type: RelationshipType;
  categories: string[];
  age: number | null;
  notes: string | null;
  important_dates: ImportantDate[];
  isSpouse?: boolean;
}

/**
 * Parse freeform text describing people into structured crew member objects using AI.
 * Falls back to simple name extraction if AI parsing fails.
 */
export async function parseBulkCrew(
  inputText: string,
  existingNames: string[],
  userId: string,
): Promise<{ newMembers: ParsedCrewMember[]; duplicates: string[] }> {
  const trimmed = inputText.trim();
  if (!trimmed) return { newMembers: [], duplicates: [] };

  const existingNamesLower = existingNames.map((n) => n.toLowerCase());

  try {
    const systemPrompt = `You are a helpful assistant that parses descriptions of people into structured data. The user is adding people to their personal relationship management system.

For each person mentioned, extract:
- name (string, required)
- relationship_type (one of: "child", "parent", "sibling", "coworker", "friend", "mentor", "other")
- categories (array of strings from: "immediate_family", "extended_family", "professional", "social", "church_community", "custom")
- age (number or null — only if explicitly stated or clearly implied)
- notes (string or null — any extra context the user provided about this person)
- important_dates (array of {label: string, date: string (YYYY-MM-DD), recurring: boolean})
  - Extract birthdays when mentioned: "born March 15", "birthday is June 3rd", "turns 12 on Sept 20", "Jake (12, 3/15/2014)"
  - Always set label to "Birthday" and recurring to true for birthdays
  - If only month/day given (no year), use current year as placeholder
  - If no dates mentioned for a person, return an empty array []
  - Also extract other important dates if mentioned: anniversaries, graduations, etc.
- is_spouse (boolean — true ONLY if the person is described as a spouse, wife, husband, or partner)

Category assignment rules:
- children, parents, siblings → "immediate_family"
- in-laws, cousins, grandparents, aunts, uncles, nieces, nephews → "extended_family"
- coworkers, boss, business partners, clients → "professional"
- friends, neighbors → "social"
- church leaders, congregation, pastors, ministers, small group → "church_community"
- If unclear, default to "social"
- A person CAN have multiple categories (e.g., a friend who is also a coworker)

Relationship type inference:
- "my son/daughter/kid" → "child"
- "my mom/dad/mother/father" → "parent"
- "my brother/sister" → "sibling"
- "my boss/coworker/colleague" → "coworker"
- "my friend/buddy/pal" → "friend"
- "my mentor/coach/advisor" → "mentor"
- "my pastor/minister" → "other" (with "church_community" category)
- "my neighbor" → "friend" (with "social" category)
- "my mother-in-law/father-in-law/sister-in-law/brother-in-law" → "other" (with "extended_family" category)
- "my cousin/aunt/uncle/grandma/grandpa" → "other" (with "extended_family" category)
- If a spouse or partner is mentioned, set is_spouse to true, use relationship_type "other" with category "immediate_family" and add a note: "Partner/spouse — should be set up as First Mate"

Do NOT include the user themselves in the results.

These people already exist in the system (skip them): ${existingNames.length > 0 ? existingNames.join(', ') : 'none'}

Return ONLY a JSON object with this structure, no other text:
{
  "members": [
    { "name": "...", "relationship_type": "...", "categories": [...], "age": null, "notes": null, "important_dates": [{"label": "Birthday", "date": "2014-03-15", "recurring": true}], "is_spouse": false }
  ],
  "duplicates": ["name1", "name2"]
}

The "duplicates" array should list names from the input that match existing people (case-insensitive).`;

    const response = await sendChatMessage(
      systemPrompt,
      [{ role: 'user', content: trimmed }],
      1024,
      userId,
    );

    // Parse JSON from the response (handle markdown fences)
    const cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.members && Array.isArray(parsed.members)) {
        const validMembers: ParsedCrewMember[] = parsed.members
          .filter((m: Record<string, unknown>) => m.name && typeof m.name === 'string' && (m.name as string).trim().length > 0)
          .filter((m: Record<string, unknown>) => !existingNamesLower.includes((m.name as string).trim().toLowerCase()))
          .map((m: Record<string, unknown>) => ({
            name: (m.name as string).trim(),
            relationship_type: isValidRelationshipType(m.relationship_type) ? m.relationship_type : 'other',
            categories: Array.isArray(m.categories) ? (m.categories as unknown[]).filter(isValidCategory) as string[] : ['social'],
            age: typeof m.age === 'number' && m.age > 0 ? m.age : null,
            notes: typeof m.notes === 'string' && m.notes.trim().length > 0 ? m.notes.trim() : null,
            important_dates: Array.isArray(m.important_dates)
              ? (m.important_dates as Record<string, unknown>[])
                  .filter((d) => d.label && d.date)
                  .map((d) => ({
                    label: typeof d.label === 'string' ? d.label : 'Birthday',
                    date: typeof d.date === 'string' ? d.date : '',
                    recurring: typeof d.recurring === 'boolean' ? d.recurring : true,
                  }))
              : [],
            isSpouse: m.is_spouse === true,
          }));

        const duplicates: string[] = Array.isArray(parsed.duplicates)
          ? parsed.duplicates.filter((d: unknown) => typeof d === 'string')
          : [];

        return { newMembers: validMembers, duplicates };
      }
    }
  } catch {
    // AI parsing failed — fall through to fallback
  }

  // Fallback: extract names by splitting on newlines/commas, assign defaults
  const lines = trimmed
    .split(/[\n,]/)
    .map((line) => line.replace(/^\s*[-*•]\s*/, '').replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter((line) => line.length > 0);

  const newMembers: ParsedCrewMember[] = lines
    .filter((name) => !existingNamesLower.includes(name.toLowerCase()))
    .map((name) => ({
      name,
      relationship_type: 'friend' as RelationshipType,
      categories: ['social'],
      age: null,
      notes: null,
      important_dates: [],
    }));

  const duplicates = lines.filter((name) => existingNamesLower.includes(name.toLowerCase()));

  return { newMembers, duplicates };
}

function isValidRelationshipType(val: unknown): val is RelationshipType {
  return (
    typeof val === 'string' &&
    ['child', 'parent', 'sibling', 'coworker', 'friend', 'mentor', 'other'].includes(val)
  );
}

function isValidCategory(val: unknown): boolean {
  return (
    typeof val === 'string' &&
    ['immediate_family', 'extended_family', 'professional', 'social', 'church_community', 'custom'].includes(val)
  );
}
