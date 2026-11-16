import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, updateProfile } from 'firebase/auth';
import { ArrowRight, ArrowLeft, Check, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { auth, authMessage, authReady, localAuth, requireAuth } from '../auth/firebase';
import { useAuth } from '../auth/AuthProvider';
import { Logo, Notice, Spinner } from '../components/ui';
import { setAnalyticsUser, trackActivity, trackPage } from '../lib/analytics';
export function AuthPage() {
  const { user, refresh, logout } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  useEffect(() => { trackPage(user && !user.verified ? '/verify' : `/${mode}`); }, [mode, user?.verified, user?.uid]);
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [name, setName] = useState('');
  const [show, setShow] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [info, setInfo] = useState('');
  const changeMode = (next: typeof mode) => { setMode(next); setError(''); setInfo(''); setPassword(''); };
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setInfo(''); setBusy(true);
    try {
      await authReady;
      const client = requireAuth();
      if (mode === 'signup') {
        const result = await createUserWithEmailAndPassword(client, email.trim(), password);
        setAnalyticsUser(result.user.uid); trackActivity('sign_up', { method: 'password' });
        await updateProfile(result.user, { displayName: name.trim() });
        await sendEmailVerification(result.user);
        await refresh();
      } else if (mode === 'reset') {
        await sendPasswordResetEmail(client, email.trim());
        setInfo('If an account exists for this email, you’ll receive a password reset link.');
      } else { const result = await signInWithEmailAndPassword(client, email.trim(), password); setAnalyticsUser(result.user.uid); trackActivity('login', { method: 'password' }); }
    } catch (e) { setError(authMessage(e)); } finally { setBusy(false); }
  };
  const verifyEmail = async () => {
    setBusy(true); setError('');
    try { if (!(await refresh())) setError('Your email is not verified yet. Open the link in your email, then try again.'); }
    catch (e) { setError(authMessage(e)); } finally { setBusy(false); }
  };
  const resend = async () => {
    setBusy(true); setError('');
    try { if (auth?.currentUser) await sendEmailVerification(auth.currentUser); setInfo('A new verification link has been sent.'); }
    catch (e) { setError(authMessage(e)); } finally { setBusy(false); }
  };
  return <div className="auth-page"><aside className="auth-story"><Logo light/><div className="auth-story-main"><div className="story-kicker">CRISPR analysis, thoughtfully refined</div><h1>A clearer view<br/>of every edit<span>.</span></h1><p>From paired reads to meaningful results.<br/>A focused workspace for your next discovery.</p><div className="sequence-illustration" aria-label="Illustration of a single nucleotide edit"><div className="sequence-caption"><span>ANATOMY OF AN EDIT</span><span>5′ → 3′</span></div><div className="base-row">{'TCAGAAAGTG'.split('').map((s, i) => <span key={i} className={i === 5 ? 'base-target' : ''}>{s}</span>)}</div><div className="base-links">{'TCAGAAAGTG'.split('').map((_, i) => <span key={i} className={i === 5 ? 'edit-link' : ''}>{i === 5 ? '↓' : '│'}</span>)}</div><div className="base-row secondary">{'TCAGAGAGTG'.split('').map((s, i) => <span key={i} className={i === 5 ? 'base-edit' : ''}>{s}</span>)}</div><div className="illustration-label"><span className="tiny-line"/> One base. A meaningful change.</div></div></div><div className="auth-story-footer"><LockKeyhole size={15}/><span>Your sequencing files stay in your browser.</span></div></aside>
    <main className="auth-main"><div className="auth-top"><span>Built for research.</span><span>EUN / 03</span></div><div className="auth-form-wrap">
      {user && !user.verified ? <><div className="verification-icon"><Mail size={28}/></div><h2>Check your inbox.</h2><p className="auth-description">Verify <strong>{user.email}</strong> to open your workspace. Follow the link in your email, then return here.</p>{error && <Notice error>{error}</Notice>}{info && <Notice>{info}</Notice>}<button className="button primary full" disabled={busy} onClick={verifyEmail}>{busy ? <Spinner/> : <Check size={18}/>} I’ve verified my email</button><button className="button secondary full" disabled={busy} onClick={resend}>Resend verification email</button><button className="text-button back-link" disabled={busy} onClick={() => void logout().catch(e => setError(authMessage(e)))}><ArrowLeft size={15}/> Back to sign in</button></> : <>
        <div className="auth-eyebrow">YOUR RESEARCH WORKSPACE</div><h2>{mode === 'login' ? 'Welcome back.' : mode === 'signup' ? 'Make room for discovery.' : 'Let’s get you back in.'}</h2><p className="auth-description">{mode === 'login' ? 'Sign in to continue your analysis.' : mode === 'signup' ? 'Create your free EUN account to get started.' : 'We’ll email you a link to reset your password.'}</p>
        {mode === 'login' && <Notice>Accounts from the original EUN haven’t been transferred to EUN V3. Please create a new account.</Notice>}
        {!auth && <Notice>Sign-in isn’t connected yet. The workspace will be available once account setup is complete.</Notice>}
        <form onSubmit={submit}>{mode === 'signup' && <div className="field"><label htmlFor="name">Name</label><input id="name" autoComplete="name" required maxLength={80} placeholder="Your name" value={name} onChange={e => setName(e.target.value)}/></div>}<div className="field"><label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="email" required placeholder="you@yourlab.org" value={email} onChange={e => setEmail(e.target.value)}/></div>
        {mode !== 'reset' && <div className="field"><div className="label-row"><label htmlFor="password">Password</label>{mode === 'login' && <button type="button" className="text-button" onClick={() => changeMode('reset')}>Forgot password?</button>}</div><div className="password-input"><input id="password" type={show ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={mode === 'signup' ? 8 : 1} maxLength={128} placeholder={mode === 'signup' ? 'At least 8 characters' : 'Enter your password'} value={password} onChange={e => setPassword(e.target.value)}/><button type="button" className="icon-button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></div>}
        {error && <Notice error>{error}</Notice>}{info && <Notice>{info}</Notice>}<button className="button primary full" disabled={!auth || busy}>{busy ? <Spinner/> : null}{mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}{!busy && <ArrowRight size={17}/>}</button></form>
        <div className="auth-switch">{mode === 'login' ? <>New to EUN V3? <button className="text-button" onClick={() => changeMode('signup')}>Create an account</button></> : <button className="text-button" onClick={() => changeMode('login')}><ArrowLeft size={14}/> Back to sign in</button>}</div>
        <div className="auth-privacy"><LockKeyhole size={15}/><p>Analysis happens on your device.<br/>Your sequencing data is never uploaded.</p></div>
      </>}
      {localAuth && <div className="local-note">Local preview · test accounts only<br/>Verification and reset links appear in the auth terminal.</div>}
    </div><footer className="auth-footer"><span>Understand your edits.</span><span>EUN · CRISPR / Cas</span></footer></main>
  </div>;
}
