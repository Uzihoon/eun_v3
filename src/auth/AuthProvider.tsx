import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged, reload, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth, authReady, requireAuth } from './firebase';
import { setAnalyticsUser, trackActivity } from '../lib/analytics';
interface Identity { uid: string; email: string; name: string; verified: boolean }
interface AuthState { user: Identity | null; loading: boolean; refresh: () => Promise<boolean>; verify: () => Promise<void>; logout: () => Promise<void> }
const AuthContext = createContext<AuthState | null>(null);
const identity = (user: User): Identity => ({ uid: user.uid, email: user.email ?? '', name: user.displayName ?? '', verified: user.emailVerified });
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(!!auth);
  useEffect(() => { setAnalyticsUser(user?.uid ?? null); }, [user?.uid]);
  const refresh = useCallback(async () => {
    const current = auth?.currentUser;
    if (!current) { setUser(null); return false; }
    try {
      await reload(current); await current.getIdToken(true);
      if (auth?.currentUser?.uid !== current.uid) return false;
      setUser(identity(current)); return current.emailVerified;
    } catch { setUser(null); await signOut(requireAuth()).catch(() => {}); return false; }
  }, []);
  useEffect(() => {
    if (!auth) return;
    let live = true;
    let revision = 0;
    const unsubscribe = onAuthStateChanged(auth, async current => {
      const version = ++revision;
      await authReady;
      if (current) {
        try { await reload(current); await current.getIdToken(); }
        catch { if (live && version === revision) { setUser(null); setLoading(false); } return; }
      }
      if (live && version === revision) { setUser(current ? identity(current) : null); setLoading(false); }
    });
    const focus = () => { if (auth?.currentUser) void refresh(); };
    window.addEventListener('focus', focus);
    const timer = window.setInterval(focus, 5 * 60 * 1000);
    return () => { live = false; unsubscribe(); window.removeEventListener('focus', focus); clearInterval(timer); };
  }, [refresh]);
  const verify = useCallback(async () => { if (!(await refresh())) throw new Error('Please sign in with a verified account to continue.'); }, [refresh]);
  const logout = useCallback(async () => { await signOut(requireAuth()); trackActivity('logout', {}); setAnalyticsUser(null); setUser(null); }, []);
  return <AuthContext.Provider value={{ user, loading, refresh, verify, logout }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('Missing auth provider'); return context; }
