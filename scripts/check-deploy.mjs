import { loadEnv } from 'vite';
const env = { ...loadEnv('production', process.cwd(), ''), ...process.env };
const keys = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID'];
const missing = keys.filter(key => !env[key]?.trim());
if (missing.length || env.VITE_FIREBASE_PROJECT_ID?.startsWith('demo-')) {
  console.error(`Production authentication is not configured. Set ${missing.length ? missing.join(', ') : 'a real Firebase project'} before deploying. See docs/DEPLOYMENT.md. No credentials have been printed.`);
  process.exit(1);
}
console.log('Production Firebase configuration is present. Building with emulator access disabled.');
