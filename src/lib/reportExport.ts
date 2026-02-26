import jsPDF from 'jspdf';
import type { ReportData } from './types';
import { REPORT_PERIOD_LABELS, LOG_ENTRY_TYPE_LABELS, COMPASS_LIFE_AREA_LABELS } from './types';
import type { CompassLifeArea } from './types';

const MARGIN = 20;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_HEIGHT = 15;
const MAX_Y = PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT;

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > MAX_Y) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function addSectionHeader(doc: jsPDF, y: number, title: string): number {
  y = ensureSpace(doc, y, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 80, 70);
  doc.text(title, MARGIN, y);
  y += 2;
  doc.setDrawColor(60, 110, 103);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  return y + 6;
}

function addKeyValue(doc: jsPDF, y: number, key: string, value: string): number {
  y = ensureSpace(doc, y, 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text(`${key}: `, MARGIN + 4, y);
  const keyWidth = doc.getTextWidth(`${key}: `);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 30, 30);
  doc.text(value, MARGIN + 4 + keyWidth, y);
  return y + 5;
}

function addParagraph(doc: jsPDF, y: number, text: string, indent = 4): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  const lines = doc.splitTextToSize(text, CONTENT_WIDTH - indent);
  for (const line of lines) {
    y = ensureSpace(doc, y, 5);
    doc.text(line, MARGIN + indent, y);
    y += 4.5;
  }
  return y + 2;
}

export function generateReportPDF(data: ReportData, userName: string): Blob {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Title page
  const centerX = PAGE_WIDTH / 2;
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.5);
  doc.line(MARGIN + 20, 80, PAGE_WIDTH - MARGIN - 20, 80);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(30, 30, 30);
  doc.text('Progress Report', centerX, 100, { align: 'center' });

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(14);
  doc.setTextColor(100, 100, 100);
  doc.text('A Record of Stewardship', centerX, 112, { align: 'center' });

  doc.line(MARGIN + 20, 120, PAGE_WIDTH - MARGIN - 20, 120);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(60, 60, 60);
  doc.text(userName, centerX, 145, { align: 'center' });

  doc.setFontSize(11);
  doc.text(
    `${REPORT_PERIOD_LABELS[data.period]}: ${data.dateFrom} to ${data.dateTo}`,
    centerX, 157, { align: 'center' },
  );

  doc.setFontSize(10);
  doc.setTextColor(130, 130, 130);
  doc.text(
    `Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
    centerX, 175, { align: 'center' },
  );

  // Content pages
  doc.addPage();
  let y = MARGIN;

  // Tasks section
  if (data.tasks) {
    y = addSectionHeader(doc, y, 'Tasks');
    const t = data.tasks;
    const total = t.completed + t.pending + t.carried_forward + t.cancelled;
    y = addKeyValue(doc, y, 'Total Tasks', String(total));
    y = addKeyValue(doc, y, 'Completed', String(t.completed));
    y = addKeyValue(doc, y, 'Pending', String(t.pending));
    if (t.carried_forward > 0) y = addKeyValue(doc, y, 'Carried Forward', String(t.carried_forward));
    if (t.cancelled > 0) y = addKeyValue(doc, y, 'Cancelled', String(t.cancelled));
    if (total > 0) {
      y = addKeyValue(doc, y, 'Completion Rate', `${Math.round((t.completed / total) * 100)}%`);
    }

    const areas = Object.entries(t.byLifeArea).sort(([, a], [, b]) => b - a);
    if (areas.length > 0) {
      y += 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      y = ensureSpace(doc, y, 6);
      doc.text('By Life Area:', MARGIN + 4, y);
      y += 5;
      for (const [area, count] of areas) {
        const label = COMPASS_LIFE_AREA_LABELS[area as CompassLifeArea] || area.replace(/_/g, ' ');
        y = addKeyValue(doc, y, `  ${label}`, String(count));
      }
    }
    y += 6;
  }

  // Routines section
  if (data.routines && data.routines.length > 0) {
    y = addSectionHeader(doc, y, 'Routines');
    for (const r of data.routines) {
      y = addKeyValue(doc, y, r.routineName, `${r.completionCount} completions, ${r.averageCompletion}% avg`);
    }
    y += 6;
  }

  // Journal section
  if (data.journal) {
    y = addSectionHeader(doc, y, 'Journal');
    y = addKeyValue(doc, y, 'Total Entries', String(data.journal.total));
    const types = Object.entries(data.journal.byType).sort(([, a], [, b]) => b - a);
    for (const [type, count] of types) {
      const label = LOG_ENTRY_TYPE_LABELS[type as keyof typeof LOG_ENTRY_TYPE_LABELS] || type;
      y = addKeyValue(doc, y, `  ${label}`, String(count));
    }
    y += 6;
  }

  // Victories section
  if (data.victories) {
    y = addSectionHeader(doc, y, 'Victories');
    y = addKeyValue(doc, y, 'Total', String(data.victories.total));
    if (data.victories.descriptions.length > 0) {
      y += 2;
      for (const desc of data.victories.descriptions.slice(0, 20)) {
        y = ensureSpace(doc, y, 6);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(30, 30, 30);
        const bullet = `  - ${desc}`;
        const lines = doc.splitTextToSize(bullet, CONTENT_WIDTH - 8);
        for (const line of lines) {
          y = ensureSpace(doc, y, 5);
          doc.text(line, MARGIN + 4, y);
          y += 4.5;
        }
      }
    }
    y += 6;
  }

  // Reflections section
  if (data.reflections) {
    y = addSectionHeader(doc, y, 'Reflections');
    y = addKeyValue(doc, y, 'Total Responses', String(data.reflections.total));
    if (data.reflections.questions.length > 0) {
      y += 2;
      for (const q of data.reflections.questions.slice(0, 30)) {
        y = ensureSpace(doc, y, 12);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        doc.text(`${q.date} — ${q.question}`, MARGIN + 4, y);
        y += 4.5;
        y = addParagraph(doc, y, q.response, 8);
        y += 2;
      }
    }
    y += 6;
  }

  // Goals section
  if (data.goals && data.goals.length > 0) {
    y = addSectionHeader(doc, y, 'Goals');
    for (const g of data.goals) {
      const progress = g.target ? `${g.progress}/${g.target}` : String(g.progress);
      y = addKeyValue(doc, y, g.title, `${progress} (${g.status})`);
    }
    y += 6;
  }

  // Streaks section
  if (data.streaks && data.streaks.length > 0) {
    y = addSectionHeader(doc, y, 'Streaks');
    for (const s of data.streaks) {
      y = addKeyValue(doc, y, s.taskTitle, `Current: ${s.currentStreak} | Best: ${s.longestStreak}`);
    }
  }

  // Page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`${i - 1}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 10, { align: 'center' });
  }

  return doc.output('blob');
}

