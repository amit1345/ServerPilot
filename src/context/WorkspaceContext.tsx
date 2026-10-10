import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Workspace } from '../lib/types';
import { errorMessage } from '../data/api';
import { useApi } from './SessionContext';

interface WorkspaceCtx {
  workspaces: Workspace[];
  current: Workspace | null;
  loading: boolean;
  error: string | null;
  select(id: string): void;
  refresh(selectId?: string): Promise<void>;
}

const Ctx = createContext<WorkspaceCtx | null>(null);
const KEY = 'serverpilot.workspace';

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(() => {
    try { return localStorage.getItem(KEY); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const select = useCallback((id: string) => {
    setCurrentId(id);
    try { localStorage.setItem(KEY, id); } catch { /* ignore */ }
  }, []);

  const refresh = useCallback(async (selectId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listWorkspaces();
      setWorkspaces(list);
      if (selectId) select(selectId);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [api, select]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Fall back to the first workspace if the stored id isn't one we can access.
  const current = useMemo(
    () => workspaces.find((w) => w.id === currentId) ?? workspaces[0] ?? null,
    [workspaces, currentId],
  );

  const value = useMemo(
    () => ({ workspaces, current, loading, error, select, refresh }),
    [workspaces, current, loading, error, select, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return c;
}

/** Inside the shell a workspace is always selected. */
export function useCurrentWorkspace(): Workspace {
  const { current } = useWorkspace();
  if (!current) throw new Error('No workspace selected');
  return current;
}
