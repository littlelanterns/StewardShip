import { useState, useRef, useCallback, useMemo } from 'react';
import { Upload, FileText, BookOpen, FileCode, Mic, Image, Check, X, Loader, RotateCcw, SkipForward, RefreshCw, Replace } from 'lucide-react';
import type { ManifestItem } from '../../lib/types';
import { Button } from '../shared';
import './UploadFlow.css';

interface UploadFlowProps {
  onUpload: (file: File) => Promise<ManifestItem | null>;
  onCheckDuplicate: (fileName: string, fileSize: number) => ManifestItem | null;
  onAutoIntake: (itemId: string) => Promise<boolean>;
  onArchiveItem: (id: string) => Promise<boolean>;
  onReprocessItem: (id: string) => Promise<boolean>;
  onClose: () => void;
}

type FileQueueStatus = 'pending' | 'uploading' | 'uploaded' | 'failed' | 'skipped';
type DuplicateAction = 'skip' | 'replace' | 'reprocess';

interface QueuedFile {
  file: File;
  status: FileQueueStatus;
  error?: string;
  duplicate?: boolean;
  existingItem?: ManifestItem;
  duplicateAction?: DuplicateAction;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (file.type.includes('pdf') || ext === 'pdf') return FileText;
  if (file.type === 'application/epub+zip' || ext === 'epub') return BookOpen;
  if (ext === 'docx') return FileText;
  if (ext === 'md') return FileCode;
  if (ext === 'txt' || file.type === 'text/plain') return FileText;
  if (file.type.startsWith('audio/')) return Mic;
  if (file.type.startsWith('image/')) return Image;
  return FileText;
}

