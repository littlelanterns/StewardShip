import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, Mic, Image, AlertCircle } from 'lucide-react';
import type { ManifestItem } from '../../lib/types';
import { Button } from '../shared';
import './UploadFlow.css';

interface UploadFlowProps {
  onUpload: (file: File) => Promise<ManifestItem | null>;
  onCheckDuplicate: (fileName: string, fileSize: number) => ManifestItem | null;
  onClose: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(file: File) {
  if (file.type.includes('pdf')) return FileText;
  if (file.type.includes('audio')) return Mic;
  if (file.type.includes('image')) return Image;
  return FileText;
}

export function UploadFlow({ onUpload, onCheckDuplicate, onClose }: UploadFlowProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [duplicate, setDuplicate] = useState<ManifestItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSelectedFile(file);

    // Check for duplicate
    const dup = onCheckDuplicate(file.name, file.size);
    setDuplicate(dup);
  }, [onCheckDuplicate]);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    setUploading(true);
    setError(null);

    const result = await onUpload(selectedFile);
    if (!result) {
      setError('Upload failed. Please try again.');
      setUploading(false);
      return;
    }

    setUploading(false);
    onClose();
  }, [selectedFile, onUpload, onClose]);

  const Icon = selectedFile ? getFileIcon(selectedFile) : Upload;

  return (
    <div className="upload-flow">
      <h3 className="upload-flow__heading">Upload to Manifest</h3>

      {!selectedFile ? (
        <div
          className="upload-flow__dropzone"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={32} className="upload-flow__dropzone-icon" />
          <p className="upload-flow__dropzone-text">Tap to select a file</p>
          <p className="upload-flow__dropzone-hint">PDF, audio, or images</p>
        </div>
      ) : (
        <div className="upload-flow__preview">
          <div className="upload-flow__file-info">
            <Icon size={24} className="upload-flow__file-icon" />
            <div>
              <p className="upload-flow__file-name">{selectedFile.name}</p>
              <p className="upload-flow__file-size">{formatFileSize(selectedFile.size)}</p>
            </div>
          </div>

          {duplicate && (
            <div className="upload-flow__duplicate">
              <AlertCircle size={14} />
              <span>You already have "{duplicate.title}" in your Manifest. Upload anyway?</span>
            </div>
          )}

          {error && (
            <p className="upload-flow__error">{error}</p>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        className="upload-flow__input"
        accept=".pdf,audio/*,image/*"
        onChange={handleFileSelect}
      />

      <div className="upload-flow__actions">
        {selectedFile && (
          <Button onClick={handleUpload} disabled={uploading}>
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        )}
        {selectedFile && !uploading && (
          <Button variant="text" onClick={() => { setSelectedFile(null); setDuplicate(null); setError(null); }}>
            Choose Different File
          </Button>
        )}
        <Button variant="text" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
