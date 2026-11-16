import { Component, lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { AuthPage } from './pages/AuthPage';
import { Spinner } from './components/ui';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/instrument-serif/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './styles.css';
const Workspace = lazy(() => import('./components/Workspace'));
function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen"><Spinner/> Checking your session…</div>;
  if (!user?.verified) return <AuthPage/>;
  return <Suspense fallback={<div className="loading-screen"><Spinner/> Opening your workspace…</div>}><Workspace key={user.uid}/></Suspense>;
}
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="empty-state"><h1>Something interrupted this page.</h1><p>Reload to try again. Unsaved results will be cleared.</p><button className="button primary" onClick={() => window.location.reload()}>Reload EUN</button></div> : this.props.children; }
}
createRoot(document.getElementById('root')!).render(<ErrorBoundary><AuthProvider><App/></AuthProvider></ErrorBoundary>);
