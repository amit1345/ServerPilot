import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { I18nProvider } from './lib/i18n';
import { SessionProvider, useSession } from './context/SessionContext';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import { Shell } from './components/Shell';
import { ErrorState, Spinner } from './components/ui';
import { AuthPage } from './pages/AuthPage';
import { CreateWorkspaceModal, CreateWorkspacePage } from './pages/CreateWorkspace';
import { Dashboard } from './pages/Dashboard';
import { Reports } from './pages/Reports';
import { Staff } from './pages/Staff';
import { ServerSettings } from './pages/ServerSettings';
import { Account } from './pages/Account';

function WorkspaceGate() {
  const { workspaces, current, loading, error, refresh } = useWorkspace();
  const [creating, setCreating] = useState(false);

  if (loading && !workspaces.length) return <div className="center-screen"><Spinner /></div>;
  if (error && !workspaces.length) return <div className="center-screen"><ErrorState message={error} onRetry={() => void refresh()} /></div>;
  if (!current) return <CreateWorkspacePage />;

  return (
    <>
      <Routes>
        {/* key remounts pages when switching workspace so no data leaks between them */}
        <Route element={<Shell key={current.id} onCreateWorkspace={() => setCreating(true)} />}>
          <Route index element={<Dashboard />} />
          <Route path="reports" element={<Reports />} />
          <Route path="staff" element={<Staff />} />
          <Route path="server" element={<ServerSettings />} />
          <Route path="account" element={<Account />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      {creating && <CreateWorkspaceModal onClose={() => setCreating(false)} />}
    </>
  );
}

function Root() {
  const { ready, session } = useSession();
  if (!ready) return <div className="center-screen"><Spinner /></div>;

  if (session.kind === 'none') {
    return (
      <Routes>
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/register" element={<Navigate to="/" replace />} />
      <Route path="/*" element={<WorkspaceProvider key={session.kind === 'user' ? session.userId : 'demo'}><WorkspaceGate /></WorkspaceProvider>} />
    </Routes>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <SessionProvider>
          <Root />
        </SessionProvider>
      </BrowserRouter>
    </I18nProvider>
  );
}
