import { useCallback, useEffect, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { useVoiceRecording } from '../../hooks/useVoiceRecording';
import './VoiceRecordButton.css';

interface VoiceRecordButtonProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function VoiceRecordButton({ onTranscription, disabled, compact }: VoiceRecordButtonProps) {
  const { state, error, isSupported, startRecording, stopRecording, cancelRecording } = useVoiceRecording();
  const [showError, setShowError] = useState(false);

  // Show error briefly then auto-dismiss
  useEffect(() => {
    if (error) {
      setShowError(true);
      const timer = setTimeout(() => setShowError(false), 3000);
      return () => clearTimeout(timer);
    }
    setShowError(false);
  }, [error]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelRecording();
    };
  }, [cancelRecording]);

  const handleClick = useCallback(async () => {
    if (state === 'idle') {
      await startRecording();
    } else if (state === 'recording') {
      const result = await stopRecording();
      if (result.text) {
        onTranscription(result.text);
      }
    }
    // Do nothing if transcribing — button is disabled
  }, [state, startRecording, stopRecording, onTranscription]);

  if (!isSupported) {
    return null;
  }

  const isRecording = state === 'recording';
  const isTranscribing = state === 'transcribing';
  const buttonDisabled = disabled || isTranscribing;

  const stateClass = isRecording
    ? 'voice-record-btn--recording'
    : isTranscribing
    ? 'voice-record-btn--transcribing'
    : '';

  const title = isRecording
    ? 'Stop recording'
    : isTranscribing
    ? 'Transcribing...'
    : 'Record voice';

  const ariaLabel = isRecording
    ? 'Stop recording'
    : isTranscribing
    ? 'Transcribing audio'
    : 'Start voice recording';

  return (
    <div className="voice-record-indicator">
      {isRecording && !compact && (
        <>
          <span className="voice-record-dot" />
          <span className="voice-record-indicator__label">Recording...</span>
        </>
      )}
      {isTranscribing && !compact && (
        <>
          <span className="voice-record-spinner" />
          <span className="voice-record-indicator__label voice-record-indicator__label--transcribing">
            Transcribing...
          </span>
        </>
      )}
      <button
        type="button"
        className={`voice-record-btn ${stateClass}`}
        onClick={handleClick}
        disabled={buttonDisabled}
        title={title}
        aria-label={ariaLabel}
      >
        {isRecording ? (
          <Square size={18} strokeWidth={2} fill="currentColor" />
        ) : isTranscribing ? (
          <Mic size={20} strokeWidth={1.5} />
        ) : (
          <Mic size={20} strokeWidth={1.5} />
        )}
      </button>
      {showError && error && (
        <span className="voice-record-error">{error}</span>
      )}
    </div>
  );
}
