import { supabase } from './supabase';
import type { CompassTask, CompassView, EisenhowerQuadrant, ImportanceLevel } from './types';

const VIEW_PROMPTS: Record<string, string> = {
  eisenhower: `You are a task categorization assistant. Given a list of tasks, categorize each into one of these Eisenhower quadrants:
- do_now: Urgent AND important (deadlines, crises, pressing problems)
- schedule: Important but NOT urgent (planning, relationships, personal growth, prevention)
- delegate: Urgent but NOT important (interruptions, some meetings, some emails)
- eliminate: Neither urgent nor important (time wasters, busy work, pleasant but unproductive)

Respond with ONLY a JSON object mapping task IDs to quadrant values. Example:
{"id1": "do_now", "id2": "schedule"}`,

  eat_the_frog: `You are a task prioritization assistant. Given a list of tasks, identify which ONE task is the most challenging, most dreaded, or most important to tackle first (the "frog"). Also rank the remaining tasks by difficulty/importance.

Respond with ONLY a JSON object mapping task IDs to their frog_rank (1 = the frog, 2 = next hardest, etc.). Example:
{"id1": 1, "id2": 2, "id3": 3}`,

  one_three_nine: `You are a task prioritization assistant. Given a list of tasks, categorize each by importance level:
- critical_1: The single most critical task for today (only 1)
- important_3: Important tasks that matter (up to 3)
- small_9: Smaller tasks that need doing (up to 9)

Respond with ONLY a JSON object mapping task IDs to importance levels. Example:
{"id1": "critical_1", "id2": "important_3", "id3": "small_9"}`,

  ivy_lee: `You are a task prioritization assistant. Given a list of tasks, select the 6 most important and rank them 1-6 by priority (1 = most important, do first).

If there are fewer than 6 tasks, rank all of them. If more than 6, only rank the top 6.

Respond with ONLY a JSON object mapping task IDs to their rank (1-6). Example:
{"id1": 1, "id2": 2, "id3": 3}`,
};

type PlacementResult = Record<string, Partial<CompassTask>>;

export async function suggestTaskPlacements(
  tasks: CompassTask[],
  view: CompassView,
  userId: string,
): Promise<PlacementResult> {
  const prompt = VIEW_PROMPTS[view];
  if (!prompt || tasks.length === 0) return {};

  const taskList = tasks.map((t) => `- ID: ${t.id} | Title: ${t.title}${t.description ? ` | Description: ${t.description}` : ''}`).join('\n');

  try {
    const { data, error } = await supabase.functions.invoke('chat', {
      body: {
        system_prompt: prompt,
        messages: [{ role: 'user', content: `Here are the tasks:\n${taskList}` }],
        max_tokens: 500,
        user_id: userId,
      },
    });

    if (error || data?.error || !data?.content) return {};

    // Parse the JSON from the response
    const content = data.content.trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};

    const parsed = JSON.parse(jsonMatch[0]);
    const result: PlacementResult = {};

    // Map back to the correct field based on view
    for (const [taskId, value] of Object.entries(parsed)) {
      // Verify this is a real task ID
      if (!tasks.find((t) => t.id === taskId)) continue;

      switch (view) {
        case 'eisenhower':
          result[taskId] = { eisenhower_quadrant: value as EisenhowerQuadrant };
          break;
        case 'eat_the_frog':
          result[taskId] = { frog_rank: value as number };
          break;
        case 'one_three_nine':
          result[taskId] = { importance_level: value as ImportanceLevel };
          break;
        case 'ivy_lee':
          result[taskId] = { ivy_lee_rank: value as number };
          break;
      }
    }

    return result;
  } catch {
    return {};
  }
}
