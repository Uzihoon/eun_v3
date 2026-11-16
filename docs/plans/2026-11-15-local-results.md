# Local results and pinned reference implementation plan

**Goal:** Let signed-in users opt into saving results locally for later review and keep the reference amplicon visible while scrolling through a report.

**Architecture:** Store original-compatible JSON reports and display metadata in IndexedDB, scoped to the signed-in Firebase UID. A settings preference controls automatic saves and defaults off. Keep unsaved reports in memory when storage is unavailable. Existing JSON import/export remains the portable backup path. Apply sticky positioning only to the report's reference amplicon panel, with bounded height and keyboard-accessible sequence scrolling.

**Tech stack:** React, TypeScript, IndexedDB via idb; Vitest, fake-indexeddb and React Testing Library for persistence and component regression tests.

## 1. Durable report storage

- Add `src/lib/report-store.ts` and `tests/report-store.test.ts`.
- First test default-off behavior, exact JSON round trips after reopening storage, per-account preferences and report isolation, enabling with existing reports, disabling without deletion, removal, and transaction failure.
- Implement atomic preference/report writes, explicit manual saves, and helpful errors without deleting existing records.
- Run the targeted tests before and after implementation.

## 2. Settings and result history

- Add `src/hooks/useReports.ts`, `src/pages/SettingsPage.tsx`, and `src/pages/HistoryPage.tsx`.
- Load saved reports before resolving report links. Show saved/session status, dated history, JSON import/export, individual save and removal with a confirmation step.
- Add Settings navigation and change This session to Results history in `Workspace.tsx`.
- Save completed analyses and imported JSON when the preference is enabled; save current reports when enabling it. Keep old saved reports when disabling it. Logout clears active UI but preserves local saved records for that account.
- Cover restoration, toggling, failed writes, and account changes in component/hook tests.
- Update report save messages, help, and README to describe real retention behavior and browser-data limits.

## 3. Pinned reference

- Label the reference region in `ReportPage.tsx` and add sticky/bounded-height styles in `styles.css`.
- Keep sequence colors, selection, and copy behavior; allow scrolling long sequences without covering the entire viewport.
- Add browser regression assertions for sticky bounds at desktop/mobile widths; execute when the browser permission gate allows it. Do not bypass the existing browser policy denial.

## 4. Verify and deliver

- Run storage/component tests, the full test suite including local authentication, and the production build.
- Keep original scientific workers and sample assets unchanged.
- Update `docs/VERIFICATION.md` with executed checks and the remaining visual-testing limitation.
- Leave the user's running preview and test account available.
