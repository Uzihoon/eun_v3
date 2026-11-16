import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { BarChart3, X } from 'lucide-react';
import { analyticsAvailable, getAnalyticsConsent, setAnalyticsConsent, startAnalytics, subscribeAnalyticsConsent } from '../lib/analytics';

export function AnalyticsConsent() {
  const consent = useSyncExternalStore(subscribeAnalyticsConsent, getAnalyticsConsent);
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(startAnalytics, []);
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close(); }, [open]);
  if (!analyticsAvailable) return null;
  const choose = (value: 'granted' | 'denied') => { setAnalyticsConsent(value); setOpen(false); };
  return <>
    {consent === 'unknown' ? <section className="analytics-banner" aria-label="Optional usage analytics">
      <div><strong>Help improve EUN</strong><p>Allow Google Analytics to measure page visits, feature use, and approximate location. Signed-in activity uses an account ID. Your research files and results stay on your device.</p></div>
      <div className="analytics-actions"><button className="button secondary" onClick={() => choose('denied')}>Decline analytics</button><button className="button primary" onClick={() => choose('granted')}>Allow analytics</button><button className="text-button" onClick={() => setOpen(true)}>Details</button></div>
    </section> : <button className="analytics-preferences" onClick={() => setOpen(true)}>Privacy & analytics</button>}
    <dialog ref={dialog} className="analytics-dialog" aria-labelledby="analytics-dialog-title" onCancel={() => setOpen(false)} onClose={() => setOpen(false)}>
      <div className="panel-heading"><h2 id="analytics-dialog-title">Your privacy choices</h2><button className="icon-button" aria-label="Close privacy choices" onClick={() => setOpen(false)}><X size={20}/></button></div>
      <p>EUN uses Firebase Authentication to manage your account, including your email address and most recent sign-in. Analysis runs in your browser. Saving results on this device is a separate setting.</p>
      <p>Optional Google Analytics helps us understand page visits, analysis completion, imports, exports, and local saving. It receives an internal account ID when you are signed in, device/browser information, and approximate location. Analytics cookies help recognize return visits.</p>
      <p>Analytics does not receive your email, name, file names, sequencing data, or analysis results. Advertising features are disabled.</p>
      <p>You can use every feature without analytics. Change your choice here or in Settings at any time. Turning it off stops future collection and removes EUN’s analytics cookies; it does not delete previously collected events.</p>
      <p><a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google’s privacy policy</a></p>
      <div className="analytics-actions"><button className="button secondary" onClick={() => choose('denied')}>Decline analytics</button><button className="button primary" onClick={() => choose('granted')}>Allow analytics</button></div>
    </dialog>
  </>;
}

export function AnalyticsSettings() {
  const consent = useSyncExternalStore(subscribeAnalyticsConsent, getAnalyticsConsent);
  return <section className="panel settings-panel analytics-settings" aria-labelledby="analytics-heading">
    <div className="panel-heading"><h2 id="analytics-heading"><BarChart3 size={19}/> Usage analytics</h2></div>
    <div className="setting-row"><div><h3 id="analytics-label">Share usage analytics</h3><p id="analytics-description">Help improve EUN by sharing page visits and feature use with Google Analytics. This choice applies to this browser.</p></div>
      <div className="setting-control"><button type="button" role="switch" className="setting-switch" aria-checked={consent === 'granted' && analyticsAvailable} aria-labelledby="analytics-label" aria-describedby="analytics-description" disabled={!analyticsAvailable} onClick={() => setAnalyticsConsent(consent === 'granted' ? 'denied' : 'granted')}><span/></button><span>{consent === 'granted' && analyticsAvailable ? 'On' : 'Off'}</span></div>
    </div><div className="setting-detail"><p>{analyticsAvailable ? 'Signed-in activity uses an internal account ID. Analytics includes approximate location and browser information. Your email, file names, sequences, and results are excluded.' : 'Usage analytics are not enabled on this site.'}</p><p>All analysis features work with analytics off. Account sign-in records are managed separately by Firebase.</p></div>
  </section>;
}
