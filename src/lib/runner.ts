import type { Report } from './types';
import { prepareAnalysis } from './science';
export interface Progress { completed: number; total: number; percent: number; current: string }
export async function runAnalysis(prepared: ReturnType<typeof prepareAnalysis>, externalSignal: AbortSignal, onProgress: (p: Progress) => void): Promise<Report> {
  const controller = new AbortController();
  const signal = controller.signal;
  const cancelAll = () => controller.abort();
  externalSignal.addEventListener('abort', cancelAll, { once: true });
  if (externalSignal.aborted) controller.abort();
  const entries = Object.entries(prepared.groups);
  const value: Report['value'] = {};
  let summary: Report['summary'] = [], cursor = 0, completed = 0;
  const fractions = new Map<string, number>();
  const active = new Set<Worker>();
  const update = (id: string, fraction: number) => {
    fractions.set(id, fraction);
    onProgress({ current: id, completed, total: entries.length, percent: Math.round([...fractions.values()].reduce((a, b) => a + b, 0) / entries.length) });
  };
  const terminate = () => active.forEach(worker => worker.terminate());
  const processPair = (id: string, files: File[]) => new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Analysis cancelled.', 'AbortError'));
    const worker = new Worker(`${import.meta.env.BASE_URL}engine/worker.js`);
    active.add(worker);
    const clean = () => { worker.terminate(); active.delete(worker); signal.removeEventListener('abort', cancel); };
    const fail = (error: Error) => { clean(); reject(error); };
    const cancel = () => fail(new DOMException('Analysis cancelled.', 'AbortError'));
    signal.addEventListener('abort', cancel, { once: true });
    worker.onerror = e => fail(new Error(`Sample ${id}: ${e.message || 'The analysis worker failed.'}`));
    worker.onmessageerror = () => fail(new Error(`Sample ${id}: could not read the worker result.`));
    worker.onmessage = e => {
      const { msgType, msg } = e.data;
      if (msgType === 0) summary = msg;
      else if (msgType === 2 && Number.isFinite(msg)) update(id, Math.max(fractions.get(id) ?? 0, Math.min(99, Math.max(0, msg))));
      else if (msgType === 4) { value[id] = msg; completed++; update(id, 100); clean(); resolve(); }
      else if (msgType !== 2) fail(new Error(`Sample ${id}: ${typeof msg === 'string' ? msg : msg?.message || 'Invalid sequencing data.'}`));
    };
    update(id, 0);
    worker.postMessage({ ...prepared.format, fileId: id, files });
  });
  try {
    // Bound memory consumption when processing dozens of paired samples.
    await Promise.all(Array.from({ length: Math.min(2, entries.length) }, async () => {
      while (cursor < entries.length) { const [id, files] = entries[cursor++]; await processPair(id, files); }
    }));
    return { value, summary, format: prepared.format };
  } finally { controller.abort(); terminate(); externalSignal.removeEventListener('abort', cancelAll); }
}
export async function loadSampleFiles(signal: AbortSignal) {
  return Promise.all([71, 72].flatMap(id => [1, 2].map(async read => {
    const name = `Sample-ID-${id}_S${id}_L001_R${read}_001.fastq.gz`;
    const response = await fetch(`${import.meta.env.BASE_URL}samples/${name}`, { signal });
    if (!response.ok) throw new Error('The sample files could not be loaded. Please try again.');
    const blob = await response.blob();
    const signature = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
    const gzipped = signature[0] === 0x1f && signature[1] === 0x8b;
    if (!gzipped && signature[0] !== 0x40) throw new Error(`The sample file ${name} is not valid FASTQ. Please try again.`);
    // Hosts such as Vite send Content-Encoding: gzip, so fetch has already
    // decompressed the body. The legacy worker chooses its reader by filename.
    return new File([blob], gzipped ? name : name.replace(/\.gz$/, ''));
  })));
}
