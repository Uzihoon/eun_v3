# Vercel deployment and activity analytics

**Goal:** Deploy EUN on Vercel Hobby with Firebase Spark authentication and free GA4 activity reporting.

**Approved direction:** Vercel + Firebase + GA4, as requested on November 15, 2026. Preserve browser-only scientific analysis and local result storage. No paid services, billing upgrades, cloud data storage, or custom domain purchases.

**Architecture:** Serve the existing Vite build as static assets. Load the Google tag only after optional analytics consent. Send predefined page categories and operational events, with Firebase UID for signed-in users. Never send account emails, names, report identifiers, file names, sequences, or raw error messages. Disable advertising features and enhanced automatic measurement. Keep user-controlled consent available on login and in Settings.

**Tech stack:** React, TypeScript, Vite, Firebase Authentication, GA4 Google tag, Vitest, Vercel static hosting.

## Implementation and verification

1. Add tests for consent, opt-out, sanitized navigation, account identity changes, event validation, and disabled local/preview tracking. Run the focused tests before implementation.
2. Implement the analytics module and consent UI. Instrument successful login/signup, analysis start/completion/failure/cancellation, imports, exports, conversions, and local saves. Check event payloads contain only allowed values.
3. Add Vercel configuration with the guarded production build, Node 24, security headers, and ignored local deployment state. Document public configuration and owner dashboard access.
4. Run focused tests, existing tests, type checking, production build, and production dependency audit. Review the exact diff and public commit contents.
5. Verify connected accounts and free plans. Create the Firebase project/web app and GA4 property/stream; enable email/password, configure authorized domains and analytics settings. Create the Vercel Git project with public build variables. Push and deploy.
6. Verify deployment status, public HTTP assets and sample gzip behavior, login configuration, and analytics collection where browser/account access permits. Record actual deployment identifiers and any remaining user-only authentication steps. Never describe an unverified deployment or analytics flow as complete.

Production configuration requires Firebase API key, auth domain, project ID, app ID, and GA4 measurement ID. These browser identifiers are public; no service-account credentials or measurement-protocol secrets belong in the bundle or repository.
