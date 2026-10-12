import { parseBetaInvitation } from '$lib/domain/betaInvitation';
import { hasSearchCriteria, parseSearchState } from '$lib/domain/searchState';

export const WELCOME_SESSION_CONTEXT = Symbol('welcome-session');

export interface WelcomeSession {
  /** Route which opened this tab session; set once by the root layout. */
  initialPath: string;
}

export const WELCOME_INITIAL_ROUTE_KEY = 'discotica:welcome:initial-route:v1';
export const WELCOME_HANDLED_KEY = 'discotica:welcome:handled:v1';

/**
 * Storage is deliberately limited to the tab session. It records that the
 * first direct home entry was handled, including entries deliberately
 * suppressed by a shared filter, modal or valid beta URL.
 */
export function readInitialWelcomePath(currentPath: string): string {
  try {
    const stored = window.sessionStorage.getItem(WELCOME_INITIAL_ROUTE_KEY);
    if (stored !== null) return stored;
    window.sessionStorage.setItem(WELCOME_INITIAL_ROUTE_KEY, currentPath);
  } catch {
    // Private/blocked storage must not prevent access to the catalogue.
  }
  return currentPath;
}

export function hasHandledWelcome(): boolean {
  try {
    return window.sessionStorage.getItem(WELCOME_HANDLED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markWelcomeHandled(): void {
  try {
    window.sessionStorage.setItem(WELCOME_HANDLED_KEY, '1');
  } catch {
    // The banner remains non-modal even where sessionStorage is unavailable.
  }
}

/**
 * Decide once per tab whether home shows the welcome. A direct entry with
 * filters, a modal or a beta invitation is not eligible but still consumes the
 * decision, so the banner never follows a dismissed beta or a shared link.
 */
export function consumeWelcomeDecision(initialPath: string | undefined, params: URLSearchParams): boolean {
  const parsed = parseSearchState(params);
  const eligible = initialPath === '/'
    && !hasSearchCriteria(parsed.state)
    && !parsed.state.modal
    && !parseBetaInvitation(params);
  const handled = hasHandledWelcome();
  if (!handled) markWelcomeHandled();
  return eligible && !handled;
}
