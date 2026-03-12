import JSZip from 'jszip';
import type { ManifestSummary, ManifestDeclaration, ManifestActionStep, AIFrameworkPrinciple } from './types';
import { DECLARATION_STYLE_LABELS, ACTION_STEP_CONTENT_TYPE_LABELS } from './types';
import type { ActionStepContentType } from './types';

// --- Shared types ---

export interface BookExtractionGroup {
  bookTitle: string;
  summaries: ManifestSummary[];
  declarations: ManifestDeclaration[];
  actionSteps?: ManifestActionStep[];
  principles: (AIFrameworkPrinciple & { framework_name?: string })[];
}

export interface ExportTabFilter {
  summary?: boolean;
  frameworks?: boolean;
  action_steps?: boolean;
  mast_content?: boolean;
}

export type ExportFormat = 'md' | 'txt' | 'docx' | 'epub';

export interface ExportOptions {
  tabs?: ExportTabFilter;
  format: ExportFormat;
  title?: string;
  mode?: 'extractions' | 'hearted' | 'notes';
}

// --- Helpers (exported for use by exportEpub.ts) ---

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function toFilename(name: string): string {
  return name.replace(/[^a-z0-9\-_ ]/gi, '').trim().replace(/\s+/g, '_');
}

export function today(): string {
  return new Date().toISOString().split('T')[0];
}

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Clean up AI-generated text: remove escaped quotes, backslash escapes, and stray bracket tags */
export function cleanText(str: string): string {
  return str
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\\\/g, '\\');
}

/** Convert content_type slug to human-readable label: key_concept → KEY CONCEPT */
export function contentTypeLabel(type: string): string {
  return type.replace(/_/g, ' ').toUpperCase();
}

/** Format a declaration style enum to display label */
export function styleLabel(style: string): string {
  return DECLARATION_STYLE_LABELS[style as keyof typeof DECLARATION_STYLE_LABELS] || style.replace(/_/g, ' ');
}

/** Format action step content_type to display label */
export function actionStepLabel(type: string): string {
  return ACTION_STEP_CONTENT_TYPE_LABELS[type as ActionStepContentType] || type.replace(/_/g, ' ').toUpperCase();
}

/** Format user note for markdown export */
function mdNote(note: string | null | undefined): string {
  if (!note) return '';
  return `\n  > **Note:** ${cleanText(note)}\n`;
}

/** Format user note for plain text export */
function txtNote(note: string | null | undefined): string {
  if (!note) return '';
  return `  [Note] ${cleanText(note)}\n`;
}

/** Format user note for docx export */
function docxNoteParagraph(note: string | null | undefined): string {
  if (!note) return '';
  return `<w:p><w:pPr><w:spacing w:after="60"/><w:ind w:left="360"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="A46A3C"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">Note: </w:t></w:r><w:r><w:rPr><w:color w:val="666666"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">${escapeXml(cleanText(note))}</w:t></w:r></w:p>`;
}

// --- Chapter-first organization: collect all sections across content types ---

export interface ChapterData {
  sectionTitle: string;
  sectionIndex: number;
  summaries: ManifestSummary[];
  principles: (AIFrameworkPrinciple & { framework_name?: string })[];
  actionSteps: ManifestActionStep[];
  declarations: ManifestDeclaration[];
}

export function tabEnabled(tabs: ExportTabFilter | undefined, key: keyof ExportTabFilter): boolean {
  if (!tabs) return true; // no filter = all enabled
  return tabs[key] !== false; // undefined or true = enabled
}

