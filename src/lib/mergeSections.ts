import type { SectionInfo } from '../hooks/useFrameworks';

export interface MergeStats {
  totalContentSections: number;
  avgWordsPerSection: number;
  suggestMerge: boolean;
}

/**
 * Compute stats about sections to determine if merging would be beneficial.
 * Suggests merge when 10+ content sections AND average word count < 1500.
 */
export function computeMergeStats(sections: SectionInfo[]): MergeStats {
  const contentSections = sections.filter(
    (s) => !s.title.startsWith('[NON-CONTENT]'),
  );

  if (contentSections.length === 0) {
    return { totalContentSections: 0, avgWordsPerSection: 0, suggestMerge: false };
  }

  const totalWords = contentSections.reduce(
    (sum, s) => sum + Math.round((s.end_char - s.start_char) / 5),
    0,
  );
  const avgWords = Math.round(totalWords / contentSections.length);

  return {
    totalContentSections: contentSections.length,
    avgWordsPerSection: avgWords,
    suggestMerge: contentSections.length >= 10 && avgWords < 1500,
  };
}

/**
 * Merge consecutive short content sections into larger groups targeting ~targetWords per group.
 *
 * Rules:
 * - [NON-CONTENT] sections pass through as-is, never merged with content
 * - Already-large sections (>= targetWords) pass through as-is
 * - Only consecutive short content sections get merged
 * - Flush accumulator when adding next section would exceed targetWords * 1.5
 * - Merged title: "First Title \u2013 Last Title" (en-dash)
 * - Merged description: "N sections merged (~X words)"
 */
export function mergeShortSections(
  sections: SectionInfo[],
  targetWords: number = 2000,
): SectionInfo[] {
  if (sections.length === 0) return [];

  const result: SectionInfo[] = [];
  let accumulator: SectionInfo[] = [];
  let accumulatedWords = 0;

  const flush = () => {
    if (accumulator.length === 0) return;

    if (accumulator.length === 1) {
      result.push(accumulator[0]);
    } else {
      const firstTitle = cleanTitle(accumulator[0].title);
      const lastTitle = cleanTitle(accumulator[accumulator.length - 1].title);
      const mergedTitle =
        firstTitle === lastTitle
          ? firstTitle
          : `${firstTitle} \u2013 ${lastTitle}`;
      const totalWords = Math.round(
        (accumulator[accumulator.length - 1].end_char - accumulator[0].start_char) / 5,
      );

      result.push({
        title: mergedTitle,
        start_char: accumulator[0].start_char,
        end_char: accumulator[accumulator.length - 1].end_char,
        description: `${accumulator.length} sections merged (~${totalWords.toLocaleString()} words)`,
      });
    }

    accumulator = [];
    accumulatedWords = 0;
  };

  for (const section of sections) {
    const isNonContent = section.title.startsWith('[NON-CONTENT]');
    const wordCount = Math.round((section.end_char - section.start_char) / 5);

    // Non-content sections: flush any accumulator, pass through as-is
    if (isNonContent) {
      flush();
      result.push(section);
      continue;
    }

    // Large sections: flush any accumulator, pass through as-is
    if (wordCount >= targetWords) {
      flush();
      result.push(section);
      continue;
    }

    // Short content section — accumulate
    // If adding this would exceed 1.5x target, flush first
    if (accumulatedWords > 0 && accumulatedWords + wordCount > targetWords * 1.5) {
      flush();
    }

    accumulator.push(section);
    accumulatedWords += wordCount;
  }

  // Flush remaining
  flush();

  return result;
}

function cleanTitle(title: string): string {
  return title.replace(/^\[NON-CONTENT\]\s*/i, '');
}
