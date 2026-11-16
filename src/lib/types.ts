export interface AnalysisForm {
  namePattern: string; indexPattern: string; fullseq: string; rgenseq: string;
  end_range: number; targetSeq: string; changeSeq: string;
}
export interface Format {
  seq_wt: string; seq_RGEN: string; targetSeq: string; changeSeq: string; end_range: number;
  rgen_type?: number; seq_RGEN2?: string; filt_n?: number; filt_r?: number; nucleases?: string;
  [key: string]: unknown;
}
export interface SequenceRow {
  id: number; origin: string; change: string; graphic: string; count: number; type: number; length: number; hdr: number;
}
export interface Sample {
  fileId: string; standard_seq: string; seq_target: string; seq_type: string | number;
  joins_length: number; totlr_count: number; tot_count: number; cnt_ins: number; cnt_del: number;
  changed: number; standardLen: number; chartIndex: Record<string, number>[]; table: SequenceRow[];
  [key: string]: unknown;
}
export interface Report {
  format: Format; summary: { type: string; data: string }[]; value: Record<string, Sample>;
}
export interface NamedReport extends Report { key: string }
export interface SessionReport extends Report { id: string; name: string; createdAt: string }
export type Conversion = 'reverseSeq' | 'reverseNucleo' | 'merge';
export interface IndelData {
  seq: string; seq_type: string | number; target_rna: string;
  result: { label: string; standard_seq: string; seq_target: string; indel: { x: number; y: number }[] }[];
}
