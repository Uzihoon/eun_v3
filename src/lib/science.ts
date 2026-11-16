import type { AnalysisForm, Conversion, Format, IndelData, NamedReport, Report } from './types';

export const SAMPLE_FORM: AnalysisForm = {
  namePattern: '', indexPattern: '_L001_',
  fullseq: 'ACCTCTTATCTTCCTCCCACAGCTCCTGGGCAACGTGCTGGTCTGTGTGCTGGCCCATCACTTTGGCAAAGAATTCACCCCACCAGTGCAGGCTGCCTATCAGAAAGTGGTGGCTGGTGTGGCTAATGCCCTGGCCCACAAGTATCACTAAGCTCGCTTTCTTGCTGTCCAATTTCTATTAAAGGTTCCTTTGTTCCCTAAGTCCAACT',
  rgenseq: 'TCAGAAAGTGGTGGCTGGTG', end_range: 70, targetSeq: 'A', changeSeq: 'G',
};
export const EMPTY_FORM: AnalysisForm = { ...SAMPLE_FORM, fullseq: '', rgenseq: '', indexPattern: '' };
export const percent = (part: number, total: number) => total > 0 ? part / total * 100 : 0;
export const sampleIds = (report: Report) => Object.keys(report.value).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
// Preserve the original converter's treatment of ambiguous bases (omitted).
export const complement = (seq: string) => [...seq].map(b => ({ A: 'T', T: 'A', G: 'C', C: 'G', '-': '-' })[b.toUpperCase()] ?? '').join('');
export const reverse = (seq: string) => [...seq].reverse().join('');
export function prepareAnalysis(form: AnalysisForm, files: File[]) {
  if (!files.length) throw new Error('Choose at least one pair of sequencing files.');
  if (files.some(f => !f.size)) throw new Error('An empty file was selected. Remove it and select the original sequencing file.');
  if (files.some(f => !/\.(fastq|fq)(\.gz)?$|\.gz$/i.test(f.name))) throw new Error('Use FASTQ, FQ, or gzipped sequencing files.');
  const seq_wt = form.fullseq.replace(/\s/g, '').toUpperCase();
  const seq_RGEN = form.rgenseq.replace(/\s/g, '').toUpperCase();
  if (!/^[ACGT]+$/.test(seq_wt)) throw new Error('The reference sequence must contain only A, C, G, and T.');
  if (!/^[ACGT]+$/.test(seq_RGEN) || (!seq_wt.includes(seq_RGEN) && !seq_wt.includes(reverse(complement(seq_RGEN))))) throw new Error('The target DNA sequence or its reverse complement must occur in the reference.');
  if (!Number.isInteger(+form.end_range) || +form.end_range < 15) throw new Error('Standard range must be a whole number of at least 15 nucleotides.');
  if (!/^[ACGT]$/.test(form.targetSeq) || !/^[ACGT]$/.test(form.changeSeq)) throw new Error('Choose a target and desired nucleotide.');
  if (!form.indexPattern.trim()) throw new Error('Enter the file index pattern to identify paired reads.');
  let pattern: RegExp;
  try { pattern = new RegExp(`${form.namePattern}(.*)${form.indexPattern}`); }
  catch { throw new Error('The file patterns are not valid regular expressions.'); }
  const groups: Record<string, File[]> = Object.create(null);
  for (const file of files) {
    const match = pattern.exec(file.name);
    if (!match?.[1]) throw new Error(`File patterns do not identify a sample in “${file.name}”.`);
    (groups[match[1]] ??= []).push(file);
  }
  for (const [id, pair] of Object.entries(groups)) {
    if (pair.length !== 2) throw new Error(`Sample “${id}” has ${pair.length} files. Each sample needs one pair of reads.`);
    if (pair[0].name === pair[1].name) throw new Error(`Sample “${id}” contains a duplicate file.`);
    pair.sort((a, b) => a.name.localeCompare(b.name));
    const reads = pair.map(f => f.name.match(/(?:^|_)R([12])(?:_|\.)/i)?.[1]);
    if (reads.every(Boolean) && new Set(reads).size !== 2) throw new Error(`Sample “${id}” needs an R1 and an R2 pair.`);
  }
  const format: Format = { msgtype: 0, msgType: 0, seq_wt, seq_RGEN, seq_RGEN2: '', rgen_type: 0, end_range: +form.end_range, filt_n: 1, filt_r: 5, nucleases: '1', targetSeq: form.targetSeq, changeSeq: form.changeSeq };
  return { format, groups };
}