export function collectChapters(group: BookExtractionGroup, tabs?: ExportTabFilter): ChapterData[] {
  const map = new Map<string, ChapterData>();

  const getOrCreate = (title: string | null, index: number): ChapterData => {
    const key = title || '__full_book__';
    if (!map.has(key)) {
      map.set(key, {
        sectionTitle: title || '',
        sectionIndex: index,
        summaries: [],
        principles: [],
        actionSteps: [],
        declarations: [],
      });
    }
    const chapter = map.get(key)!;
    // Use the lowest section_index for ordering
    if (index < chapter.sectionIndex) chapter.sectionIndex = index;
    return chapter;
  };

  if (tabEnabled(tabs, 'summary')) {
    for (const s of group.summaries) getOrCreate(s.section_title, s.section_index).summaries.push(s);
  }
  if (tabEnabled(tabs, 'frameworks')) {
    for (const p of group.principles) getOrCreate(p.section_title, (p as unknown as { section_index?: number }).section_index ?? 999).principles.push(p);
  }
  if (tabEnabled(tabs, 'action_steps') && group.actionSteps) {
    for (const a of group.actionSteps) getOrCreate(a.section_title, a.section_index).actionSteps.push(a);
  }
  if (tabEnabled(tabs, 'mast_content')) {
    for (const d of group.declarations) getOrCreate(d.section_title, d.section_index).declarations.push(d);
  }

  return Array.from(map.values()).sort((a, b) => a.sectionIndex - b.sectionIndex);
}

// ============================================================
//  MARKDOWN EXPORT
// ============================================================

function buildBookMarkdown(group: BookExtractionGroup, headingLevel: '#' | '##', tabs?: ExportTabFilter): string[] {
  const lines: string[] = [];
  const sub = headingLevel === '#' ? '##' : '###';
  const subsub = headingLevel === '#' ? '###' : '####';

  const chapters = collectChapters(group, tabs);
  const fwName = group.principles[0]?.framework_name;

  for (const chapter of chapters) {
    // Chapter heading (skip if only one untitled chapter)
    if (chapter.sectionTitle) {
      lines.push(`${sub} ${chapter.sectionTitle}`, '');
    }

    const contentSub = chapter.sectionTitle ? subsub : sub;

    // Summary items for this chapter
    if (chapter.summaries.length > 0) {
      lines.push(`${contentSub} Summary`, '');
      for (const s of chapter.summaries) {
        const heartPrefix = s.is_hearted ? '\u2764\uFE0F ' : '';
        lines.push(`${heartPrefix}**${contentTypeLabel(s.content_type)}** \u2014 ${cleanText(s.text)}`, '');
        const note = mdNote(s.user_note);
        if (note) lines.push(note);
      }
    }

    // Framework principles for this chapter
    if (chapter.principles.length > 0) {
      lines.push(`${contentSub} Frameworks${fwName ? ` (${fwName})` : ''}`, '');
      for (const p of chapter.principles) {
        const heartPrefix = p.is_hearted ? '\u2764\uFE0F ' : '';
        lines.push(`- ${heartPrefix}${cleanText(p.text)}`);
        const note = mdNote(p.user_note);
        if (note) lines.push(note);
      }
      lines.push('');
    }

    // Action steps for this chapter
    if (chapter.actionSteps.length > 0) {
      lines.push(`${contentSub} Action Steps`, '');
      for (const a of chapter.actionSteps) {
        const heartPrefix = a.is_hearted ? '\u2764\uFE0F ' : '';
        lines.push(`${heartPrefix}**${actionStepLabel(a.content_type)}** \u2014 ${cleanText(a.text)}`, '');
        const note = mdNote(a.user_note);
        if (note) lines.push(note);
      }
    }

    // Declarations for this chapter
    if (chapter.declarations.length > 0) {
      lines.push(`${contentSub} Declarations`, '');
      for (const d of chapter.declarations) {
        const heartPrefix = d.is_hearted ? '\u2764\uFE0F ' : '';
        const valuePart = d.value_name ? `**${d.value_name}** ` : '';
        const stylePart = `*${styleLabel(d.declaration_style)}*`;
        lines.push(`${heartPrefix}${valuePart}${stylePart} \u2014 ${cleanText(d.declaration_text)}`, '');
        const note = mdNote(d.user_note);
        if (note) lines.push(note);
      }
    }

    lines.push('---', '');
  }

  return lines;
}

