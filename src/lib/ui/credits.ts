import type { ArtistCredit, Release } from '$lib/domain/releases';

/**
 * Créditos por rol para la ficha (U6, variante `roles` de CreditLine). La regla
 * del resumen de una línea sigue en `summarizeReleaseCredits` (R2); esto solo
 * agrupa para la vista completa. Hoy el catálogo distingue dos roles.
 */
export type CreditRole = 'primary' | 'collaborator';

export type CreditRoleGroup = {
  role: CreditRole;
  /** Etiqueta visible, en singular o plural según el número de personas. */
  label: string;
  credits: ArtistCredit[];
};

const ROLE_LABELS: Record<CreditRole, [singular: string, plural: string]> = {
  primary: ['Artista principal', 'Artistas principales'],
  collaborator: ['Colaborador', 'Colaboradores']
};

export function creditRoleLabel(role: CreditRole, count: number): string {
  return ROLE_LABELS[role][count === 1 ? 0 : 1];
}

export function creditRoleGroups(release: Pick<Release, 'primaryArtists' | 'collaborators'>): CreditRoleGroup[] {
  const groups: CreditRoleGroup[] = [];
  const primary = release.primaryArtists ?? [];
  const collaborators = release.collaborators ?? [];
  if (primary.length) groups.push({ role: 'primary', label: creditRoleLabel('primary', primary.length), credits: primary });
  if (collaborators.length) groups.push({ role: 'collaborator', label: creditRoleLabel('collaborator', collaborators.length), credits: collaborators });
  return groups;
}

/** Enlace público de un crédito: solo con el slug que entrega el catálogo (E03). */
export function defaultArtistHref(credit: ArtistCredit): string | null {
  return credit.slug ? `/artista/${credit.slug}` : null;
}
