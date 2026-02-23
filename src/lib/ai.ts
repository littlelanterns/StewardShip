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
