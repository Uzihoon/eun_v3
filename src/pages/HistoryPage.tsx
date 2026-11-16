import { useEffect, useRef, useState } from 'react';
import { ArrowRight, FileJson, FolderOpen, HardDrive, Search, Settings } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { Notice, PageHeading } from '../components/ui';
import { exportJson } from '../lib/export';
import { parseReport } from '../lib/science';
import type { Report, SessionReport } from '../lib/types';

export function HistoryPage({ reports, savedIds, autoSave, busy, onOpen, onReport, onSave, onRemove }: {
  reports: SessionReport[]; savedIds: Set<string>; autoSave: boolean; busy: boolean;
  onOpen: (id: string) => void; onReport: (report: Report, name: string) => void;
  onSave: (id: string) => Promise<boolean>; onRemove: (id: string) => Promise<boolean>;
}) {
  const { verify } = useAuth();
  const [query, setQuery] = useState(''), [error, setError] = useState(''), [importing, setImporting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null), cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (removing) cancel.current?.focus(); }, [removing]);
  const selected = reports.find(report => report.id === removing);
  const matches = [...reports].reverse().filter(report => `${report.name} ${Object.keys(report.value).join(' ')}`.toLowerCase().includes(query.toLowerCase()));
  const importReport = async (file?: File) => {
    if (!file) return;
    setError(''); setImporting(true);
    try { await verify(); onReport(parseReport(await file.text()), file.name.replace(/\.json$/i, '')); }
    catch (cause) { setError((cause as Error).message); }
    finally { setImporting(false); }
  };
  const download = async (report: SessionReport) => {
    setError('');
    try { await verify(); exportJson(report); } catch (cause) { setError((cause as Error).message); }
  };
  return <>
    <PageHeading section="Results history" title="Pick up where you left off." description="Reopen a saved analysis or bring a JSON report back into your workspace." actions={<><button className="button secondary" disabled={busy || importing} onClick={() => input.current?.click()}><FileJson size={16}/> Import JSON</button><input ref={input} type="file" className="sr-only" tabIndex={-1} accept=".json" aria-label="Import JSON report" onChange={event => { void importReport(event.target.files?.[0]); event.target.value = ''; }}/><a className="button primary" href="#/analysis">New analysis <ArrowRight size={16}/></a></>}/>
    {error && <Notice error>{error}</Notice>}
    <div className="history-storage-note"><span><HardDrive size={16}/>{autoSave ? 'Automatic local saving is on.' : 'Automatic local saving is off. Save individual results or turn it on in Settings.'}</span><a className="text-button" href="#/settings"><Settings size={15}/> Storage settings</a></div>
    {selected && <section className="remove-confirm" role="alert" aria-label="Confirm result removal"><div><strong>{selected.name}</strong><p>{savedIds.has(selected.id) ? 'Remove this result and its saved copy from this browser?' : 'Remove this result from the current session?'} Downloaded JSON files will remain on your computer.</p></div><div className="actions"><button className="button secondary" ref={cancel} disabled={busy} onClick={() => setRemoving(null)} aria-label="Cancel removal">Keep result</button><button className="button danger" disabled={busy} aria-label="Confirm removal" onClick={async () => { if (await onRemove(selected.id)) setRemoving(null); }}>Remove result</button></div></section>}
    {reports.length > 0 ? <>
      <div className="history-toolbar"><label className="history-search"><Search size={16}/><span className="sr-only">Search results</span><input type="search" placeholder="Search analyses or sample IDs" value={query} onChange={event => setQuery(event.target.value)}/></label><span>{savedIds.size} saved · {reports.length - savedIds.size} in this session</span></div>
      <div className="panel table-scroll"><table className="session-table history-table"><thead><tr><th>Analysis</th><th>Samples</th><th>Change</th><th>Created</th><th>Actions</th></tr></thead><tbody>{matches.map(report => <tr key={report.id}>
        <td><button className="text-button" aria-label={`Open ${report.name}`} onClick={() => onOpen(report.id)}>{report.name}</button><span className={`report-storage-label ${savedIds.has(report.id) ? 'saved' : ''}`}>{savedIds.has(report.id) ? 'Saved on this device' : 'This session only'}</span></td>
        <td>{Object.keys(report.value).length}</td><td className="mono">{report.format.targetSeq} → {report.format.changeSeq}</td>
        <td><time dateTime={report.createdAt}>{new Date(report.createdAt).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })}<small>{new Date(report.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></time></td>
        <td><div className="history-actions"><button className="text-button" aria-label={`Download ${report.name} as JSON`} onClick={() => void download(report)}>Download JSON</button>{!savedIds.has(report.id) && <button className="text-button" disabled={busy} aria-label={`Save ${report.name} on device`} onClick={() => void onSave(report.id)}>Save on device</button>}<button className="text-button danger-text" disabled={busy} aria-label={`Remove ${report.name}`} onClick={() => setRemoving(report.id)}>Remove</button></div></td>
      </tr>)}</tbody></table>{matches.length === 0 && <div className="empty-inline">No results match your search.</div>}</div>
    </> : <div className="empty-state"><FolderOpen size={36} strokeWidth={1.2}/><h2>A clean slate.</h2><p>Your saved results and current analyses will appear here.<br/>Start a new run or import a JSON report.</p><a className="button primary" href="#/analysis">Start an analysis <ArrowRight size={16}/></a></div>}
  </>;
}