export function exportExtractionsMd(groups: BookExtractionGroup[], title?: string, tabs?: ExportTabFilter): void {
  const isSingleBook = groups.length === 1;
  const docTitle = title || (isSingleBook ? `${groups[0].bookTitle} - Extractions` : 'Extractions');

  const lines: string[] = [
    `# ${docTitle}`,
    '',
    `*Exported: ${today()}*`,
    '',
    '---',
    '',
  ];

  for (const group of groups) {
    if (!isSingleBook) {
      lines.push(`## ${group.bookTitle}`, '');
    }
    lines.push(...buildBookMarkdown(group, isSingleBook ? '#' : '##', tabs));
    if (!isSingleBook) {
      lines.push('---', '');
    }
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  triggerDownload(blob, `${toFilename(docTitle)}.md`);
}

// ============================================================
//  PLAIN TEXT EXPORT
// ============================================================

function buildBookTxt(group: BookExtractionGroup, isTopLevel: boolean, tabs?: ExportTabFilter): string[] {
  const lines: string[] = [];
  const sectionDivider = isTopLevel ? '===' : '---';

  const chapters = collectChapters(group, tabs);
  const fwName = group.principles[0]?.framework_name;

  for (const chapter of chapters) {
    if (chapter.sectionTitle) {
      lines.push(`${sectionDivider} ${chapter.sectionTitle.toUpperCase()} ${sectionDivider}`, '');
    }

    // Summary items for this chapter
    if (chapter.summaries.length > 0) {
      lines.push('--- SUMMARY ---', '');
      for (const s of chapter.summaries) {
        const heartPrefix = s.is_hearted ? '[hearted] ' : '';
        lines.push(`${heartPrefix}${contentTypeLabel(s.content_type)}: ${cleanText(s.text)}`);
        const note = txtNote(s.user_note);
        if (note) lines.push(note);
        lines.push('');
      }
    }

    // Framework principles for this chapter
    if (chapter.principles.length > 0) {
      lines.push(`--- FRAMEWORKS${fwName ? ` (${fwName})` : ''} ---`, '');
      for (const p of chapter.principles) {
        const heartPrefix = p.is_hearted ? '[hearted] ' : '';
        lines.push(`${heartPrefix}${cleanText(p.text)}`);
        const note = txtNote(p.user_note);
        if (note) lines.push(note);
        lines.push('');
      }
    }

    // Action steps for this chapter
    if (chapter.actionSteps.length > 0) {
      lines.push('--- ACTION STEPS ---', '');
      for (const a of chapter.actionSteps) {
        const heartPrefix = a.is_hearted ? '[hearted] ' : '';
        lines.push(`${heartPrefix}${actionStepLabel(a.content_type)}: ${cleanText(a.text)}`);
        const note = txtNote(a.user_note);
        if (note) lines.push(note);
        lines.push('');
      }
    }

    // Declarations for this chapter
    if (chapter.declarations.length > 0) {
      lines.push('--- DECLARATIONS ---', '');
      for (const d of chapter.declarations) {
        const heartPrefix = d.is_hearted ? '[hearted] ' : '';
        const valuePart = d.value_name ? `${d.value_name} — ` : '';
        const stylePart = `(${styleLabel(d.declaration_style)})`;
        lines.push(`${heartPrefix}${valuePart}${stylePart} ${cleanText(d.declaration_text)}`);
        const note = txtNote(d.user_note);
        if (note) lines.push(note);
        lines.push('');
      }
    }

    lines.push('');
  }

  return lines;
}

export function exportExtractionsTxt(groups: BookExtractionGroup[], title?: string, tabs?: ExportTabFilter): void {
  const isSingleBook = groups.length === 1;
  const docTitle = title || (isSingleBook ? `${groups[0].bookTitle} - Extractions` : 'Extractions');

  const lines: string[] = [
    docTitle.toUpperCase(),
    `Exported: ${today()}`,
    '',
    '========================================',
    '',
  ];

  for (const group of groups) {
    if (!isSingleBook) {
      lines.push(`== ${group.bookTitle.toUpperCase()} ==`, '');
    }
    lines.push(...buildBookTxt(group, isSingleBook, tabs));
    if (!isSingleBook) {
      lines.push('========================================', '');
    }
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  triggerDownload(blob, `${toFilename(docTitle)}.txt`);
}

// ============================================================
//  DOCX EXPORT
// ============================================================

function buildDocxParagraphs(groups: BookExtractionGroup[], isMultiBook: boolean, tabs?: ExportTabFilter): string {
  const paras: string[] = [];

  for (const group of groups) {
    if (isMultiBook) {
      paras.push(docxHeading(group.bookTitle, 'Heading1'));
    }

    const h2 = isMultiBook ? 'Heading2' : 'Heading1';
    const h3 = isMultiBook ? 'Heading3' : 'Heading2';

    const chapters = collectChapters(group, tabs);
    const fwName = group.principles[0]?.framework_name;

    for (const chapter of chapters) {
      // Chapter heading
      if (chapter.sectionTitle) {
        paras.push(docxHeading(chapter.sectionTitle, h2));
      }

      const contentHeading = chapter.sectionTitle ? h3 : h2;

      // Summary items for this chapter
      if (chapter.summaries.length > 0) {
        paras.push(docxHeading('Summary', contentHeading));
        for (const s of chapter.summaries) {
          const heartPrefix = s.is_hearted ? '\u2764\uFE0F ' : '';
          paras.push(docxBoldPrefixParagraph(
            `${heartPrefix}${contentTypeLabel(s.content_type)}`,
            cleanText(s.text),
          ));
          const note = docxNoteParagraph(s.user_note);
          if (note) paras.push(note);
        }
        paras.push(docxSpacer());
      }

      // Framework principles for this chapter
      if (chapter.principles.length > 0) {
        paras.push(docxHeading(`Frameworks${fwName ? ` (${fwName})` : ''}`, contentHeading));
        for (const p of chapter.principles) {
          const heartPrefix = p.is_hearted ? '\u2764\uFE0F ' : '';
          paras.push(docxParagraph(`${heartPrefix}${cleanText(p.text)}`));
          const note = docxNoteParagraph(p.user_note);
          if (note) paras.push(note);
        }
        paras.push(docxSpacer());
      }

      // Action steps for this chapter
      if (chapter.actionSteps.length > 0) {
        paras.push(docxHeading('Action Steps', contentHeading));
        for (const a of chapter.actionSteps) {
          const heartPrefix = a.is_hearted ? '\u2764\uFE0F ' : '';
          paras.push(docxBoldPrefixParagraph(
            `${heartPrefix}${actionStepLabel(a.content_type)}`,
            cleanText(a.text),
          ));
          const note = docxNoteParagraph(a.user_note);
          if (note) paras.push(note);
        }
        paras.push(docxSpacer());
      }

      // Declarations for this chapter
      if (chapter.declarations.length > 0) {
        paras.push(docxHeading('Declarations', contentHeading));
        for (const d of chapter.declarations) {
          const heartPrefix = d.is_hearted ? '\u2764\uFE0F ' : '';
          paras.push(docxDeclarationParagraph(
            heartPrefix,
            d.value_name,
            styleLabel(d.declaration_style),
            cleanText(d.declaration_text),
          ));
          const note = docxNoteParagraph(d.user_note);
          if (note) paras.push(note);
        }
        paras.push(docxSpacer());
      }
    }
  }

  return paras.join('\n');
}

function docxHeading(text: string, style: string): string {
  const colorAttr = style === 'Heading1' ? '<w:color w:val="2D5A5A"/><w:sz w:val="36"/><w:szCs w:val="36"/>' :
    style === 'Heading2' ? '<w:color w:val="2D5A5A"/><w:sz w:val="28"/><w:szCs w:val="28"/>' :
      '<w:color w:val="3B6E67"/><w:sz w:val="24"/><w:szCs w:val="24"/>';
  return `<w:p><w:pPr><w:pStyle w:val="${style}"/><w:spacing w:before="200" w:after="100"/></w:pPr><w:r><w:rPr>${colorAttr}</w:rPr><w:t>${escapeXml(text)}</w:t></w:r></w:p>`;
}

function docxParagraph(text: string): string {
  return `<w:p><w:pPr><w:spacing w:after="100"/></w:pPr><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function docxSpacer(): string {
  return '<w:p><w:pPr><w:spacing w:after="80"/></w:pPr></w:p>';
}

/** Paragraph with bold prefix + em-dash + normal text */
function docxBoldPrefixParagraph(boldPart: string, normalPart: string): string {
  return `<w:p><w:pPr><w:spacing w:after="100"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t xml:space="preserve">${escapeXml(boldPart)}</w:t></w:r><w:r><w:t xml:space="preserve"> \u2014 ${escapeXml(normalPart)}</w:t></w:r></w:p>`;
}

/** Declaration paragraph: optional bold value name, italic style, em-dash, text */
function docxDeclarationParagraph(
  heartPrefix: string,
  valueName: string | null,
  style: string,
  text: string,
): string {
  const runs: string[] = [];
  if (heartPrefix) {
    runs.push(`<w:r><w:t xml:space="preserve">${escapeXml(heartPrefix)}</w:t></w:r>`);
  }
  if (valueName) {
    runs.push(`<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${escapeXml(valueName)} </w:t></w:r>`);
  }
  runs.push(`<w:r><w:rPr><w:i/><w:color w:val="666666"/></w:rPr><w:t xml:space="preserve">${escapeXml(style)}</w:t></w:r>`);
  runs.push(`<w:r><w:t xml:space="preserve"> \u2014 ${escapeXml(text)}</w:t></w:r>`);
  return `<w:p><w:pPr><w:spacing w:after="100"/></w:pPr>${runs.join('')}</w:p>`;
}

export async function exportExtractionsDocx(groups: BookExtractionGroup[], title?: string, tabs?: ExportTabFilter): Promise<void> {
  const isSingleBook = groups.length === 1;
  const docTitle = title || (isSingleBook ? `${groups[0].bookTitle} - Extractions` : 'Extractions');

  const bodyContent = buildDocxParagraphs(groups, !isSingleBook, tabs);

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  mc:Ignorable="w14">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Title"/><w:spacing w:after="60"/></w:pPr>
      <w:r><w:rPr><w:color w:val="2D5A5A"/><w:sz w:val="44"/><w:szCs w:val="44"/></w:rPr><w:t>${escapeXml(isSingleBook ? groups[0].bookTitle : docTitle)}</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:spacing w:after="200"/></w:pPr>
      <w:r><w:rPr><w:color w:val="666666"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">${isSingleBook ? 'Extractions' : ''} Exported: ${today()}</w:t></w:r>
    </w:p>
    ${bodyContent}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr><w:b/><w:color w:val="2D5A5A"/><w:sz w:val="44"/><w:szCs w:val="44"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr><w:b/><w:color w:val="2D5A5A"/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr><w:b/><w:color w:val="2D5A5A"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr><w:b/><w:color w:val="3B6E67"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
  </w:style>
</w:styles>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const zip = new JSZip();
  zip.file('[Content_Types].xml', contentTypesXml);
  zip.file('_rels/.rels', rootRelsXml);
  zip.file('word/document.xml', documentXml);
  zip.file('word/styles.xml', stylesXml);
  zip.file('word/_rels/document.xml.rels', docRelsXml);

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  triggerDownload(blob, `${toFilename(docTitle)}.docx`);
}

// ============================================================
//  HEARTED ITEMS EXPORTS (convenience wrappers with custom title)
// ============================================================

export function exportHeartedMd(groups: BookExtractionGroup[]): void {
  exportExtractionsMd(groups, `My Hearted Items - ${today()}`);
}

export function exportHeartedTxt(groups: BookExtractionGroup[]): void {
  exportExtractionsTxt(groups, `My Hearted Items - ${today()}`);
}

export async function exportHeartedDocx(groups: BookExtractionGroup[]): Promise<void> {
  await exportExtractionsDocx(groups, `My Hearted Items - ${today()}`);
}

// ============================================================
//  NOTES EXPORTS — items with user notes only, note-prominent
// ============================================================

interface NotedItem {
  type: 'summary' | 'framework' | 'action_step' | 'declaration';
  text: string;
  note: string;
  badge: string;
  sectionTitle: string | null;
  sectionIndex: number;
}

function collectNotedItems(group: BookExtractionGroup): NotedItem[] {
  const items: NotedItem[] = [];
  for (const s of group.summaries) {
    if (s.user_note) items.push({ type: 'summary', text: s.text, note: s.user_note, badge: contentTypeLabel(s.content_type), sectionTitle: s.section_title, sectionIndex: s.section_index });
  }
  for (const p of group.principles) {
    if (p.user_note) items.push({ type: 'framework', text: p.text, note: p.user_note, badge: 'Framework', sectionTitle: p.section_title, sectionIndex: (p as { section_index?: number }).section_index ?? 0 });
  }
  if (group.actionSteps) {
    for (const a of group.actionSteps) {
      if (a.user_note) items.push({ type: 'action_step', text: a.text, note: a.user_note, badge: actionStepLabel(a.content_type), sectionTitle: a.section_title, sectionIndex: a.section_index });
    }
  }
  for (const d of group.declarations) {
    if (d.user_note) items.push({ type: 'declaration', text: d.declaration_text, note: d.user_note, badge: styleLabel(d.declaration_style), sectionTitle: d.section_title, sectionIndex: d.section_index });
  }
  return items;
}

function groupNotedBySection(items: NotedItem[]): Array<{ title: string | null; items: NotedItem[] }> {
  const map = new Map<string, NotedItem[]>();
  for (const item of items) {
    const key = item.sectionTitle || '__full__';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return Array.from(map.entries())
    .sort((a, b) => (a[1][0]?.sectionIndex ?? 0) - (b[1][0]?.sectionIndex ?? 0))
    .map(([key, items]) => ({ title: key === '__full__' ? null : key, items }));
}

// --- Notes Markdown ---

function buildNotesMd(group: BookExtractionGroup, headingLevel: '#' | '##'): string[] {
  const noted = collectNotedItems(group);
  if (noted.length === 0) return [];
  const sub = headingLevel === '#' ? '##' : '###';
  const lines: string[] = [];
  const sections = groupNotedBySection(noted);
  for (const section of sections) {
    if (section.title) lines.push(`${sub} ${section.title}`, '');
    for (const item of section.items) {
      const prefix = item.type === 'declaration' ? `*${item.badge}*` : `**${item.badge}**`;
      const text = item.type === 'declaration' ? `\u201C${cleanText(item.text)}\u201D` : cleanText(item.text);
      lines.push(`${prefix} \u2014 ${text}`, '');
      lines.push(`> **My Note:** ${cleanText(item.note)}`, '');
    }
  }
  return lines;
}

export function exportNotesMd(groups: BookExtractionGroup[], title?: string): void {
  const filtered = groups.filter((g) => collectNotedItems(g).length > 0);
  if (filtered.length === 0) return;
  const isSingle = filtered.length === 1;
  const docTitle = title || (isSingle ? `${filtered[0].bookTitle} - My Notes` : 'My Notes');
  const lines: string[] = [`# ${docTitle}`, '', `*Exported: ${today()}*`, '', '---', ''];
  for (const group of filtered) {
    if (!isSingle) lines.push(`## ${group.bookTitle}`, '');
    lines.push(...buildNotesMd(group, isSingle ? '#' : '##'));
    if (!isSingle) lines.push('---', '');
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  triggerDownload(blob, `${toFilename(docTitle)}.md`);
}

// --- Notes Plain Text ---

function buildNotesTxt(group: BookExtractionGroup): string[] {
  const noted = collectNotedItems(group);
  if (noted.length === 0) return [];
  const lines: string[] = [];
  const sections = groupNotedBySection(noted);
  for (const section of sections) {
    if (section.title) lines.push(`--- ${section.title} ---`, '');
    for (const item of section.items) {
      const text = item.type === 'declaration' ? `"${cleanText(item.text)}"` : cleanText(item.text);
      lines.push(`${item.badge}: ${text}`);
      lines.push(`  >> ${cleanText(item.note)}`, '');
    }
  }
  return lines;
}

export function exportNotesTxt(groups: BookExtractionGroup[], title?: string): void {
  const filtered = groups.filter((g) => collectNotedItems(g).length > 0);
  if (filtered.length === 0) return;
  const isSingle = filtered.length === 1;
  const docTitle = title || (isSingle ? `${filtered[0].bookTitle} - My Notes` : 'My Notes');
  const lines: string[] = [docTitle.toUpperCase(), `Exported: ${today()}`, '', '========================================', ''];
  for (const group of filtered) {
    if (!isSingle) lines.push(`== ${group.bookTitle.toUpperCase()} ==`, '');
    lines.push(...buildNotesTxt(group));
    if (!isSingle) lines.push('========================================', '');
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  triggerDownload(blob, `${toFilename(docTitle)}.txt`);
}

// --- Notes DOCX ---

function buildNotesDocxParagraphs(groups: BookExtractionGroup[], isMultiBook: boolean): string {
  const paras: string[] = [];
  for (const group of groups) {
    const noted = collectNotedItems(group);
    if (noted.length === 0) continue;
    if (isMultiBook) paras.push(docxHeading(group.bookTitle, 'Heading1'));
    const h2 = isMultiBook ? 'Heading2' : 'Heading1';
    const sections = groupNotedBySection(noted);
    for (const section of sections) {
      if (section.title) paras.push(docxHeading(section.title, h2));
      for (const item of section.items) {
        const text = item.type === 'declaration' ? `\u201C${cleanText(item.text)}\u201D` : cleanText(item.text);
        paras.push(docxBoldPrefixParagraph(item.badge, text));
        // Note styled prominently with cognac color
        paras.push(`<w:p><w:pPr><w:spacing w:after="80"/><w:ind w:left="240"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="A46A3C"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t xml:space="preserve">My Note: </w:t></w:r><w:r><w:rPr><w:color w:val="333333"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t xml:space="preserve">${escapeXml(cleanText(item.note))}</w:t></w:r></w:p>`);
        paras.push(docxSpacer());
      }
    }
  }
  return paras.join('\n');
}

export async function exportNotesDocx(groups: BookExtractionGroup[], title?: string): Promise<void> {
  const filtered = groups.filter((g) => collectNotedItems(g).length > 0);
  if (filtered.length === 0) return;
  const isSingle = filtered.length === 1;
  const docTitle = title || (isSingle ? `${filtered[0].bookTitle} - My Notes` : 'My Notes');

  const bodyContent = buildNotesDocxParagraphs(filtered, !isSingle);

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  mc:Ignorable="w14">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Title"/><w:spacing w:after="60"/></w:pPr>
      <w:r><w:rPr><w:color w:val="2D5A5A"/><w:sz w:val="44"/><w:szCs w:val="44"/></w:rPr><w:t>${escapeXml(docTitle)}</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:spacing w:after="200"/></w:pPr>
      <w:r><w:rPr><w:color w:val="666666"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">Exported: ${today()}</w:t></w:r>
    </w:p>
    ${bodyContent}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr><w:b/><w:color w:val="2D5A5A"/><w:sz w:val="44"/><w:szCs w:val="44"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr><w:b/><w:color w:val="2D5A5A"/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr><w:b/><w:color w:val="2D5A5A"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr><w:b/><w:color w:val="3B6E67"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
  </w:style>
</w:styles>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const zip = new JSZip();
  zip.file('[Content_Types].xml', contentTypesXml);
  zip.file('_rels/.rels', rootRelsXml);
  zip.file('word/document.xml', documentXml);
  zip.file('word/styles.xml', stylesXml);
  zip.file('word/_rels/document.xml.rels', docRelsXml);

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  triggerDownload(blob, `${toFilename(docTitle)}.docx`);
}
