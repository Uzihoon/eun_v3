# Original EUN → V3 behavior map

Original repository revision: `19072d41fcf4ff63411783208fca67b03b37751b`.
V2 reference revision: `f0cfeac8f0533ea09cf3dae720e86004963741e5`.

| Original source | Responsibility | V3 counterpart |
| --- | --- | --- |
| `src/store/saga/upload.js` | Normalize sequences, regex filename grouping, fixed engine parameters | `src/lib/science.ts`: `prepareAnalysis` |
| `src/components/containers/UploadContainer.js` | Spawn workers, progress, import JSON, sample entry point | `src/lib/runner.ts`, `src/pages/AnalysisPage.tsx` |
| `public/worker.js` | FASTQ join, indicator matching, sequence alignment, read filtering, edit counts, target-frequency matrix | `public/engine/worker.js`, unchanged |
| `public/pako.js` | Gzip decompression for reads | `public/engine/pako.js`, unchanged |
| `src/store/saga/analysis.js` | Original paired sample files and parameters | `public/samples/`, `SAMPLE_FORM`, `loadSampleFiles` |
| `src/components/Analysis/Analysis.js` | Per-sample report and sequence visualization | `src/pages/ReportPage.tsx` |
| `src/worker/analysis.worker.js`, `src/components/Excel/Excel.js` | Workbook data and download | `src/lib/export.ts`: `exportExcel` |
| `src/worker/indel.worker.js` | Equal-weight INDEL averaging per uploaded report | `src/lib/science.ts`: `buildIndel`, tested against original |
| `src/components/containers/IndelContainer.js` | Chart, cleavage marker, zoom and PNG export | `src/pages/IndelPage.tsx` |
| `src/store/saga/convert.js` | Ordered reverse/complement/merge transformations and ZIP | `convertReports`, `exportZip`, tested against original |
| `src/lib/PrivateRouter.js`, login/signup containers, state saga | Cognito auth, verification, guest access | `src/auth/`, `src/pages/AuthPage.tsx`; replaced with required Firebase verified auth, no guest |
| `src/components/List/List.js` | Empty, unfinished analysis list | `HistoryPage.tsx`, `useReports.ts`, and `report-store.ts`: session reports plus optional local JSON history |
| `src/components/Info/Info.js`, `src/lib/history.json` | Guide and changelog | `src/pages/GuidePage.tsx`, copied history |

V2 showed an intended move to TypeScript, separated form fields, an analyzer/report split, MUI/Emotion styling, and contextual help. Its converter and INDEL views were incomplete. V3 takes the separation and help intent but uses an independent visual design and the original EUN behavior as its reference.

The original worker's fastq-join attribution and license notice remain in the copied source. Third-party libraries are installed via npm with their own licenses; fonts are served locally via Fontsource.
