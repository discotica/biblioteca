/**
 * Bandeja del Estudio (U17): Propuestas y Reportes en lista + detalle. Aquí
 * viven qué grupos ve cada rol, qué acción tiene cada propuesta, qué campos se
 * marcan como editados y qué elemento queda elegido. Sin Svelte ni Supabase,
 * para probarlo en node.
 *
 * Los estados, las colas y los permisos son los de E09 y E18; estas reglas solo
 * deciden cómo se muestran, y son las mismas que tenía la estación de E10.
 */

export type InboxRole = 'admin' | 'colaborador';

// ---------------------------------------------------------------------------
// Propuestas (E09)

export interface ProposalPayloadLike {
  title?: string;
  primary_artists?: string[];
  collaborators?: string[];
  release_type?: string;
  release_date?: string;
  genres?: string[];
  countries?: string[];
  label?: string;
}

export interface ProposalLike {
  id: string;
  author_id: string;
  status: string;
  queue_kind: string | null;
  payload: ProposalPayloadLike;
  detected_metadata?: Record<string, unknown> | null;
}

export type ProposalFieldKey =
  | 'title'
  | 'primary_artists'
  | 'collaborators'
  | 'release_type'
  | 'release_date'
  | 'label'
  | 'genres'
  | 'countries';

export type ProposalField = {
  key: ProposalFieldKey;
  label: string;
  /** Texto del campo; '' si está vacío. */
  value: string;
  /** Campos de lista: sus elementos. */
  values?: string[];
  /** La fuente detectó un valor para este campo. */
  detected: boolean;
  /** Difiere de lo que detectó la fuente. */
  edited: boolean;
};

/** Campos del payload v2 de E09, en el orden del paso "Revisar datos" de Sugerir. */
const PROPOSAL_FIELDS: ReadonlyArray<{ key: ProposalFieldKey; label: string; list?: boolean }> = [
  { key: 'title', label: 'Título' },
  { key: 'primary_artists', label: 'Artistas principales', list: true },
  { key: 'collaborators', label: 'Colaboradores', list: true },
  { key: 'release_type', label: 'Tipo' },
  { key: 'release_date', label: 'Fecha' },
  { key: 'label', label: 'Sello' },
  { key: 'genres', label: 'Géneros', list: true },
  { key: 'countries', label: 'Países', list: true }
];

/** Lo que detecta la fuente (inspect-release-source), por campo propuesto. */
const DETECTED_KEY: Partial<Record<ProposalFieldKey, string>> = {
  title: 'title',
  primary_artists: 'artists',
  release_type: 'type',
  release_date: 'release_date'
};

const text = (value: unknown) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');
const list = (value: unknown) => (Array.isArray(value) ? value.map(text).filter(Boolean) : []);
/** Sin tildes ni mayúsculas: solo para emparejar el nombre de un tipo con su slug. */
const fold = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es');

/** La fuente se leyó y trajo algo comparable. */
export function proposalDetection(item: Pick<ProposalLike, 'detected_metadata'>): 'available' | 'unavailable' {
  const detected = item.detected_metadata;
  if (!detected || detected.source_available === false) return 'unavailable';
  return Object.values(DETECTED_KEY).some((key) => {
    const value = detected[key!];
    return Array.isArray(value) ? list(value).length > 0 : text(value) !== '';
  })
    ? 'available'
    : 'unavailable';
}

/**
 * Lo propuesto, campo por campo, con la marca de lo editado. Un campo está
 * editado si la fuente detectó un valor y lo propuesto es distinto: cualquier
 * cambio de texto cuenta (también mayúsculas y tildes), salvo espacios de más.
 * Los artistas se comparan en orden. El tipo detectado es un nombre ("Álbum")
 * y se empareja con el slug propuesto sin tildes ni mayúsculas.
 */
export function proposalFields(
  item: Pick<ProposalLike, 'payload' | 'detected_metadata'>,
  typeOptions: ReadonlyArray<{ value: string; label: string }>
): ProposalField[] {
  const payload = item.payload ?? {};
  const detected = proposalDetection(item) === 'available' ? item.detected_metadata ?? {} : {};
  const typeLabel = (slug: string) => typeOptions.find((option) => option.value === slug)?.label ?? slug;

  return PROPOSAL_FIELDS.map(({ key, label, list: isList }) => {
    const raw = payload[key];
    const values = isList ? list(raw) : undefined;
    const proposed = isList ? values!.join(', ') : text(raw);
    const value = key === 'release_type' && proposed ? typeLabel(proposed) : proposed;

    const detectedKey = DETECTED_KEY[key];
    const before = detectedKey ? detected[detectedKey] : undefined;
    const beforeText = isList ? list(before).join(', ') : text(before);
    const hasDetection = beforeText !== '';
    let edited = false;
    if (hasDetection) {
      edited = key === 'release_type'
        ? fold(beforeText) !== fold(proposed) && fold(beforeText) !== fold(value)
        : beforeText !== proposed;
    }
    return { key, label, value, ...(isList ? { values } : {}), detected: hasDetection, edited };
  });
}

export type InboxGroup<T> = {
  id: string;
  label: string;
  /** Una línea bajo el nombre del grupo. */
  help?: string;
  /** Texto cuando el grupo está vacío. */
  empty: string;
  items: T[];
};

/**
 * Grupos de la lista de propuestas, con los filtros de la estación de E10:
 * - admin: cola prioritaria (aportes de colaboración y preparadas) y cola comunitaria;
 * - colaborador: primero la cola comunitaria (lo que puede preparar) y, si los
 *   hay, sus propios aportes, sin revisión;
 * - con el filtro de un lanzamiento: un solo grupo, en cualquier estado.
 */
