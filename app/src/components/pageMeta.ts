import { createContext, useContext } from 'react';

/** The six classifications every displayed metric carries (CLAUDE.md, financial integrity). */
export type Classification =
  'reported_public' | 'synthetic' | 'proxy_estimate' | 'calculated' | 'stale' | 'missing';

/** What a page states once so its panels need not repeat it: the classification that applies
 *  unless a figure is marked otherwise, and the sources that apply to the whole page. Outside a
 *  provider nothing is assumed, so every badge and citation renders where it is used. */
export interface PageMetaValue {
  defaultClass: Classification | null;
  defaultSourceIds: string[];
}

export const PageMetaContext = createContext<PageMetaValue>({
  defaultClass: null,
  defaultSourceIds: [],
});

export const usePageMeta = (): PageMetaValue => useContext(PageMetaContext);
