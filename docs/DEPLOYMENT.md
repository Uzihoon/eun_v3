# Deploy EUN V3 with Vercel, Firebase, and GA4

Use Vercel **Hobby**, Firebase **Spark**, and standard **Google Analytics 4**. Do not enable a Pro trial, Blaze billing, paid databases, server functions, SMS sign-in, BigQuery exports, or Vercel Analytics. Scientific analysis and result storage run on the user's device.

## Production accounts

- Firebase project: `eun-v3-uzihoon`, display name **EUN V3**.
- Firebase Web app: **EUN V3 Web**.
- Source: [Uzihoon/eun_v3](https://github.com/Uzihoon/eun_v3), production branch `codex/eun-v3`.
- Vercel: [eun-v3](https://vercel.com/uzihoon/eun-v3), project `prj_qL2ysUH1ZGIVp0quzk2WdGOFxLao`, in the `uzihoon` Hobby workspace.
- GA4: property `564411466`, Web stream `16349169498`, measurement ID `G-KGHMZ1XTLY`, linked to Firebase under **Default Account for Firebase**.
- [Firebase accounts](https://console.firebase.google.com/project/eun-v3-uzihoon/authentication/users) · [GA4 administration](https://analytics.google.com/analytics/web/#/a164059888p564411466/admin).

## Firebase Authentication

1. Keep the project on Spark, with no billing account attached.
2. In Authentication, enable **Email/Password**. Require verified email before opening EUN; the application already enforces this.
3. Add the actual production Vercel hostname under **Authentication → Settings → Authorized domains**. Keep the default Firebase action-handler domains.
4. Firebase's hosted verification/reset action handler handles email links. No email server is needed.
5. Firebase Authentication's Users view is the source for account identities and latest sign-in times. GA4 is usage analytics, not a complete login audit log.

## GA4

Link a standard GA4 property to the Firebase project and create a Web data stream for the production URL. Copy its `G-…` measurement ID into the Vercel production environment.

- Disable **Enhanced measurement** for the Web stream. EUN sends its own sanitized page views and events; automatic form, link, download, and history collection could capture file names or report identifiers.
- Leave Google Signals, advertising features, and optional data sharing off. Do not link advertising products or BigQuery.
- Use the user's reporting timezone, `America/Vancouver`.
- The app loads the Google tag only after the user chooses **Allow analytics**. Declining still permits all EUN features. Preferences can be changed from **Privacy & analytics** or **Settings → Usage analytics**.
- Signed-in events use the Firebase UID, not an email or name. EUN sends category-only page locations, without report IDs or query strings. It excludes sequencing files, reference sequences, report names, scientific results, and raw error messages.
- The analytics cookie is limited to the deployment hostname. Withdrawal disables collection and removes those cookies. It does not erase events already collected.
- Local development and preview deployments do not collect analytics.

### Events

| Event | Allowed details |
| --- | --- |
| `page_view` | Predefined page category and title |
| `sign_up`, `login` | Password sign-in method |
| `logout` | No custom details |
| `analysis_started`, `analysis_cancelled` | Sample or user-file mode |
| `analysis_completed` | Mode, sample count, duration |
| `analysis_failed` | Mode and fixed stage: authentication/preparation/processing |
| `report_imported` | Import page and number of reports |
| `report_exported` | JSON, Excel, PNG, or ZIP |
| `result_saved` | Manual or automatic |
| `storage_preference_changed` | On/off |
| `conversion_completed` | Number of conversion operations |

Reports appear in GA4 **Realtime** first; standard reports may take 24–48 hours. Country/city are approximate. Declined consent, blockers, and network failures can make usage counts incomplete. For user-level exploration, use GA4's User explorer and internal IDs; account emails stay in Firebase Authentication.

## Vercel

Import the GitHub repository into the existing Hobby workspace. Use the repository root, not an `eun_v3` subdirectory.

| Setting | Value |
| --- | --- |
| Framework | Vite |
| Production branch | `codex/eun-v3` |
| Build | `npm run build:deploy` |
| Output | `dist` |
| Install | `npm ci` |
| Node | 24.x |

Set these public browser configuration variables for the deployment:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_GA4_MEASUREMENT_ID`

Vercel's `VERCEL_ENV` determines whether analytics can run. The build fails if authentication or the GA4 measurement ID is missing. Never put Admin SDK credentials, OAuth tokens, or GA4 Measurement Protocol secrets in Vite variables or the repository.

`vercel.json` configures the build and security headers. Hash routes work without server rewrites. Use the supplied `vercel.app` hostname for zero domain-registration cost. JSON export/import moves saved results between the local preview and deployed origin.

## Free-plan limits checked November 15, 2026

- [Vercel Hobby](https://vercel.com/docs/plans/hobby): 100 GB fast data transfer and 1 million CDN requests per month. Hobby is for [personal or noncommercial use](https://vercel.com/legal/terms). Reaching limits can pause service; do not upgrade automatically.
- [Firebase Spark](https://firebase.google.com/pricing): no payment method required. [Authentication quotas](https://firebase.google.com/docs/auth/limits) apply to account creation and verification/reset email delivery.
- [GA4 through Firebase](https://firebase.google.com/docs/analytics): available at no charge. No paid analytics add-on is needed.

## Release verification

Check the deployment is Ready and its public URL serves the correct build. Verify production Firebase config, authorized domains, email/password login, and the absence of emulator endpoints. Test the sample, JSON round-trip, exports, local history, and consent controls. Confirm safe events appear in GA4 Realtime after consent, and no Google tag loads before consent. Record observed results in `VERIFICATION.md`; distinguish HTTP/unit checks from real-browser checks.
