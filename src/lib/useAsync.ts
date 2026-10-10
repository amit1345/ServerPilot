import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../data/api';

/** Minimal loader: data / loading / error, plus reload and local overrides. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const call = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);

  const reload = useCallback(async () => {
    const n = ++call.current;
    setLoading(true);
    setError(null);
    try {
      const v = await run();
      if (n === call.current) setData(v);
    } catch (e) {
      if (n === call.current) setError(errorMessage(e));
    } finally {
      if (n === call.current) setLoading(false);
    }
  }, [run]);

  useEffect(() => { void reload(); }, [reload]);

  return { data, setData, loading, error, reload };
}
