import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, BookOpen, Check, FileJson, FlaskConical, HardDrive, Play, ShieldCheck, X } from 'lucide-react';
import { Dropzone, Field, Notice, PageHeading, Spinner } from '../components/ui';
import { EMPTY_FORM, SAMPLE_FORM, parseReport, prepareAnalysis } from '../lib/science';
import { loadSampleFiles, runAnalysis } from '../lib/runner';
import type { Progress } from '../lib/runner';
import type { Report } from '../lib/types';
import { useAuth } from '../auth/AuthProvider';
import { trackActivity } from '../lib/analytics';
export function AnalysisPage({ onReport }: { onReport: (report: Report, name: string) => void }) {
  const { verify } = useAuth();
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [files, setFiles] = useState<File[]>([]), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [phase, setPhase] = useState(''), [progress, setProgress] = useState<Progress | null>(null);
  const controller = useRef<AbortController | null>(null), importRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!busy) return;
    const beforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [busy]);
  const set = (key: keyof typeof form, value: string | number) => setForm(current => ({ ...current, [key]: value }));
  const run = async (sample: boolean) => {
    if (busy) return;
    setError(''); setBusy(true); setProgress(null); setPhase(sample ? 'Loading sample reads…' : 'Preparing analysis…');
    const runController = new AbortController(); controller.current = runController;
    const source = sample ? 'sample' : 'files';
    const startedAt = performance.now();
    let stage: 'authentication' | 'preparation' | 'processing' = 'authentication';
    trackActivity('analysis_started', { source });
    runController.signal.addEventListener('abort', () => trackActivity('analysis_cancelled', { source }), { once: true });
    try {
      await verify();
      stage = 'preparation';
      const input = sample ? SAMPLE_FORM : form;
      const selected = sample ? await loadSampleFiles(runController.signal) : files;
      if (runController.signal.aborted) return;
      if (sample) { setForm({ ...SAMPLE_FORM }); setFiles(selected); }
      const prepared = prepareAnalysis(input, selected);
      setPhase('Analyzing paired reads');
      stage = 'processing';
      const report = await runAnalysis(prepared, runController.signal, setProgress);
      if (!runController.signal.aborted) { trackActivity('analysis_completed', { source, sample_count: Object.keys(report.value).length, duration_seconds: Math.round((performance.now() - startedAt) / 100) / 10 }); controller.current = null; onReport(report, sample ? 'EUN sample analysis' : `Analysis · ${new Date().toLocaleDateString()}`); }
    } catch (e) { if (!runController.signal.aborted) { trackActivity('analysis_failed', { source, stage }); setError((e as Error).message); } }
    finally { if (controller.current === runController) controller.current = null; if (!runController.signal.aborted) { setBusy(false); setProgress(null); } }
  };
  const submit = (e: FormEvent) => { e.preventDefault(); void run(false); };
  const importReport = async (file?: File) => {
    if (!file) return;
    setError('');
    try { await verify(); const report = parseReport(await file.text()); trackActivity('report_imported', { source: 'analysis', report_count: 1 }); onReport(report, file.name.replace(/\.json$/i, '')); }
    catch (e) { setError((e as Error).message); }
  };
  return <>
    <PageHeading section="Analysis" title="Every edit tells a story." description="Start with your reads. Get a clearer picture of your CRISPR results." actions={<><button className="button secondary" disabled={busy} onClick={() => importRef.current?.click()}><FileJson size={16}/> Open JSON</button><button className="button secondary" disabled={busy} onClick={() => void run(true)}><Play size={15}/> Run sample</button><input ref={importRef} className="sr-only" tabIndex={-1} type="file" accept=".json" aria-label="Open JSON report" onChange={e => { void importReport(e.target.files?.[0]); e.target.value = ''; }}/></>}/>
    <div className="analysis-layout"><div className="analysis-main">
      <div className="workflow-strip"><a href="#files" onClick={e => { e.preventDefault(); document.getElementById('files')?.scrollIntoView({ behavior: 'smooth' }); }}><span>1</span> Sequencing files</a><div/><a href="#target" onClick={e => { e.preventDefault(); document.getElementById('target')?.scrollIntoView({ behavior: 'smooth' }); }}><span>2</span> Target definition</a><div/><a href="#settings" onClick={e => { e.preventDefault(); document.getElementById('settings')?.scrollIntoView({ behavior: 'smooth' }); }}><span>3</span> Analysis settings</a></div>
      {error && <Notice error>{error}</Notice>}
      <form onSubmit={submit} className="analysis-form"><fieldset disabled={busy}>
        <section className="form-section" id="files"><div className="section-heading"><span className="section-number">01</span><div><h2>Sequencing files</h2><p>Add your paired-end reads and tell us how to match them.</p></div><span className="format-label">FASTQ / GZ</span></div>
          <Dropzone files={files} onChange={setFiles} disabled={busy} accept=".gz,.fastq,.fq" label="Drop your sequencing files here" detail="Paired-end FASTQ reads, compressed or uncompressed"/>
          <div className="field-grid"><Field label="File name pattern" optional hint="The prefix before the sample ID. Regular expressions are supported.">{id => <input id={id} placeholder="e.g. Sample-ID-" value={form.namePattern} onChange={e => set('namePattern', e.target.value)}/>}</Field><Field label="File index pattern" hint="The separator between your sample ID and paired reads.">{id => <input id={id} required placeholder="e.g. _L001_" value={form.indexPattern} onChange={e => set('indexPattern', e.target.value)}/>}</Field></div>
          <div className="filename-example"><span>Example</span><code><span>Sample-ID-</span><strong>71_S71</strong><mark>_L001_</mark>R1_001.fastq.gz</code></div>
        </section>
        <section className="form-section" id="target"><div className="section-heading"><span className="section-number">02</span><div><h2>Target definition</h2><p>Define the reference and the site you’re investigating.</p></div></div>
          <Field label="Reference amplicon sequence" hint="Paste the full amplified sequence of your target locus. Spaces and line breaks are removed.">{id => <textarea id={id} className="sequence-input" rows={4} required placeholder="ACCTCTTATCTTCCTCCCACAGCTCCTGGGCAACGTGCTGGTCTGTGTGCTG…" value={form.fullseq} onChange={e => set('fullseq', e.target.value)}/>}</Field>
          <Field label="Target DNA sequence" hint="5′ to 3′, without the PAM sequence.">{id => <input id={id} className="sequence-input" required placeholder="TCAGAAAGTGGTGGCTGGTG" value={form.rgenseq} onChange={e => set('rgenseq', e.target.value)}/>}</Field>
        </section>
        <section className="form-section" id="settings"><div className="section-heading"><span className="section-number">03</span><div><h2>Analysis settings</h2><p>Set the analysis window and the nucleotide change of interest.</p></div></div>
          <div className="field-grid"><Field label="Cas ortholog" hint="The original EUN analysis supports SpCas9.">{id => <select id={id} value="1" onChange={() => {}}><option value="1">SpCas9 · 5′-NGG-3′</option></select>}</Field><Field label="Standard range" hint="Nucleotides on each side of the cleavage site. Default: 70.">{id => <div className="input-unit"><input id={id} type="number" required min={15} step={1} value={form.end_range} onChange={e => set('end_range', +e.target.value)}/><span>nt</span></div>}</Field></div>
          <div className="nucleotide-settings"><NucleotidePicker label="Target nucleotide" value={form.targetSeq} onChange={value => set('targetSeq', value)}/><ArrowRight size={22}/><NucleotidePicker label="Desired change" value={form.changeSeq} onChange={value => set('changeSeq', value)}/></div>
        </section>
      </fieldset><div className="form-footer"><span><ShieldCheck size={16}/> Files are processed on your device.</span><button className="button primary" disabled={busy}>{busy ? <Spinner/> : <FlaskConical size={17}/>} Run analysis <ArrowRight size={16}/></button></div></form>
    </div><aside className="analysis-aside"><div className="aside-note"><div className="aside-heading"><FlaskConical size={19}/><h3>A good place to start</h3></div><p>New to EUN? Run the sample to explore a complete analysis with paired sequencing reads.</p><button className="text-button" disabled={busy} onClick={() => void run(true)}>Explore the sample <ArrowUpRightSmall/></button><div className="aside-divider"/><h4>Before you begin</h4><ul className="check-list"><li><Check size={15}/> One R1 + R2 pair per sample</li><li><Check size={15}/> Reference amplicon sequence</li><li><Check size={15}/> Target sequence without PAM</li></ul></div><div className="privacy-note"><HardDrive size={21}/><div><h4>Your data stays yours.</h4><p>Reads are processed locally. Save results on your device or download a JSON copy to keep them.</p></div></div><a className="guide-link" href="#/guide"><BookOpen size={17}/><span>Read the analysis guide</span><ArrowRight size={16}/></a></aside></div>
    {busy && <div className="progress-overlay"><section className="progress-dialog" role="dialog" aria-modal="true" aria-labelledby="progress-title"><div className="progress-icon"><FlaskConical size={27}/></div><h2 id="progress-title">{phase}</h2><p>{progress ? `${progress.completed} of ${progress.total} samples complete` : 'Your files stay on this device.'}</p><div className="progress-track" role="progressbar" aria-label="Analysis progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress?.percent ?? 0}><div style={{ width: `${progress?.percent ?? 0}%` }}/></div><div className="progress-caption"><span>{progress?.current ?? 'Getting ready'}</span><strong>{progress?.percent ?? 0}%</strong></div><button className="button secondary" onClick={() => { controller.current?.abort(); setBusy(false); setProgress(null); }}><X size={15}/> Cancel analysis</button></section></div>}
  </>;
}
function ArrowUpRightSmall() { return <ArrowRight size={14}/>; }
function NucleotidePicker({ label, value, onChange }: { label: string; value: string; onChange: (s: string) => void }) {
  return <div className="nucleotide-picker"><span>{label}</span><div role="group" aria-label={label}>{['A', 'C', 'G', 'T'].map(base => <button type="button" className={value === base ? 'selected' : ''} aria-pressed={value === base} key={base} onClick={() => onChange(base)}>{base}</button>)}</div></div>;
}
