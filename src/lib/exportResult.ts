import jsPDF from 'jspdf';

export interface ResultQuestionRow {
  number: number;
  question: string;
  question_secondary?: string | null;
  options: { A: string; B: string; C: string; D: string };
  correct: string;
  selected: string | null;
  marks: number;
  awarded: number;
  explanation?: string | null;
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
export function downloadResultPDF(sheet: ResultSheet, filename?: string) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 40;
  const maxWidth = pageWidth - marginX * 2;
  let y = 50;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 40) {
      doc.addPage();
      y = 50;
    }
  };

  const write = (text: string, size = 10, style: 'normal' | 'bold' = 'normal', color: [number, number, number] = [30, 30, 30], indent = 0) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, maxWidth - indent);
    ensureSpace(lines.length * (size + 3));
    doc.text(lines, marginX + indent, y);
    y += lines.length * (size + 3);
  };

  // Header
  doc.setFillColor(124, 58, 237);
  doc.rect(0, 0, pageWidth, 70, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('ANSWER SHEET & RESULT', marginX, 32);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(sheet.competitionName, marginX, 52);
  y = 95;

  write(`Player: ${sheet.studentName}`, 11, 'bold');
  write(`Started: ${fmt(sheet.startedAt)}    Submitted: ${fmt(sheet.submittedAt)}`, 9, 'normal', [110, 110, 110]);
  write(
    `Score: ${sheet.totalMarks} / ${sheet.maxMarks}   (Correct +${sheet.correctMarks}, Negative -${sheet.negativeMarks})`,
    11,
    'bold',
    [20, 120, 60],
  );
  y += 8;
  doc.setDrawColor(220);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 16;

  sheet.rows.forEach((r) => {
    ensureSpace(90);
    const status = !r.selected ? 'NOT ANSWERED' : r.selected === r.correct ? 'CORRECT' : 'WRONG';
    const statusColor: [number, number, number] =
      status === 'CORRECT' ? [20, 130, 70] : status === 'WRONG' ? [190, 40, 40] : [130, 130, 130];

    write(`Q${r.number}. ${r.question}`, 10, 'bold');
    if (r.question_secondary) write(r.question_secondary, 10, 'normal', [70, 70, 70]);

    (['A', 'B', 'C', 'D'] as const).forEach((k) => {
      const text = r.options[k];
      if (!text) return;
      const mark = k === r.correct ? '  <-- correct' : k === r.selected ? '  <-- your answer' : '';
      write(`${k}) ${text}${mark}`, 9, 'normal', k === r.correct ? [20, 130, 70] : [60, 60, 60], 14);
    });

    write(
      `${status}   |   Your answer: ${r.selected || '—'}   |   Correct answer: ${r.correct}   |   Marks: ${r.awarded}`,
      9,
      'bold',
      statusColor,
    );
    if (r.explanation) write(`Explanation: ${r.explanation}`, 9, 'normal', [90, 90, 90], 14);

    y += 6;
    doc.setDrawColor(235);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 12;
  });

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
      correct: q.correct_answer,
      selected,
      marks,
      awarded: Math.round(awarded * 100) / 100,
      explanation: q.explanation || null,
    };
  });

  return {
    rows,
    correctMarks: Math.round(correctMarks * 100) / 100,
    negativeMarks: Math.round(negativeMarks * 100) / 100,
    maxMarks: Math.round(maxMarks * 100) / 100,
  };
}
