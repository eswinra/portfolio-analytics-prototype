import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

import { CONFIG } from '../config';
import type { EntityId } from '../fixtures/published';
import { useUrlParam } from './urlState';

/** Entity (Pension Plan / OPEB Trust) selection — shared by every view and carried in the URL
 *  (`?e=OPEB`), so a link reproduces the fund the sender was looking at. Must be mounted inside
 *  the router. */

interface EntityState {
  entity: EntityId;
  setEntity: (e: EntityId) => void;
}

const Ctx = createContext<EntityState | null>(null);

export function EntityProvider({ children }: { children: ReactNode }) {
  const [raw, setRaw] = useUrlParam('e', CONFIG.defaultEntity);
  const entity: EntityId = raw === 'OPEB' ? 'OPEB' : 'PENSION';
  const setEntity = useCallback((e: EntityId) => setRaw(e), [setRaw]);
  const value = useMemo(() => ({ entity, setEntity }), [entity, setEntity]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEntity(): EntityState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useEntity outside EntityProvider');
  return v;
}
