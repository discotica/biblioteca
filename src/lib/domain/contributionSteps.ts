// Pasos de "Sugerir un lanzamiento" (U13): fuente → revisar datos → nota →
// enviar. Lógica pura: qué campo vive en qué paso y a qué paso se puede llegar.
// El contrato de E09 (payload y estados) no cambia; esto solo ordena la vista.

export const CONTRIBUTION_STEPS = [
  { step: 1, label: 'Fuente' },
  { step: 2, label: 'Revisar datos' },
  { step: 3, label: 'Nota' },
  { step: 4, label: 'Enviar' }
] as const;

export type ContributionStep = (typeof CONTRIBUTION_STEPS)[number]['step'];

/** Campos obligatorios del espejo de validación (contributionFieldErrors). */
export type ContributionField =
  | 'source'
  | 'title'
  | 'primary_artists'
  | 'release_type'
  | 'release_date'
  | 'genres'
  | 'countries';

const FIELD_STEP: Record<ContributionField, ContributionStep> = {
  source: 1,
  title: 2,
  primary_artists: 2,
  release_type: 2,
  release_date: 2,
  genres: 2,
  countries: 2
};

/** Orden de foco dentro de cada paso: el del formulario. */
export const FIELD_ORDER: ContributionField[] = [
  'source',
  'title',
  'primary_artists',
  'release_type',
  'release_date',
  'genres',
  'countries'
];

export function stepOfField(field: ContributionField): ContributionStep {
  return FIELD_STEP[field];
}

/** Errores que pertenecen a un paso, en el orden del formulario. */
export function errorsForStep<T extends Partial<Record<ContributionField, string>>>(errors: T, step: ContributionStep): T {
  const result = {} as T;
  for (const field of FIELD_ORDER) {
    const message = errors[field];
    if (message && FIELD_STEP[field] === step) (result as Record<string, string>)[field] = message;
  }
  return result;
}

/** El primer paso con un error, o null si no hay ninguno. */
export function firstStepWithError(errors: Partial<Record<ContributionField, string>>): ContributionStep | null {
  for (const field of FIELD_ORDER) if (errors[field]) return FIELD_STEP[field];
  return null;
}

/** El primer campo con error, en el orden del formulario. */
export function firstInvalidField(errors: Partial<Record<ContributionField, string>>): ContributionField | null {
  return FIELD_ORDER.find((field) => errors[field]) ?? null;
}

/**
 * Paso que se muestra para un valor del historial. Sin datos todavía (no se ha
 * detectado ni retomado nada) solo existe el primero: una entrada vieja del
 * historial o una recarga no pueden dejar a la persona en un paso vacío. Con
 * datos y sin paso en el historial (un borrador retomado), `fallback`.
 */
export function visibleStep(requested: unknown, hasData: boolean, fallback: ContributionStep = 1): ContributionStep {
  if (!hasData) return 1;
  const value = Number(requested);
  return value === 1 || value === 2 || value === 3 || value === 4 ? value : fallback;
}
