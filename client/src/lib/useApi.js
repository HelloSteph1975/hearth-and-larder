import { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';

export function useApi(url, { keepPrevious = false } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(url), url });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!url) {
      setState({ data: null, error: null, loading: false, url });
      return undefined;
    }
    let live = true;
    // Keep data on a plain reload of the same url; drop it when the url changes
    // so a screen keyed by :id never shows the previous record.
    setState(s => (s.url === url || keepPrevious ? { ...s, loading: true, url } : { data: null, error: null, loading: true, url }));
    api.get(url).then(
      data => live && setState({ data, error: null, loading: false, url }),
      error => live && setState({ data: null, error, loading: false, url }),
    );
    return () => { live = false; };
  }, [url, tick, keepPrevious]);
  const reload = useCallback(() => setTick(x => x + 1), []);
  // Guard the render between a url change and the effect running.
  const stale = state.url !== url;
  if (stale && keepPrevious && url) return { data: state.data, error: null, loading: true, reload };
  return {
    data: stale ? null : state.data,
    error: stale ? null : state.error,
    loading: stale ? Boolean(url) : state.loading,
    reload,
  };
}
