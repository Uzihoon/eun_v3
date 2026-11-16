import 'fake-indexeddb/auto';
import { IDBObjectStore } from 'fake-indexeddb';
import { openDB, deleteDB } from 'idb';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ReportStore } from '../src/lib/report-store';
import type { SessionReport } from '../src/lib/types';
import sample from './fixtures/sample-report.json';

let database: string;
let store: ReportStore;
const report = (id = 'first', name = 'My experiment'): SessionReport => ({ ...structuredClone(sample), id, name, createdAt: '2026-11-15T22:00:00.000Z' });
beforeEach(() => { database = `eun-storage-test-${crypto.randomUUID()}`; store = new ReportStore(database); });
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllGlobals(); await deleteDB(database); });

it('starts with automatic saving off and does not retain automatic results', async () => {
  expect(await store.load('alice')).toEqual({ autoSave: false, reports: [], skipped: 0 });
  expect(await store.save('alice', report(), true)).toBe(false);
  expect((await new ReportStore(database).load('alice')).reports).toEqual([]);
});

it('enables saving atomically and restores full reports after reopening storage', async () => {
  const original = report();
  await store.setAutoSave('alice', true, [original]);
  expect(await new ReportStore(database).load('alice')).toEqual({ autoSave: true, reports: [original], skipped: 0 });
  const db = await openDB(database);
  const record = await db.get('reports', ['alice', original.id]);
  expect(JSON.parse(record.json)).toEqual(sample);
  db.close();
});

it('stops future automatic saves without deleting existing reports', async () => {
  await store.setAutoSave('alice', true);
  expect(await store.save('alice', report(), true)).toBe(true);
  await store.setAutoSave('alice', false);
  expect(await store.save('alice', report('second'), true)).toBe(false);
  expect(await store.load('alice')).toEqual({ autoSave: false, reports: [report()], skipped: 0 });
});

it('allows an explicit save even when automatic saving is off', async () => {
  expect(await store.save('alice', report())).toBe(true);
  expect(await store.load('alice')).toEqual({ autoSave: false, reports: [report()], skipped: 0 });
});

it('isolates settings and reports for different signed-in accounts', async () => {
  await store.setAutoSave('alice', true, [report()]);
  await store.save('bob', report('first', 'Bob’s experiment'));
  expect(await store.load('bob')).toEqual({ autoSave: false, reports: [report('first', 'Bob’s experiment')], skipped: 0 });
  await store.remove('alice', 'first');
  expect((await store.load('alice')).reports).toEqual([]);
  expect((await store.load('bob')).reports).toHaveLength(1);
});

it('skips damaged records without discarding other saved results', async () => {
  await store.save('alice', report());
  const db = await openDB(database);
  await db.put('reports', { ownerId: 'alice', id: 'broken', name: 'Broken', createdAt: '2026-11-15', json: '{' });
  db.close();
  expect(await store.load('alice')).toEqual({ autoSave: false, reports: [report()], skipped: 1 });
});

it('rolls back the setting and all reports if a storage write fails', async () => {
  await store.load('alice');
  const put = IDBObjectStore.prototype.put;
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function(this: IDBObjectStore, ...args: Parameters<typeof put>) {
    if (this.name === 'reports' && args[0].id === 'second') throw new DOMException('No space left', 'QuotaExceededError');
    return put.apply(this, args);
  });
  await expect(store.setAutoSave('alice', true, [report(), report('second')])).rejects.toMatchObject({ name: 'QuotaExceededError' });
  expect(await store.load('alice')).toEqual({ autoSave: false, reports: [], skipped: 0 });
});

it('fails clearly when the browser does not provide local storage', async () => {
  vi.stubGlobal('indexedDB', undefined);
  await expect(store.load('alice')).rejects.toThrow(/not available/);
});
