# Verification record

Checked November 15, 2026, using Node 24 and the original source checkouts beside `eun_v3`.

## Executed

- **51 automated tests passed** with `RUN_AUTH_TESTS=1 npm test`: input validation, original JSON import, original engine hashes, original INDEL and conversion parity, bounded worker concurrency/cancellation/error cleanup, sample downloads over HTTP, actual JSON/Excel/ZIP export contents, Firebase Authentication emulator integration, local result storage/history, and analytics privacy controls.
- **Analytics checks**: eight tests cover no collection before consent, sanitized page locations and event payloads, privacy defaults applied before tag initialization, withdrawal and cookie cleanup, clearing account identity at logout, disabled preview tracking, rejecting unknown events/invalid values, and unavailable local storage. These validate the app's Google tag commands; GA4 receipt was checked separately below.
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

## Live production verification

- [eun-v3.vercel.app](https://eun-v3.vercel.app/) is publicly available on Vercel. Deployment `dpl_FEegSKcAzy9xXxTd8V6Dug9NvNZW` reached **Ready**, serving application commit `8663fe972cb30b3f601165395de5b00d506c8f0d`. The Git connection points to `Uzihoon/eun_v3`, and production branch tracking is set to `codex/eun-v3`.
- Vercel's workspace shows **Hobby**. Firebase project `eun-v3-uzihoon` shows **Spark**, with the billing API confirming billing disabled and no billing account attached. Email/Password is enabled, and `eun-v3.vercel.app` is an authorized domain. No paid services or Vercel Analytics were enabled.
- The public app and all four sample FASTQ.GZ files returned HTTP 200. Each downloaded sample decompresses to the same SHA-256 as its original file. The deployed bundle contains the expected Firebase/GA4 public configuration and no local auth-emulator endpoint. Security headers were checked.
- The owner created a real production account and verified the email without sharing a password. The authenticated workspace was observed, and the session survived reloads.
- In Chrome, **Run sample** completed both samples with the counts shown above. Saving a report displayed **Saved on this device**; both saved reports remained in Results history after reload, and the new report reopened correctly from its saved URL.
- **Download JSON** produced a valid report containing both samples and the expected counts. **Export Excel** produced a valid XLSX download. Automated tests separately verify export contents and JSON import/restoration.
- The reference amplicon remained sticky while scrolling: 12 px from the top on desktop and 8 px on a 390 px mobile viewport. The mobile report had no horizontal page overflow. The viewport was restored after testing.
- No Google tag loaded before analytics consent. After opting out and reloading, no Google tag loaded and the Settings switch remained off. Restoring consent loaded analytics again; automatic result saving was left off.
- GA4 Realtime received page views, analysis start/completion, saved-result, and export events. Report page locations were `https://eun-v3.vercel.app/#/report`, without report IDs. Existing setup-only automatic page views exposed a migrated Google tag initialization issue; published container version 3 now waits for EUN's on-page configuration. A subsequent report reload increased the sanitized Results count without increasing the old automatic-page-view count. All displayed page locations were reviewed; none contained report IDs or scientific data.

## Not yet executed

- The full automated browser suite in `tests/browser/workflows.spec.ts` has not been run. The manual production Chrome checks above cover the core signup, sample, storage, download, consent, and sticky-reference flows, but do not replace the entire suite.
- Production password-reset email delivery was not tested. The official Firebase emulator integration tests cover signup, wrong-password rejection, email verification, sign-in, password reset, and logout.
- Standard GA4 reports were not awaited; receipt was verified in Realtime. Consent refusal, blockers, and network failures can make usage counts incomplete.

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
