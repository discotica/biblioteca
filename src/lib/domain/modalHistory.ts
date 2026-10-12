import { createSearchState, type SearchState } from './searchState.ts';

export const MODAL_HISTORY_KEY = '__discotecaModalSession';

export type ModalSessionOrigin = 'catalog' | 'direct';
export type ModalSessionPhase = 'idle' | 'open' | 'base';

export type ScrollSnapshot = { x: number; y: number };

export type ModalHistoryEntry = {
  version: 1;
  sessionId: string;
  origin: ModalSessionOrigin;
  baseHref: string;
  baseSearchState: SearchState;
  baseScroll: ScrollSnapshot;
  depth: number;
  slug: string;
};

export type ModalSession = {
  phase: ModalSessionPhase;
  sessionId: string | null;
  origin: ModalSessionOrigin | null;
  baseHref: string;
  baseSearchState: SearchState;
  baseScroll: ScrollSnapshot;
  depth: number;
  slug: string | null;
};

export type ModalClosePlan =
  | { kind: 'none' }
  | { kind: 'go'; delta: number; finishDirectAtDepthZero: boolean }
  | { kind: 'replace'; href: string; scroll: ScrollSnapshot };

export const idleModalSession = (): ModalSession => ({
  phase: 'idle',
  sessionId: null,
  origin: null,
  baseHref: '/',
  baseSearchState: createSearchState(),
  baseScroll: { x: 0, y: 0 },
  depth: 0,
  slug: null
});

function cloneSearchState(state: SearchState): SearchState {
  return createSearchState({
    ...state,
    text: state.text.map((term) => typeof term === 'string' ? term : { ...term }),
    genres: [...state.genres],
    countries: [...state.countries],
    radar: { ...state.radar }
  });
}

function sessionId(): string {
  return `modal-${Date.now().toString(36)}-${(++sessionCounter).toString(36)}`;
}

let sessionCounter = 0;

export function beginModalSession(input: {
  origin: ModalSessionOrigin;
  baseHref: string;
  baseSearchState: SearchState;
  baseScroll: ScrollSnapshot;
  slug: string;
}): ModalSession {
  return {
    phase: 'open',
    sessionId: sessionId(),
    origin: input.origin,
    baseHref: input.baseHref,
    baseSearchState: cloneSearchState(input.baseSearchState),
    baseScroll: { ...input.baseScroll },
    depth: input.origin === 'catalog' ? 1 : 0,
    slug: input.slug
  };
}

export function entryForSession(session: ModalSession, slug = session.slug, depth = session.depth): ModalHistoryEntry | null {
  if (!session.sessionId || !session.origin || !slug) return null;
  return {
    version: 1,
    sessionId: session.sessionId,
    origin: session.origin,
    baseHref: session.baseHref,
    baseSearchState: cloneSearchState(session.baseSearchState),
    baseScroll: { ...session.baseScroll },
    depth,
    slug
  };
}

export function pushModalRelease(session: ModalSession, slug: string): { session: ModalSession; entry: ModalHistoryEntry } {
  if (session.phase !== 'open' || !session.sessionId || !session.origin) throw new Error('Cannot push a release outside an open modal session.');
  const next = { ...session, depth: session.depth + 1, slug } satisfies ModalSession;
  return { session: next, entry: entryForSession(next)! };
}

export function readModalHistoryEntry(value: unknown): ModalHistoryEntry | null {
  if (!value || typeof value !== 'object') return null;
  const state = value as Record<string, unknown>;
  const raw = state[MODAL_HISTORY_KEY];
  if (!raw || typeof raw !== 'object') return null;
  const entry = raw as Partial<ModalHistoryEntry>;
  if (
    entry.version !== 1 || typeof entry.sessionId !== 'string' ||
    (entry.origin !== 'catalog' && entry.origin !== 'direct') ||
    typeof entry.baseHref !== 'string' || typeof entry.depth !== 'number' || entry.depth < 0 ||
    typeof entry.slug !== 'string' || !entry.slug || !entry.baseSearchState || !entry.baseScroll ||
    typeof entry.baseScroll.x !== 'number' || typeof entry.baseScroll.y !== 'number'
  ) return null;
  return {
    ...entry,
    baseSearchState: cloneSearchState(entry.baseSearchState),
    baseScroll: { x: entry.baseScroll.x, y: entry.baseScroll.y }
  } as ModalHistoryEntry;
}

export function restoreModalSession(entry: ModalHistoryEntry): ModalSession {
  return {
    phase: 'open',
    sessionId: entry.sessionId,
    origin: entry.origin,
    baseHref: entry.baseHref,
    baseSearchState: cloneSearchState(entry.baseSearchState),
    baseScroll: { ...entry.baseScroll },
    depth: entry.depth,
    slug: entry.slug
  };
}

export function visitModalBase(session: ModalSession): ModalSession {
  return { ...session, phase: session.sessionId ? 'base' : 'idle', depth: 0, slug: null };
}

export function closeModalPlan(session: ModalSession): ModalClosePlan {
  if (session.phase !== 'open' || !session.origin) return { kind: 'none' };
  if (session.origin === 'catalog') {
    return session.depth > 0
      ? { kind: 'go', delta: -session.depth, finishDirectAtDepthZero: false }
      : { kind: 'replace', href: session.baseHref, scroll: session.baseScroll };
  }
  return session.depth > 0
    ? { kind: 'go', delta: -session.depth, finishDirectAtDepthZero: true }
    : { kind: 'replace', href: session.baseHref, scroll: session.baseScroll };
}

