import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Header,
  Footer,
  PageNumber,
} from 'docx';

export type QuestionForExport = {
  question_number: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'A' | 'B' | 'C' | 'D' | string;
  marks?: number | null;
  explanation?: string | null;
};

export type ExportMode = 'questions_only' | 'with_answers';
export type ExportFormat = 'pdf' | 'word';

interface ExportOptions {
  title: string;
  watermark?: string;
  mode: ExportMode;
  format: ExportFormat;
  competitionName?: string;
  filename?: string;
}

function safeFilename(name: string): string {
  return name.replace(/[^a-z0-9-_]+/gi, '_').replace(/_+/g, '_').slice(0, 80) || 'questions';
}

/* ---------------- PDF EXPORT ---------------- */

function drawWatermark(doc: jsPDF, text: string) {
  if (!text) return;
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    // @ts-ignore - GState exists at runtime in jspdf
    const gs = (doc as any).GState ? new (doc as any).GState({ opacity: 0.12 }) : null;
    if (gs) (doc as any).setGState(gs);
    doc.setTextColor(120, 80, 200);
    doc.setFontSize(70);
    doc.text(text, w / 2, h / 2, {
      align: 'center',
      angle: 35,
      baseline: 'middle',
    });
    // reset opacity
    // @ts-ignore
    if ((doc as any).GState) (doc as any).setGState(new (doc as any).GState({ opacity: 1 }));
    doc.setTextColor(0, 0, 0);
  }
}

function exportPdf(questions: QuestionForExport[], opts: ExportOptions) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(opts.title, pageWidth / 2, 50, { align: 'center' });

  if (opts.competitionName) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(opts.competitionName, pageWidth / 2, 68, { align: 'center' });
    doc.setTextColor(0);
  }

  doc.setDrawColor(124, 58, 237);
  doc.setLineWidth(1);
  doc.line(margin, 78, pageWidth - margin, 78);

  // Body — render as a table for clean pagination
  const body: any[] = [];
  questions.forEach((q) => {
    const lines: string[] = [];
    lines.push(`Q${q.question_number}. ${q.question_text}` + (q.marks ? `   [${q.marks} mark${Number(q.marks) === 1 ? '' : 's'}]` : ''));
    lines.push(`   A) ${q.option_a}`);
    lines.push(`   B) ${q.option_b}`);
    lines.push(`   C) ${q.option_c}`);
    lines.push(`   D) ${q.option_d}`);
    if (opts.mode === 'with_answers') {
      lines.push(`   Answer: ${q.correct_answer}`);
      if (q.explanation) lines.push(`   Explanation: ${q.explanation}`);
    }
    body.push([lines.join('\n')]);
  });

  autoTable(doc, {
    startY: 92,
    head: [],
    body,
    theme: 'plain',
    styles: { fontSize: 11, cellPadding: 6, overflow: 'linebreak', textColor: 20 },
    columnStyles: { 0: { cellWidth: pageWidth - margin * 2 } },
    margin: { left: margin, right: margin, top: 92, bottom: 50 },
    didDrawPage: () => {
      // Footer
      const h = doc.internal.pageSize.getHeight();
      doc.setFontSize(9);
      doc.setTextColor(140);
      doc.text(
        `${opts.title} — Page ${doc.getCurrentPageInfo().pageNumber}`,
        pageWidth / 2,
        h - 20,
        { align: 'center' }
      );
      doc.setTextColor(0);
    },
  });

  if (opts.watermark) drawWatermark(doc, opts.watermark);

  const fname = safeFilename(opts.filename || opts.title);
  doc.save(`${fname}.pdf`);
}

/* ---------------- WORD (DOCX) EXPORT ---------------- */

async function exportWord(questions: QuestionForExport[], opts: ExportOptions) {
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: opts.title, bold: true, size: 36 })],
    })
  );

  if (opts.competitionName) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: opts.competitionName, italics: true, size: 22, color: '666666' })],
      })
    );
  }

  children.push(new Paragraph({ children: [new TextRun({ text: '' })] }));

  questions.forEach((q) => {
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 80 },
        children: [
          new TextRun({ text: `Q${q.question_number}. `, bold: true }),
          new TextRun({ text: q.question_text }),
          ...(q.marks ? [new TextRun({ text: `   [${q.marks} mark${Number(q.marks) === 1 ? '' : 's'}]`, italics: true, color: '888888' })] : []),
        ],
      })
    );
    (['A', 'B', 'C', 'D'] as const).forEach((letter) => {
      const value = (q as any)[`option_${letter.toLowerCase()}`] as string;
      children.push(
        new Paragraph({
          indent: { left: 360 },
          children: [new TextRun({ text: `${letter}) ${value}` })],
        })
      );
    });
    if (opts.mode === 'with_answers') {
      children.push(
        new Paragraph({
          indent: { left: 360 },
          spacing: { before: 60 },
          children: [
            new TextRun({ text: 'Answer: ', bold: true, color: '0D9488' }),
            new TextRun({ text: q.correct_answer, bold: true }),
          ],
        })
      );
      if (q.explanation) {
        children.push(
          new Paragraph({
            indent: { left: 360 },
            children: [
              new TextRun({ text: 'Explanation: ', bold: true, color: '7C3AED' }),
              new TextRun({ text: q.explanation }),
            ],
          })
        );
      }
    }
  });

  const headers = opts.watermark
    ? {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: opts.watermark.toUpperCase(),
                  bold: true,
                  size: 60,
                  color: 'E0D4FF',
                }),
              ],
            }),
          ],
        }),
      }
    : undefined;

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
          },
        },
        headers,
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: `${opts.title} — Page `, size: 18, color: '888888' }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '888888' }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFilename(opts.filename || opts.title)}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ---------------- PUBLIC API ---------------- */

export async function exportQuestions(questions: QuestionForExport[], opts: ExportOptions) {
  if (!questions || questions.length === 0) {
    throw new Error('No questions to export');
  }
  if (opts.format === 'pdf') {
    exportPdf(questions, opts);
  } else {
    await exportWord(questions, opts);
  }
}