const isObject = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
export function parseReport(text: string): Report {
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new Error('This file is not valid JSON. Choose a JSON report exported by EUN.'); }
  const fail = () => { throw new Error('This is not a complete EUN report. It must include format, summary, and sample results.'); };
  if (!isObject(data) || !isObject(data.format) || !isObject(data.value) || !Object.keys(data.value).length || !Array.isArray(data.summary)) return fail();
  for (const key of ['seq_wt', 'seq_RGEN', 'targetSeq', 'changeSeq']) if (typeof data.format[key] !== 'string') return fail();
  if (!data.summary.every(s => isObject(s) && typeof s.data === 'string' && typeof s.type === 'string')) return fail();
  for (const [id, sample] of Object.entries(data.value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(id) || !isObject(sample)) return fail();
    if (typeof sample.standard_seq !== 'string' || typeof sample.seq_target !== 'string' || !Array.isArray(sample.table) || !Array.isArray(sample.chartIndex)) return fail();
    for (const key of ['tot_count', 'joins_length', 'totlr_count', 'cnt_ins', 'cnt_del', 'changed']) if (typeof sample[key] !== 'number' || !Number.isFinite(sample[key]) || sample[key] < 0) return fail();
    if (!sample.table.every(r => isObject(r) && typeof r.origin === 'string' && typeof r.change === 'string' && typeof r.graphic === 'string' && typeof r.count === 'number' && r.count >= 0 && Number.isFinite(r.count) && [0, 1, 2].includes(Number(r.type)))) return fail();
    if (!sample.chartIndex.every(row => isObject(row) && Object.values(row).every(v => typeof v === 'number' && v >= 0 && Number.isFinite(v)))) return fail();
  }
  return data as unknown as Report;
}
export async function readReports(files: File[]): Promise<NamedReport[]> {
  return Promise.all(files.map(async file => {
    try { return { ...parseReport(await file.text()), key: file.name.replace(/\.json$/i, '') }; }
    catch (error) { throw new Error(`${file.name}: ${(error as Error).message}`); }
  }));
}
export function convertReports(input: NamedReport[], steps: Conversion[]): NamedReport[] {
  // Clone each report independently, even if callers supplied shared sample objects.
  let reports = input.map(report => structuredClone(report));
  for (const step of steps) {
    if (step === 'merge') {
      const value: Report['value'] = {};
      for (const report of reports) for (const [id, sample] of Object.entries(report.value)) {
        if (Object.hasOwn(value, id)) throw new Error(`Duplicate sample ID “${id}”. Merge would overwrite a sample; use reports with different sample IDs.`);
        value[id] = sample;
      }
      const last = reports.at(-1);
      if (last) reports = [{ key: 'merge_file', value, format: last.format, summary: last.summary }];
    } else {
      const transform = step === 'reverseSeq' ? reverse : complement;
      for (const report of reports) for (const sample of Object.values(report.value)) {
        sample.table = sample.table.map(row => ({ ...row, origin: transform(row.origin), change: transform(row.change), graphic: step === 'reverseSeq' ? reverse(row.graphic) : row.graphic }));
        sample.standard_seq = transform(sample.standard_seq);
        sample.seq_target = transform(sample.seq_target);
      }
    }
  }
  return reports;
}

// Original EUN INDEL aggregation: equal weight per sample, not pooled read counts.
export function buildIndel(reports: NamedReport[]): IndelData {
  let seq = '', target_rna = '';
  for (const report of reports) for (const sample of Object.values(report.value)) {
    if (sample.standard_seq.length > seq.length) { seq = sample.standard_seq; target_rna = sample.seq_target; }
  }
  const result = reports.map(report => {
    const samples = Object.values(report.value);
    const indel: { x: number; y: number }[] = [];
    let standard_seq = '', seq_target = '';
    for (const sample of samples) {
      standard_seq = sample.standard_seq; seq_target = sample.seq_target;
      for (const row of sample.table.filter(r => r.type !== 0)) {
        const origin = [...row.origin].slice(0, seq.length), change = [...row.change].slice(0, seq.length);
        const add = (gap: boolean, i: number) => { indel[i] = { x: i + 1, y: (indel[i]?.y ?? 0) + (gap ? percent(row.count, sample.tot_count) / samples.length : 0) }; };
        if (origin.length === change.length) origin.forEach((base, i) => add(base === '-' || change[i] === '-', i));
        else [origin, change].forEach(s => s.forEach((base, i) => add(base === '-', i)));
      }
    }
    return { label: report.key, indel, standard_seq, seq_target };
  });
  return { result, seq, seq_type: 1, target_rna };
}