export function generateReportMarkdown(data: ReportData, userName: string): string {
  const lines: string[] = [];
  lines.push(`# Progress Report`);
  lines.push(`**${userName}** | ${REPORT_PERIOD_LABELS[data.period]}: ${data.dateFrom} to ${data.dateTo}`);
  lines.push('');

  if (data.tasks) {
    const t = data.tasks;
    const total = t.completed + t.pending + t.carried_forward + t.cancelled;
    lines.push('## Tasks');
    lines.push(`- **Total:** ${total}`);
    lines.push(`- **Completed:** ${t.completed}`);
    lines.push(`- **Pending:** ${t.pending}`);
    if (t.carried_forward > 0) lines.push(`- **Carried Forward:** ${t.carried_forward}`);
    if (t.cancelled > 0) lines.push(`- **Cancelled:** ${t.cancelled}`);
    if (total > 0) lines.push(`- **Completion Rate:** ${Math.round((t.completed / total) * 100)}%`);

    const areas = Object.entries(t.byLifeArea).sort(([, a], [, b]) => b - a);
    if (areas.length > 0) {
      lines.push('');
      lines.push('**By Life Area:**');
      for (const [area, count] of areas) {
        const label = COMPASS_LIFE_AREA_LABELS[area as CompassLifeArea] || area.replace(/_/g, ' ');
        lines.push(`- ${label}: ${count}`);
      }
    }
    lines.push('');
  }

  if (data.routines && data.routines.length > 0) {
    lines.push('## Routines');
    for (const r of data.routines) {
      lines.push(`- **${r.routineName}:** ${r.completionCount} completions, ${r.averageCompletion}% avg completion`);
    }
    lines.push('');
  }

  if (data.journal) {
    lines.push('## Journal');
    lines.push(`- **Total Entries:** ${data.journal.total}`);
    const types = Object.entries(data.journal.byType).sort(([, a], [, b]) => b - a);
    for (const [type, count] of types) {
      const label = LOG_ENTRY_TYPE_LABELS[type as keyof typeof LOG_ENTRY_TYPE_LABELS] || type;
      lines.push(`- ${label}: ${count}`);
    }
    lines.push('');
  }

  if (data.victories) {
    lines.push('## Victories');
    lines.push(`- **Total:** ${data.victories.total}`);
    for (const desc of data.victories.descriptions) {
      lines.push(`- ${desc}`);
    }
    lines.push('');
  }

  if (data.reflections) {
    lines.push('## Reflections');
    lines.push(`- **Total Responses:** ${data.reflections.total}`);
    lines.push('');
    for (const q of data.reflections.questions) {
      lines.push(`### ${q.date} — ${q.question}`);
      lines.push(q.response);
      lines.push('');
    }
  }

  if (data.goals && data.goals.length > 0) {
    lines.push('## Goals');
    for (const g of data.goals) {
      const progress = g.target ? `${g.progress}/${g.target}` : String(g.progress);
      lines.push(`- **${g.title}:** ${progress} (${g.status})`);
    }
    lines.push('');
  }

  if (data.streaks && data.streaks.length > 0) {
    lines.push('## Streaks');
    for (const s of data.streaks) {
      lines.push(`- **${s.taskTitle}:** Current ${s.currentStreak} | Best ${s.longestStreak}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push(`*Generated by StewardShip on ${new Date().toLocaleDateString()}*`);

  return lines.join('\n');
}
