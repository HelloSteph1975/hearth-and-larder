import { createContext, useContext, useMemo } from 'react';
import { useApi } from '../lib/useApi.js';

const Ctx = createContext({ stores: [], reload: () => {}, loading: false, error: null });
export const useStores = () => useContext(Ctx);

export function StoresProvider({ children }) {
  const { data, reload, loading, error } = useApi('/api/stores');
  const value = useMemo(() => ({ stores: data ?? [], reload, loading, error }), [data, reload, loading, error]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
