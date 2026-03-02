import { useRef, useEffect, useCallback } from 'react';

/**
 * Hook that provides a reliable file input for mobile browsers.
 *
 * On Android Chrome, React-managed file inputs (hidden via opacity/position)
 * often fail to fire change events after the native file picker closes.
 * This hook avoids the problem entirely by creating a temporary <input>
 * element on the real DOM (outside React's tree) each time the user
 * initiates a file pick. This guarantees:
 *
 * 1. No React reconciliation can unmount/remount the input
 * 2. Native DOM change event fires reliably
 * 3. visibilitychange + focus polling as fallback
 * 4. Input is cleaned up after use
 *
 * Usage:
 *   const { openFilePicker } = useMobileFileInput({
 *     accept: '.pdf,.png,.jpg',
 *     onFileSelected: (file) => { ... },
 *   });
 *
 *   return <button onClick={openFilePicker}>Upload</button>;
 */

interface UseMobileFileInputOptions {
  accept?: string;
  onFileSelected: (file: File) => void;
}

export function useMobileFileInput({ accept, onFileSelected }: UseMobileFileInputOptions) {
  const onFileSelectedRef = useRef(onFileSelected);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Keep callback ref current without re-running effects
  useEffect(() => {
    onFileSelectedRef.current = onFileSelected;
  }, [onFileSelected]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const openFilePicker = useCallback(() => {
    // Clean up any previous input
    cleanupRef.current?.();

    // Create a fresh input element on the real DOM, outside React
    const input = document.createElement('input');
    input.type = 'file';
    if (accept) input.accept = accept;
    input.style.position = 'fixed';
    input.style.top = '-9999px';
    input.style.left = '-9999px';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';
    document.body.appendChild(input);

    let handled = false;

    const handleFile = () => {
      if (handled) return;
      if (!input.files?.length) return;
      handled = true;
      const file = input.files[0];
      onFileSelectedRef.current(file);
      cleanup();
    };

    const handleVisibility = () => {
      if (!document.hidden) {
        setTimeout(handleFile, 100);
        setTimeout(handleFile, 500);
        setTimeout(handleFile, 1000);
      }
    };

    const handleFocus = () => {
      setTimeout(handleFile, 100);
      setTimeout(handleFile, 500);
      setTimeout(handleFile, 1000);
    };

    const cleanup = () => {
      input.removeEventListener('change', handleFile);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      // Delay removal so the browser has time to read files
      setTimeout(() => {
        try { document.body.removeChild(input); } catch { /* already removed */ }
      }, 2000);
      if (cleanupRef.current === cleanup) {
        cleanupRef.current = null;
      }
    };

    cleanupRef.current = cleanup;

    // Listen for the change event (native DOM, not React)
    input.addEventListener('change', handleFile);
    // Fallback: poll after page returns from file picker
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    // Trigger the native file picker — must be synchronous within user gesture
    input.click();
  }, [accept]);

  // No-op FileInput component for backwards compatibility during migration
  const FileInput = useCallback(() => null, []);

  return { openFilePicker, FileInput };
}
