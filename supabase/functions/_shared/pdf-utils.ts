/**
 * Shared PDF text extraction utilities.
 * Used by: manifest-process, extract-text, extract-insights, chat
 *
 * Primary strategy: unpdf (PDF.js wrapper for edge runtimes).
 * Handles CIDFont encoding, ToUnicode CMaps, composite fonts, and all
 * standard PDF text formats including Adobe InDesign output.
 *
 * Fallback: regex-based BT/ET extraction for edge cases where unpdf fails.
 * Both paths run through sanitization and paragraph filtering.
 */

// --- Main Entry Point ---

/**
 * Extract text from a PDF, sanitize, and filter.
 * Returns clean prose text ready for storage or AI processing.
 */
export async function extractCleanTextFromPDF(bytes: Uint8Array): Promise<string> {
  const startTime = Date.now();
  let text = '';
  let method = 'none';

  // Primary: unpdf (PDF.js engine — handles CIDFont, ToUnicode, composite fonts)
  try {
    text = await extractTextWithUnPDF(bytes);
    method = 'unpdf';
  } catch (err) {
    console.warn('[PDF] unpdf extraction failed, falling back to legacy:', err);
  }

  // Fallback: regex-based extraction if unpdf produced nothing useful
  if (!text || text.length < 50) {
    if (method === 'unpdf' && text.length > 0) {
      console.log(`[PDF] unpdf produced only ${text.length} chars, trying legacy`);
    }
    try {
      const legacyText = await extractTextFromPDFLegacy(bytes);
      // Use whichever produced more text
      if (legacyText.length > text.length) {
        text = legacyText;
        method = text.length > 0 ? 'legacy' : 'none';
      }
    } catch (err) {
      console.warn('[PDF] Legacy extraction also failed:', err);
    }
  }

  // Sanitize and filter
  text = sanitizeExtractedText(text);
  text = filterTextParagraphs(text);

  const elapsed = Date.now() - startTime;
  console.log(`[PDF] Extraction complete: ${text.length} chars via ${method} in ${elapsed}ms`);

  return text;
}

// --- unpdf Extraction (Primary) ---

async function extractTextWithUnPDF(bytes: Uint8Array): Promise<string> {
  // Dynamic import — only loaded when a PDF is processed
  const unpdfModule = await import('https://esm.sh/unpdf@1.4.0');
  const { extractText, getDocumentProxy, configureUnPDF } = unpdfModule;

  // Configure pdfjs module explicitly for esm.sh / Deno compatibility.
  // Without this, the auto-resolution of pdfjs-serverless may fail in edge runtimes.
  try {
    const pdfjsModule = await import('https://esm.sh/unpdf@1.4.0/pdfjs');
    await configureUnPDF({ pdfjs: () => Promise.resolve(pdfjsModule) });
  } catch (configErr) {
    // If configureUnPDF fails, extractText will try auto-resolving pdfjs
    console.log('[PDF/unpdf] configureUnPDF skipped:', configErr);
  }

  const pdf = await getDocumentProxy(new Uint8Array(bytes));

  try {
    const result = await extractText(pdf, { mergePages: true });
    const totalPages = result.totalPages ?? 0;
    const resultText = typeof result.text === 'string'
      ? result.text
      : Array.isArray(result.text) ? result.text.join('\n\n') : '';

    console.log(`[PDF/unpdf] Extracted ${resultText.length} chars from ${totalPages} pages`);

    if (resultText.length > 0) {
      console.log(`[PDF/unpdf] First 300 chars: ${resultText.substring(0, 300)}`);
    }

    return resultText;
  } finally {
    // Free PDF.js resources
    try { pdf.cleanup?.(); } catch { /* ignore */ }
    try { pdf.destroy?.(); } catch { /* ignore */ }
  }
}

// --- Legacy Regex Extraction (Fallback) ---

