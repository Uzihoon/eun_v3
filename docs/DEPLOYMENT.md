# Deploy EUN V3 for $0 within free-tier quotas

## 1. Firebase Authentication (Spark)

1. Create a Firebase project in the Firebase console. Keep the **Spark / no-cost plan**. A billing account or payment method is not required. Analytics is unnecessary for this app.
2. Register a Web app. Copy `apiKey`, `authDomain`, `projectId`, and `appId` from its public Firebase config into the corresponding variables in `.env.example`. Save as `.env.local` for local cloud testing. These are public app identifiers; never put Admin SDK/service-account credentials in Vite variables.
3. In **Authentication → Sign-in method**, enable **Email/Password**. No SMS provider is used.
4. In **Authentication → Settings → Authorized domains**, add your actual `PROJECT.pages.dev` hostname and any custom domain. Add `localhost` and `127.0.0.1` only if you want to test the cloud project locally; the emulator needs neither.
5. Customize verification and password-reset email templates as desired. Firebase's hosted action handler processes links, so this app does not need an email server. Users return to EUN after verification and click **I’ve verified my email**.
6. Keep the browser API key restricted to the Firebase services required by Auth, following Firebase's API-key guidance. Configure password policy and email-enumeration protection in Firebase as appropriate. The UI requires at least 8 characters for new passwords.

## 2. Cloudflare Pages (Free)

Connect the source repository to a new **Pages** project on the free plan. If this folder is in a monorepo, set the root directory to `eun_v3`; if it is its own repository, use the repository root.

| Setting | Value |
| --- | --- |
| Framework | Vite |
| Build command | `npm run build:deploy` |
| Build output | `dist` |
| Node version | `24` (24.12 or newer) |
| Environment variables | `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` |

The deploy build fails if Firebase config is missing or points to a `demo-` project. Pages serves the generated assets with the provided redirect and security-header files. No Pages Functions, Workers, database, file bucket, Cognito, S3 or CloudFront are required.

All navigation uses hash routes, so returning to a report or tool works with static hosting. A report URL resolves while the report is open in the current session or saved locally for the signed-in account. Local history is stored in IndexedDB on that origin; use JSON export/import to move reports between the local preview, the deployed site, or another device.

## Limits checked on November 15, 2026

- [Cloudflare Pages](https://developers.cloudflare.com/pages/functions/pricing/): static asset requests are free and unlimited; this app uses only static assets.
- [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/): Free has 500 builds/month, 20,000 files/site, and 25 MiB maximum per asset. The largest included sample is about 6 MiB.
- [Firebase Spark pricing](https://firebase.google.com/pricing): no payment method required; authentication is available without a paid backend.
- [Firebase Auth limits](https://firebase.google.com/docs/auth/limits): quotas apply to account creation and verification/reset email sending. Authentication with Identity Platform on Spark has a 3,000 daily active-user limit for Tier 1 providers. Keep an eye on the console's quota panel; do not enable paid upgrades to avoid reaching a limit.
- Ordinary domain registration is separate. Use the free Pages subdomain if the target is zero recurring cost.

## Before sharing the production URL

- Confirm Spark and Pages Free are still selected.
- Create an account with a real email you control, verify the email, sign in, sign out, and reset its password.
- Open `#/analysis`, `#/indel` and `#/convert` in a signed-out browser; all must show login.
- Run the EUN sample, export/reimport JSON, export Excel, generate the INDEL PNG, and download a conversion ZIP.
- Confirm the deployed site never says **Local preview** and makes no requests to port 9099.

An active Firebase session is required to use the UI. All scientific computations run locally. There is no cloud API for scientific data. Reads are never persisted. Users can opt into automatic local saving of JSON reports in Settings; it is off by default. Saved reports and preferences are scoped to the Firebase UID. This UI separation is not encryption or protection from someone with access to the browser profile; JSON backups remain recommended.
