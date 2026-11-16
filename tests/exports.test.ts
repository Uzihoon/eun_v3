import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { exportJson, exportExcel, exportZip } from '../src/lib/export';
import { parseReport, convertReports } from '../src/lib/science';
const report = parseReport(readFileSync('tests/fixtures/sample-report.json', 'utf8'));
let blob: Blob;
let savedName: string;
beforeEach(() => {
  const link = { href: '', download: '', click() { savedName = this.download; }, remove() {} };
  vi.stubGlobal('document', { createElement: () => link, body: { append() {} } });
  vi.spyOn(URL, 'createObjectURL').mockImplementation(b => { blob = b as Blob; return 'blob:test'; });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('round trips every field of the original sample through JSON export', async () => {
  exportJson(report);
  expect(savedName).toBe('AG.json');
  expect(parseReport(await blob.text())).toEqual(report);
});
it('exports an actual Excel workbook containing both samples and all alignments', async () => {
  await exportExcel(report);
  expect(savedName).toMatch(/\.xlsx$/);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await blob.arrayBuffer());
  expect(workbook.worksheets.map(s => s.name)).toEqual(['Summary', 'Sequence', 'Sample-ID-71_S71', 'Sample-ID-72_S72']);
  expect(workbook.getWorksheet('Summary')!.getCell('B6').value).toBe(14568);
  expect(workbook.getWorksheet('Sample-ID-71_S71')!.getCell('B5').value).toBe(report.value['Sample-ID-71_S71'].table[0].origin);
  expect(workbook.getWorksheet('Sample-ID-71_S71')!.getCell('B339').value).toBe(report.value['Sample-ID-71_S71'].table[334].origin);
});
it('exports ZIP files with valid converted legacy reports and distinct filenames', async () => {
  const converted = convertReports([{ ...report, key: 'AG' }, { ...report, key: 'AG' }], ['reverseSeq']);
  await exportZip(converted);
  expect(savedName).toBe('EUN_Convert_File.zip');
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  expect(Object.keys(zip.files)).toEqual(['AG.json', 'AG_2.json']);
  const reopened = parseReport(await zip.file('AG.json')!.async('string'));
  expect(reopened.value['Sample-ID-71_S71'].table[0].origin).toBe([...report.value['Sample-ID-71_S71'].table[0].origin].reverse().join(''));
});
