import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface ResultQuestionRow {
  number: number;
  question: string;
  question_secondary?: string | null;
  options: { A: string; B: string; C: string; D: string };
  options_secondary?: { A: string; B: string; C: string; D: string } | null;
  correct: string;
  selected: string | null;
  marks: number;
  awarded: number;
  explanation?: string | null;
  explanation_secondary?: string | null;
}

export interface ResultSheet {
  studentName: string;
  competitionName: string;
  startedAt?: string | null;
  submittedAt?: string | null;
  totalMarks: number;
  maxMarks: number;
  correctMarks: number;
  negativeMarks: number;
  rows: ResultQuestionRow[];
}

function fmt(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

/**
 * Detailed answer sheet: every question, its options, the correct answer and
 * the student's answer, with per-question marks awarded.
 */
export async function downloadResultPDF(sheet: ResultSheet, filename?: string) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 40;
  const maxWidth = pageWidth - marginX * 2;
  let y = 40;

  const escapeHtml = (value: unknown) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const renderBlock = async (html: string) => {
    const host = document.createElement('div');
    host.style.cssText = [
      'position:fixed', 'left:-10000px', 'top:0', 'width:720px', 'padding:18px',
      'box-sizing:border-box', 'background:#ffffff', 'color:#1e1e1e',
      'font-family:Arial,"Noto Sans Tamil","Nirmala UI",Latha,sans-serif',
      'font-size:14px', 'line-height:1.55', 'white-space:normal', 'overflow-wrap:anywhere',
    ].join(';');
    host.innerHTML = html;
    document.body.appendChild(host);
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      return await html2canvas(host, { backgroundColor: '#ffffff', scale: 2, logging: false });
    } finally {
      host.remove();
    }
  };

  const addBlock = async (html: string) => {
    const canvas = await renderBlock(html);
    let height = (canvas.height * maxWidth) / canvas.width;
    let width = maxWidth;
    const availablePageHeight = pageHeight - 80;
    if (height > availablePageHeight) {
      const scale = availablePageHeight / height;
      height *= scale;
      width *= scale;
    }
    if (y + height > pageHeight - 40) {
      doc.addPage();
      y = 40;
    }
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', marginX, y, width, height, undefined, 'FAST');
    y += height + 10;
  };

  await addBlock(`
    <div style="background:#7c3aed;color:#fff;padding:18px 22px;margin:-18px">
      <div style="font-size:21px;font-weight:700">ANSWER SHEET &amp; RESULT</div>
      <div style="font-size:15px;margin-top:5px">${escapeHtml(sheet.competitionName)}</div>
    </div>
    <div style="margin-top:30px;font-size:15px;font-weight:700">Player: ${escapeHtml(sheet.studentName)}</div>
    <div style="color:#6e6e6e;margin-top:5px">Started: ${escapeHtml(fmt(sheet.startedAt))} &nbsp;&nbsp; Submitted: ${escapeHtml(fmt(sheet.submittedAt))}</div>
    <div style="color:#14783c;font-size:15px;font-weight:700;margin-top:5px">Score: ${sheet.totalMarks} / ${sheet.maxMarks} &nbsp; (Correct +${sheet.correctMarks}, Negative -${sheet.negativeMarks})</div>
  `);

  for (const r of sheet.rows) {
    const status = !r.selected ? 'NOT ANSWERED' : r.selected === r.correct ? 'CORRECT' : 'WRONG';
    const statusColor = status === 'CORRECT' ? '#148246' : status === 'WRONG' ? '#be2828' : '#737373';
    const options = (['A', 'B', 'C', 'D'] as const).map((k) => {
      const marker = k === r.correct ? '&nbsp; ← correct' : k === r.selected ? '&nbsp; ← your answer' : '';
      const secondary = r.options_secondary?.[k]
        ? `<div style="margin-left:20px;color:#555">${escapeHtml(r.options_secondary[k])}</div>`
        : '';
      return `<div style="margin:4px 0 0 14px;color:${k === r.correct ? '#148246' : '#3c3c3c'}"><b>${k}.</b> ${escapeHtml(r.options[k])}${marker}${secondary}</div>`;
    }).join('');

    await addBlock(`
      <div style="border-bottom:1px solid #e5e5e5;padding-bottom:12px">
        <div style="font-weight:700">Q${r.number}. ${escapeHtml(r.question)}</div>
        ${r.question_secondary ? `<div lang="ta" style="color:#444;margin-top:5px">${escapeHtml(r.question_secondary)}</div>` : ''}
        <div style="margin-top:7px">${options}</div>
        <div style="color:${statusColor};font-weight:700;margin-top:9px">${status} &nbsp; | &nbsp; Your answer: ${escapeHtml(r.selected || '—')} &nbsp; | &nbsp; Correct answer: ${escapeHtml(r.correct)} &nbsp; | &nbsp; Marks: ${r.awarded}</div>
        ${r.explanation ? `<div style="color:#595959;margin:7px 0 0 14px"><b>Explanation:</b> ${escapeHtml(r.explanation)}</div>` : ''}
        ${r.explanation_secondary ? `<div lang="ta" style="color:#595959;margin:4px 0 0 14px"><b>விளக்கம்:</b> ${escapeHtml(r.explanation_secondary)}</div>` : ''}
      </div>
    `);
  }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${total}`, pageWidth - marginX - 60, pageHeight - 20);
  }

  const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  doc.save(filename || `result-${safe(sheet.competitionName)}-${safe(sheet.studentName)}.pdf`);
}

/** Build the rows for a result sheet from questions + the student's answers. */
export function buildResultRows(
  questions: any[],
  answersByQuestion: Map<string, any>,
): { rows: ResultQuestionRow[]; correctMarks: number; negativeMarks: number; maxMarks: number } {
  let correctMarks = 0;
  let negativeMarks = 0;
  let maxMarks = 0;

  const rows: ResultQuestionRow[] = questions.map((q) => {
    const marks = Number(q.marks) || 0;
    maxMarks += marks;
    const ans = answersByQuestion.get(q.id);
    const selected = ans?.selected_answer || null;
    let awarded = 0;
    if (selected) {
      if (selected === q.correct_answer) {
        awarded = marks;
        correctMarks += marks;
      } else {
        awarded = -Math.round((marks / 3) * 100) / 100;
        negativeMarks += marks / 3;
      }
    }
    return {
      number: q.question_number,
      question: q.question_text,
      question_secondary: q.question_text_secondary || null,
      options: { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d },
      options_secondary: q.secondary_language ? {
        A: q.option_a_secondary || '',
        B: q.option_b_secondary || '',
        C: q.option_c_secondary || '',
        D: q.option_d_secondary || '',
      } : null,
      correct: q.correct_answer,
      selected,
      marks,
      awarded: Math.round(awarded * 100) / 100,
      explanation: q.explanation || null,
      explanation_secondary: q.explanation_secondary || null,
    };
  });

  return {
    rows,
    correctMarks: Math.round(correctMarks * 100) / 100,
    negativeMarks: Math.round(negativeMarks * 100) / 100,
    maxMarks: Math.round(maxMarks * 100) / 100,
  };
}
