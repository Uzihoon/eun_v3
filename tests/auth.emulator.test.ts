import { describe, it, expect } from 'vitest';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, reload, signOut, sendPasswordResetEmail, deleteUser } from 'firebase/auth';

describe.skipIf(process.env.RUN_AUTH_TESTS !== '1')('Firebase Authentication emulator integration', () => {
  it('enforces passwords, verifies accounts, restores login, resets passwords, and signs out', async () => {
    const app = initializeApp({ projectId: 'demo-eun-v3', apiKey: 'demo-eun-v3' }, `test-${Date.now()}`);
    const auth = getAuth(app);
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    const email = `unit-${Date.now()}@example.test`;
    const password = 'Test-only-EUN-123!';
    try {
      await expect(signInWithEmailAndPassword(auth, email, 'wrong')).rejects.toThrow();
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      expect(user.emailVerified).toBe(false);
      await sendEmailVerification(user);
      const { oobCodes } = await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-eun-v3/oobCodes').then(r => r.json());
      const code = oobCodes.find((c: { email: string; requestType: string }) => c.email === email && c.requestType === 'VERIFY_EMAIL');
      expect(code).toBeTruthy();
      const confirmed = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update?key=demo-eun-v3', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ oobCode: code.oobCode }) });
      expect(confirmed.ok).toBe(true);
      await reload(user);
      expect(user.emailVerified).toBe(true);
      expect(await user.getIdToken(true)).toBeTruthy();
      await signOut(auth);
      expect(auth.currentUser).toBe(null);
      await expect(signInWithEmailAndPassword(auth, email, 'wrong-password')).rejects.toThrow();
      const loggedIn = await signInWithEmailAndPassword(auth, email, password);
      expect(loggedIn.user.emailVerified).toBe(true);
      await sendPasswordResetEmail(auth, email);
      const codes = await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-eun-v3/oobCodes').then(r => r.json());
      const reset = codes.oobCodes.find((c: { email: string; requestType: string }) => c.email === email && c.requestType === 'PASSWORD_RESET');
      expect(reset).toBeTruthy();
      const changed = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=demo-eun-v3', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ oobCode: reset.oobCode, newPassword: 'Test-only-Updated-123!' }) });
      expect(changed.ok).toBe(true);
      await signOut(auth);
      await expect(signInWithEmailAndPassword(auth, email, password)).rejects.toThrow();
      const updated = await signInWithEmailAndPassword(auth, email, 'Test-only-Updated-123!');
      await deleteUser(updated.user);
      expect(auth.currentUser).toBe(null);
    } finally { await deleteApp(app); }
  }, 20000);
});