export function UploadFlow({ onUpload, onCheckDuplicate, onAutoIntake, onArchiveItem, onReprocessItem, onClose }: UploadFlowProps) {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [queueComplete, setQueueComplete] = useState(false);
  const abortRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newEntries: QueuedFile[] = Array.from(files).map((file) => {
      const existing = onCheckDuplicate(file.name, file.size);
      return {
        file,
        status: 'pending' as const,
        duplicate: !!existing,
        existingItem: existing || undefined,
      };
    });

    setQueue((prev) => [...prev, ...newEntries]);
    setQueueComplete(false);
  }, [onCheckDuplicate]);

  const removeFromQueue = useCallback((index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const setDuplicateAction = useCallback((index: number, action: DuplicateAction) => {
    setQueue((prev) =>
      prev.map((q, i) => (i === index ? { ...q, duplicateAction: action } : q)),
    );
  }, []);

  const skipAllDuplicates = useCallback(() => {
    setQueue((prev) =>
      prev.map((q) =>
        q.duplicate && q.status === 'pending' && !q.duplicateAction
          ? { ...q, duplicateAction: 'skip' }
          : q,
      ),
    );
  }, []);

  const processQueue = useCallback(async () => {
    setIsProcessingQueue(true);
    setQueueComplete(false);
    abortRef.current = false;

    const pendingIndices = queue
      .map((q, i) => (q.status === 'pending' ? i : -1))
      .filter((i) => i >= 0);

    for (let idx = 0; idx < pendingIndices.length; idx++) {
      if (abortRef.current) break;
      const queueIdx = pendingIndices[idx];
      const queueItem = queue[queueIdx];

      // Handle duplicates based on chosen action
      if (queueItem.duplicate) {
        const action = queueItem.duplicateAction || 'skip';

        if (action === 'skip') {
          setQueue((prev) =>
            prev.map((q, i) => (i === queueIdx ? { ...q, status: 'skipped' as const } : q)),
          );
          continue;
        }

        if (action === 'reprocess' && queueItem.existingItem) {
          setQueue((prev) =>
            prev.map((q, i) => (i === queueIdx ? { ...q, status: 'uploading' as const } : q)),
          );
          try {
            await onReprocessItem(queueItem.existingItem.id);
            setQueue((prev) =>
              prev.map((q, i) => (i === queueIdx ? { ...q, status: 'uploaded' as const } : q)),
            );
          } catch (err) {
            setQueue((prev) =>
              prev.map((q, i) =>
                i === queueIdx
                  ? { ...q, status: 'failed' as const, error: (err as Error).message }
                  : q,
              ),
            );
          }
          continue;
        }

        // action === 'replace': archive old, then upload new below
        if (action === 'replace' && queueItem.existingItem) {
          setQueue((prev) =>
            prev.map((q, i) => (i === queueIdx ? { ...q, status: 'uploading' as const } : q)),
          );
          try {
            await onArchiveItem(queueItem.existingItem.id);
          } catch (err) {
            setQueue((prev) =>
              prev.map((q, i) =>
                i === queueIdx
                  ? { ...q, status: 'failed' as const, error: `Archive failed: ${(err as Error).message}` }
                  : q,
              ),
            );
            continue;
          }
          // Fall through to normal upload below
        }
      }

      // Normal upload (also handles 'replace' after archiving)
      if (queue[queueIdx].status !== 'uploading') {
        setQueue((prev) =>
          prev.map((q, i) => (i === queueIdx ? { ...q, status: 'uploading' as const } : q)),
        );
      }

      try {
        const result = await onUpload(queueItem.file);
        if (result) {
          setQueue((prev) =>
            prev.map((q, i) => (i === queueIdx ? { ...q, status: 'uploaded' as const } : q)),
          );
          // Fire-and-forget auto-intake
          onAutoIntake(result.id).catch((err) =>
            console.error('Auto-intake failed (non-fatal):', err),
          );
        } else {
          setQueue((prev) =>
            prev.map((q, i) =>
              i === queueIdx ? { ...q, status: 'failed' as const, error: 'Upload failed' } : q,
            ),
          );
        }
      } catch (err) {
        setQueue((prev) =>
          prev.map((q, i) =>
            i === queueIdx
              ? { ...q, status: 'failed' as const, error: (err as Error).message }
              : q,
          ),
        );
      }

      // Small delay between uploads to avoid overwhelming the system
      if (idx < pendingIndices.length - 1 && !abortRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    setIsProcessingQueue(false);
    setQueueComplete(true);
  }, [queue, onUpload, onAutoIntake, onArchiveItem, onReprocessItem]);

  const retryFailed = useCallback(() => {
    setQueue((prev) =>
      prev.map((q) => (q.status === 'failed' ? { ...q, status: 'pending' as const, error: undefined } : q)),
    );
    setQueueComplete(false);
  }, []);

  const uploadedCount = queue.filter((q) => q.status === 'uploaded').length;
  const failedCount = queue.filter((q) => q.status === 'failed').length;
  const skippedCount = queue.filter((q) => q.status === 'skipped').length;
  const pendingCount = queue.filter((q) => q.status === 'pending').length;
  const totalCount = queue.length;
  const hasFiles = totalCount > 0;

  // Duplicates that still need a decision
  const unresolvedDuplicates = useMemo(() =>
    queue.filter((q) => q.duplicate && q.status === 'pending' && !q.duplicateAction),
    [queue],
  );

  return (
    <div className="upload-flow">
      <h3 className="upload-flow__heading">Upload to Manifest</h3>

      {/* Dropzone — shown when no files selected or to add more */}
      {!hasFiles && (
        <div
          className="upload-flow__dropzone"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={32} className="upload-flow__dropzone-icon" />
          <p className="upload-flow__dropzone-text">Tap to select files</p>
          <p className="upload-flow__dropzone-hint">PDF, EPUB, DOCX, TXT, MD, audio, or images</p>
        </div>
      )}

      {/* Duplicate warning banner */}
      {unresolvedDuplicates.length > 0 && !isProcessingQueue && (
        <div className="upload-flow__dup-banner">
          <p className="upload-flow__dup-banner-text">
            {unresolvedDuplicates.length} file{unresolvedDuplicates.length !== 1 ? 's' : ''} already in your Manifest.
            Choose an action for each, or:
          </p>
          <button
            type="button"
            className="upload-flow__dup-banner-btn"
            onClick={skipAllDuplicates}
          >
            <SkipForward size={14} />
            Skip All Duplicates
          </button>
        </div>
      )}

      {/* Progress bar during upload */}
      {isProcessingQueue && (
        <div className="upload-flow__progress">
          <p className="upload-flow__progress-text">
            Processing {uploadedCount + skippedCount + 1} of {totalCount}...
          </p>
          <div className="upload-flow__progress-bar">
            <div
              className="upload-flow__progress-fill"
              style={{ width: `${((uploadedCount + skippedCount) / totalCount) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Completion summary */}
      {queueComplete && (
        <div className="upload-flow__summary">
          <p className="upload-flow__summary-text">
            {failedCount === 0
              ? skippedCount > 0
                ? `${uploadedCount} uploaded, ${skippedCount} skipped`
                : `All ${uploadedCount} files uploaded successfully`
              : `${uploadedCount} uploaded, ${failedCount} failed${skippedCount > 0 ? `, ${skippedCount} skipped` : ''}`}
          </p>
          <p className="upload-flow__summary-note">
            Files are now processing in the background. You can navigate away.
          </p>
        </div>
      )}

      {/* File queue list */}
      {hasFiles && (
        <div className="upload-flow__queue">
          {queue.map((q, index) => {
            const Icon = getFileIcon(q.file);
            const showDupActions = q.duplicate && q.status === 'pending' && !q.duplicateAction && !isProcessingQueue;
            return (
              <div
                key={`${q.file.name}-${index}`}
                className={`upload-flow__queue-item upload-flow__queue-item--${q.status}${q.duplicate && q.status === 'pending' ? ' upload-flow__queue-item--duplicate' : ''}`}
              >
                <Icon size={18} className="upload-flow__queue-icon" />
                <div className="upload-flow__queue-info">
                  <span className="upload-flow__queue-name">{q.file.name}</span>
                  <span className="upload-flow__queue-size">{formatFileSize(q.file.size)}</span>
                  {q.duplicate && q.status === 'pending' && !q.duplicateAction && (
                    <span className="upload-flow__queue-dup">Already in Manifest</span>
                  )}
                  {q.duplicateAction === 'skip' && q.status === 'pending' && (
                    <span className="upload-flow__queue-action-label upload-flow__queue-action-label--skip">Will skip</span>
                  )}
                  {q.duplicateAction === 'replace' && q.status === 'pending' && (
                    <span className="upload-flow__queue-action-label upload-flow__queue-action-label--replace">Will replace</span>
                  )}
                  {q.duplicateAction === 'reprocess' && q.status === 'pending' && (
                    <span className="upload-flow__queue-action-label upload-flow__queue-action-label--reprocess">Will reprocess</span>
                  )}
                  {q.status === 'skipped' && (
                    <span className="upload-flow__queue-action-label upload-flow__queue-action-label--skip">Skipped</span>
                  )}
                  {q.error && (
                    <span className="upload-flow__queue-error">{q.error}</span>
                  )}
                  {/* Duplicate action buttons */}
                  {showDupActions && (
                    <div className="upload-flow__dup-actions">
                      <button
                        type="button"
                        className="upload-flow__dup-btn upload-flow__dup-btn--skip"
                        onClick={() => setDuplicateAction(index, 'skip')}
                        title="Don't upload this file"
                      >
                        <SkipForward size={12} />
                        Skip
                      </button>
                      <button
                        type="button"
                        className="upload-flow__dup-btn upload-flow__dup-btn--replace"
                        onClick={() => setDuplicateAction(index, 'replace')}
                        title="Archive old version and upload new"
                      >
                        <Replace size={12} />
                        Replace
                      </button>
                      <button
                        type="button"
                        className="upload-flow__dup-btn upload-flow__dup-btn--reprocess"
                        onClick={() => setDuplicateAction(index, 'reprocess')}
                        title="Re-run processing on existing file"
                      >
                        <RefreshCw size={12} />
                        Reprocess
                      </button>
                    </div>
                  )}
                  {/* Allow changing decision */}
                  {q.duplicate && q.duplicateAction && q.status === 'pending' && !isProcessingQueue && (
                    <button
                      type="button"
                      className="upload-flow__dup-change"
                      onClick={() => setQueue((prev) =>
                        prev.map((item, i) => (i === index ? { ...item, duplicateAction: undefined } : item)),
                      )}
                    >
                      Change
                    </button>
                  )}
                </div>
                <div className="upload-flow__queue-status">
                  {q.status === 'uploading' && <Loader size={16} className="upload-flow__queue-spin" />}
                  {q.status === 'uploaded' && <Check size={16} className="upload-flow__queue-check" />}
                  {q.status === 'failed' && <X size={16} className="upload-flow__queue-fail" />}
                  {q.status === 'skipped' && <SkipForward size={16} className="upload-flow__queue-skipped" />}
                  {q.status === 'pending' && !isProcessingQueue && !q.duplicate && (
                    <button
                      className="upload-flow__queue-remove"
                      onClick={() => removeFromQueue(index)}
                      title="Remove"
                    >
                      <X size={14} />
                    </button>
                  )}
                  {q.status === 'pending' && !isProcessingQueue && q.duplicate && q.duplicateAction && (
                    <button
                      className="upload-flow__queue-remove"
                      onClick={() => removeFromQueue(index)}
                      title="Remove"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        className="upload-flow__input"
        accept=".pdf,.epub,.docx,.txt,.md,.mp3,.m4a,.wav,.ogg,.webm,.png,.jpg,.jpeg,.webp"
        multiple
        onChange={handleFileSelect}
        onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
      />

      <div className="upload-flow__actions">
        {hasFiles && !isProcessingQueue && !queueComplete && (
          <>
            <Button onClick={processQueue} disabled={pendingCount === 0}>
              Upload{totalCount > 1 ? ` All (${totalCount})` : ''}
            </Button>
            <Button variant="text" onClick={() => fileInputRef.current?.click()}>
              Add More
            </Button>
          </>
        )}
        {queueComplete && failedCount > 0 && (
          <Button variant="secondary" onClick={retryFailed}>
            <RotateCcw size={14} /> Retry Failed ({failedCount})
          </Button>
        )}
        {queueComplete && (
          <Button onClick={onClose}>Done</Button>
        )}
        {!isProcessingQueue && !queueComplete && (
          <Button variant="text" onClick={onClose}>Cancel</Button>
        )}
        {isProcessingQueue && (
          <Button variant="text" onClick={() => { abortRef.current = true; }}>
            Stop
          </Button>
        )}
      </div>
    </div>
  );
}
