import { createContext, useContext, useMemo } from 'react';
import { useApi } from '../lib/useApi.js';

// Matches the server's defaults, so screens work before the settings arrive (and in tests without a provider).
export const DEFAULT_SETTINGS = { household_name: '', week_start: 'monday', default_servings: '4', use_soon_days: '14' };

const Ctx = createContext({ settings: DEFAULT_SETTINGS, loading: false, reload: () => {} });
export const useSettings = () => useContext(Ctx);

export function SettingsProvider({ children }) {
  const { data, loading, reload } = useApi('/api/settings');
  const value = useMemo(() => ({ settings: { ...DEFAULT_SETTINGS, ...(data ?? {}) }, loading: loading && !data, reload }), [data, loading, reload]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
