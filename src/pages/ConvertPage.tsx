import { useState } from 'react';
import { ArrowDownToLine, ArrowLeftRight, Combine, RefreshCw } from 'lucide-react';
import { Dropzone, Notice, PageHeading, Spinner } from '../components/ui';
import { convertReports, readReports } from '../lib/science';
import { exportZip } from '../lib/export';
import type { Conversion } from '../lib/types';
import { useAuth } from '../auth/AuthProvider';
import { trackActivity } from '../lib/analytics';
const options = [
  { id: 'reverseSeq' as const, title: 'Reverse sequence', description: 'Reverse the order of reference and treated sequences.', example: 'ACGT → TGCA', Icon: ArrowLeftRight },
  { id: 'reverseNucleo' as const, title: 'Complement nucleotides', description: 'Swap A ↔ T and C ↔ G. Called “Reverse nucleotide” in EUN.', example: 'ACGT → TGCA', Icon: RefreshCw },
  { id: 'merge' as const, title: 'Merge reports', description: 'Combine samples from multiple JSON files into one report.', example: 'Report A + Report B', Icon: Combine },
];
export function ConvertPage() {
  const { verify } = useAuth();
  const [files, setFiles] = useState<File[]>([]), [steps, setSteps] = useState<Conversion[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState(false);
  const run = async () => {
    setError(''); setSuccess(false); setBusy(true);
    try {
      await verify();
      if (!files.length || !steps.length) throw new Error('Choose reports and at least one conversion.');
      const reports = await readReports(files);
      await exportZip(convertReports(reports, steps)); setSuccess(true);
      trackActivity('conversion_completed', { operation_count: steps.length }); trackActivity('report_exported', { format: 'zip' });
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return <><PageHeading section="File conversion" title="A new perspective on your data." description="Reverse, complement, or combine your existing EUN reports."/>
    <div className="narrow-content">{error && <Notice error>{error}</Notice>}{success && <Notice>Your converted reports are ready. The ZIP download has started.</Notice>}<section className="panel padded-panel"><div className="section-heading"><span className="section-number">01</span><div><h2>Add your reports</h2><p>Use JSON files exported from EUN or EUN-V3.</p></div></div><Dropzone files={files} onChange={f => { setFiles(f); setSuccess(false); }} disabled={busy}/></section>
    <section className="panel padded-panel"><div className="section-heading"><span className="section-number">02</span><div><h2>Choose your conversions</h2><p>Operations run in the order you select them.</p></div></div><div className="conversion-list">{options.map(({ id, title, description, example, Icon }) => <label key={id} className={`conversion-option ${steps.includes(id) ? 'selected' : ''}`}><input type="checkbox" checked={steps.includes(id)} disabled={busy} onChange={() => { setSteps(steps.includes(id) ? steps.filter(s => s !== id) : [...steps, id]); setSuccess(false); }}/><Icon size={23}/><span><strong>{title}</strong><small>{description}</small></span><code>{example}</code>{steps.includes(id) && <span className="operation-number">{steps.indexOf(id) + 1}</span>}</label>)}</div>
    {steps.includes('reverseNucleo') && <p className="field-hint">Original EUN behavior: complement conversion supports A, C, G, T, and gaps. Ambiguous bases such as N are omitted. Keep a copy of your source report.</p>}
    {steps.includes('merge') && <p className="field-hint">Use reports with the same reference and analysis settings. As in EUN, merged metadata comes from the last report. Duplicate sample IDs are rejected to prevent overwriting data.</p>}
    <div className="conversion-footer"><span>{steps.length ? `${steps.length} operation${steps.length > 1 ? 's' : ''} selected` : 'Select an operation to continue'}</span><button className="button primary" disabled={busy || !files.length || !steps.length} onClick={() => void run()}>{busy ? <Spinner/> : <ArrowDownToLine size={17}/>} Convert & download ZIP</button></div></section><p className="subtle">Conversions preserve the original JSON report format. Your source files are never modified.</p></div></>;
}