async function extractTextFromPDFLegacy(bytes: Uint8Array): Promise<string> {
  const { inflateSync } = await import('https://esm.sh/fflate@0.8.2');
  const decoder = new TextDecoder('latin1');
  const raw = decoder.decode(bytes);

  const textParts: string[] = [];
  let streamCount = 0;
  let skippedBinary = 0;
  let skippedDecompressErr = 0;
  let processedCount = 0;

  const allStreamRegex = /stream\r?\n/g;
  let streamMatch;

  while ((streamMatch = allStreamRegex.exec(raw)) !== null) {
    streamCount++;
    const streamStart = streamMatch.index + streamMatch[0].length;
    const endIdx = raw.indexOf('endstream', streamStart);
    if (endIdx === -1) continue;

    const streamLen = endIdx - streamStart;

    // Skip very large streams (>500KB) — likely embedded images/fonts
    if (streamLen > 512000) {
      skippedBinary++;
      continue;
    }

    const objSearchStart = Math.max(0, streamMatch.index - 200);
    const preStreamText = raw.substring(objSearchStart, streamMatch.index);
    const objPos = preStreamText.lastIndexOf(' obj');
    const dictText = objPos >= 0
      ? preStreamText.substring(objPos)
      : preStreamText.substring(Math.max(0, preStreamText.length - 100));

    // Only skip unambiguous binary stream types
    if (/\/Subtype\s*\/Image/i.test(dictText)) { skippedBinary++; continue; }
    if (/\/N\s+\d+\s*\/Alternate/i.test(dictText) && /ICCBased/i.test(dictText)) { skippedBinary++; continue; }

    const isCompressed = preStreamText.includes('/FlateDecode');
    const streamData = raw.substring(streamStart, endIdx);

    if (isCompressed) {
      try {
        const streamBytes = new Uint8Array(streamData.length);
        for (let i = 0; i < streamData.length; i++) {
          streamBytes[i] = streamData.charCodeAt(i);
        }
        const decompressed = inflateSync(streamBytes);
        const decompressedText = new TextDecoder('latin1').decode(decompressed);

        const partsBefore = textParts.length;
        extractTextFromPDFContent(decompressedText, textParts);
        if (textParts.length > partsBefore) {
          processedCount++;
        }
      } catch {
        skippedDecompressErr++;
      }
    } else {
      const partsBefore = textParts.length;
      extractTextFromPDFContent(streamData, textParts);
      if (textParts.length > partsBefore) {
        processedCount++;
      }
    }
  }

  console.log(`[PDF/legacy] Streams: ${streamCount} total, ${skippedBinary} skipped (binary), ${skippedDecompressErr} decompress errors, ${processedCount} yielded text, ${textParts.length} text parts`);

  // If no BT/ET text found in any stream, try the raw file
  if (textParts.length === 0) {
    console.log('[PDF/legacy] No BT/ET text from streams — trying raw content');
    extractTextFromPDFContent(raw, textParts);
  }

  // Restricted ASCII fallback — absolute last resort
  if (textParts.length === 0) {
    console.log('[PDF/legacy] No BT/ET text found — trying restricted ASCII fallback');
    const readableRegex = /[\x20-\x7E]{40,}/g;
    let readableMatch;
    while ((readableMatch = readableRegex.exec(raw)) !== null) {
      const text = readableMatch[0].trim();
      if (text.length > 50 && /[a-zA-Z]/.test(text) && !isMetadataLine(text)) {
        textParts.push(text);
      }
    }
  }

  const result = textParts.join(' ').replace(/\s+/g, ' ').trim();
  console.log(`[PDF/legacy] Final: ${textParts.length} text parts, ${result.length} chars`);

  return result;
}

// --- Text Extraction from PDF Content Streams (used by legacy) ---

export function extractTextFromPDFContent(content: string, textParts: string[]): void {
  const btRegex = /BT\s([\s\S]*?)ET/g;
  let match;

  while ((match = btRegex.exec(content)) !== null) {
    const block = match[1];

    // Parenthesized strings: (text) Tj
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(block)) !== null) {
      const decoded = decodePDFString(tjMatch[1]);
      if (decoded.trim()) textParts.push(decoded);
    }

    // Hex strings: <hex> Tj
    const tjHexRegex = /<([0-9A-Fa-f]+)>\s*Tj/g;
    let tjHexMatch;
    while ((tjHexMatch = tjHexRegex.exec(block)) !== null) {
      const decoded = decodeHexPDFString(tjHexMatch[1]);
      if (decoded.trim()) textParts.push(decoded);
    }

    // TJ arrays: [(text) kerning (text) ...] TJ
    const tjArrayRegex = /\[([\s\S]*?)\]\s*TJ/g;
    let tjArrMatch;
    while ((tjArrMatch = tjArrayRegex.exec(block)) !== null) {
      const arrContent = tjArrMatch[1];

      const strRegex = /\(([^)]*)\)/g;
      let strMatch;
      while ((strMatch = strRegex.exec(arrContent)) !== null) {
        const decoded = decodePDFString(strMatch[1]);
        if (decoded.trim()) textParts.push(decoded);
      }

      const hexRegex = /<([0-9A-Fa-f]+)>/g;
      let hexMatch;
      while ((hexMatch = hexRegex.exec(arrContent)) !== null) {
        const decoded = decodeHexPDFString(hexMatch[1]);
        if (decoded.trim()) textParts.push(decoded);
      }
    }
  }
}

// --- String Decoders (used by legacy) ---

export function decodePDFString(str: string): string {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');
}

