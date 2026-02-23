import { supabase } from './supabase';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function sendChatMessage(
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens: number,
  userId: string,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('chat', {
    body: {
      system_prompt: systemPrompt,
      messages,
      max_tokens: maxTokens,
      user_id: userId,
    },
  });

  if (error) {
    throw new Error(error.message || 'Failed to get AI response');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data?.content || '';
}

export async function autoTagEntry(
  text: string,
  userId: string,
): Promise<string[]> {
  try {
    const { data, error } = await supabase.functions.invoke('auto-tag', {
      body: { text, user_id: userId },
    });

    if (error || !data?.tags) {
      return [];
    }

    return data.tags;
  } catch {
    return [];
  }
}

export async function autoTitleConversation(
  userMessage: string,
  userId: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('chat', {
      body: {
        system_prompt: 'You generate short conversation titles. Respond with ONLY the title, nothing else.',
        messages: [
          {
            role: 'user',
            content: `Given this user message, generate a 3-5 word conversation title. Respond with ONLY the title, nothing else.\n\nUser message: "${userMessage}"`,
          },
        ],
        max_tokens: 20,
        user_id: userId,
      },
    });

    if (error || data?.error || !data?.content) return null;
    // Clean up: remove quotes and trim
    return data.content.replace(/^["']|["']$/g, '').trim() || null;
  } catch {
    return null;
  }
}

export async function breakDownTask(
  taskTitle: string,
  taskDescription: string | null,
  detailLevel: 'quick' | 'detailed' | 'granular',
  userId: string,
  context?: string,
): Promise<Array<{ title: string; description?: string; sort_order: number }>> {
  const { data, error } = await supabase.functions.invoke('task-breaker', {
    body: {
      task_title: taskTitle,
      task_description: taskDescription,
      detail_level: detailLevel,
      context: context || undefined,
      user_id: userId,
    },
  });

  if (error) {
    throw new Error(error.message || 'Failed to break down task');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data?.subtasks || [];
}

export async function autoTagTask(
  title: string,
  description: string | null,
  userId: string,
): Promise<string | null> {
  try {
    const text = description ? `${title}\n${description}` : title;
    const { data, error } = await supabase.functions.invoke('auto-tag', {
      body: { text, user_id: userId, tag_type: 'compass' },
    });

    if (error || !data?.tags || data.tags.length === 0) return null;
    return data.tags[0]; // Single tag for tasks
  } catch {
    return null;
  }
}