export function proposalGroups<T extends ProposalLike>(
  items: T[],
  role: InboxRole,
  byRelease: boolean
): InboxGroup<T>[] {
  if (byRelease) {
    return [{ id: 'release', label: 'Propuestas de este lanzamiento', empty: 'Ninguna propuesta creó este lanzamiento: se cargó desde el catálogo.', items }];
  }
  const community = items.filter((item) => item.queue_kind === 'community' && item.status === 'pending');
  const priority = items.filter((item) => item.queue_kind === 'collaborator' || item.status === 'ready_for_admin');
  if (role === 'admin') {
    return [
      { id: 'priority', label: 'Cola prioritaria', help: 'Aportes de colaboración y propuestas ya preparadas.', empty: 'No hay propuestas en la cola prioritaria.', items: priority },
      { id: 'community', label: 'Cola comunitaria', help: 'Propuestas pendientes de la comunidad.', empty: 'No hay propuestas comunitarias pendientes.', items: community }
    ];
  }
  const groups: InboxGroup<T>[] = [
    { id: 'community', label: 'Cola comunitaria', help: 'Prepara propuestas ajenas para la revisión final.', empty: 'No hay propuestas comunitarias pendientes.', items: community }
  ];
  // Con la RLS de E09, lo prioritario que ve un colaborador son sus propios aportes.
  if (priority.length) {
    groups.push({ id: 'own', label: 'Mis aportes prioritarios', help: 'Pasan directo a administración; no los revisas tú.', empty: '', items: priority });
  }
  return groups;
}

/**
 * Qué puede hacer cada rol con una propuesta, igual que en E10:
 * - review: admin aprueba, pide cambios o rechaza (en cola);
 * - prepare: colaborador marca lista una propuesta comunitaria pendiente ajena;
 * - waiting: en cola, sin acciones para este rol;
 * - none: resuelta, solo consulta.
 */
export function proposalAction(item: ProposalLike, role: InboxRole, userId: string): 'review' | 'prepare' | 'waiting' | 'none' {
  if (item.status !== 'pending' && item.status !== 'ready_for_admin') return 'none';
  if (role === 'admin') return 'review';
  if (item.queue_kind === 'community' && item.status === 'pending' && item.author_id !== userId) return 'prepare';
  return 'waiting';
}

// ---------------------------------------------------------------------------
// Selección

/**
 * Elemento abierto en la bandeja. El de la URL si sigue en la lista; si no, en
 * ancho el primero (lista y detalle a la vez) y en móvil ninguno (solo la lista).
 */
export function selectInboxItem(ids: string[], requested: string | null, wide: boolean): string | null {
  if (requested && ids.includes(requested)) return requested;
  return wide ? ids[0] ?? null : null;
}

/** El que ocupa su lugar cuando `id` sale de la lista: el siguiente, o el anterior si era el último. */
export function inboxNeighbor(ids: string[], id: string): string | null {
  const index = ids.indexOf(id);
  if (index === -1) return null;
  return ids[index + 1] ?? ids[index - 1] ?? null;
}

// ---------------------------------------------------------------------------
// Reportes (E18)

export type ReportStatus = 'new' | 'triaged' | 'in_progress' | 'resolved' | 'closed';

export const OPEN_REPORT_STATUSES: ReadonlyArray<ReportStatus> = ['new', 'triaged', 'in_progress'];

/** Tono del chip de estado: lo nuevo pide atención; lo resuelto, ninguna. */
export const REPORT_STATUS_TONES: Record<ReportStatus, 'neutral' | 'accent' | 'warning' | 'danger'> = {
  new: 'warning',
  triaged: 'neutral',
  in_progress: 'accent',
  resolved: 'neutral',
  closed: 'neutral'
};

/** Abiertos (lo que cuenta la barra lateral) y resueltos o cerrados, cada uno en su orden. */
export function reportGroups<T extends { id: string; status: string }>(reports: T[]): InboxGroup<T>[] {
  const open = reports.filter((report) => (OPEN_REPORT_STATUSES as readonly string[]).includes(report.status));
  const closed = reports.filter((report) => !(OPEN_REPORT_STATUSES as readonly string[]).includes(report.status));
  return [
    { id: 'open', label: 'Abiertos', empty: 'No hay reportes abiertos.', items: open },
    { id: 'closed', label: 'Resueltos y cerrados', empty: 'Ninguno todavía.', items: closed }
  ];
}

/**
 * El contexto técnico de un reporte, en palabras. Solo las claves que E18
 * permite guardar; el id del lanzamiento y la hora ya se muestran aparte.
 */
export function reportContextRows(context: Record<string, unknown> | null | undefined): { label: string; value: string }[] {
  if (!context) return [];
  const rows: { label: string; value: string }[] = [];
  const add = (label: string, value: unknown) => {
    const clean = text(value);
    if (clean) rows.push({ label, value: clean });
  };
  add('Ruta', context.route);
  const viewport = context.viewport as { width?: unknown; height?: unknown } | undefined;
  if (viewport && typeof viewport.width === 'number' && typeof viewport.height === 'number') {
    rows.push({ label: 'Pantalla', value: `${viewport.width} × ${viewport.height}` });
  }
  add('Navegador', context.user_agent);
  add('Idioma', context.locale);
  if (typeof context.online === 'boolean') rows.push({ label: 'Conexión', value: context.online ? 'En línea' : 'Sin conexión' });
  add('Versión', context.app_version);
  add('Catálogo', context.catalog_source);
  return rows;
}
