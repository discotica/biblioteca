/**
 * Filas de "Mis aportes" (U14, U31): qué estado, qué fecha y qué acción muestra
 * cada aporte, y en qué grupo va. Puro, sin Supabase. Los estados y datos son
 * los de E09; solo cambia cómo se presentan (filas compactas, una acción como
 * mucho, tres grupos).
 */
export type ContributionRowStatus =
  | 'draft'
  | 'pending'
  | 'ready_for_admin'
  | 'changes_requested'
  | 'rejected'
  | 'approved';

export interface ContributionRowInput {
  id: string;
  status: ContributionRowStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  updated_at: string;
  release_id: string | null;
  /** U19: desde que el equipo la tomó, el autor ya no la edita. */
  taken_at?: string | null;
}

export type ContributionRowTone = 'neutral' | 'accent' | 'warning' | 'danger';

/**
 * Tono del punto de estado en el Estudio (U23, StatusDot): ámbar lo que espera a alguien, verde lo
 * listo o aceptado, rojo lo rechazado, contorno el borrador. Son los nombres de `StatusTone`.
 */
export const CONTRIBUTION_DOT_TONES: Record<ContributionRowStatus, 'ok' | 'pending' | 'draft' | 'danger' | 'neutral'> = {
  draft: 'draft',
  pending: 'pending',
  ready_for_admin: 'ok',
  changes_requested: 'pending',
  rejected: 'danger',
  approved: 'ok'
};

export const CONTRIBUTION_ROW_TONES: Record<ContributionRowStatus, ContributionRowTone> = {
  draft: 'neutral',
  pending: 'neutral',
  ready_for_admin: 'neutral',
  changes_requested: 'warning',
  rejected: 'danger',
  approved: 'accent'
};

/** La fecha que importa en cada estado, con su verbo. */
export function contributionRowDate(row: ContributionRowInput): { label: string; value: string } {
  if (row.status === 'draft') return { label: 'Guardado', value: row.updated_at };
  if (row.status === 'pending' || row.status === 'ready_for_admin') {
    return { label: 'Enviado', value: row.submitted_at ?? row.updated_at };
  }
  return { label: 'Revisado', value: row.reviewed_at ?? row.updated_at };
}

export type ContributionRowAction =
  | { kind: 'resume'; label: 'Editar'; href: string }
  | { kind: 'fix'; label: 'Corregir'; href: string }
  | { kind: 'edit'; label: 'Editar'; href: string }
  /** U31: «Editar» a la vista pero desactivado; el equipo ya la tomó. */
  | { kind: 'locked'; label: 'Editar'; href: string }
  | { kind: 'view'; label: 'Ver lanzamiento'; href: string };

/**
 * U19: la propuesta enviada que el equipo ya está revisando (la corrigió, la marcó lista o la
 * está decidiendo). Quien la propuso ya no la edita.
 */
export function contributionTaken(row: Pick<ContributionRowInput, 'status' | 'taken_at'>): boolean {
  return row.status === 'ready_for_admin' || (row.status === 'pending' && !!row.taken_at);
}

/**
 * Una acción como mucho: editar un borrador, corregir lo que el equipo pidió
 * cambiar, editar lo enviado mientras nadie lo haya tomado (U19) o ver el
 * lanzamiento aceptado (si sigue publicado). Lo que el equipo ya tomó muestra
 * «Editar» desactivado (U31). El rechazado, ninguna.
 */
export function contributionRowAction(
  row: ContributionRowInput,
  releaseSlug: string | null | undefined
): ContributionRowAction | null {
  const href = `/sugerir?draft=${row.id}`;
  if (row.status === 'draft') return { kind: 'resume', label: 'Editar', href };
  if (row.status === 'changes_requested') return { kind: 'fix', label: 'Corregir', href };
  if (contributionTaken(row)) return { kind: 'locked', label: 'Editar', href };
  if (row.status === 'pending') return { kind: 'edit', label: 'Editar', href };
  if (row.status === 'approved' && releaseSlug) {
    return { kind: 'view', label: 'Ver lanzamiento', href: `/lanzamiento/${encodeURIComponent(releaseSlug)}` };
  }
  return null;
}

/* ---------- Grupos y cifras de Mis aportes (U31, tablero N) ---------- */

export type ContributionGroupId = 'por-resolver' | 'en-revision' | 'resueltos';

/** Primero lo que depende de quien aporta, luego lo que espera al equipo y al final lo resuelto. */
export const CONTRIBUTION_GROUPS: ReadonlyArray<{ id: ContributionGroupId; label: string; statuses: readonly ContributionRowStatus[] }> = [
  { id: 'por-resolver', label: 'Por resolver', statuses: ['changes_requested', 'draft'] },
  { id: 'en-revision', label: 'En revisión', statuses: ['pending', 'ready_for_admin'] },
  { id: 'resueltos', label: 'Resueltos', statuses: ['approved', 'rejected'] }
];

/**
 * Agrupa las filas sin perder el orden en que llegan (el más reciente primero).
 * En «Por resolver», los cambios solicitados van antes que los borradores: son
 * lo único que el equipo está esperando. Los grupos vacíos no se devuelven.
 */
export function groupContributions<T extends Pick<ContributionRowInput, 'status'>>(
  rows: T[]
): Array<{ id: ContributionGroupId; label: string; rows: T[] }> {
  return CONTRIBUTION_GROUPS.map(({ id, label, statuses }) => {
    const inGroup = rows.filter((row) => statuses.includes(row.status));
    if (id === 'por-resolver') {
      inGroup.sort((a, b) => Number(b.status === 'changes_requested') - Number(a.status === 'changes_requested'));
    }
    return { id, label, rows: inGroup };
  }).filter((group) => group.rows.length > 0);
}

/** Las tres cifras de la cabecera: todos los aportes, los que esperan al equipo y los aceptados. */
export function contributionCounts(rows: Pick<ContributionRowInput, 'status'>[]): { total: number; enRevision: number; aceptados: number } {
  return {
    total: rows.length,
    enRevision: rows.filter((row) => row.status === 'pending' || row.status === 'ready_for_admin').length,
    aceptados: rows.filter((row) => row.status === 'approved').length
  };
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

/** Fecha corta del tablero N, en la zona del navegador: «5 nov 2026». */
export function fechaAporte(value: string): string {
  const date = new Date(value);
  return `${date.getDate()} ${MESES[date.getMonth()]} ${date.getFullYear()}`;
}
