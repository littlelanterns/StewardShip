import { supabase } from './supabase';

export interface TranscriptionResult {
  text: string;
  error?: string;
}

/**
 * Send an audio blob to the Whisper Edge Function for transcription.
 * Uses direct fetch to properly handle FormData (supabase.functions.invoke
 * sets Content-Type to application/json which breaks FormData boundary).
 */
export async function transcribeAudio(
  audioBlob: Blob,
  language: string = 'en'
): Promise<TranscriptionResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return { text: '', error: 'Not authenticated' };
    }

    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    formData.append('language', language);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await fetch(
      `${supabaseUrl}/functions/v1/whisper-transcribe`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Transcription failed' }));
      return { text: '', error: errorData.error || `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { text: data.text || '', error: data.error };
  } catch (err) {
    console.error('Transcription error:', err);
    return { text: '', error: (err as Error).message || 'Transcription failed' };
  }
}
