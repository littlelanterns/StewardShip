import JSZip from 'jszip';

export interface ExportablePrinciple {
  text: string;
  sort_order: number;
  is_included?: boolean;
}

export interface FrameworkExportData {
  frameworkName: string;
  sourceTitle: string;
  principles: ExportablePrinciple[];
}

export interface AggregatedFrameworkExportData {
  frameworks: FrameworkExportData[];
  exportedAt?: string;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function toFilename(name: string): string {
  return name.replace(/[^a-z0-9\-_ ]/gi, '').trim().replace(/\s+/g, '_');
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// --- Single Framework Exports ---

export function exportAsMarkdown(data: FrameworkExportData): void {
  const { frameworkName, sourceTitle, principles } = data;
  const included = principles.filter((p) => p.is_included !== false);

  const lines: string[] = [
    `# ${frameworkName}`,
    ``,
    `**Source:** ${sourceTitle}`,
    `**Exported:** ${today()}`,
    `**Principles:** ${included.length}`,
    ``,
    `---`,
    ``,
  ];

  included.forEach((p, i) => {
    lines.push(`${i + 1}. ${p.text}`);
    lines.push(``);
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  triggerDownload(blob, `${toFilename(frameworkName)}_framework.md`);
}

export function exportAsTxt(data: FrameworkExportData): void {
  const { frameworkName, sourceTitle, principles } = data;
  const included = principles.filter((p) => p.is_included !== false);

  const lines: string[] = [
    frameworkName,
    `Source: ${sourceTitle}`,
    `Exported: ${today()}`,
    `Principles: ${included.length}`,
    ``,
    `---`,
    ``,
  ];

  included.forEach((p, i) => {
    lines.push(`${i + 1}. ${p.text}`);
    lines.push(``);
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  triggerDownload(blob, `${toFilename(frameworkName)}_framework.txt`);
}

export async function exportAsDocx(data: FrameworkExportData): Promise<void> {
  const { frameworkName, sourceTitle, principles } = data;
  const included = principles.filter((p) => p.is_included !== false);

  const principleParas = included.map((p) => `
    <w:p>
      <w:pPr>
        <w:numPr>
          <w:ilvl w:val="0"/>
          <w:numId w:val="1"/>
        </w:numPr>
        <w:spacing w:after="120"/>
      </w:pPr>
      <w:r>
        <w:t xml:space="preserve">${escapeXml(p.text)}</w:t>
      </w:r>
    </w:p>`).join('\n');

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
  mc:Ignorable="w14 wpc">
  <w:body>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
        <w:spacing w:after="120"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:color w:val="2D5A5A"/>
          <w:sz w:val="40"/>
          <w:szCs w:val="40"/>
        </w:rPr>
        <w:t>${escapeXml(frameworkName)}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr><w:spacing w:after="80"/></w:pPr>
      <w:r>
        <w:rPr><w:color w:val="666666"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
        <w:t xml:space="preserve">Source: ${escapeXml(sourceTitle)}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr><w:spacing w:after="80"/></w:pPr>
      <w:r>
        <w:rPr><w:color w:val="666666"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
        <w:t xml:space="preserve">Exported: ${today()} · ${included.length} principles</w:t>
      </w:r>
    </w:p>
    <w:p><w:pPr><w:spacing w:after="160" w:before="160"/></w:pPr></w:p>
    ${principleParas}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const numberingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="decimal"/>
      <w:lvlText w:val="%1."/>
      <w:lvlJc w:val="left"/>
      <w:pPr>
        <w:ind w:left="720" w:hanging="360"/>
      </w:pPr>
      <w:rPr>
        <w:sz w:val="22"/>
      </w:rPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1">
    <w:abstractNumId w:val="0"/>
  </w:num>
</w:numbering>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr>
      <w:b/>
      <w:color w:val="2D5A5A"/>
      <w:sz w:val="40"/>
      <w:szCs w:val="40"/>
    </w:rPr>
  </w:style>
</w:styles>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const zip = new JSZip();
  zip.file('[Content_Types].xml', contentTypesXml);
  zip.file('_rels/.rels', rootRelsXml);
  zip.file('word/document.xml', documentXml);
  zip.file('word/styles.xml', stylesXml);
  zip.file('word/numbering.xml', numberingXml);
  zip.file('word/_rels/document.xml.rels', relsXml);

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  triggerDownload(blob, `${toFilename(frameworkName)}_framework.docx`);
}

// --- Aggregated Framework Exports ---

export function exportAggregatedAsMarkdown(data: AggregatedFrameworkExportData): void {
  const date = data.exportedAt || today();
  const totalPrinciples = data.frameworks.reduce(
    (sum, fw) => sum + fw.principles.filter((p) => p.is_included !== false).length, 0
  );

  const lines: string[] = [
    `# My Frameworks`,
    ``,
    `**Exported:** ${date}`,
    `**Frameworks:** ${data.frameworks.length} · **Total Principles:** ${totalPrinciples}`,
    ``,
    `---`,
    ``,
  ];

  data.frameworks.forEach((fw) => {
    const included = fw.principles.filter((p) => p.is_included !== false);
    lines.push(`## ${fw.frameworkName}`);
    lines.push(``);
    lines.push(`*Source: ${fw.sourceTitle} · ${included.length} principles*`);
    lines.push(``);
    included.forEach((p, i) => {
      lines.push(`${i + 1}. ${p.text}`);
      lines.push(``);
    });
    lines.push(`---`);
    lines.push(``);
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  triggerDownload(blob, `my_frameworks_${date}.md`);
}

export function exportAggregatedAsTxt(data: AggregatedFrameworkExportData): void {
  const date = data.exportedAt || today();
  const totalPrinciples = data.frameworks.reduce(
    (sum, fw) => sum + fw.principles.filter((p) => p.is_included !== false).length, 0
  );

  const lines: string[] = [
    `MY FRAMEWORKS`,
    `Exported: ${date}`,
    `Frameworks: ${data.frameworks.length} · Total Principles: ${totalPrinciples}`,
    ``,
    `---`,
    ``,
  ];

  data.frameworks.forEach((fw) => {
    const included = fw.principles.filter((p) => p.is_included !== false);
    lines.push(fw.frameworkName.toUpperCase());
    lines.push(`Source: ${fw.sourceTitle} · ${included.length} principles`);
    lines.push(``);
    included.forEach((p, i) => {
      lines.push(`${i + 1}. ${p.text}`);
      lines.push(``);
    });
    lines.push(`---`);
    lines.push(``);
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  triggerDownload(blob, `my_frameworks_${date}.txt`);
}

export async function exportAggregatedAsDocx(data: AggregatedFrameworkExportData): Promise<void> {
  const date = data.exportedAt || today();
  const totalPrinciples = data.frameworks.reduce(
    (sum, fw) => sum + fw.principles.filter((p) => p.is_included !== false).length, 0
  );

  const abstractNumXml = `
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="decimal"/>
      <w:lvlText w:val="%1."/>
      <w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
      <w:rPr><w:sz w:val="22"/></w:rPr>
    </w:lvl>
  </w:abstractNum>`;

  const numEntries = data.frameworks.map((_, i) => `
  <w:num w:numId="${i + 1}">
    <w:abstractNumId w:val="0"/>
    <w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride>
  </w:num>`).join('\n');

  const numberingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  ${abstractNumXml}
  ${numEntries}
</w:numbering>`;

  const coverXml = `
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/><w:spacing w:after="120"/></w:pPr>
      <w:r>
        <w:rPr><w:color w:val="2D5A5A"/><w:sz w:val="40"/><w:szCs w:val="40"/></w:rPr>
        <w:t>My Frameworks</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr><w:spacing w:after="80"/></w:pPr>
      <w:r>
        <w:rPr><w:color w:val="666666"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
        <w:t xml:space="preserve">Exported: ${date} · ${data.frameworks.length} frameworks · ${totalPrinciples} principles</w:t>
      </w:r>
    </w:p>
    <w:p><w:pPr><w:spacing w:after="240" w:before="240"/></w:pPr></w:p>`;

  const frameworkBlocks = data.frameworks.map((fw, fwIndex) => {
    const included = fw.principles.filter((p) => p.is_included !== false);
    const numId = fwIndex + 1;

    const principleParas = included.map((p) => `
    <w:p>
      <w:pPr>
        <w:numPr>
          <w:ilvl w:val="0"/>
          <w:numId w:val="${numId}"/>
        </w:numPr>
        <w:spacing w:after="120"/>
      </w:pPr>
      <w:r><w:t xml:space="preserve">${escapeXml(p.text)}</w:t></w:r>
    </w:p>`).join('\n');

    return `
    <w:p>
      <w:pPr><w:pStyle w:val="Heading2"/><w:spacing w:before="240" w:after="80"/></w:pPr>
      <w:r>
        <w:rPr><w:color w:val="2D5A5A"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>
        <w:t>${escapeXml(fw.frameworkName)}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr><w:spacing w:after="120"/></w:pPr>
      <w:r>
        <w:rPr><w:color w:val="666666"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:i/></w:rPr>
        <w:t xml:space="preserve">Source: ${escapeXml(fw.sourceTitle)} · ${included.length} principles</w:t>
      </w:r>
    </w:p>
    ${principleParas}
    <w:p><w:pPr><w:spacing w:after="200" w:before="200"/></w:pPr></w:p>`;
  }).join('\n');

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  mc:Ignorable="w14">
  <w:body>
    ${coverXml}
    ${frameworkBlocks}
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
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr><w:b/><w:color w:val="2D5A5A"/><w:sz w:val="40"/><w:szCs w:val="40"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr><w:b/><w:color w:val="2D5A5A"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>
  </w:style>
</w:styles>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const zip = new JSZip();
  zip.file('[Content_Types].xml', contentTypesXml);
  zip.file('_rels/.rels', rootRelsXml);
  zip.file('word/document.xml', documentXml);
  zip.file('word/styles.xml', stylesXml);
  zip.file('word/numbering.xml', numberingXml);
  zip.file('word/_rels/document.xml.rels', relsXml);

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  triggerDownload(blob, `my_frameworks_${date}.docx`);
}
