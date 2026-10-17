/**
 * Filas de "Mis aportes" (U14): qué estado, qué fecha y qué acción muestra cada
 * aporte. Puro, sin Supabase. Los estados y datos son los de E09; solo cambia
 * cómo se presentan (filas compactas, una acción como mucho).
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
  | { kind: 'resume'; label: 'Retomar'; href: string }
  | { kind: 'fix'; label: 'Corregir'; href: string }
  | { kind: 'edit'; label: 'Editar'; href: string }
  | { kind: 'view'; label: 'Ver lanzamiento'; href: string };

/**
 * U19: la propuesta enviada que el equipo ya está revisando (la corrigió, la marcó lista o la
 * está decidiendo). Quien la propuso ya no la edita.
 */
export function contributionTaken(row: Pick<ContributionRowInput, 'status' | 'taken_at'>): boolean {
  return row.status === 'ready_for_admin' || (row.status === 'pending' && !!row.taken_at);
}

/**
 * Una acción como mucho: retomar un borrador, corregir lo que el equipo pidió
 * cambiar, editar lo enviado mientras nadie lo haya tomado (U19) o ver el
 * lanzamiento aceptado (si sigue publicado). El resto, ninguna.
 */
export function contributionRowAction(
  row: ContributionRowInput,
  releaseSlug: string | null | undefined
): ContributionRowAction | null {
  if (row.status === 'draft') return { kind: 'resume', label: 'Retomar', href: `/sugerir?draft=${row.id}` };
  if (row.status === 'changes_requested') return { kind: 'fix', label: 'Corregir', href: `/sugerir?draft=${row.id}` };
  if (row.status === 'pending' && !row.taken_at) return { kind: 'edit', label: 'Editar', href: `/sugerir?draft=${row.id}` };
  if (row.status === 'approved' && releaseSlug) {
    return { kind: 'view', label: 'Ver lanzamiento', href: `/lanzamiento/${encodeURIComponent(releaseSlug)}` };
  }
  return null;
}
