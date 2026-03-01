import { supabase } from './supabase';

export interface TextExtractionResult {
  text: string;
  file_type: string;
  used_vision?: boolean;
  error?: string;
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp']);
const SERVER_EXTENSIONS = new Set(['pdf', 'docx', 'png', 'jpg', 'jpeg', 'webp']);

/**
 * Extract text from a file using a cascading pipeline:
 * 1. Client-side read for .txt/.md (instant, free)
 * 2. Server-side text extraction for .pdf/.docx (fast, no AI cost)
 * 3. AI vision fallback for images or when text extraction yields nothing (scanned PDFs)
 *
 * The server handles steps 2-3 internally — the frontend just sends the file.
 */
export async function extractTextFromFile(file: File): Promise<TextExtractionResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  // Client-side extraction for plain text formats — instant, no server call
  if (ext === 'txt' || ext === 'md') {
    try {
      const text = await file.text();
      return { text, file_type: ext };
    } catch (err) {
      return { text: '', file_type: ext, error: (err as Error).message || 'Failed to read file' };
    }
  }

  // Server-side extraction for PDF, DOCX, and images
  // The Edge Function handles the cascade: text extraction → vision fallback
  if (SERVER_EXTENSIONS.has(ext)) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return { text: '', file_type: ext, error: 'Not authenticated' };
      }

      const formData = new FormData();
      formData.append('file', file, file.name);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/extract-text`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Extraction failed' }));
        return { text: '', file_type: ext, error: errorData.error || `HTTP ${response.status}` };
      }

      const data = await response.json();
      return {
        text: data.text || '',
        file_type: data.file_type || ext,
        used_vision: data.used_vision || false,
        error: data.error,
      };
    } catch (err) {
      return { text: '', file_type: ext, error: (err as Error).message || 'Extraction failed' };
    }
  }

  return { text: '', file_type: ext, error: `Unsupported file type: .${ext}` };
}

/**
 * Check if a file extension is supported for text extraction.
 */
export function isSupportedFileType(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return ['txt', 'md', 'pdf', 'docx', ...IMAGE_EXTENSIONS].includes(ext);
}

/**
 * Check if a file extension requires AI vision (images).
 */
export function isVisionFileType(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return IMAGE_EXTENSIONS.has(ext);
}
