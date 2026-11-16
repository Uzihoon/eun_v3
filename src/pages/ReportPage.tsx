import { useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowRight, ChevronLeft, ChevronRight, FileJson, FileSpreadsheet, HardDrive, LineChart } from 'lucide-react';
import type { NamedReport, Report, Sample } from '../lib/types';
import { percent, sampleIds } from '../lib/science';
import { exportExcel, exportJson } from '../lib/export';
import { Notice, PageHeading, Spinner } from '../components/ui';
import { useAuth } from '../auth/AuthProvider';
import { trackActivity } from '../lib/analytics';
const num = (n: number) => (n ?? 0).toLocaleString();
export function ReportPage({ report, name, saved, saving, onSave, onIndel }: { report: Report; name: string; saved: boolean; saving: boolean; onSave: () => Promise<boolean>; onIndel: (reports: NamedReport[]) => void }) {
  const { verify } = useAuth();
  const ids = sampleIds(report);
  const [selected, setSelected] = useState(ids[0]), [tab, setTab] = useState<'sequences' | 'frequencies'>('sequences');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const sample = report.value[selected];
  const total = Object.values(report.value).reduce((sum, item) => sum + item.tot_count, 0);
  const exportFile = async (kind: 'json' | 'excel') => {
    setBusy(true); setError('');
    try { await verify(); if (kind === 'json') exportJson(report); else await exportExcel(report); trackActivity('report_exported', { format: kind }); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return <><PageHeading section="Analysis / Results" title="Your results, in focus." description={name} actions={<><button className="button secondary" disabled={busy} onClick={() => void exportFile('json')}><FileJson size={16}/> Download JSON</button><button className="button primary" disabled={busy} onClick={() => void exportFile('excel')}>{busy ? <Spinner/> : <FileSpreadsheet size={16}/>} Export Excel</button></>}/>
    {error && <Notice error>{error}</Notice>}<div className="report-save-bar"><span role="status"><HardDrive size={16}/>{saved ? 'Saved on this device' : saving ? 'Saving result…' : 'This session only'}</span><div>{!saved && <button className="text-button" disabled={saving} onClick={() => void onSave()}>Save on device</button>}<a className="text-button" href="#/settings">Storage settings <ArrowRight size={14}/></a></div></div><div className="report-overview"><div><span>Samples analyzed</span><strong>{ids.length.toString().padStart(2, '0')}</strong></div><div><span>Reads above minimum frequency</span><strong>{num(total)}</strong></div><div><span>Change of interest</span><strong className="change-value">{report.format.targetSeq} <ArrowRight size={21}/> {report.format.changeSeq}</strong></div><div><span>Analysis window</span><strong>±{report.format.end_range} <small>nt</small></strong></div></div>
    <section className="panel reference-panel" aria-labelledby="reference-title"><div className="panel-heading"><h2 id="reference-title">Reference amplicon</h2><div className="legend"><span><i className="legend-comparison"/> Comparison region</span><span><i className="legend-guide"/> Target DNA</span></div></div><div className="reference-sequence" role="group" aria-label="Reference amplicon sequence" tabIndex={0}>{report.summary.map((part, i) => <span key={i} className={`region-${part.type}`}>{part.data}</span>)}</div><div className="panel-footnote">5′ → 3′ <span>SpCas9 · NGG</span></div></section>
    <div className="sample-bar"><div className="sample-select"><label htmlFor="sample-select">Sample</label><select id="sample-select" value={selected} onChange={e => setSelected(e.target.value)}>{ids.map(id => <option key={id} value={id}>{id}</option>)}</select><span>{ids.indexOf(selected) + 1} of {ids.length}</span></div><button className="button secondary" onClick={async () => { try { await verify(); onIndel([{ ...report, key: `${report.format.targetSeq}${report.format.changeSeq}` }]); } catch (e) { setError((e as Error).message); } }}><LineChart size={16}/> View INDEL report <ArrowRight size={15}/></button></div>
    <section className="panel"><div className="panel-heading"><h2>Read summary</h2><span className="subtle">{selected}</span></div><div className="read-metrics">{[['Total sequences', sample.joins_length], ['Both indicators', sample.totlr_count], ['Above minimum frequency', sample.tot_count], ['Insertions', sample.cnt_ins], ['Deletions', sample.cnt_del]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{num(Number(value))}</strong></div>)}</div></section>
    <section className="panel results-panel"><div className="result-tabs" role="tablist" aria-label="Sample results"><button role="tab" aria-selected={tab === 'sequences'} onClick={() => setTab('sequences')}>Sequence alignments <span>{sample.table.length}</span></button><button role="tab" aria-selected={tab === 'frequencies'} onClick={() => setTab('frequencies')}>Nucleotide frequencies</button></div>{tab === 'sequences' ? <SequenceTable key={selected} sample={sample} report={report}/> : <FrequencyTable sample={sample} report={report}/>}</section>
    <div className="change-summary"><div><span className="change-symbol">{report.format.targetSeq}<ArrowRight size={20}/>{report.format.changeSeq}</span><div><h3>Desired substitution frequency</h3><p>{num(sample.changed)} of {num(sample.tot_count)} reads · Standard length {sample.standardLen || 0} nt</p></div></div><strong>{percent(sample.changed, sample.tot_count).toFixed(2)}<small>%</small></strong></div>
    <p className="download-reminder"><ArrowDownToLine size={15}/>{saved ? 'This result is in your local Results history. Download JSON for a portable backup.' : 'Save on device to return to this result later, or download a JSON copy.'}</p>
  </>;
}
function SequenceTable({ sample, report }: { sample: Sample; report: Report }) {
  const [filter, setFilter] = useState('all'), [sort, setSort] = useState('count-desc'), [page, setPage] = useState(0);
  const rows = useMemo(() => {
    const selected = sample.table.filter(row => filter === 'all' || row.type === Number(filter));
    const [key, direction] = sort.split('-');
    return selected.sort((a, b) => ((a[key as 'count' | 'length'] ?? 0) - (b[key as 'count' | 'length'] ?? 0)) * (direction === 'desc' ? -1 : 1));
  }, [sample, filter, sort]);
  const pageCount = Math.max(1, Math.ceil(rows.length / 10));
  return <><div className="table-tools"><div className="legend"><span><i className="desired"/> Desired change</span><span><i className="substitution"/> Other substitution</span><span><i className="insertion"/> Insertion</span><span><i className="deletion"/> Deletion</span></div><div className="table-filters"><select aria-label="Filter sequence type" value={filter} onChange={e => { setFilter(e.target.value); setPage(0); }}><option value="all">All sequence types</option><option value="0">WT or substitution</option><option value="1">Insertion</option><option value="2">Deletion</option></select><select aria-label="Sort sequences" value={sort} onChange={e => { setSort(e.target.value); setPage(0); }}><option value="count-desc">Count: high to low</option><option value="count-asc">Count: low to high</option><option value="length-desc">Length: high to low</option><option value="length-asc">Length: low to high</option></select></div></div>
    <div className="table-scroll"><table className="sequence-table"><thead><tr><th>ID</th><th>Aligned sequence</th><th>Length</th><th>Count</th><th>Type</th><th>HDR</th></tr></thead><tbody>{rows.slice(page * 10, page * 10 + 10).map((row, i) => <tr key={`${row.id}-${i}`}><td>{row.id}</td><td><div className="alignment"><div className="alignment-reference" aria-label="Reference sequence">{row.origin}</div><div aria-label="Treated sequence">{[...row.change].map((base, position) => {
      const origin = row.origin[position];
      const kind = origin === base ? '' : origin === '-' ? 'insertion' : base === '-' ? 'deletion' : origin === report.format.targetSeq && base === report.format.changeSeq ? 'desired' : 'substitution';
      return <span key={position} className={kind} title={kind ? `${position + 1}: ${origin} → ${base} (${kind})` : undefined}>{base}</span>;
    })}</div></div></td><td>{row.length}</td><td>{num(row.count)}</td><td><span className={`type-label type-${row.type}`}>{['WT / Sub', 'INS', 'DEL'][row.type]}</span></td><td>{row.hdr < -1 ? 'N/A' : row.hdr === -1 ? 'X' : 'O'}</td></tr>)}</tbody></table>{rows.length === 0 && <div className="empty-inline">No sequences match this filter.</div>}</div>
    <div className="pagination"><span>{rows.length ? page * 10 + 1 : 0}–{Math.min((page + 1) * 10, rows.length)} of {rows.length} sequences</span><div><button className="icon-button" aria-label="Previous page" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft size={17}/></button><span>{page + 1} / {pageCount}</span><button className="icon-button" aria-label="Next page" disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)}><ChevronRight size={17}/></button></div></div>
  </>;
}
function FrequencyTable({ sample, report }: { sample: Sample; report: Report }) {
  return <div className="frequency-section"><p>Base frequencies at each target position, as a percentage of reads above minimum frequency.</p><div className="table-scroll"><table className="frequency-table"><thead><tr><th>Base</th>{[...report.format.seq_RGEN].map((base, i) => <th key={i}><span>{base}</span><small>{report.format.seq_RGEN.length - i}</small></th>)}</tr></thead><tbody>{['A', 'C', 'G', 'T'].map(base => <tr key={base}><th>{base}</th>{[...report.format.seq_RGEN].map((original, i) => {
    const count = sample.chartIndex[i]?.[base] ?? 0, value = percent(count, sample.tot_count);
    const kind = value === 0 ? '' : original === base ? 'original' : original === report.format.targetSeq && base === report.format.changeSeq ? 'desired' : 'substitution';
    return <td key={i} title={`${count} reads`}><span className={kind} style={{ opacity: value ? Math.max(.45, value / 100) : 1 }}>{value.toFixed(1)}</span></td>;
  })}</tr>)}</tbody></table></div><div className="legend"><span><i className="original"/> Original</span><span><i className="desired"/> Desired change</span><span><i className="substitution"/> Other substitution</span></div></div>;
}
