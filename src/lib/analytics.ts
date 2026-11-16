/** Only predefined operational data may leave EUN through this module. */
export type AnalyticsConsent = 'unknown' | 'granted' | 'denied';
type Source = 'sample' | 'files';
interface ActivityEvents {
  login: { method: 'password' };
  sign_up: { method: 'password' };
  logout: Record<string, never>;
  analysis_started: { source: Source };
  analysis_completed: { source: Source; sample_count: number; duration_seconds: number };
  analysis_failed: { source: Source; stage: 'authentication' | 'preparation' | 'processing' };
  analysis_cancelled: { source: Source };
  report_imported: { source: 'analysis' | 'history' | 'indel'; report_count: number };
  report_exported: { format: 'json' | 'excel' | 'png' | 'zip' };
  result_saved: { method: 'manual' | 'automatic' };
  storage_preference_changed: { enabled: boolean };
  conversion_completed: { operation_count: number };
}
type Params = Record<string, string | number | boolean | null>;
type GoogleWindow = Window & { dataLayer?: IArguments[]; gtag?: (...args: unknown[]) => void; [key: `ga-disable-${string}`]: boolean };
const browser = (typeof window === 'undefined' ? {} : window) as GoogleWindow;
const measurementId = (import.meta.env.VITE_GA4_MEASUREMENT_ID ?? '').trim();
export const analyticsAvailable = import.meta.env.PROD && import.meta.env.VITE_DEPLOY_ENV === 'production'
  && /^G-[A-Z0-9]+$/.test(measurementId) && !['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
const consentKey = 'eun.analytics-consent.v1';
const listeners = new Set<() => void>();
let consent: AnalyticsConsent = readConsent();
let configured = false;
let userId: string | null = null;
let page = 'login';
let lastPage = '';
const titles: Record<string, string> = { login: 'Sign in', signup: 'Create account', reset: 'Reset password', verify: 'Verify email', analysis: 'Analysis', report: 'Results', history: 'Results history', indel: 'INDEL reports', convert: 'File conversion', settings: 'Settings', guide: 'Help', not_found: 'Page not found' };
const allowed: Record<keyof ActivityEvents, Record<string, readonly string[] | 'number' | 'boolean'>> = {
  login: { method: ['password'] }, sign_up: { method: ['password'] }, logout: {},
  analysis_started: { source: ['sample', 'files'] },
  analysis_completed: { source: ['sample', 'files'], sample_count: 'number', duration_seconds: 'number' },
  analysis_failed: { source: ['sample', 'files'], stage: ['authentication', 'preparation', 'processing'] },
  analysis_cancelled: { source: ['sample', 'files'] },
  report_imported: { source: ['analysis', 'history', 'indel'], report_count: 'number' },
  report_exported: { format: ['json', 'excel', 'png', 'zip'] },
  result_saved: { method: ['manual', 'automatic'] },
  storage_preference_changed: { enabled: 'boolean' }, conversion_completed: { operation_count: 'number' },
};
function readConsent(): AnalyticsConsent {
  try { const value = localStorage.getItem(consentKey); return value === 'granted' || value === 'denied' ? value : 'unknown'; }
  catch { return 'unknown'; }
}
export const getAnalyticsConsent = () => consent;
export const subscribeAnalyticsConsent = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const isActive = () => analyticsAvailable && consent === 'granted';
const pageContext = (): Params => ({ page_location: `${location.origin}/#/${page}`, page_title: `EUN · ${titles[page]}`, page_referrer: '', user_id: userId });
function command(...args: unknown[]) { try { browser.gtag?.(...args); } catch { /* Analytics never blocks research work. */ } }
const deniedAds = { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' };
function initialize() {
  if (!isActive()) return;
  browser[`ga-disable-${measurementId}`] = false;
  if (!configured) {
    browser.dataLayer ??= [];
    browser.gtag = function () { browser.dataLayer!.push(arguments); };
    command('consent', 'default', { ...deniedAds, analytics_storage: 'denied' });
    command('consent', 'update', { ...deniedAds, analytics_storage: 'granted' });
    const settings = { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false, cookie_domain: location.hostname, cookie_flags: 'SameSite=Lax;Secure' };
    // Migrated Google tags may initialize on `js`, before a stream config.
    command('set', { ...settings, ...pageContext() });
    command('js', new Date());
    command('config', measurementId, settings);
    const script = document.createElement('script');
    script.async = true; script.dataset.eunAnalytics = 'true';
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    script.referrerPolicy = 'no-referrer';
    document.head.appendChild(script);
    configured = true;
  } else command('consent', 'update', { ...deniedAds, analytics_storage: 'granted' });
  sendPage();
}
function clearCookies() {
  try {
    for (const item of document.cookie.split(';')) {
      const name = item.split('=')[0].trim();
      if (name !== '_ga' && !name.startsWith('_ga_')) continue;
      const expired = `${name}=; Max-Age=0; path=/`;
      document.cookie = expired;
      document.cookie = `${expired}; domain=${location.hostname}`;
      document.cookie = `${expired}; domain=.${location.hostname}`;
    }
  } catch { /* Cookies may be unavailable in restricted browsers. */ }
}
function applyConsent() {
  if (isActive()) initialize();
  else {
    if (analyticsAvailable) browser[`ga-disable-${measurementId}`] = true;
    if (configured) { command('consent', 'update', { ...deniedAds, analytics_storage: 'denied' }); command('set', { user_id: null }); }
    lastPage = '';
    clearCookies();
  }
  listeners.forEach(listener => listener());
}
export function setAnalyticsConsent(value: Exclude<AnalyticsConsent, 'unknown'>) {
  consent = value;
  try { localStorage.setItem(consentKey, value); } catch { /* Retain the choice for this session. */ }
  applyConsent();
}
export function startAnalytics() {
  const sync = (event: StorageEvent) => { if (event.key === consentKey || event.key === null) { consent = readConsent(); applyConsent(); } };
  window.addEventListener('storage', sync);
  applyConsent();
  return () => window.removeEventListener('storage', sync);
}
export function setAnalyticsUser(uid: string | null) {
  userId = uid && /^[A-Za-z0-9_-]{1,128}$/.test(uid) ? uid : null;
  if (isActive() && configured) command('set', { user_id: userId });
}
export function trackPage(path: string) {
  const category = path.replace(/^#?\/?/, '').split(/[/?#]/)[0] || 'analysis';
  page = category === 'list' ? 'history' : Object.hasOwn(titles, category) ? category : 'not_found';
  sendPage();
}
function sendPage() {
  if (!isActive() || !configured) return;
  const context = pageContext();
  command('set', context);
  const key = `${page}:${userId ?? ''}`;
  if (lastPage === key) return;
  lastPage = key;
  command('event', 'page_view', { ...context, send_to: measurementId });
}
export function trackActivity<K extends keyof ActivityEvents>(name: K, properties: ActivityEvents[K]) {
  if (!isActive() || !configured || !Object.hasOwn(allowed, name)) return;
  const safe: Params = {};
  for (const [key, rule] of Object.entries(allowed[name])) {
    const value = (properties as Record<string, unknown>)[key];
    if (rule === 'number' && typeof value === 'number' && Number.isFinite(value) && value >= 0) safe[key] = Math.min(value, 1_000_000);
    else if (rule === 'boolean' && typeof value === 'boolean') safe[key] = value;
    else if (Array.isArray(rule) && typeof value === 'string' && rule.includes(value)) safe[key] = value;
  }
  command('event', name, { ...safe, ...pageContext(), send_to: measurementId });
}
