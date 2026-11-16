import { afterEach, expect, it, vi } from 'vitest';
import { runAnalysis } from '../src/lib/runner';
import { SAMPLE_FORM, prepareAnalysis } from '../src/lib/science';
class FakeWorker {
  static workers: FakeWorker[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: unknown; onmessageerror: unknown;
  stopped = false;
  constructor() { FakeWorker.workers.push(this); }
  postMessage() {}
  terminate() { this.stopped = true; }
  emit(msgType: number, msg: unknown) { this.onmessage?.({ data: { msgType, msg } }); }
}
afterEach(() => { FakeWorker.workers = []; vi.unstubAllGlobals(); });
const prepared = () => prepareAnalysis(SAMPLE_FORM, [1, 2, 3].flatMap(i => [1, 2].map(r => ({ name: `${i}_L001_R${r}.fastq.gz`, size: 10 }) as File)));
it('bounds concurrent workers, finishes from result messages, and cleans up', async () => {
  vi.stubGlobal('Worker', FakeWorker);
  const progress = vi.fn();
  const result = runAnalysis(prepared(), new AbortController().signal, progress);
  expect(FakeWorker.workers.length).toBe(2);
  FakeWorker.workers[0].emit(2, 100);
  expect(progress.mock.lastCall![0].completed).toBe(0);
  FakeWorker.workers[0].emit(4, { fileId: '1' });
  await Promise.resolve();
  expect(FakeWorker.workers.length).toBe(3);
  FakeWorker.workers[1].emit(4, { fileId: '2' });
  FakeWorker.workers[2].emit(4, { fileId: '3' });
  expect(Object.keys((await result).value)).toHaveLength(3);
  expect(FakeWorker.workers.every(w => w.stopped)).toBe(true);
  expect(progress.mock.lastCall![0].percent).toBe(100);
});
it('cancels every active worker and does not start queued samples', async () => {
  vi.stubGlobal('Worker', FakeWorker);
  const controller = new AbortController();
  const result = runAnalysis(prepared(), controller.signal, () => {});
  controller.abort();
  await expect(result).rejects.toMatchObject({ name: 'AbortError' });
  expect(FakeWorker.workers.length).toBe(2);
  expect(FakeWorker.workers.every(w => w.stopped)).toBe(true);
});
it('fails on a legacy error message and releases sibling workers', async () => {
  vi.stubGlobal('Worker', FakeWorker);
  const result = runAnalysis(prepared(), new AbortController().signal, () => {});
  FakeWorker.workers[0].emit(1, 'Input files is not FASTQ!');
  await expect(result).rejects.toThrow(/FASTQ/);
  expect(FakeWorker.workers.every(w => w.stopped)).toBe(true);
});
