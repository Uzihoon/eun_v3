import { useCallback, useEffect, useRef, useState } from 'react';
import { ReportStore, reportStore, storageError } from '../lib/report-store';
import type { Report, SessionReport } from '../lib/types';
import { trackActivity } from '../lib/analytics';

export function useReports(ownerId: string, verify: () => Promise<void>, store: ReportStore = reportStore) {
  const [reports, setReports] = useState<SessionReport[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [autoSave, setAutoSaveState] = useState(false);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState('');
  const reportsRef = useRef(reports), savedRef = useRef(savedIds), autoSaveRef = useRef(false);
  const generation = useRef(0), pending = useRef(0), queue = useRef<Promise<unknown>>(Promise.resolve());
  const updateReports = useCallback((next: SessionReport[]) => { reportsRef.current = next; setReports(next); }, []);
  const updateSaved = useCallback((next: Set<string>) => { savedRef.current = next; setSavedIds(next); }, []);

  useEffect(() => {
    const version = ++generation.current;
    pending.current = 0; setSaving(false); setLoading(true); setError('');
    updateReports([]); updateSaved(new Set()); autoSaveRef.current = false; setAutoSaveState(false);
    queue.current = store.load(ownerId).then(data => {
      if (generation.current !== version) return;
      updateReports(data.reports); updateSaved(new Set(data.reports.map(report => report.id)));
      autoSaveRef.current = data.autoSave; setAutoSaveState(data.autoSave);
      if (data.skipped) setError(`${data.skipped} saved report(s) could not be read. Other results are available; you can reopen a JSON backup.`);
    }).catch(cause => {
      if (generation.current === version) setError(`Saved results could not be loaded. ${storageError(cause)} You can still analyze and download JSON.`);
    }).finally(() => { if (generation.current === version) setLoading(false); });
    return () => { generation.current++; };
  }, [ownerId, store, updateReports, updateSaved]);

  // Serialize writes so a slow autosave cannot recreate a result after removal,
  // or race with a change to the saving preference.
  const mutate = useCallback((task: (current: () => boolean) => Promise<void>) => {
    const version = generation.current;
    const current = () => generation.current === version;
    pending.current++; setSaving(true);
    const operation = queue.current.then(async () => {
      if (!current()) return false;
      setError('');
      try { await verify(); if (!current()) return false; await task(current); return current(); }
      catch (cause) { if (current()) setError(`Changes could not be saved. ${storageError(cause)} Your open results are still available in this tab.`); return false; }
      finally { if (current()) { pending.current--; setSaving(pending.current > 0); } }
    });
    queue.current = operation;
    return operation;
  }, [verify]);

  const addReport = useCallback((data: Report, name: string) => {
    const report: SessionReport = { ...data, id: crypto.randomUUID(), name, createdAt: new Date().toISOString() };
    updateReports([...reportsRef.current, report]);
    if (autoSaveRef.current || pending.current) void mutate(async current => {
      const saved = await store.save(ownerId, report, true);
      if (current()) {
        if (saved) { updateSaved(new Set([...savedRef.current, report.id])); trackActivity('result_saved', { method: 'automatic' }); }
        else { autoSaveRef.current = false; setAutoSaveState(false); }
      }
    });
    return report;
  }, [mutate, ownerId, store, updateReports, updateSaved]);

  const setAutoSave = useCallback((enabled: boolean) => mutate(async current => {
    const existing = reportsRef.current;
    await store.setAutoSave(ownerId, enabled, existing);
    if (current()) {
      autoSaveRef.current = enabled; setAutoSaveState(enabled);
      trackActivity('storage_preference_changed', { enabled });
      if (enabled) updateSaved(new Set([...savedRef.current, ...existing.map(report => report.id)]));
    }
  }), [mutate, ownerId, store, updateSaved]);

  const saveReport = useCallback((id: string) => mutate(async current => {
    const report = reportsRef.current.find(item => item.id === id);
    if (!report) return;
    await store.save(ownerId, report);
    if (current()) { updateSaved(new Set([...savedRef.current, id])); trackActivity('result_saved', { method: 'manual' }); }
  }), [mutate, ownerId, store, updateSaved]);

  const removeReport = useCallback((id: string) => mutate(async current => {
    if (savedRef.current.has(id)) await store.remove(ownerId, id);
    if (current()) {
      updateReports(reportsRef.current.filter(report => report.id !== id));
      updateSaved(new Set([...savedRef.current].filter(saved => saved !== id)));
    }
  }), [mutate, ownerId, store, updateReports, updateSaved]);

  return { reports, savedIds, autoSave, loading, saving, error, dismissError: () => setError(''), addReport, setAutoSave, saveReport, removeReport };
}
