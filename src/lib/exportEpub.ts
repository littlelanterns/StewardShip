import JSZip from 'jszip';
import type {
  BookExtractionGroup,
  ExportTabFilter,
  ExportOptions,
} from './exportExtractions';
import {
  escapeXml,
  cleanText,
  contentTypeLabel,
  actionStepLabel,
  styleLabel,
  triggerDownload,
  toFilename,
  today,
  collectChapters,
  exportExtractionsMd,
  exportExtractionsTxt,
  exportExtractionsDocx,
  exportNotesMd,
  exportNotesTxt,
  exportNotesDocx,
} from './exportExtractions';

// ============================================================
//  EPUB EXPORT
// ============================================================

const EPUB_STYLESHEET = `body {
  font-family: Georgia, "Times New Roman", serif;
  color: #2C3E50;
  line-height: 1.6;
  margin: 1em;
}
h1 {
  color: #12403A;
  font-size: 1.8em;
  margin-top: 1.5em;
  padding-bottom: 0.3em;
  border-bottom: 2px solid #A46A3C;
}
h2 {
  color: #1F514E;
  font-size: 1.4em;
  margin-top: 1.2em;
}
h3 {
  color: #3B6E67;
  font-size: 1.15em;
  margin-top: 1em;
}
.content-type {
  font-weight: bold;
  color: #1F514E;
  text-transform: uppercase;
  font-size: 0.85em;
}
.declaration {
  font-style: italic;
  color: #733C0C;
}
.style-label {
  font-style: italic;
  color: #879E9D;
  font-size: 0.9em;
}
.hearted::before {
  content: "\\2764\\FE0F ";
}
.user-note {
  margin: 0.3em 0 0.8em 1em;
  padding: 0.4em 0.6em;
  border-left: 3px solid #A46A3C;
  color: #555;
  font-size: 0.9em;
}
.user-note strong {
  color: #A46A3C;
}
.go-deeper {
  border-left: 3px solid #A46A3C;
  padding-left: 0.5em;
}
.section-divider {
  border: none;
  border-top: 1px solid #E8DFD0;
  margin: 1.5em 0;
}
.title-page {
  text-align: center;
  padding-top: 30%;
}
.title-page h1 {
  border: none;
  font-size: 2.2em;
}
.title-page .date {
  color: #879E9D;
  margin-top: 1em;
}
.title-page .footer {
  color: #879E9D;
  font-size: 0.85em;
  margin-top: 3em;
}
.value-name {
  font-weight: bold;
}
p {
  margin: 0.4em 0;
}`;

