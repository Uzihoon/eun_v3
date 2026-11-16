import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react';
import { ArrowRight, BookOpen, Dna, FileClock, HardDrive, LineChart, LogOut, Menu, RefreshCw, Settings, X } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { localAuth } from '../auth/firebase';
import { Logo, Notice, PageHeading, Spinner } from './ui';
import type { NamedReport, Report } from '../lib/types';
import { useReports } from '../hooks/useReports';
import { setAnalyticsUser, trackPage } from '../lib/analytics';
const AnalysisPage = lazy(() => import('../pages/AnalysisPage').then(m => ({ default: m.AnalysisPage })));
const ReportPage = lazy(() => import('../pages/ReportPage').then(m => ({ default: m.ReportPage })));
const ConvertPage = lazy(() => import('../pages/ConvertPage').then(m => ({ default: m.ConvertPage })));
const IndelPage = lazy(() => import('../pages/IndelPage').then(m => ({ default: m.IndelPage })));
const GuidePage = lazy(() => import('../pages/GuidePage').then(m => ({ default: m.GuidePage })));
const SettingsPage = lazy(() => import('../pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const HistoryPage = lazy(() => import('../pages/HistoryPage').then(m => ({ default: m.HistoryPage })));
const subscribe = (fn: () => void) => { window.addEventListener('hashchange', fn); return () => window.removeEventListener('hashchange', fn); };
const navigate = (path: string) => { window.location.hash = path; window.scrollTo(0, 0); };
const navigation = [
  { path: '/analysis', label: 'Cas analysis', Icon: Dna }, { path: '/indel', label: 'INDEL reports', Icon: LineChart },
  { path: '/convert', label: 'File conversion', Icon: RefreshCw }, { path: '/history', label: 'Results history', Icon: FileClock },
];
export default function Workspace() {
  const { user, logout, verify } = useAuth();
  const path = useSyncExternalStore(subscribe, () => window.location.hash.replace(/^#/, '') || '/analysis');
  useEffect(() => { setAnalyticsUser(user!.uid); trackPage(path); }, [path, user?.uid]);
  const archive = useReports(user!.uid, verify);
  const { reports } = archive;
  const [indel, setIndel] = useState<NamedReport[] | null>(null);
  const [menu, setMenu] = useState(false), [error, setError] = useState(''), [signingOut, setSigningOut] = useState(false);
  const addReport = (report: Report, name: string) => {
    const saved = archive.addReport(report, name);
    navigate(`/report/${saved.id}`);
  };
  const report = reports.find(r => path === `/report/${r.id}`);
  const signout = async () => { setSigningOut(true); setError(''); try { await logout(); } catch { setError('Could not sign out. Please try again.'); } finally { setSigningOut(false); } };
  return <div className="workspace"><a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById('main-content')?.focus(); }}>Skip to content</a>
    <aside className={`sidebar ${menu ? 'open' : ''}`}><div className="sidebar-brand"><Logo/><button className="icon-button mobile-only" aria-label="Close menu" onClick={() => setMenu(false)}><X size={21}/></button></div><div className="workspace-label">RESEARCH WORKSPACE</div><nav className="main-nav" aria-label="Main navigation">{navigation.map(({ path: target, label, Icon }) => <a key={target} href={`#${target}`} aria-label={label} className={path === target || target === '/analysis' && path.startsWith('/report/') ? 'active' : ''} aria-current={path === target ? 'page' : undefined} onClick={() => setMenu(false)}><Icon size={19} strokeWidth={1.6}/><span>{label}</span>{target === '/history' && reports.length > 0 && <small>{reports.length}</small>}</a>)}</nav>
    <div className="sidebar-bottom"><div className="sidebar-local"><HardDrive size={18}/><h4>On your device.</h4><p>{archive.autoSave ? 'Results are saved locally in this browser.' : 'Choose which results to keep in Settings.'}</p></div><a className={`guide-nav ${path === '/settings' ? 'active' : ''}`} href="#/settings" aria-current={path === '/settings' ? 'page' : undefined} onClick={() => setMenu(false)}><Settings size={18}/> Settings <ArrowRight size={14}/></a><a className={`guide-nav ${path === '/guide' ? 'active' : ''}`} href="#/guide" onClick={() => setMenu(false)}><BookOpen size={18}/> Help & documentation <ArrowRight size={14}/></a><div className="user-row"><div className="avatar">{(user?.name || user?.email || 'E')[0].toUpperCase()}</div><div><strong>{user?.name || user?.email.split('@')[0]}</strong><span title={user?.email}>{user?.email}</span></div><button className="icon-button" aria-label="Sign out" title="Sign out (saved local results are kept)" disabled={signingOut || archive.saving} onClick={() => void signout()}>{signingOut ? <Spinner/> : <LogOut size={17}/>}</button></div></div></aside>
    {menu && <button className="menu-backdrop" aria-label="Close navigation" onClick={() => setMenu(false)}/>}
    <div className="workspace-body"><div className="workspace-topbar"><div><button className="icon-button mobile-only" aria-label="Open menu" onClick={() => setMenu(true)}><Menu size={21}/></button><span>CRISPR / Cas analysis</span></div><div><span className="topbar-note">{localAuth ? 'Local preview' : 'Browser-based analysis'}</span><span className="version-badge">V3</span></div></div><main id="main-content" className="main-content" tabIndex={-1}>{error && <Notice error>{error}</Notice>}{archive.error && <Notice error><div className="storage-error"><span>{archive.error}</span><button className="icon-button" aria-label="Dismiss storage message" onClick={archive.dismissError}><X size={16}/></button></div></Notice>}<Suspense fallback={<div className="loading-state"><Spinner/> Opening your workspace…</div>}>{archive.loading ? <div className="loading-state"><Spinner/> Opening your saved results…</div> : <>
      {(path === '/' || path === '/analysis') && <AnalysisPage onReport={addReport}/>}
      {path.startsWith('/report/') && (report ? <ReportPage key={report.id} report={report} name={report.name} saved={archive.savedIds.has(report.id)} saving={archive.saving} onSave={() => archive.saveReport(report.id)} onIndel={r => { setIndel(r); navigate('/indel'); }}/> : <><PageHeading section="Analysis" title="This report isn’t saved here." description="Find it in Results history or import its JSON file to view it again."/><a className="button primary" href="#/history">Open results history <ArrowRight size={16}/></a></>)}
      {path === '/indel' && <IndelPage reports={indel} onReports={setIndel}/>}
      {path === '/convert' && <ConvertPage/>}
      {path === '/guide' && <GuidePage/>}
      {path === '/settings' && <SettingsPage autoSave={archive.autoSave} savedCount={archive.savedIds.size} busy={archive.saving} onAutoSave={archive.setAutoSave}/>}
      {(path === '/history' || path === '/list') && <HistoryPage reports={reports} savedIds={archive.savedIds} autoSave={archive.autoSave} busy={archive.saving} onOpen={id => navigate(`/report/${id}`)} onReport={addReport} onSave={archive.saveReport} onRemove={archive.removeReport}/>}
      {!['/', '/analysis', '/indel', '/convert', '/guide', '/history', '/list', '/settings'].includes(path) && !path.startsWith('/report/') && <div className="empty-state"><h1>Page not found.</h1><a className="button primary" href="#/analysis">Go to analysis</a></div>}
    </>}</Suspense><footer className="workspace-footer"><span>EUN · Understand your edits.</span><span>Made for a closer look.</span></footer></main></div>
  </div>;
}
