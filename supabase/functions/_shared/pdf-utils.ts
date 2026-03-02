/**
 * Shared PDF text extraction utilities.
 * Used by: manifest-process, extract-text, extract-insights, chat
 *
 * Key improvements over the original inline versions:
 * - Stream type filtering: skips image, metadata, ICC, font, CMap streams
 * - BT/ET operator check: only keeps streams that contain text operators
 * - Restricted ASCII fallback: requires 40+ chars, filters metadata patterns
 * - Post-extraction sanitization: removes XMP, ICC, PDF structural artifacts
 * - Paragraph-level quality filtering: removes junk paragraphs before storage
 */

// --- Main Entry Point ---

/**
 * Extract text from a PDF, sanitize, and filter.
 * Returns clean prose text ready for storage or AI processing.
 */
export async function extractCleanTextFromPDF(bytes: Uint8Array): Promise<string> {
  let text = await extractTextFromPDF(bytes);
  text = sanitizeExtractedText(text);
  text = filterTextParagraphs(text);
  return text;
}

// --- Core PDF Extraction ---

export async function extractTextFromPDF(bytes: Uint8Array): Promise<string> {
  const { inflateSync } = await import('https://esm.sh/fflate@0.8.2');
  const decoder = new TextDecoder('latin1');
  const raw = decoder.decode(bytes);

  const streamContents: string[] = [];
  let streamCount = 0;
  let skippedCount = 0;

  const allStreamRegex = /stream\r?\n/g;
  let streamMatch;

  while ((streamMatch = allStreamRegex.exec(raw)) !== null) {
    streamCount++;
    const streamStart = streamMatch.index + streamMatch[0].length;
    const endIdx = raw.indexOf('endstream', streamStart);
    if (endIdx === -1) continue;

    // Look back at the dictionary preceding this stream
    const dictStart = Math.max(0, streamMatch.index - 500);
    const dictText = raw.substring(dictStart, streamMatch.index);

    // SKIP non-text streams based on their dictionary
    if (/\/Subtype\s*\/Image/i.test(dictText)) { skippedCount++; continue; }
    if (/\/Subtype\s*\/XML/i.test(dictText) || /\/Type\s*\/Metadata/i.test(dictText)) { skippedCount++; continue; }
    if (/\/N\s+\d+\s*\/Alternate/i.test(dictText) || /ICCBased/i.test(dictText)) { skippedCount++; continue; }
    if (/\/Subtype\s*\/(Type1C|CIDFontType0C|OpenType)/i.test(dictText)) { skippedCount++; continue; }
    if (/\/Type\s*\/FontDescriptor/i.test(dictText)) { skippedCount++; continue; }
    if (/\/Type\s*\/CMap/i.test(dictText) || /begincmap/i.test(dictText)) { skippedCount++; continue; }

    const isCompressed = dictText.includes('/FlateDecode');
    const streamData = raw.substring(streamStart, endIdx);

    if (isCompressed) {
      try {
        const streamBytes = new Uint8Array(streamData.length);
        for (let i = 0; i < streamData.length; i++) {
          streamBytes[i] = streamData.charCodeAt(i);
        }
        const decompressed = inflateSync(streamBytes);
        const decompressedText = new TextDecoder('latin1').decode(decompressed);

        // Only keep streams that contain text operators (BT...ET blocks)
        if (/BT\s[\s\S]*?ET/.test(decompressedText)) {
          streamContents.push(decompressedText);
        } else {
          skippedCount++;
        }
      } catch {
        // Decompression failed — skip
      }
    } else {
      // Uncompressed — still check for text operators
      if (/BT\s[\s\S]*?ET/.test(streamData)) {
        streamContents.push(streamData);
      }
    }
  }

  console.log(`PDF streams: ${streamCount} total, ${skippedCount} skipped (non-text), ${streamContents.length} text streams`);

  const textParts: string[] = [];

  for (const content of streamContents) {
    extractTextFromPDFContent(content, textParts);
  }

  // If no text from filtered streams, try unfiltered BT/ET from raw content
  if (textParts.length === 0) {
    extractTextFromPDFContent(raw, textParts);
  }

  // Restricted ASCII fallback — last resort for truly unstructured PDFs
  if (textParts.length === 0) {
    console.log('No BT/ET text found — trying restricted ASCII fallback');
    const readableRegex = /[\x20-\x7E]{40,}/g;
    let readableMatch;
    while ((readableMatch = readableRegex.exec(raw)) !== null) {
      const text = readableMatch[0].trim();
      if (text.length > 50 && /[a-zA-Z]/.test(text) && !isMetadataLine(text)) {
        textParts.push(text);
      }
    }
  }

  console.log(`PDF extraction result: ${textParts.length} text parts, ${textParts.join(' ').length} chars`);

  return textParts.join(' ').replace(/\s+/g, ' ').trim();
}

// --- Text Extraction from PDF Content Streams ---

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

// --- String Decoders ---

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

/**
 * Detect metadata/artifact lines in the ASCII fallback.
 */
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

  // High ratio of non-alpha characters suggests non-prose
  const alphaRatio = text.replace(/[^a-zA-Z\s]/g, '').length / text.length;
  if (alphaRatio < 0.6) return true;

  return false;
}

/**
 * Clean extracted text by removing common PDF artifacts that survived extraction.
 * Runs AFTER extractTextFromPDF, BEFORE storing in text_content.
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

    // Check letter/space ratio
    const letters = trimmed.replace(/[^a-zA-Z\s]/g, '').length;
    const ratio = letters / trimmed.length;
    if (ratio < 0.5) return false;

    // Check for garbage patterns
    if (isMetadataLine(trimmed)) return false;

    // Must have at least a few real words
    const words = trimmed.split(/\s+/).filter(w => w.length > 1 && /[a-zA-Z]/.test(w));
    if (words.length < 3) return false;

    return true;
  });

  return filtered.join('\n\n');
}