export function decodeHexPDFString(hex: string): string {
  if (hex.length % 2 !== 0) hex += '0';

  // Try UTF-16BE first (common for CIDFont PDFs — 4 hex chars per character)
  if (hex.length % 4 === 0) {
    let utf16 = '';
    let isReadable = true;
    for (let i = 0; i < hex.length; i += 4) {
      const code = parseInt(hex.substring(i, i + 4), 16);
      if (code === 0) { isReadable = false; break; }
      utf16 += String.fromCharCode(code);
    }
    if (isReadable && utf16.length > 0 && /[a-zA-Z]/.test(utf16)) {
      return utf16;
    }
  }

  // Fallback: single-byte interpretation
  let result = '';
  for (let i = 0; i < hex.length; i += 2) {
    const code = parseInt(hex.substring(i, i + 2), 16);
    if (code >= 32 && code < 127) {
      result += String.fromCharCode(code);
    }
  }
  return result;
}

// --- Post-Extraction Sanitization ---

export function isMetadataLine(text: string): boolean {
  const metadataPatterns = [
    /xmlns:/i,
    /rdf:Description/i,
    /xmp:/i,
    /xmpMM:/i,
    /dc:format/i,
    /pdf:Producer/i,
    /photoshop:/i,
    /stEvt:/i,
    /<\?xpacket/i,
    /ICCBased/i,
    /ColorSpace/i,
    /IEC\s*61966/i,
    /sRGB/i,
    /Reference Viewing Condition/i,
    /Hewlett-Packard/i,
    /\/Type\s*\//,
    /\/Filter\s*\//,
    /\/Length\s+\d+/,
    /\/FontDescriptor/,
    /\/BaseFont/,
    /\/Encoding/,
    /obj\s*<</,
    /endobj/,
    /xref/,
    /trailer/,
    /^[A-Za-z0-9+\/=]{50,}$/,
    /^[0-9A-Fa-f\s]{50,}$/,
  ];

  for (const pattern of metadataPatterns) {
    if (pattern.test(text)) return true;
  }

  const alphaRatio = text.replace(/[^a-zA-Z\s]/g, '').length / text.length;
  if (alphaRatio < 0.6) return true;

  return false;
}

/**
 * Clean extracted text by removing common PDF artifacts.
 * Runs AFTER extraction, BEFORE storing in text_content.
 */
export function sanitizeExtractedText(text: string): string {
  let cleaned = text;

  // Remove XMP metadata blocks
  cleaned = cleaned.replace(/<\?xpacket[\s\S]*?\?>/g, '');
  cleaned = cleaned.replace(/<x:xmpmeta[\s\S]*?<\/x:xmpmeta>/g, '');
  cleaned = cleaned.replace(/<rdf:RDF[\s\S]*?<\/rdf:RDF>/g, '');

  // Remove ICC color profile text artifacts
  cleaned = cleaned.replace(/IEC\s*61966[\s\S]{0,500}?(?=\n\n|\s{3,}|$)/gi, '');
  cleaned = cleaned.replace(/Reference Viewing Condition[\s\S]{0,200}?(?=\n\n|\s{3,}|$)/gi, '');

  // Remove PDF object notation that leaked through
  cleaned = cleaned.replace(/\d+\s+\d+\s+obj[\s\S]*?endobj/g, '');
  cleaned = cleaned.replace(/xref[\s\S]*?startxref/g, '');
  cleaned = cleaned.replace(/trailer[\s\S]*?%%EOF/g, '');

  // Remove long hex/base64 sequences (encoded binary data)
  cleaned = cleaned.replace(/[A-Za-z0-9+\/=]{100,}/g, '');
  cleaned = cleaned.replace(/[0-9A-Fa-f]{60,}/g, '');

  // Remove font encoding tables
  cleaned = cleaned.replace(/\/(?:BaseFont|FontDescriptor|Encoding|Widths|ToUnicode)[\s\S]{0,300}?(?=\n\n|\s{3,}|$)/g, '');

  // Collapse excessive whitespace
  cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n');
  cleaned = cleaned.replace(/\s{10,}/g, '  ');

  // Remove lines that are pure numbers/symbols (page numbers, PDF artifacts)
  cleaned = cleaned.replace(/^\s*[\d\s.,:;()\[\]{}|\\\/]+\s*$/gm, '');

  // Final cleanup
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

  return cleaned;
}

/**
 * Filter full extracted text at the paragraph level.
 * Removes paragraphs that look like PDF artifacts.
 */
export function filterTextParagraphs(text: string): string {
  const paragraphs = text.split(/\n\n+/);
  const filtered = paragraphs.filter(para => {
    const trimmed = para.trim();
    if (trimmed.length < 10) return false;

    const letters = trimmed.replace(/[^a-zA-Z\s]/g, '').length;
    const ratio = letters / trimmed.length;
    if (ratio < 0.5) return false;

    if (isMetadataLine(trimmed)) return false;

    const words = trimmed.split(/\s+/).filter(w => w.length > 1 && /[a-zA-Z]/.test(w));
    if (words.length < 3) return false;

    return true;
  });

  return filtered.join('\n\n');
}
