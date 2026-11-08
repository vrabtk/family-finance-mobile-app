import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from './session';

// Loads data on mount / when deps change. `reload` is for pull-to-refresh (shows the spinner);
// `refetch` re-reads quietly after a save.
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const loadRef = useRef(load);
  loadRef.current = load;
  const alive = useRef(true);
  const latest = useRef(0); // only the newest request may update state (older ones are ignored)

  const run = useCallback(async (mode: 'initial' | 'refresh' | 'silent') => {
    if (mode === 'initial') setLoading(true); else if (mode === 'refresh') setRefreshing(true);
    setError('');
    const ticket = ++latest.current;
    const current = () => alive.current && ticket === latest.current;
    try {
      const next = await loadRef.current();
      if (current()) setData(next);
    } catch (e) {
      if (current()) setError(errorMessage(e, 'Could not load data.'));
    } finally {
      if (current()) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    run('initial');
    return () => { alive.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, refreshing, error, reload: () => run('refresh'), refetch: () => run('silent'), setData };
}
