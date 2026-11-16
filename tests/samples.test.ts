import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import vm from 'node:vm';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { loadSampleFiles } from '../src/lib/runner';
import { prepareAnalysis, SAMPLE_FORM } from '../src/lib/science';
import type { Report } from '../src/lib/types';
import golden from './fixtures/sample-report.json';

const samples = new Map([71, 72].flatMap(id => [1, 2].map(read => {
  const name = `Sample-ID-${id}_S${id}_L001_R${read}_001.fastq.gz`;
  return [name, readFileSync(new URL(`../public/samples/${name}`, import.meta.url))] as const;
})));
const nativeFetch = globalThis.fetch;
let origin: string;
let transport: 'raw' | 'gzip' | 'html' | 'missing' = 'raw';
// Real HTTP responses reproduce fetch's automatic Content-Encoding decoding.
const server = createServer((request, response) => {
  response.setHeader('Connection', 'close');
  const sample = samples.get(request.url?.split('/').at(-1) ?? '');
  if (!sample || transport === 'missing') { response.writeHead(404).end(); return; }
  if (transport === 'html') { response.writeHead(200, { 'Content-Type': 'text/html' }).end('<html>Not a sample</html>'); return; }
  response.writeHead(200, transport === 'gzip' ? { 'Content-Encoding': 'gzip' } : { 'Content-Type': 'application/gzip' });
  response.end(sample);
});
beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test HTTP server did not start');
  origin = `http://127.0.0.1:${address.port}`;
});
beforeEach(() => {
  transport = 'raw';
  vi.stubGlobal('fetch', (input: string, init?: RequestInit) => nativeFetch(new URL(input, origin), init));
});
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

it('preserves compressed sample bytes and filenames when served as gzip files', async () => {
  const files = await loadSampleFiles(new AbortController().signal);
  expect(files).toHaveLength(4);
  for (const file of files) {
    expect(file.name).toMatch(/\.fastq\.gz$/);
    expect(Buffer.from(await file.arrayBuffer()).equals(samples.get(file.name)!)).toBe(true);
  }
});

it('analyzes HTTP-decoded samples without decompressing them twice', async () => {
  transport = 'gzip';
  const files = await loadSampleFiles(new AbortController().signal);
  for (const file of files) {
    const sourceName = file.name.endsWith('.gz') ? file.name : `${file.name}.gz`;
    expect(Buffer.from(await file.arrayBuffer()).equals(gunzipSync(samples.get(sourceName)!))).toBe(true);
  }
  const prepared = prepareAnalysis(SAMPLE_FORM, files);
  for (const [id, pair] of Object.entries(prepared.groups)) {
    let result: Report['value'][string] | undefined;
    const context = vm.createContext({
      FileReaderSync: class {
        readAsArrayBuffer(buffer: Buffer) { return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength); }
        readAsText(buffer: Buffer) { return buffer.toString('utf8'); }
      },
      postMessage({ msgType, msg }: { msgType: number; msg: unknown }) {
        if (msgType === 4) result = JSON.parse(JSON.stringify(msg));
        else if (![0, 2].includes(msgType)) throw new Error(String((msg as Error)?.message ?? msg));
      },
    });
    context.self = context;
    context.importScripts = () => vm.runInContext(readFileSync(new URL('../public/engine/pako.js', import.meta.url), 'utf8'), context);
    vm.runInContext(readFileSync(new URL('../public/engine/worker.js', import.meta.url), 'utf8'), context);
    const workerFiles = await Promise.all(pair.map(async file => {
      const buffer = Buffer.from(await file.arrayBuffer());
      return { name: file.name, size: buffer.length, slice: (start: number, end: number) => buffer.subarray(start, end) };
    }));
    context.onmessage({ data: { ...prepared.format, fileId: id, files: workerFiles } });
    expect(result).toEqual((golden as Report).value[id]);
  }
}, 120000);

it('rejects HTML fallback responses before sending them to the analysis worker', async () => {
  transport = 'html';
  await expect(loadSampleFiles(new AbortController().signal)).rejects.toThrow(/not valid FASTQ/);
});

it('reports missing sample downloads', async () => {
  transport = 'missing';
  await expect(loadSampleFiles(new AbortController().signal)).rejects.toThrow(/could not be loaded/);
});
