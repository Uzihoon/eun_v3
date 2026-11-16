# Verification record

Checked November 15, 2026, using Node 24 and the original source checkouts beside `eun_v3`.

## Executed

- **43 automated tests passed**: input validation, original JSON import, original engine hashes, original INDEL and conversion parity, bounded worker concurrency/cancellation/error cleanup, sample downloads over HTTP, actual JSON/Excel/ZIP export contents, Firebase Authentication emulator integration, and local result storage/history.
- **Local history checks**: eight IndexedDB repository tests, six React hook tests, and two workspace DOM integration tests cover default-off saving, exact JSON restoration, account isolation, atomic quota-failure rollback, keeping old results when disabled, manual saving/removal, import, and reopening a saved report URL. These use fake-indexeddb and JSDOM, not a live browser.
- **Production TypeScript check and Vite build passed.** ExcelJS is a large, lazy-loaded export chunk; it is requested only when exporting Excel.
- **Production dependency audit: 0 known vulnerabilities.** Firebase CLI development dependencies still have 14 moderate transitive audit advisories. They are not shipped in the static application; no downgrade or forced incompatible fix was applied.
- **Full original sample parity**: executed both V3's copied worker and the original checkout worker with the original four FASTQ.GZ files. The entire returned result structures matched, not only the counts.
- **Sample download regression fixed**: Vite serves `.gz` assets with `Content-Encoding: gzip`; fetch automatically decompresses them. The loader previously retained the `.gz` filename, causing the engine to decompress plain FASTQ again. The regression test reproduced the reported error before the fix. The loader now checks the downloaded bytes and uses `.fastq` for decoded files. Real HTTP tests cover compressed and decoded responses, missing files, and HTML fallbacks; both decoded sample analyses match the full original results. The earlier direct-file engine tests did not cover this HTTP boundary.
- Production deploy validation rejects missing Firebase configuration. Building in emulator mode rejects the build. The normal production build has no authentication bypass.
- The original `eun` and `eun_v2` checkouts remain unmodified. Application source and runtime dependencies contain no AWS integration.

| Sample | Joined reads | Both indicators | Retained reads | Insertions | Deletions | Desired changes | Alignment rows |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Sample-ID-71_S71 | 105,785 | 15,573 | 14,568 | 0 | 582 | 9,089 | 335 |
| Sample-ID-72_S72 | 79,667 | 14,822 | 13,819 | 0 | 720 | 7,927 | 336 |

Golden sample hashes are recorded in `scripts/verify-engine.mjs`. These tests verify preservation of the legacy calculations; they do not independently validate the scientific method.

## Not yet executed

- **Browser/visual QA**: the suite in `tests/browser/workflows.spec.ts` has not been run because automated browser access was unavailable in the development environment. It includes saved-history restoration after reload/login and desktop/mobile sticky reference bounds. Rendered appearance, scroll behavior, browser storage, download clicks, and browser worker integration still need verification in a browser.
- **Production Firebase and hosting**: no Firebase/Cloudflare project configuration was supplied. No cloud resources were created, no live verification/reset emails were sent, and no deployment was made. The official local Firebase emulator was used to verify signup, wrong-password rejection, email verification, sign-in, password reset, and logout.

## Compatibility notes

- Original ambiguous-base complement behavior is retained: bases outside A/C/G/T and gaps, including N, are omitted. This is called out in the conversion UI. Do not silently change it without a scientific migration decision.
- Duplicate sample IDs are rejected during merge to avoid the original silent overwrite. Original format/summary metadata still comes from the final input report.
- Original scientific workers are unmodified. Input validation, bounded scheduling, cancellation, and presentation are new adapters around them.
- Results history combines current-session reports and saved JSON records in account-scoped IndexedDB. Automatic saving is off by default; enabling it also saves current reports. Disabling it preserves old records. Signing out, refreshing, or closing the page clears only unsaved results. Saved history remains local to the same browser, origin, and Firebase UID; it is not cloud storage or encryption. JSON files remain the portable backup path.

## Reproduce

```sh
npm ci
npm run dev
# In a second terminal, with the auth emulator running:
RUN_AUTH_TESTS=1 npm test
node scripts/verify-engine.mjs --compare-original
npm run build
npm audit --omit=dev
# Once browser testing is permitted:
npx playwright install chromium
npm run test:e2e
```
