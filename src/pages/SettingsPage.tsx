import { ArrowRight, FileJson, HardDrive } from 'lucide-react';
import { PageHeading, Spinner } from '../components/ui';
import { AnalyticsSettings } from '../components/AnalyticsConsent';

export function SettingsPage({ autoSave, savedCount, busy, onAutoSave }: {
  autoSave: boolean; savedCount: number; busy: boolean; onAutoSave: (enabled: boolean) => Promise<boolean>;
}) {
  return <>
    <PageHeading section="Settings" title="Make room for your work." description="Choose how EUN keeps your results on this device."/>
    <div className="settings-layout">
      <section className="panel settings-panel" aria-labelledby="storage-heading">
        <div className="panel-heading"><h2 id="storage-heading"><HardDrive size={19}/> Result storage</h2></div>
        <div className="setting-row">
          <div><h3 id="local-save-label">Save results on this device</h3><p id="local-save-description">Automatically keep completed analyses and imported JSON reports in this browser, ready to reopen from Results history.</p></div>
          <div className="setting-control"><button type="button" role="switch" className="setting-switch" aria-checked={autoSave} aria-labelledby="local-save-label" aria-describedby="local-save-description" disabled={busy} onClick={() => void onAutoSave(!autoSave)}><span/></button><span aria-live="polite">{busy ? <Spinner/> : autoSave ? 'On' : 'Off'}</span></div>
        </div>
        <div className="setting-detail"><p>Turning this on also saves the reports currently open in your workspace. Turning it off stops automatic saving; previously saved results remain available.</p><p>This preference and your saved history belong to your signed-in account in this browser. Reads are not stored, and results are not uploaded.</p></div>
        <div className="settings-summary"><span><strong>{savedCount}</strong> {savedCount === 1 ? 'report' : 'reports'} saved here</span><a className="text-button" href="#/history">Open results history <ArrowRight size={15}/></a></div>
      </section>
      <section className="settings-backup" aria-labelledby="backup-heading"><FileJson size={24}/><h2 id="backup-heading">Keep a JSON copy.</h2><p>Use Download JSON on a result to save a file on your computer. Import it from Results history to reopen it here or on another device.</p><p>Clearing browser data or using a private window can remove locally saved results. A downloaded JSON file is your backup.</p><a className="text-button" href="#/history">Choose a result to download <ArrowRight size={15}/></a></section>
    </div>
    <AnalyticsSettings/>
  </>;
}
