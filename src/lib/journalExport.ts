import jsPDF from 'jspdf';
import type { LogEntry } from './types';

export interface JournalExportOptions {
  entries: LogEntry[];
  dateRange: { start: Date; end: Date };
  includeRouting: boolean;
  includeMood: boolean;
  includeSource: boolean;
  userName: string;
}

const ENTRY_TYPE_PDF_LABELS: Record<string, string> = {
  journal: 'Journal',
  gratitude: 'Gratitude',
  reflection: 'Reflection',
  quick_note: 'Quick Note',
  meeting_notes: 'Meeting Notes',
  transcript: 'Transcript',
  helm_conversation: 'Helm Conversation',
  brain_dump: 'Brain Dump',
  custom: 'Note',
};

const ROUTE_LABELS: Record<string, string> = {
  compass_task: 'Created task',
  list_item: 'Added to list',
  reminder: 'Set reminder',
  mast_entry: 'Saved to Mast',
  keel_entry: 'Saved to Keel',
  victory: 'Recorded as victory',
  spouse_insight: 'Saved to First Mate',
  crew_note: 'Saved to Crew',
};

const SOURCE_LABELS: Record<string, string> = {
  manual_text: 'Manual entry',
  voice_transcription: 'Voice',
  helm_conversation: 'Helm conversation',
  meeting_framework: 'Meeting',
  unload_the_hold: 'Unload the Hold',
};

const MARGIN = 20; // mm
const PAGE_WIDTH = 210; // A4 width
const PAGE_HEIGHT = 297; // A4 height
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_HEIGHT = 15;
const MAX_Y = PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT;

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDateRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };
  const startStr = start.toLocaleDateString('en-US', opts);
  const endStr = end.toLocaleDateString('en-US', opts);
  if (startStr === endStr) return startStr;
  return `${startStr} - ${endStr}`;
}

function formatExportDate(): string {
  return new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function groupEntriesByDate(entries: LogEntry[]): Map<string, LogEntry[]> {
  const grouped = new Map<string, LogEntry[]>();
  for (const entry of entries) {
    const dateKey = new Date(entry.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const existing = grouped.get(dateKey) || [];
    existing.push(entry);
    grouped.set(dateKey, existing);
  }
  return grouped;
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > MAX_Y) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function addTitlePage(doc: jsPDF, options: JournalExportOptions): void {
  const centerX = PAGE_WIDTH / 2;

  // Decorative rule
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.5);
  doc.line(MARGIN + 20, 80, PAGE_WIDTH - MARGIN - 20, 80);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(30, 30, 30);
  doc.text('The Log', centerX, 100, { align: 'center' });

  // Subtitle
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(14);
  doc.setTextColor(100, 100, 100);
  doc.text('A Record of the Voyage', centerX, 112, { align: 'center' });

  // Decorative rule
  doc.line(MARGIN + 20, 120, PAGE_WIDTH - MARGIN - 20, 120);

  // User name
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(60, 60, 60);
  doc.text(options.userName, centerX, 145, { align: 'center' });

  // Date range
  doc.setFontSize(11);
  doc.text(
    formatDateRange(options.dateRange.start, options.dateRange.end),
    centerX,
    157,
    { align: 'center' },
  );

  // Entry count
  const count = options.entries.length;
  doc.text(
    `${count} ${count === 1 ? 'entry' : 'entries'}`,
    centerX,
    169,
    { align: 'center' },
  );

  // Export date
  doc.setFontSize(10);
  doc.setTextColor(130, 130, 130);
  doc.text(`Exported ${formatExportDate()}`, centerX, 185, { align: 'center' });
}

function addDateHeader(doc: jsPDF, y: number, dateStr: string): number {
  const entry = new Date(dateStr);
  const label = entry.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  y = ensureSpace(doc, y, 14);

  // Horizontal rule
  doc.setDrawColor(160, 160, 160);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);

  y += 6;

  // Date text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(40, 40, 40);
  doc.text(label, MARGIN + 2, y);

  y += 2;

  // Bottom rule
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);

  return y + 6;
}

