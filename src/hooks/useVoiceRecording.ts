import { useState, useRef, useCallback } from 'react';
import { transcribeAudio } from '../lib/whisper';
import type { TranscriptionResult } from '../lib/whisper';

export type RecordingState = 'idle' | 'recording' | 'transcribing';

export function useVoiceRecording() {
  const [state, setState] = useState<RecordingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Prefer webm/opus, fall back to whatever's available
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg';

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.start(1000); // Collect chunks every second
      mediaRecorderRef.current = recorder;
      setState('recording');
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes('Permission denied') || message.includes('NotAllowedError')) {
        setError('Microphone access denied. Please enable it in your browser settings.');
      } else {
        setError('Could not start recording. Check your microphone.');
      }
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<TranscriptionResult> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve({ text: '', error: 'No active recording' });
        return;
      }

      recorder.onstop = async () => {
        // Stop all tracks to release the microphone
        recorder.stream.getTracks().forEach(track => track.stop());

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        chunksRef.current = [];

        if (blob.size === 0) {
          setState('idle');
          resolve({ text: '', error: 'Recording was empty' });
          return;
        }

        setState('transcribing');
        const result = await transcribeAudio(blob);
        setState('idle');

        if (result.error) {
          setError(result.error);
        }

        resolve(result);
      };

      recorder.stop();
    });
  }, []);

  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stream.getTracks().forEach(track => track.stop());
      recorder.stop();
    }
    chunksRef.current = [];
    setState('idle');
    setError(null);
  }, []);

  const isSupported = typeof navigator !== 'undefined'
    && 'mediaDevices' in navigator
    && 'getUserMedia' in navigator.mediaDevices;

  return {
    state,
    error,
    isSupported,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
