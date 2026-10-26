import type { Crumb } from '$lib/ui/Breadcrumbs.svelte';
import { withoutBetaInvitationSearch } from '$lib/domain/betaInvitation';

/**
 * Primera miga de las vistas que salen del catálogo (artista, sello, ficha).
 * Conserva la búsqueda con la que se llegó (filtros, página, orden), que viaja
 * en la query de la URL, sin la invitación beta.
 */
export function catalogCrumb(search: string | URLSearchParams = ''): Crumb {
  return { label: 'Catálogo', href: `/${withoutBetaInvitationSearch(search)}` };
}
