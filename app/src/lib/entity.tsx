import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { CONFIG } from '../config';
import type { EntityId } from '../fixtures/published';

/** Entity (Pension Plan / OPEB Trust) selection — client state shared by every view. */

interface EntityState {
  entity: EntityId;
  setEntity: (e: EntityId) => void;
}

const Ctx = createContext<EntityState | null>(null);

export function EntityProvider({ children }: { children: ReactNode }) {
  const [entity, setEntity] = useState<EntityId>(CONFIG.defaultEntity);
  const value = useMemo(() => ({ entity, setEntity }), [entity]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEntity(): EntityState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useEntity outside EntityProvider');
  return v;
}
