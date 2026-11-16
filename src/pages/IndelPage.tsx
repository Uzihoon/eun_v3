import { useEffect, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { ArrowRight, ImageDown, LineChart, RotateCcw } from 'lucide-react';
import { Dropzone, Notice, PageHeading, Spinner } from '../components/ui';
import { buildIndel, readReports } from '../lib/science';
import type { IndelData, NamedReport } from '../lib/types';
import { useAuth } from '../auth/AuthProvider';
import { trackActivity } from '../lib/analytics';
Chart.register(...registerables, annotationPlugin);
const colors = ['#1c7971', '#dc8c56', '#577db5', '#9c6c9d', '#8c9952', '#c45b6b'];
export function IndelPage({ reports, onReports }: { reports: NamedReport[] | null; onReports: (r: NamedReport[] | null) => void }) {
  const { verify } = useAuth();
  const [files, setFiles] = useState<File[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const run = async () => {
    setError(''); setBusy(true);
    try { await verify(); if (!files.length) throw new Error('Choose at least one JSON report.'); const imported = await readReports(files); onReports(imported); trackActivity('report_imported', { source: 'indel', report_count: imported.length }); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return <><PageHeading section="INDEL reports" title={reports ? 'See where change happens.' : 'Put your edits in context.'} description="Compare insertion and deletion frequencies across your EUN reports." actions={reports ? <button className="button secondary" onClick={() => onReports(null)}>Compare other reports</button> : undefined}/>
    {error && <Notice error>{error}</Notice>}{reports ? <IndelChart key={reports.map(r => r.key).join('|')} data={buildIndel(reports)}/> : <div className="narrow-content"><section className="panel padded-panel"><div className="section-heading"><LineChart size={23}/><div><h2>Build an INDEL report</h2><p>Add one or more JSON reports to compare their profiles.</p></div></div><Dropzone files={files} onChange={setFiles} disabled={busy}/><div className="conversion-footer"><span>{files.length} report{files.length === 1 ? '' : 's'} selected</span><button className="button primary" disabled={busy || !files.length} onClick={() => void run()}>{busy ? <Spinner/> : <LineChart size={17}/>} Generate report <ArrowRight size={16}/></button></div></section><div className="instruction-note"><h3>From analysis to comparison</h3><p>Run a Cas analysis and download its JSON report, or open an existing report. Each line represents the average INDEL frequency across samples in one file.</p><a href="#/analysis" className="text-button">Go to analysis <ArrowRight size={15}/></a></div></div>}</>;
}
function IndelChart({ data }: { data: IndelData }) {
  const canvas = useRef<HTMLCanvasElement>(null), chart = useRef<Chart<'line'> | null>(null);
  const [range, setRange] = useState({ start: 1, end: data.seq.length }), [hover, setHover] = useState<number | null>(null);
  const cleavageIndex = data.seq.indexOf(data.target_rna);
  const cleavage = cleavageIndex >= 0 ? cleavageIndex + data.target_rna.length - 2.5 : null;
  const [showSequences, setShowSequences] = useState(false);
  useEffect(() => {
    if (!canvas.current) return;
    const instance = new Chart(canvas.current, {
      type: 'line',
      data: { datasets: data.result.map((r, i) => ({
        label: r.label, data: Array.from({ length: data.seq.length }, (_, position) => ({ x: position + 1, y: r.indel[position]?.y ?? 0 })),
        borderColor: colors[i % colors.length], backgroundColor: colors[i % colors.length], borderWidth: 2, pointRadius: 0, pointHitRadius: 12, tension: .2,
      })) },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: 'index', intersect: false },
        onHover: (_, elements) => setHover(elements.length ? elements[0].index + 1 : null),
        scales: {
          x: { type: 'linear', min: 1, max: data.seq.length, title: { display: true, text: 'Sequence position (nt)' }, grid: { display: false } },
          y: { beginAtZero: true, title: { display: true, text: 'INDEL frequency (%)' }, grid: { color: '#edf0ed' } },
        },
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'line', padding: 26 } },
          tooltip: { backgroundColor: '#173d3b', padding: 12, callbacks: { title: points => `Position ${points[0]?.parsed.x}`, label: p => `${p.dataset.label}: ${p.parsed.y?.toFixed(2)}%` } },
          annotation: { annotations: cleavage === null ? {} : { cut: { type: 'line', xMin: cleavage, xMax: cleavage, borderColor: '#879b8a', borderWidth: 1.5, borderDash: [5, 5], label: { display: true, content: 'Cleavage site', position: 'start', backgroundColor: '#edf2ec', color: '#46614b', font: { size: 11, weight: 'normal' } } } } },
        },
      },
      plugins: [{ id: 'white-background', beforeDraw: chart => { const ctx = chart.ctx; ctx.save(); ctx.globalCompositeOperation = 'destination-over'; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, chart.width, chart.height); ctx.restore(); } }],
    });
    chart.current = instance;
    return () => { instance.destroy(); chart.current = null; };
  }, [data, cleavage]);
  useEffect(() => {
    if (!chart.current?.options.scales?.x) return;
    chart.current.options.scales.x.min = range.start; chart.current.options.scales.x.max = range.end; chart.current.update('none');
  }, [range]);
  const downloadPng = () => {
    if (!chart.current) return;
    const link = document.createElement('a'); link.download = '[EUN]INDEL_Chart.png'; link.href = chart.current.toBase64Image(); link.click(); trackActivity('report_exported', { format: 'png' });
  };
  return <><section className="panel chart-panel"><div className="panel-heading"><div><h2>INDEL frequency</h2><p>Equal-weight average across samples in each report</p></div><button className="button secondary" onClick={downloadPng}><ImageDown size={16}/> Download PNG</button></div><div className="chart-container"><canvas ref={canvas} role="img" aria-label={`INDEL frequency chart comparing ${data.result.map(r => r.label).join(', ')}`}/></div><div className="chart-range"><span>Zoom to position</span><label>From<input type="number" min={1} max={Math.max(1, range.end - 1)} value={range.start} onChange={e => setRange(r => ({ ...r, start: Math.max(1, Math.min(+e.target.value, r.end - 1)) }))}/></label><label>To<input type="number" min={range.start + 1} max={data.seq.length} value={range.end} onChange={e => setRange(r => ({ ...r, end: Math.max(r.start + 1, Math.min(data.seq.length, +e.target.value)) }))}/></label><button className="text-button" onClick={() => setRange({ start: 1, end: data.seq.length })}><RotateCcw size={14}/> Reset zoom</button></div></section>
    <section className="panel"><button className="disclosure" aria-expanded={showSequences} onClick={() => setShowSequences(!showSequences)}><span>Reference sequences <small>{data.result.length} reports</small></span><span>{showSequences ? '−' : '+'}</span></button>{showSequences && <div className="indel-sequences">{data.result.map((r, i) => {
      const start = r.standard_seq.indexOf(r.seq_target);
      return <div key={`${r.label}-${i}`}><h3><i style={{ background: colors[i % colors.length] }}/>{r.label}</h3><div className="reference-sequence">{[...r.standard_seq].map((base, position) => <span key={position} className={`${position >= start && position < start + r.seq_target.length ? 'region-rgenSeq' : ''} ${hover === position + 1 ? 'hover-base' : ''}`}>{base}</span>)}</div></div>;
    })}</div>}</section><details className="data-details"><summary>View chart data as a table</summary><div className="table-scroll"><table><thead><tr><th>Position</th>{data.result.map((r, i) => <th key={i}>{r.label} (%)</th>)}</tr></thead><tbody>{Array.from({ length: data.seq.length }, (_, i) => <tr key={i}><th>{i + 1}</th>{data.result.map((r, j) => <td key={j}>{(r.indel[i]?.y ?? 0).toFixed(2)}</td>)}</tr>)}</tbody></table></div></details></>;
}
