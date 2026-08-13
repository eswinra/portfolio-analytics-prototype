import type { EntityId } from './fixtures/published';

/** Tweakable presentation parameters (config, not per-user UI) — per the design handoff. */
export const CONFIG = {
  defaultEntity: 'PENSION' as EntityId,
  /** "Near bound" early-warning distance in percentage points (0.5–3). */
  nearBoundPp: 1.0,
  /** Per-panel source citations on/off. */
  showSources: true,
};
