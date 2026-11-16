import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { prepareAnalysis, parseReport, convertReports, buildIndel, SAMPLE_FORM, percent } from '../src/lib/science';

const fixture = () => ({
  format: { seq_wt: 'AACCGGTT', seq_RGEN: 'CCGG', targetSeq: 'C', changeSeq: 'T', end_range: 70 },
  summary: [{ type: 'normal', data: 'AACCGGTT' }],
  value: { sample1: {
    fileId: 'sample1', standard_seq: 'AACCGGTT', seq_target: 'CCGG', seq_type: '1', tot_count: 10,
    joins_length: 12, totlr_count: 11, cnt_ins: 0, cnt_del: 2, changed: 3, standardLen: 8, chartIndex: [],
    table: [
      { id: 1, origin: 'AACCGGTT', change: 'AACCGGTT', graphic: '||||||||', count: 8, type: 0, length: 8, hdr: -2 },
      { id: 2, origin: 'AACCGGTT', change: 'AA-CGGTT', graphic: '|| |||||', count: 2, type: 2, length: 7, hdr: -2 },
    ],
  } },
});
describe('legacy compatibility', () => {
  it('preserves both original engine files byte-for-byte', () => {
    expect(createHash('sha256').update(readFileSync('public/engine/worker.js')).digest('hex')).toBe('bf24aa8423616f82b6d07978adae15fee5256d4de64fcd08b18cd23bd2a797b6');
    expect(createHash('sha256').update(readFileSync('public/engine/pako.js')).digest('hex')).toBe('b1231fb0cff7b838e662936402a3b48ff0a380308453826f3493c1a5c72aceb3');
  });
  it('imports original JSON without altering its contents', () => {
    const report = fixture();
    expect(parseReport(JSON.stringify(report))).toEqual(report);
  });
  it.each(['{}', '{', '{"value":null}', JSON.stringify({ ...fixture(), summary: null }), JSON.stringify({ ...fixture(), value: { s: { table: 'bad' } } })])('rejects malformed reports: %s', text => {
    expect(() => parseReport(text)).toThrow();
  });
  it('matches the original INDEL worker on the same report', () => {
    const input = [{ ...fixture(), key: 'AG' }, { ...fixture(), key: 'CT' }];
    let original: unknown;
    const context = vm.createContext({ postMessage: (data: unknown) => { original = data; } });
    vm.runInContext(readFileSync('tests/fixtures/original-indel.js', 'utf8').replace('export default () => {', '(() => {').replace(/};\s*$/, '})();'), context);
    context.onmessage({ data: structuredClone(input) });
    expect(buildIndel(input)).toEqual(original);
  });
  it('matches the original INDEL calculation for the complete 671-row sample', () => {
    const report = parseReport(readFileSync('tests/fixtures/sample-report.json', 'utf8'));
    const input = [{ ...report, key: 'AG' }];
    let original: unknown;
    const context = vm.createContext({ postMessage: (data: unknown) => { original = data; } });
    vm.runInContext(readFileSync('tests/fixtures/original-indel.js', 'utf8').replace('export default () => {', '(() => {').replace(/};\s*$/, '})();'), context);
    context.onmessage({ data: structuredClone(input) });
    expect(buildIndel(input)).toEqual(original);
  });
  it('matches original conversion code for all operations on actual EUN results', () => {
    const report = parseReport(readFileSync('tests/fixtures/sample-report.json', 'utf8'));
    const source = readFileSync('tests/fixtures/original-convert.js', 'utf8');
    const object = source.match(/const convert = ([\s\S]+?);\n\n  let convertedFile/)![1];
    const original = vm.runInNewContext(`(${object})`, { _: { cloneDeep: structuredClone } });
    for (const operations of [['reverseSeq'], ['reverseNucleo'], ['reverseSeq', 'reverseNucleo'], ['merge']] as const) {
      let expected = [{ ...structuredClone(report), key: 'AG' }];
      for (const operation of operations) expected = original[operation](expected);
      expect(convertReports([{ ...report, key: 'AG' }], [...operations])).toEqual(expected);
    }
  });
  it('reverses sequences and complements in requested order without mutating source', () => {
    const report = { ...fixture(), key: 'AG' };
    const original = structuredClone(report);
    const [result] = convertReports([report], ['reverseSeq', 'reverseNucleo']);
    expect(result.value.sample1.table[1].change).toBe('AACCG-TT');
    expect(result.value.sample1.table[1].graphic).toBe('||||| ||');
    expect(result.format).toEqual(original.format);
    expect(result.summary).toEqual(original.summary);
    expect(report).toEqual(original);
  });
  it('merges original report structures and flags duplicate sample IDs instead of losing data', () => {
    expect(() => convertReports([{ ...fixture(), key: 'a' }, { ...fixture(), key: 'b' }], ['merge'])).toThrow(/duplicate/i);
    const second = fixture();
    const [result] = convertReports([{ ...fixture(), key: 'a' }, { ...second, key: 'b', value: { sample2: second.value.sample1 } }], ['merge']);
    expect(Object.keys(result.value)).toEqual(['sample1', 'sample2']);
  });
  it('returns a finite percentage for empty samples', () => expect(percent(0, 0)).toBe(0));
});
describe('analysis input validation', () => {
  const files = (names: string[]) => names.map(name => ({ name, size: 100 }) as File);
  it('groups and sorts R1/R2 with original regex pattern semantics', () => {
    const result = prepareAnalysis(SAMPLE_FORM, files(['71_S71_L001_R2_001.fastq.gz', '71_S71_L001_R1_001.fastq.gz']));
    expect(result.groups['71_S71'].map(f => f.name)).toEqual(['71_S71_L001_R1_001.fastq.gz', '71_S71_L001_R2_001.fastq.gz']);
    expect(result.format.filt_n).toBe(1);
    expect(result.format.filt_r).toBe(5);
    expect(result.format.rgen_type).toBe(0);
  });
  it('rejects incomplete pairs, unmatched files, empty files, and invalid patterns', () => {
    expect(() => prepareAnalysis(SAMPLE_FORM, files(['a_L001_R1.fastq.gz']))).toThrow(/pair/i);
    expect(() => prepareAnalysis(SAMPLE_FORM, files(['a.fastq.gz', 'b.fastq.gz']))).toThrow(/pattern/i);
    expect(() => prepareAnalysis({ ...SAMPLE_FORM, indexPattern: '[' }, files(['a.gz', 'b.gz']))).toThrow(/pattern/i);
    expect(() => prepareAnalysis(SAMPLE_FORM, [{ name: 'a.gz', size: 0 } as File])).toThrow(/empty/i);
  });
  it('requires a matching guide and a valid analysis window', () => {
    const pair = files(['s_L001_R1.fastq.gz', 's_L001_R2.fastq.gz']);
    expect(() => prepareAnalysis({ ...SAMPLE_FORM, rgenseq: 'GGGGGGGGGG' }, pair)).toThrow(/target/i);
    expect(() => prepareAnalysis({ ...SAMPLE_FORM, end_range: 0 }, pair)).toThrow(/range/i);
  });
});
