import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase, IDBPTransaction } from 'idb';
import { parseReport } from './science';
import type { SessionReport } from './types';

interface StoredReport {
  ownerId: string;
  id: string;
  name: string;
  createdAt: string;
  json: string;
}
interface ResultsDatabase extends DBSchema {
  preferences: { key: string; value: { ownerId: string; autoSave: boolean } };
  reports: { key: [string, string]; value: StoredReport; indexes: { owner: string } };
}
export interface LocalResults { autoSave: boolean; reports: SessionReport[]; skipped: number }
type WriteTransaction = IDBPTransaction<ResultsDatabase, ['preferences', 'reports'], 'readwrite'>;
const serialize = (ownerId: string, report: SessionReport): StoredReport => ({
  ownerId, id: report.id, name: report.name, createdAt: report.createdAt,
  json: JSON.stringify({ value: report.value, format: report.format, summary: report.summary }),
});

export class ReportStore {
  constructor(private readonly databaseName = 'eun-local-results') {}

  private open(): Promise<IDBPDatabase<ResultsDatabase>> {
    if (!globalThis.indexedDB) return Promise.reject(new Error('Local result storage is not available in this browser.'));
    return new Promise((resolve, reject) => {
      let abandoned = false;
      const timeout = setTimeout(() => { abandoned = true; reject(new Error('Local storage did not respond. Close other EUN tabs and try again.')); }, 10000);
      let opening: Promise<IDBPDatabase<ResultsDatabase>>;
      try { opening = openDB<ResultsDatabase>(this.databaseName, 1, {
        upgrade(db) {
          db.createObjectStore('preferences', { keyPath: 'ownerId' });
          db.createObjectStore('reports', { keyPath: ['ownerId', 'id'] }).createIndex('owner', 'ownerId');
        },
        blocked() { abandoned = true; clearTimeout(timeout); reject(new Error('Close other EUN tabs to open local result storage.')); },
      }); } catch (error) { clearTimeout(timeout); reject(error); return; }
      opening.then(db => { clearTimeout(timeout); if (abandoned) db.close(); else resolve(db); }, error => { clearTimeout(timeout); reject(error); });
    });
  }

  private async write<T>(action: (transaction: WriteTransaction) => Promise<T>): Promise<T> {
    const db = await this.open();
    const transaction = db.transaction(['preferences', 'reports'], 'readwrite');
    // Observe rejection immediately, including synchronous quota failures.
    void transaction.done.catch(() => {});
    try {
      const result = await action(transaction);
      await transaction.done;
      return result;
    } catch (error) {
      try { transaction.abort(); } catch { /* The transaction may already have aborted. */ }
      await transaction.done.catch(() => {});
      throw error;
    } finally { db.close(); }
  }

  async load(ownerId: string): Promise<LocalResults> {
    const db = await this.open();
    try {
      const transaction = db.transaction(['preferences', 'reports'], 'readonly');
      const [preference, records] = await Promise.all([
        transaction.objectStore('preferences').get(ownerId),
        transaction.objectStore('reports').index('owner').getAll(ownerId),
        transaction.done,
      ]);
      const reports: SessionReport[] = [];
      let skipped = 0;
      for (const record of records) {
        try {
          if (typeof record.id !== 'string' || !record.id || typeof record.name !== 'string' || !Number.isFinite(Date.parse(record.createdAt))) throw new Error('Invalid report metadata');
          reports.push({ ...parseReport(record.json), id: record.id, name: record.name, createdAt: record.createdAt });
        } catch { skipped++; }
      }
      return { autoSave: preference?.autoSave === true, reports: reports.sort((a, b) => a.createdAt.localeCompare(b.createdAt)), skipped };
    } finally { db.close(); }
  }

  async setAutoSave(ownerId: string, enabled: boolean, currentReports: SessionReport[] = []): Promise<void> {
    const records = enabled ? currentReports.map(report => serialize(ownerId, report)) : [];
    await this.write(async transaction => {
      await transaction.objectStore('preferences').put({ ownerId, autoSave: enabled });
      for (const record of records) await transaction.objectStore('reports').put(record);
    });
  }

  async save(ownerId: string, report: SessionReport, onlyIfEnabled = false): Promise<boolean> {
    const record = serialize(ownerId, report);
    return this.write(async transaction => {
      if (onlyIfEnabled && !(await transaction.objectStore('preferences').get(ownerId))?.autoSave) return false;
      await transaction.objectStore('reports').put(record);
      return true;
    });
  }

  async remove(ownerId: string, id: string): Promise<void> {
    await this.write(async transaction => { await transaction.objectStore('reports').delete([ownerId, id]); });
  }
}

export const reportStore = new ReportStore();
export function storageError(error: unknown) {
  if ((error as { name?: string })?.name === 'QuotaExceededError') return 'This browser’s storage is full. Download a JSON copy or remove older saved results.';
  return error instanceof Error ? error.message : 'Local result storage is unavailable. Download JSON to keep a copy.';
}
