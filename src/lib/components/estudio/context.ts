import { getContext, setContext } from 'svelte';
import type { StudioRole, StudioSectionId } from '$lib/domain/studio';

/**
 * Lo que el layout del Estudio comparte con sus secciones (U15). El layout ya
 * comprobó la sesión y el rol: una sección solo se pinta si su rol la ve.
 */
export type StudioContext = {
  readonly role: StudioRole;
  readonly userId: string;
  readonly sections: StudioSectionId[];
  /** Vuelve a pedir los conteos de la barra lateral (tras un lote o una decisión). */
  refreshCounts(): void;
};

const KEY = Symbol('estudio');

export function setStudioContext(context: StudioContext) {
  setContext(KEY, context);
}

export function getStudioContext(): StudioContext {
  return getContext<StudioContext>(KEY);
}
