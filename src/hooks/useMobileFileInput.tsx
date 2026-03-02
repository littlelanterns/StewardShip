import { useRef, useEffect, useCallback } from 'react';

/**
 * Hook that provides a reliable file input for mobile browsers.
 *
 * On Android Chrome, file inputs inside <label> elements with opacity:0
 * often fail to fire the React onChange event after the native file picker
 * closes. This hook works around the issue by:
 *
 * 1. Attaching a native DOM 'change' event listener (bypasses React synthetic events)
 * 2. Polling the input's files property after visibilitychange (page returns from picker)
 * 3. Providing an openFilePicker() function that programmatically clicks the input
 *
 * Usage:
 *   const { fileInputRef, openFilePicker, FileInput } = useMobileFileInput({
 *     accept: '.pdf,.png,.jpg',
 *     onFileSelected: (file) => { ... },
 *   });
 *
 *   // Render FileInput anywhere (hidden), call openFilePicker from a button
 *   return <><button onClick={openFilePicker}>Upload</button><FileInput /></>;
 */

interface UseMobileFileInputOptions {
  accept?: string;
  onFileSelected: (file: File) => void;
}

export function useMobileFileInput({ accept, onFileSelected }: UseMobileFileInputOptions) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onFileSelectedRef = useRef(onFileSelected);
  const processedFileRef = useRef<string>('');

  // Keep callback ref current without re-running effects
  useEffect(() => {
    onFileSelectedRef.current = onFileSelected;
  }, [onFileSelected]);

  // Process file if input has one — deduplicates via name+size+lastModified
  const checkForFile = useCallback(() => {
    const input = fileInputRef.current;
    if (!input?.files?.length) return;
    const file = input.files[0];
    const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
    if (fileKey === processedFileRef.current) return; // Already processed
    processedFileRef.current = fileKey;
    onFileSelectedRef.current(file);
  }, []);

  useEffect(() => {
    const input = fileInputRef.current;
    if (!input) return;

    // Native DOM change listener — more reliable than React's onChange on mobile
    const handleChange = () => checkForFile();
    input.addEventListener('change', handleChange);

    // Fallback: when page becomes visible again (file picker closed), check after delay
    const handleVisibility = () => {
      if (!document.hidden) {
        // Small delays to let the browser settle after file picker closes
        setTimeout(checkForFile, 100);
        setTimeout(checkForFile, 500);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Fallback: window focus (some browsers fire this instead of visibilitychange)
    const handleFocus = () => {
      setTimeout(checkForFile, 100);
      setTimeout(checkForFile, 500);
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      input.removeEventListener('change', handleChange);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [checkForFile]);

  const openFilePicker = useCallback(() => {
    const input = fileInputRef.current;
    if (!input) return;
    // Clear previous selection so same file can be re-selected
    input.value = '';
    processedFileRef.current = '';
    input.click();
  }, []);

  // Render function for the hidden input
  const FileInput = useCallback(() => (
    <input
      ref={fileInputRef}
      type="file"
      accept={accept}
      style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}
      tabIndex={-1}
      aria-hidden="true"
    />
  ), [accept]);

  return { fileInputRef, openFilePicker, FileInput };
}