function addEntry(
  doc: jsPDF,
  y: number,
  entry: LogEntry,
  options: JournalExportOptions,
): number {
  const typeLabel = ENTRY_TYPE_PDF_LABELS[entry.entry_type] || 'Entry';
  const time = formatTime(entry.created_at);

  // Estimate needed space
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const textLines = doc.splitTextToSize(entry.text, CONTENT_WIDTH - 4);
  const estimatedHeight = 8 + textLines.length * 4.5 + 10;
  y = ensureSpace(doc, y, Math.min(estimatedHeight, 40));

  // Type badge + time
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`[${typeLabel}]`, MARGIN + 2, y);

  const typeWidth = doc.getTextWidth(`[${typeLabel}]`);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(` ${time}`, MARGIN + 2 + typeWidth, y);

  // Source (optional)
  if (options.includeSource && entry.source && entry.source !== 'manual_text') {
    const sourceLabel = SOURCE_LABELS[entry.source] || entry.source;
    const timeWidth = doc.getTextWidth(` ${time}`);
    doc.text(`  (${sourceLabel})`, MARGIN + 2 + typeWidth + timeWidth, y);
  }

  y += 5;

  // Body text
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);

  for (const line of textLines) {
    y = ensureSpace(doc, y, 5);
    doc.text(line, MARGIN + 4, y);
    y += 4.5;
  }

  y += 1;

  // Tags
  if (entry.life_area_tags && entry.life_area_tags.length > 0) {
    y = ensureSpace(doc, y, 5);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(130, 130, 130);
    const tagsText = `Tags: ${entry.life_area_tags.map((t) => t.replace(/_/g, ' ')).join(', ')}`;
    doc.text(tagsText, MARGIN + 4, y);
    y += 4;
  }

  // Routing info (optional)
  if (options.includeRouting && entry.routed_to && entry.routed_to.length > 0) {
    for (const route of entry.routed_to) {
      y = ensureSpace(doc, y, 5);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 100, 100);
      const routeLabel = ROUTE_LABELS[route] || route.replace(/_/g, ' ');
      doc.text(`-> ${routeLabel}`, MARGIN + 4, y);
      y += 4;
    }
  }

  return y + 4;
}

function addPageNumbers(doc: jsPDF): void {
  const totalPages = doc.getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`${i - 1}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 10, { align: 'center' });
  }
}

export function generateJournalPDF(options: JournalExportOptions): Blob {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Title page
  addTitlePage(doc, options);

  // Group entries by date
  const grouped = groupEntriesByDate(options.entries);

  // Sort dates chronologically
  const sortedDates = Array.from(grouped.keys()).sort((a, b) => {
    return new Date(a).getTime() - new Date(b).getTime();
  });

  let isFirstDate = true;
  for (const dateKey of sortedDates) {
    const dayEntries = grouped.get(dateKey)!;

    if (isFirstDate) {
      doc.addPage();
      isFirstDate = false;
    }

    const pageInfo = (doc.internal as unknown as { getCurrentPageInfo?: () => { pageNumber: number } }).getCurrentPageInfo?.();
    let y = (pageInfo?.pageNumber ?? 1) > 1
      ? (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || MARGIN
      : MARGIN;

    // If we're at the very top of a new page, use MARGIN
    // Otherwise check if we need a new page for the date header
    const currentPage = pageInfo?.pageNumber ?? 1;
    if (currentPage > 1) {
      // Get current Y position — jsPDF doesn't track this well so we use our own
    }

    y = addDateHeader(doc, MARGIN, dateKey);

    // Sort entries within day by time
    const sorted = [...dayEntries].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    for (const entry of sorted) {
      y = addEntry(doc, y, entry, options);
    }
  }

  // Page numbers on all pages except title
  addPageNumbers(doc);

  return doc.output('blob');
}

export function formatDateRangeFilename(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `${fmt(start)}_to_${fmt(end)}`;
}
