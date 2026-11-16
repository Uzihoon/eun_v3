// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { deleteDB } from 'idb';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useReports } from '../src/hooks/useReports';
import { ReportStore } from '../src/lib/report-store';
import sample from './fixtures/sample-report.json';

let name: string;
let store: ReportStore;
const verify = vi.fn(async () => {});
beforeEach(() => { name = `eun-hook-test-${crypto.randomUUID()}`; store = new ReportStore(name); verify.mockClear(); });
afterEach(async () => { cleanup(); vi.restoreAllMocks(); await deleteDB(name); });
async function open(owner = 'alice') {
  const hook = renderHook(() => useReports(owner, verify, store));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

it('keeps session-only results in memory until the user chooses to save them', async () => {
  const hook = await open();
  act(() => { hook.result.current.addReport(sample, 'Unsaved analysis'); });
  expect(hook.result.current.reports).toHaveLength(1);
  expect(hook.result.current.savedIds.size).toBe(0);
  hook.unmount();
  expect((await open()).result.current.reports).toHaveLength(0);
});

it('saves existing and future results when enabled and restores them after remounting', async () => {
  const hook = await open();
  act(() => { hook.result.current.addReport(sample, 'Earlier analysis'); });
  await act(async () => { expect(await hook.result.current.setAutoSave(true)).toBe(true); });
  act(() => { hook.result.current.addReport(sample, 'Later analysis'); });
  await waitFor(() => expect(hook.result.current.savedIds.size).toBe(2));
  hook.unmount();
  const restored = await open();
  expect(restored.result.current.autoSave).toBe(true);
  expect(restored.result.current.reports.map(report => report.name)).toEqual(['Earlier analysis', 'Later analysis']);
  expect(restored.result.current.reports[0].value).toEqual(sample.value);
});

it('keeps old saved results when disabled, while isolating another account', async () => {
  const hook = await open();
  await act(async () => { await hook.result.current.setAutoSave(true); });
  act(() => { hook.result.current.addReport(sample, 'Saved'); });
  await waitFor(() => expect(hook.result.current.savedIds.size).toBe(1));
  await act(async () => { await hook.result.current.setAutoSave(false); });
  act(() => { hook.result.current.addReport(sample, 'Temporary'); });
  hook.unmount();
  const other = await open('bob');
  expect(other.result.current.reports).toHaveLength(0);
  expect(other.result.current.autoSave).toBe(false);
  other.unmount();
  const restored = await open();
  expect(restored.result.current.reports.map(report => report.name)).toEqual(['Saved']);
  expect(restored.result.current.autoSave).toBe(false);
});

it('preserves a result and reports a failed save without marking it saved', async () => {
  const hook = await open();
  act(() => { hook.result.current.addReport(sample, 'Important result'); });
  vi.spyOn(store, 'save').mockRejectedValueOnce(new DOMException('Full', 'QuotaExceededError'));
  await act(async () => { expect(await hook.result.current.saveReport(hook.result.current.reports[0].id)).toBe(false); });
  expect(hook.result.current.reports).toHaveLength(1);
  expect(hook.result.current.savedIds.size).toBe(0);
  expect(hook.result.current.error).toMatch(/storage is full/);
  expect(hook.result.current.error).toMatch(/JSON/);
});

it('removes a saved report from memory and from future sessions', async () => {
  const hook = await open();
  act(() => { hook.result.current.addReport(sample, 'Remove me'); });
  const id = hook.result.current.reports[0].id;
  await act(async () => { await hook.result.current.saveReport(id); });
  await act(async () => { expect(await hook.result.current.removeReport(id)).toBe(true); });
  expect(hook.result.current.reports).toHaveLength(0);
  hook.unmount();
  expect((await open()).result.current.reports).toHaveLength(0);
});

it('continues analysis when local storage is unavailable', async () => {
  vi.spyOn(store, 'load').mockRejectedValueOnce(new Error('Local storage is not available'));
  const hook = await open();
  expect(hook.result.current.error).toMatch(/could not be loaded/);
  act(() => { hook.result.current.addReport(sample, 'Still usable'); });
  expect(hook.result.current.reports).toHaveLength(1);
});
