# EUN V3

[Open EUN V3](https://eun-v3.vercel.app/) · [Deployment setup](docs/DEPLOYMENT.md)

A redesigned CRISPR/Cas analysis workspace based on the original [EUN](https://github.com/Uzihoon/eun). It preserves the original sequencing engine and JSON report structure. EUN-V2 was reviewed as historical context, not used as the design template.

## Run locally

Use Node **24.12+** (Node 24 LTS is recorded in `.nvmrc`).

```sh
nvm install
nvm use
npm ci
npm run dev
```

Open http://127.0.0.1:5173. This starts Vite and the **official Firebase Authentication emulator**, with no cloud account, billing, or AWS configuration. Create a test account in the UI. The auth terminal prints its verification link; open it, then click **I’ve verified my email**. Password-reset links are also printed there. These are real emulator accounts, not a client-side login bypass. They are temporary and disappear when the emulator stops.

`npm run dev:cloud` uses your Firebase configuration from `.env.local` instead. The local emulator can only be selected in development on a loopback hostname. Production builds remove that path and refuse to build in emulator mode. An unconfigured production build stays on the login page with its form disabled.

## Included workflows

- Required verified email/password login, signup, email verification/resend, reset and logout. Sessions are checked against Firebase before work begins, on focus, and periodically; signing out unmounts and clears the workspace.
- Multi-sample paired FASTQ / FASTQ.GZ analysis, regex filename grouping, original sample runs, progress and cancellation. A maximum of two analysis workers run concurrently.
- Per-sample read counts, sequence alignments, type filters, count/length sorting, pagination, HDR, nucleotide frequencies and desired substitution frequency.
- Original-compatible JSON import/export and multi-sheet Excel exports.
- INDEL comparison, cleavage-site marker, selectable chart legend, position zoom, sequence hover, accessible data table, PNG download.
- Reverse sequence, complement nucleotide and merge conversions, in the selected order, downloaded as ZIP. Duplicate sample IDs are rejected instead of silently overwriting them.
- Results history with per-account local saving, saved/session status, search, JSON import, downloads, and confirmed removal.
- Settings for automatic local saving, off by default, plus manual Save on device for individual results.
- A reference amplicon panel that stays at the top while scrolling through results, with bounded height for long sequences.
- Analysis guide and original release history.

Reads remain in memory and are never persisted. In **Settings → Save results on this device**, enable automatic saving to keep current and future analysis/JSON reports in IndexedDB. **Results history** restores saved reports after refresh, browser restart, or login with the same account. Turning saving off preserves existing saved reports; unsaved reports remain session-only. Storage failures leave open results available and show an error instead of claiming they were saved.

Use **Download JSON** for a file backup, then **Import JSON** in Results history to reopen it on any device. Local history is specific to the browser, site address, and Firebase UID. It does not sync, is not encrypted by EUN, and can be removed by clearing site data or closing a private session. Emulator accounts receive new UIDs after being recreated, so download JSON before restarting an emulator if you need those results. There is no cloud storage or analysis API.

## Free deployment, without AWS

Use **Vercel Hobby** for static hosting, **Firebase Authentication Spark** for accounts, and **Google Analytics 4** for optional activity analytics. Use the supplied `vercel.app` hostname. Keep billing upgrades, SMS sign-in, paid compute, cloud file storage, and Vercel Analytics disabled. Free plans have quotas; Vercel Hobby is intended for personal or noncommercial projects.

See [deployment instructions](docs/DEPLOYMENT.md) for the exact account setup, environment variables, build command, free limits and verification checklist. The production Firebase project is `eun-v3-uzihoon`. See the deployment guide for current setup and verification details.

## Verify

```sh
npm test
npm run build
# With npm run dev running in another terminal:
RUN_AUTH_TESTS=1 npm test
node scripts/verify-engine.mjs
# Optional: compare the original checkout in ../eun as well:
node scripts/verify-engine.mjs --compare-original
npm run test:e2e
```

The browser suite requires Playwright Chromium (`npx playwright install chromium`). See [verification record](docs/VERIFICATION.md) for checks actually executed. Legacy analysis code and pako are retained byte-for-byte; their hashes and original provenance are checked in the unit suite. The runtime interprets malformed file errors outside that engine.

## Project layout

- `src/pages/`: redesigned tools and report views.
- `src/auth/`: Firebase client, verified-session gate and account lifecycle.
- `src/lib/`: typed report schema, scientific adapters, downloads and local report storage.
- `src/hooks/useReports.ts`: account-scoped history, save preferences and session state.
- `public/engine/`: original EUN worker and pako, unchanged.
- `public/samples/`: original paired-end example files.
- `tests/fixtures/`: original INDEL/conversion code and public sample output for regression checks.

The static site's JavaScript and public example files are downloadable, as with the original browser tool. Login gates application use; it is not DRM for public client-side code. There is no private server data or protected analysis API to expose. Any future cloud storage/API must validate Firebase tokens server-side and apply per-user access rules.

## Attribution and license

See [third-party notices](THIRD_PARTY_NOTICES.md) for the original EUN engine, sample provenance, and pako license. No project-wide reuse license has been selected for the new application code.