function epubXhtmlWrap(title: string, bodyContent: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <meta charset="utf-8"/>
  <title>${escapeXml(title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
${bodyContent}
</body>
</html>`;
}

function buildEpubTitlePage(docTitle: string): string {
  return epubXhtmlWrap(docTitle, `<div class="title-page">
  <h1>${escapeXml(docTitle)}</h1>
  <p class="date">Exported: ${today()}</p>
  <p class="footer">Exported from StewardShip</p>
</div>`);
}

function buildBookXhtml(group: BookExtractionGroup, tabs?: ExportTabFilter): string {
  const chapters = collectChapters(group, tabs);
  const fwName = group.principles[0]?.framework_name;
  const parts: string[] = [];

  parts.push(`<h1>${escapeXml(group.bookTitle)}</h1>`);

  for (const chapter of chapters) {
    if (chapter.sectionTitle) {
      parts.push(`<h2>${escapeXml(chapter.sectionTitle)}</h2>`);
    }

    if (chapter.summaries.length > 0) {
      parts.push('<h3>Summary</h3>');
      for (const s of chapter.summaries) {
        const cls = [s.is_hearted ? 'hearted' : '', s.is_from_go_deeper ? 'go-deeper' : ''].filter(Boolean).join(' ');
        const clsAttr = cls ? ` class="${cls}"` : '';
        parts.push(`<p${clsAttr}><span class="content-type">${escapeXml(contentTypeLabel(s.content_type))}</span> \u2014 ${escapeXml(cleanText(s.text))}</p>`);
        if (s.user_note) parts.push(`<div class="user-note"><strong>Note:</strong> ${escapeXml(cleanText(s.user_note))}</div>`);
      }
    }

    if (chapter.principles.length > 0) {
      parts.push(`<h3>Frameworks${fwName ? ` (${escapeXml(fwName)})` : ''}</h3>`);
      parts.push('<ul>');
      for (const p of chapter.principles) {
        const cls = p.is_hearted ? ' class="hearted"' : '';
        parts.push(`<li${cls}>${escapeXml(cleanText(p.text))}</li>`);
        if (p.user_note) parts.push(`<div class="user-note"><strong>Note:</strong> ${escapeXml(cleanText(p.user_note))}</div>`);
      }
      parts.push('</ul>');
    }

    if (chapter.actionSteps.length > 0) {
      parts.push('<h3>Action Steps</h3>');
      for (const a of chapter.actionSteps) {
        const cls = a.is_hearted ? ' class="hearted"' : '';
        parts.push(`<p${cls}><span class="content-type">${escapeXml(actionStepLabel(a.content_type))}</span> \u2014 ${escapeXml(cleanText(a.text))}</p>`);
        if (a.user_note) parts.push(`<div class="user-note"><strong>Note:</strong> ${escapeXml(cleanText(a.user_note))}</div>`);
      }
    }

    if (chapter.declarations.length > 0) {
      parts.push('<h3>Mast Content</h3>');
      for (const d of chapter.declarations) {
        const cls = d.is_hearted ? ' class="hearted declaration"' : ' class="declaration"';
        const valuePart = d.value_name ? `<span class="value-name">${escapeXml(d.value_name)}</span> ` : '';
        parts.push(`<p${cls}>${valuePart}<span class="style-label">${escapeXml(styleLabel(d.declaration_style))}</span> \u2014 ${escapeXml(cleanText(d.declaration_text))}</p>`);
        if (d.user_note) parts.push(`<div class="user-note"><strong>Note:</strong> ${escapeXml(cleanText(d.user_note))}</div>`);
      }
    }

    parts.push('<hr class="section-divider"/>');
  }

  return epubXhtmlWrap(group.bookTitle, parts.join('\n'));
}

function buildEpubContentOpf(
  docTitle: string,
  chapterList: Array<{ id: string; filename: string; title: string }>,
): string {
  const uuid = `urn:uuid:${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`;
  const manifestItems = [
    '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
    '<item id="style" href="style.css" media-type="text/css"/>',
    '<item id="title_page" href="title.xhtml" media-type="application/xhtml+xml"/>',
    ...chapterList.map((c) => `<item id="${c.id}" href="${c.filename}" media-type="application/xhtml+xml"/>`),
  ];
  const spineItems = [
    '<itemref idref="title_page"/>',
    ...chapterList.map((c) => `<itemref idref="${c.id}"/>`),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">${uuid}</dc:identifier>
    <dc:title>${escapeXml(docTitle)}</dc:title>
    <dc:creator>StewardShip Export</dc:creator>
    <dc:date>${today()}</dc:date>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta>
  </metadata>
  <manifest>
    ${manifestItems.join('\n    ')}
  </manifest>
  <spine toc="ncx">
    ${spineItems.join('\n    ')}
  </spine>
</package>`;
}

function buildEpubTocNcx(
  docTitle: string,
  chapterList: Array<{ id: string; filename: string; title: string }>,
): string {
  const navPoints = chapterList.map((c, i) =>
    `<navPoint id="navpoint-${i + 1}" playOrder="${i + 1}">
      <navLabel><text>${escapeXml(c.title)}</text></navLabel>
      <content src="${c.filename}"/>
    </navPoint>`
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(docTitle)}</text></docTitle>
  ${navPoints.join('\n  ')}
</ncx>`;
}

function buildEpubNavXhtml(
  docTitle: string,
  chapterList: Array<{ id: string; filename: string; title: string }>,
): string {
  const items = chapterList.map((c) =>
    `      <li><a href="${c.filename}">${escapeXml(c.title)}</a></li>`
  );

  return epubXhtmlWrap(docTitle, `<nav epub:type="toc" id="toc">
  <h1>Table of Contents</h1>
  <ol>
${items.join('\n')}
  </ol>
</nav>`);
}

export async function exportExtractionsEpub(
  groups: BookExtractionGroup[],
  title?: string,
  tabs?: ExportTabFilter,
): Promise<void> {
  const docTitle = title || (groups.length === 1 ? `${groups[0].bookTitle} - Extractions` : 'StewardShip Extractions');
  const zip = new JSZip();

  // mimetype MUST be first, uncompressed
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // META-INF/container.xml
  zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

  // Build chapter files
  const chapterFiles: Array<{ id: string; filename: string; title: string }> = [];
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const filename = `chapter_${i}.xhtml`;
    zip.file(`OEBPS/${filename}`, buildBookXhtml(group, tabs));
    chapterFiles.push({ id: `chapter_${i}`, filename, title: group.bookTitle });
  }

  // Title page
  zip.file('OEBPS/title.xhtml', buildEpubTitlePage(docTitle));

  // Stylesheet
  zip.file('OEBPS/style.css', EPUB_STYLESHEET);

  // OPF
  zip.file('OEBPS/content.opf', buildEpubContentOpf(docTitle, chapterFiles));

  // NCX (EPUB 2 compat)
  zip.file('OEBPS/toc.ncx', buildEpubTocNcx(docTitle, chapterFiles));

  // Nav (EPUB 3 TOC)
  zip.file('OEBPS/nav.xhtml', buildEpubNavXhtml(docTitle, chapterFiles));

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/epub+zip',
  });
  triggerDownload(blob, `${toFilename(docTitle)}.epub`);
}

// ============================================================
//  UNIFIED EXPORT ENTRY POINT
// ============================================================

export async function exportWithOptions(
  groups: BookExtractionGroup[],
  options: ExportOptions,
): Promise<void> {
  const { tabs, format, title, mode } = options;

  if (mode === 'notes') {
    switch (format) {
      case 'md': exportNotesMd(groups, title); return;
      case 'txt': exportNotesTxt(groups, title); return;
      case 'docx': await exportNotesDocx(groups, title); return;
      case 'epub': await exportExtractionsEpub(groups, title, tabs); return;
    }
  }

  if (mode === 'hearted') {
    const heartTitle = title || `My Hearted Items - ${today()}`;
    switch (format) {
      case 'md': exportExtractionsMd(groups, heartTitle, tabs); return;
      case 'txt': exportExtractionsTxt(groups, heartTitle, tabs); return;
      case 'docx': await exportExtractionsDocx(groups, heartTitle, tabs); return;
      case 'epub': await exportExtractionsEpub(groups, heartTitle, tabs); return;
    }
  }

  // Default: extractions mode
  switch (format) {
    case 'md': exportExtractionsMd(groups, title, tabs); return;
    case 'txt': exportExtractionsTxt(groups, title, tabs); return;
    case 'docx': await exportExtractionsDocx(groups, title, tabs); return;
    case 'epub': await exportExtractionsEpub(groups, title, tabs); return;
  }
}
