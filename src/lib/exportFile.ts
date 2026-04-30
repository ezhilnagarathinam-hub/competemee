import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type Row = (string | number | null | undefined)[];

export function downloadExcel(filename: string, headers: string[], rows: Row[], sheetName = 'Sheet1') {
  const aoa = [headers, ...rows.map(r => r.map(v => (v == null ? '' : v)))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // Auto column widths
  ws['!cols'] = headers.map((h, i) => {
    const maxLen = Math.max(
      String(h).length,
      ...rows.map(r => String(r[i] ?? '').length),
    );
    return { wch: Math.min(Math.max(maxLen + 2, 10), 50) };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

export function downloadPDF(filename: string, title: string, headers: string[], rows: Row[]) {
  const orientation = headers.length > 6 ? 'landscape' : 'portrait';
  const doc = new jsPDF({ orientation, unit: 'pt', format: 'a4' });

  doc.setFontSize(16);
  doc.text(title, 40, 40);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 56);

  autoTable(doc, {
    startY: 72,
    head: [headers],
    body: rows.map(r => r.map(v => (v == null ? '' : String(v)))),
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [124, 58, 237], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 243, 255] },
    margin: { left: 40, right: 40 },
  });

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
