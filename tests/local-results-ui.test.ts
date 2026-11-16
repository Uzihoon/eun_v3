// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { createElement } from 'react';
import { File } from 'node:buffer';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { deleteDB } from 'idb';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Workspace from '../src/components/Workspace';
import { reportStore } from '../src/lib/report-store';
import sample from './fixtures/sample-report.json';

vi.mock('../src/auth/AuthProvider', () => ({ useAuth: () => ({
  user: { uid: 'history-test-owner', email: 'history@example.test', name: 'Test Researcher', verified: true },
  verify: async () => {}, logout: async () => {},
}) }));
vi.mock('../src/auth/firebase', () => ({ localAuth: true }));
beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); });
afterEach(async () => { cleanup(); vi.restoreAllMocks(); await deleteDB('eun-local-results'); });

it('restores a saved report directly at its existing report URL', async () => {
  await reportStore.save('history-test-owner', { ...sample, id: 'previous-run', name: 'Yesterday’s analysis', createdAt: '2026-11-15T22:00:00.000Z' });
  window.location.hash = '/report/previous-run';
  render(createElement(Workspace));
  await screen.findByRole('heading', { name: 'Your results, in focus.' });
  expect(screen.getByText('Yesterday’s analysis')).toBeTruthy();
  expect(screen.getByText('Saved on this device')).toBeTruthy();
  const reference = screen.getByRole('region', { name: 'Reference amplicon' });
  expect(within(reference).getByLabelText('Reference amplicon sequence')).toBeTruthy();
});

it('enables local saving, imports JSON, restores it after reopening, and confirms removal', async () => {
  window.location.hash = '/settings';
  const view = render(createElement(Workspace));
  const toggle = await screen.findByRole('switch', { name: 'Save results on this device' });
  expect(toggle.getAttribute('aria-checked')).toBe('false');
  fireEvent.click(toggle);
  await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'));
  fireEvent.click(screen.getByRole('link', { name: 'Results history', exact: true }));
  const input = await screen.findByLabelText('Import JSON report');
  fireEvent.change(input, { target: { files: [new File([JSON.stringify(sample)], 'Previous experiment.json', { type: 'application/json' })] } });
  await screen.findByRole('heading', { name: 'Your results, in focus.' });
  await screen.findByText('Saved on this device');
  const savedPath = window.location.hash;
  view.unmount();
  render(createElement(Workspace));
  await screen.findByRole('heading', { name: 'Your results, in focus.' });
  expect(window.location.hash).toBe(savedPath);
  expect(screen.getByText('Previous experiment')).toBeTruthy();
  fireEvent.click(screen.getByRole('link', { name: 'Results history', exact: true }));
  const remove = await screen.findByRole('button', { name: 'Remove Previous experiment' });
  fireEvent.click(remove);
  expect(screen.getByText(/Remove this result and its saved copy from this browser/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel removal' }));
  expect(screen.getByRole('button', { name: 'Open Previous experiment' })).toBeTruthy();
  fireEvent.click(remove);
  fireEvent.click(screen.getByRole('button', { name: 'Confirm removal' }));
  await screen.findByRole('heading', { name: 'A clean slate.' });
  expect((await reportStore.load('history-test-owner')).reports).toHaveLength(0);
});
