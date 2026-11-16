import type { NamedReport, Report } from './types';
import { percent, sampleIds } from './science';

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const exportJson = (report: Report) => download(new Blob([JSON.stringify({ value: report.value, format: report.format, summary: report.summary })], { type: 'application/json' }), `${report.format.targetSeq}${report.format.changeSeq}.json`);
export async function exportZip(reports: NamedReport[]) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const used = new Set<string>();
  for (const { key, value, format, summary } of reports) {
    const base = key.replace(/[/\\:*?"<>|]/g, '_') || 'report';
    let name = base, i = 2;
    while (used.has(name)) name = `${base}_${i++}`;
    used.add(name);
    zip.file(`${name}.json`, JSON.stringify({ value, format, summary }));
  }
  download(await zip.generateAsync({ type: 'blob' }), 'EUN_Convert_File.zip');
}
export async function exportExcel(report: Report) {
  const { default: ExcelJS } = await import('exceljs');
  const book = new ExcelJS.Workbook();
  book.creator = 'EUN';
  const summary = book.addWorksheet('Summary');
  summary.addRows([
    ['Analysed Date', new Date().toISOString().slice(0, 10)],
    ['WT Sequence', report.summary.map(s => s.data).join('')],
    ['crRNA sequence', report.format.seq_RGEN], [],
    ['ID', 'More than minimum frequency', 'Insertions', 'Deletions', 'Substitution frequency (%)'],
  ]);
  const sequence = book.addWorksheet('Sequence');
  const used = new Set(['summary', 'sequence']);
  for (const id of sampleIds(report)) {
    const item = report.value[id];
    summary.addRow([id, item.tot_count, item.cnt_ins, item.cnt_del, +percent(item.changed, item.tot_count).toFixed(2)]);
    const base = id.replace(/[\\/*?:[\]]/g, '_').replace(/^'+|'+$/g, '').slice(0, 27) || 'Sample';
    let name = base, index = 2;
    while (used.has(name.toLowerCase())) name = `${base}_${index++}`;
    used.add(name.toLowerCase());
    const sheet = book.addWorksheet(name);
    sheet.addRows([
      ['Total Sequences', 'With both indicator sequences', 'More than minimum frequency', 'Insertions', 'Deletions'],
      [item.joins_length, item.totlr_count, item.tot_count, item.cnt_ins, item.cnt_del], [],
      ['ID', 'WT Sequence', 'Treated Sequence', 'Length', 'Count', 'Type', 'HDR'],
      ...item.table.map(row => [row.id, row.origin, row.change, row.length, row.count, ['WT or Sub', 'INS', 'DEL'][row.type], row.hdr < -1 ? 'N/A' : row.hdr === -1 ? 'X' : 'O']), [],
      ['Original', 'Change', 'Value (%)'],
      [report.format.targetSeq, report.format.changeSeq, +percent(item.changed, item.tot_count).toFixed(2)], [],
    ]);
    const matrix = ['A', 'C', 'G', 'T'].map(base => [base, ...item.chartIndex.map(col => +percent(col[base] || 0, item.tot_count).toFixed(1))]);
    const columns = ['Nucleotide', ...item.chartIndex.map((_, i) => `${report.format.seq_RGEN[i] ?? ''} ${report.format.seq_RGEN.length - i}`)];
    sheet.addRows([columns, ...matrix]);
    sequence.addRows([[id], columns, ...matrix, []]);
  }
  book.eachSheet(sheet => {
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF163B3A' } };
    sheet.columns.forEach((col, i) => { col.width = i === 0 ? 24 : 22; });
  });
  const buffer = await book.xlsx.writeBuffer();
  download(new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `EUN-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
