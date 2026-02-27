import { supabase } from './supabase';
import type { TriageItem } from './types';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function sendChatMessage(
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens: number,
  userId: string,
  guidedMode?: string | null,
  fileInfo?: { storagePath: string; fileType: string; fileName: string },
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('chat', {
    body: {
      system_prompt: systemPrompt,
      messages,
      max_tokens: maxTokens,
      user_id: userId,
      guided_mode: guidedMode || undefined,
      file_attachment: fileInfo ? {
        storage_path: fileInfo.storagePath,
        file_type: fileInfo.fileType,
        file_name: fileInfo.fileName,
      } : undefined,
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

export async function triggerHoldTriage(
  conversationText: string,
  userId: string,
  context?: {
    mast_entries?: string;
    active_tasks?: string[];
    keel_categories?: string;
    people_names?: string[];
  },
): Promise<TriageItem[]> {
  const { data, error } = await supabase.functions.invoke('unload-the-hold', {
    body: {
      conversation_text: conversationText,
      user_id: userId,
      context: context || undefined,
    },
  });

  if (error) {
    throw new Error(error.message || 'Failed to process brain dump');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  const items: TriageItem[] = (data?.items || []).map(
    (item: { text: string; category: string; metadata?: Record<string, unknown> }, index: number) => ({
      id: `triage-${Date.now()}-${index}`,
      text: item.text,
      category: item.category,
      metadata: item.metadata || {},
    }),
  );

  return items;
}

export interface CelebrateVictoryItem {
  description: string;
  celebration_text: string | null;
  life_area_tag: string | null;
  mast_connection_id: string | null;
  wheel_connection_id: string | null;
}

export async function celebrateVictory(
  description: string,
  userId: string,
  mastEntries?: string,
  wheelHubs?: string,
): Promise<CelebrateVictoryItem[]> {
  try {
    const { data, error } = await supabase.functions.invoke('celebrate-victory', {
      body: {
        description,
        user_id: userId,
        mast_entries: mastEntries || undefined,
        wheel_hubs: wheelHubs || undefined,
      },
    });

    if (error || data?.error) {
      return [{ description, celebration_text: null, life_area_tag: null, mast_connection_id: null, wheel_connection_id: null }];
    }

    // New multi-item format
    if (data?.items && Array.isArray(data.items)) {
      return data.items.map((item: CelebrateVictoryItem) => ({
        description: item.description || description,
        celebration_text: item.celebration_text || null,
        life_area_tag: item.life_area_tag || null,
        mast_connection_id: item.mast_connection_id || null,
        wheel_connection_id: item.wheel_connection_id || null,
      }));
    }

    // Backwards-compatible single-item
    return [{
      description,
      celebration_text: data?.celebration_text || null,
      life_area_tag: data?.life_area_tag || null,
      mast_connection_id: data?.mast_connection_id || null,
      wheel_connection_id: data?.wheel_connection_id || null,
    }];
  } catch {
    return [{ description, celebration_text: null, life_area_tag: null, mast_connection_id: null, wheel_connection_id: null }];
  }
}

export async function generateVictoryNarrative(
  victoriesText: string,
  userId: string,
  mastEntries?: string,
  mode: 'review' | 'monthly' = 'review',
): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('celebrate-victory', {
      body: {
        description: victoriesText,
        user_id: userId,
        mast_entries: mastEntries || undefined,
        mode,
      },
    });

    if (error || data?.error) return null;
    return data?.narrative || null;
  } catch {
    return null;
  }
}

export async function celebrateCollection(
  accomplishments: string,
  periodLabel: string,
  userId: string,
  mastEntries?: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('celebrate-victory', {
      body: {
        description: accomplishments,
        user_id: userId,
        mast_entries: mastEntries || undefined,
        mode: 'collection',
        period_label: periodLabel,
      },
    });

    if (error || data?.error) return null;
    return data?.narrative || null;
  } catch {
    return null;
  }
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
