// Barra «Buscar» móvil del inicio (E15): se oculta al bajar y reaparece tras
// 24 px de subida; se congela con la hoja abierta, con un campo enfocado o con
// el teclado virtual. También mide `visualViewport` para que la hoja quede
// sobre el teclado.

import { MOBILE_QUERY } from './breakpoints.ts';

export const MOBILE_SEARCH_QUERY = MOBILE_QUERY;

export interface MobileSearchChromeOptions {
  /** Estado actual de la hoja de filtros. */
  sheetOpen: () => boolean;
  onSearchVisible: (visible: boolean) => void;
  onViewport: (height: number, bottom: number) => void;
}

/** Empieza a observar scroll y viewport. Devuelve la función que deja de hacerlo. */
export function observeMobileSearchChrome({ sheetOpen, onSearchVisible, onViewport }: MobileSearchChromeOptions): () => void {
  let lastScrollY = window.scrollY;
  let upwardDistance = 0;
  let downwardDistance = 0;
  let keyboardVisible = false;
  let viewportWidth = window.visualViewport?.width ?? window.innerWidth;
  let viewportMaxHeight = window.visualViewport?.height ?? window.innerHeight;
  const mobileQuery = window.matchMedia(MOBILE_SEARCH_QUERY);
  const visualViewport = window.visualViewport;

  const focusedField = () => {
    const active = document.activeElement;
    return active instanceof HTMLElement && active.matches('input, textarea, select, [contenteditable="true"]');
  };

  const updateVisualViewport = () => {
    const width = visualViewport?.width ?? window.innerWidth;
    const height = visualViewport?.height ?? window.innerHeight;
    const widthChanged = Math.abs(width - viewportWidth) >= 40;

    if (widthChanged) {
      // Rotation or a breakpoint change establishes a new baseline instead
      // of being mistaken for the virtual keyboard.
      viewportWidth = width;
      viewportMaxHeight = height;
      keyboardVisible = false;
    } else {
      viewportMaxHeight = Math.max(viewportMaxHeight, height);
      // La barra solo se congela ante un teclado real: una reducción del
      // viewport sin un campo activo también ocurre al colapsar la barra
      // del navegador móvil y no debe impedir que Buscar vuelva al subir.
      keyboardVisible = focusedField() && viewportMaxHeight - height >= 120;
    }

    onViewport(height, Math.max(0, window.innerHeight - ((visualViewport?.offsetTop ?? 0) + height)));
  };

  const onScroll = () => {
    if (!mobileQuery.matches) {
      onSearchVisible(true);
      lastScrollY = window.scrollY;
      return;
    }
    const y = Math.max(0, window.scrollY);
    const delta = y - lastScrollY;
    if (!focusedField()) keyboardVisible = false;
    if (sheetOpen() || focusedField() || keyboardVisible) {
      lastScrollY = y;
      upwardDistance = 0;
      downwardDistance = 0;
      return;
    }
    if (y <= 0) {
      onSearchVisible(true);
      upwardDistance = 0;
      downwardDistance = 0;
    } else if (delta < 0) {
      upwardDistance += -delta;
      downwardDistance = 0;
      if (upwardDistance >= 24) onSearchVisible(true);
    } else if (delta > 0) {
      downwardDistance += delta;
      upwardDistance = 0;
      if (downwardDistance >= 8) onSearchVisible(false);
    }
    lastScrollY = y;
  };

  const resetScrollBaseline = () => {
    lastScrollY = window.scrollY;
    upwardDistance = 0;
    downwardDistance = 0;
    if (!mobileQuery.matches || window.scrollY <= 0) onSearchVisible(true);
    updateVisualViewport();
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', resetScrollBaseline);
  mobileQuery.addEventListener?.('change', resetScrollBaseline);
  visualViewport?.addEventListener('resize', updateVisualViewport);
  visualViewport?.addEventListener('scroll', updateVisualViewport);
  updateVisualViewport();

  return () => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', resetScrollBaseline);
    mobileQuery.removeEventListener?.('change', resetScrollBaseline);
    visualViewport?.removeEventListener('resize', updateVisualViewport);
    visualViewport?.removeEventListener('scroll', updateVisualViewport);
  };
}
