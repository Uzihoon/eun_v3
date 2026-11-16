// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://eun-v3.vercel.app/"}
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const commands = () => ((window as unknown as { dataLayer?: IArguments[] }).dataLayer ?? []).map(item => Array.from(item));
const events = () => commands().filter(item => item[0] === 'event');
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('PROD', true);
  vi.stubEnv('VITE_GA4_MEASUREMENT_ID', 'G-TEST123456');
  vi.stubEnv('VITE_DEPLOY_ENV', 'production');
  localStorage.clear();
  document.querySelectorAll('script[data-eun-analytics]').forEach(node => node.remove());
  for (const key of ['gtag', 'dataLayer', 'ga-disable-G-TEST123456']) delete (window as unknown as Record<string, unknown>)[key];
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it('loads no Google tag and records no events until consent is granted', async () => {
  const analytics = await import('../src/lib/analytics');
  analytics.trackActivity('login', { method: 'password' });
  analytics.trackPage('/report/private-experiment?email=private@example.test');
  expect(document.querySelector('script[data-eun-analytics]')).toBeNull();
  expect(commands()).toEqual([]);
  analytics.setAnalyticsConsent('denied');
  expect(commands()).toEqual([]);
});

it('sends sanitized pages and allowed event parameters after opt-in', async () => {
  const analytics = await import('../src/lib/analytics');
  analytics.trackPage('/report/private-experiment?email=private@example.test');
  analytics.setAnalyticsUser('firebase-account-123');
  analytics.setAnalyticsConsent('granted');
  analytics.trackActivity('analysis_completed', { source: 'files', sample_count: 2, duration_seconds: 3.4, filename: 'secret.fastq', email: 'secret@example.test', sequence: 'ACGT' } as never);
  expect(document.querySelectorAll('script[data-eun-analytics]')).toHaveLength(1);
  expect(events().find(event => event[1] === 'page_view')?.[2]).toMatchObject({ page_location: 'https://eun-v3.vercel.app/#/report', page_title: 'EUN · Results' });
  expect(events().find(event => event[1] === 'analysis_completed')?.[2]).toMatchObject({ source: 'files', sample_count: 2, duration_seconds: 3.4, user_id: 'firebase-account-123' });
  const payload = JSON.stringify(commands());
  for (const forbidden of ['private-experiment', 'private@example.test', 'secret.fastq', 'secret@example.test', 'ACGT']) expect(payload).not.toContain(forbidden);
});

it('stops events immediately on withdrawal and clears analytics cookies', async () => {
  const analytics = await import('../src/lib/analytics');
  analytics.setAnalyticsConsent('granted');
  document.cookie = '_ga=old-id; path=/';
  document.cookie = '_ga_TEST123456=old-session; path=/';
  analytics.setAnalyticsConsent('denied');
  const count = events().length;
  analytics.trackActivity('login', { method: 'password' });
  analytics.trackPage('/history');
  expect(events()).toHaveLength(count);
  expect((window as unknown as Record<string, unknown>)['ga-disable-G-TEST123456']).toBe(true);
  expect(document.cookie).not.toContain('_ga');
});

it('clears the signed-in ID before subsequent signed-out events', async () => {
  const analytics = await import('../src/lib/analytics');
  analytics.setAnalyticsUser('account-a');
  analytics.setAnalyticsConsent('granted');
  analytics.trackActivity('login', { method: 'password' });
  analytics.setAnalyticsUser(null);
  analytics.trackPage('/login');
  expect(events().at(-1)?.[2]).toMatchObject({ user_id: null });
});

it('never enables analytics in local development or Vercel previews', async () => {
  vi.stubEnv('VITE_DEPLOY_ENV', 'preview');
  const analytics = await import('../src/lib/analytics');
  analytics.setAnalyticsConsent('granted');
  analytics.trackActivity('login', { method: 'password' });
  expect(analytics.analyticsAvailable).toBe(false);
  expect(commands()).toEqual([]);
});

it('discards unknown events and invalid values rather than accepting arbitrary text', async () => {
  const analytics = await import('../src/lib/analytics');
  analytics.setAnalyticsConsent('granted');
  const count = events().length;
  analytics.trackActivity('private-experiment' as never, {} as never);
  expect(events()).toHaveLength(count);
  analytics.trackActivity('analysis_failed', { source: 'files', stage: 'secret.fastq' } as never);
  expect(JSON.stringify(commands())).not.toContain('secret.fastq');
});

it('survives unavailable browser storage without blocking application actions', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  const analytics = await import('../src/lib/analytics');
  expect(() => analytics.setAnalyticsConsent('denied')).not.toThrow();
  expect(analytics.getAnalyticsConsent()).toBe('denied');
});
