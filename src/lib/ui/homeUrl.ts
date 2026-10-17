// URL e historial del inicio. El estado vive en la página; aquí solo se
// traduce a navegaciones de SvelteKit con las opciones fijadas en E12 y E17:
// los criterios hacen push, el modal hace replace, nunca se mueve el scroll y
// los parámetros ajenos (`unknown`) siempre se conservan.
import { tick } from 'svelte';
import { get } from 'svelte/store';
import { page } from '$app/stores';
import { goto, replaceState as replacePageState } from '$app/navigation';
import {
  MODAL_HISTORY_KEY,
  beginModalSession,
  entryForSession,
  readModalHistoryEntry,
  type ModalHistoryEntry,
  type ModalSession,
  type ModalSessionOrigin,
  type ScrollSnapshot
} from '$lib/domain/modalHistory';
import { createSearchState, serializeSearchState, type SearchState } from '$lib/domain/searchState';

type UnknownParams = URLSearchParams | string;

export function searchHref(state: SearchState, unknown: UnknownParams): string {
  const query = serializeSearchState(state, unknown).toString();
  return query ? `/?${query}` : '/';
}

export function currentQuery(): string {
  return get(page).url.searchParams.toString();
}

// En la primera página cargada (recarga o regreso desde otro documento)
// SvelteKit deja `page.state` en `{}`, aunque `history.state['sveltekit:states']`
// conserve el marker; la primera escritura de la app, que copia `page.state`,
// lo borraría. Se lee aquí, al evaluar el módulo y antes de cualquier escritura,
// para que una recarga con la modal abierta conserve su sesión y el scroll base
// en vez de tratarse como apertura directa.
const bootModalEntry = typeof history === 'undefined' ? null : readModalHistoryEntry(history.state?.['sveltekit:states']);
let bootModalEntryTaken = false;

/** Sesión modal que había en la entrada cargada, una sola vez y solo si es la del `modal` de la URL. */
export function takeBootModalEntry(slug: string): ModalHistoryEntry | null {
  if (bootModalEntryTaken) return null;
  bootModalEntryTaken = true;
  return bootModalEntry?.slug === slug ? bootModalEntry : null;
}

/** Entrada de sesión modal guardada en la entrada de historial actual, si existe. */
export function currentModalEntry(): ModalHistoryEntry | null {
  return readModalHistoryEntry(get(page).state);
}

/** Copia `page.state` con la entrada modal indicada, o sin ella si es `null`. */
export function historyStateWith(entry: ModalHistoryEntry | null | undefined): App.PageState {
  const state: Record<string, unknown> = { ...(get(page).state ?? {}) };
  if (entry) state[MODAL_HISTORY_KEY] = entry;
  else delete state[MODAL_HISTORY_KEY];
  return state as App.PageState;
}

/**
 * Lleva la URL al estado indicado si cambió. Push por defecto; con
 * `historyEntry` se escribe esa entrada modal en el nuevo `page.state`.
 */
export async function navigateToSearch(
  state: SearchState,
  unknown: UnknownParams,
  { replaceState = false, historyEntry = undefined }: { replaceState?: boolean; historyEntry?: ModalHistoryEntry | null } = {}
): Promise<void> {
  const nextQs = serializeSearchState(state, unknown).toString();
  if (nextQs !== currentQuery()) await goto(nextQs ? `?${nextQs}` : '/', {
    replaceState,
    noScroll: true,
    keepFocus: true,
    ...(historyEntry !== undefined ? { state: historyStateWith(historyEntry) } : {})
  });
}

/** Reemplaza la entrada actual por `href` sin mover scroll ni foco. */
export function replaceSearchHref(href: string, entry: ModalHistoryEntry | null): Promise<void> {
  return goto(href, {
    replaceState: true,
    noScroll: true,
    keepFocus: true,
    state: historyStateWith(entry)
  });
}

/**
 * Reemplaza la URL actual por su forma canónica `canonical`, conservando la
 * entrada modal. A diferencia del resto, no conserva el foco.
 */
export async function replaceWithCanonicalQuery(canonical: string): Promise<void> {
  if (currentQuery() !== canonical) await goto(canonical ? `?${canonical}` : '/', {
    replaceState: true,
    noScroll: true,
    state: historyStateWith(currentModalEntry())
  });
}

/** Abre una sesión modal sobre el estado actual sin `modal`, con el scroll de este momento como base. */
export function startModalSession(origin: ModalSessionOrigin, state: SearchState, unknown: UnknownParams, slug: string): ModalSession {
  const baseState = createSearchState({ ...state, modal: null });
  return beginModalSession({
    origin,
    baseHref: searchHref(baseState, unknown),
    baseSearchState: baseState,
    baseScroll: { x: window.scrollX, y: window.scrollY },
    slug
  });
}

/** Marca la entrada directa actual con su sesión modal, sin navegar. */
export function markModalEntry(session: ModalSession): void {
  replacePageState('', historyStateWith(entryForSession(session)));
}

/** Restaura el scroll del catálogo bajo el modal cuando el DOM ya se actualizó. */
export async function restoreUnderlyingScroll(snapshot: ScrollSnapshot): Promise<void> {
  await tick();
  requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(snapshot.x, snapshot.y)));
}
