// Datos de la suite visual. El catálogo y los diccionarios vienen de
// data/staging.json.gz (grabado en solo lectura con `npm run visual:data`).
// Sesiones, colecciones, propuestas, reportes y perfiles son ficticios, igual
// que en el censo del 2026-10-03.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import type { Row } from './postgrest';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SNAPSHOT_FILE = path.resolve(here, '../data/staging.json.gz');

type Credit = { id: string; name: string; slug: string; position: number };
export type CatalogRow = Row & {
  id: string; slug: string; title: string; release_date: string | null; type: string | null; label: string | null;
  review: string | null; buy_link: string | null; cover: string | null; genres: string[] | null; countries: string[] | null;
  primary_artists: Credit[] | null; collaborators: Credit[] | null; credit_quality: string | null;
  experimental: number | null; denso: number | null; sintetico: number | null; bailable: number | null; rapido: number | null;
};
type Snapshot = { recordedAt: string; counts: Record<string, number>; tables: Record<string, Row[]> };

if (!fs.existsSync(SNAPSHOT_FILE)) {
  throw new Error(`Falta ${path.relative(process.cwd(), SNAPSHOT_FILE)}. Ejecuta \`npm run visual:data\`.`);
}
export const snapshot = JSON.parse(zlib.gunzipSync(fs.readFileSync(SNAPSHOT_FILE)).toString('utf8')) as Snapshot;
export const tables = snapshot.tables;
// U19: el snapshot es anterior a las listas cerradas de G1. Sin `status`, todo es seleccionable
// (Sugerir pide `status=eq.selectable`). Se quita al volver a grabar con staging después de G5.
for (const table of ['genres', 'countries']) for (const row of tables[table]) row.status ??= 'selectable';
const catalog = tables.catalog_releases as CatalogRow[];

// ---------- reloj y origen fijos ----------
/** Mediodía en Bogotá del día del censo. Todas las páginas ven esta hora. */
export const FIXED_TIME = new Date('2026-10-03T17:00:00.000Z');
/** Supabase ficticio: la app nunca habla con staging durante la captura. */
export const SUPABASE_URL = 'https://visual-fixture.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_visual_fixture';
export const SUPABASE_PROJECT = 'visual-fixture';
/** Origen público estable para textos que guardan URLs (reportes). */
const PUBLIC_ORIGIN = 'https://discotica.com';

// ---------- selección de lanzamientos (fija por slug) ----------
function bySlug(slug: string) {
  const row = catalog.find((candidate) => candidate.slug === slug);
  if (!row) throw new Error(`El snapshot no contiene ${slug}. Revisa la selección en support/data.ts.`);
  return row;
}

export const pick = {
  /** Bandcamp, 1 principal + 9 colaboradores. */
  collab: bySlug('killing-mariposas-luca-duran--e64393d6'),
  /** Tipo Compilado con 20 principales. */
  compilado: bySlug('housepulse-43-fausto--59852b58'),
  /** Álbum con enlace de Spotify. */
  spotify: bySlug('alicia-mandragora--695728ae'),
  /** Título más largo del catálogo. */
  longTitle: bySlug('crashing-waves-dance-to-the-rhythm-set-by-the-broadcast-journalist-revealing-the-tragedies-of-the-day-nicolas-jaar--d3fe469c'),
  review: bySlug('jotadellicias-vol-1-jotadelli--40a0db1c'),
  soundcloud: bySlug('madafa-mistik--271ebb1c'),
  noCover: bySlug('nalgxs-cuervo--6516762c')
};
/** Lanzamientos más recientes en el orden por defecto: alimentan los fixtures ficticios. */
export const sample = catalog.slice(0, 40);
export const ARTIST_SLUG = 'entranas--38c34929';
export const LABEL_SLUG = 'trampa';
/** Desde R2 solo un Compilado muestra "Varios artistas" en la tarjeta (antes: 'Curation 03', un EP con 6 principales). */
export const VARIOS_CARD_TITLE = 'HOUSEPULSE -43';
/** Portadas que fallan en producción y deben seguir fallando en la captura. */
export const BROKEN_COVERS = new Set([pick.soundcloud.cover].filter(Boolean) as string[]);

// ---------- sesiones simuladas ----------
export type Role = 'comunidad' | 'colaborador' | 'admin';
export const ids = {
  community: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  collaborator: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  admin: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'
};
const roleUser = {
  comunidad: { id: ids.community, username: 'comunidad' },
  colaborador: { id: ids.collaborator, username: 'colaboradora' },
  admin: { id: ids.admin, username: 'jmamanche' }
} satisfies Record<Role, { id: string; username: string }>;

export function sessionFor(role: Role) {
  const { id, username } = roleUser[role];
  const expiresAt = Math.floor(FIXED_TIME.getTime() / 1000) + 36000;
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: id, role: 'authenticated', exp: expiresAt })).toString('base64url');
  return {
    access_token: `${header}.${payload}.signature`,
    refresh_token: 'fixture-refresh',
    expires_in: 36000,
    expires_at: expiresAt,
    token_type: 'bearer',
    user: {
      id, aud: 'authenticated', role: 'authenticated', email: `${username}@example.test`,
      app_metadata: {}, user_metadata: { username }, created_at: '2026-09-18T00:00:00Z'
    }
  };
}
export type Session = ReturnType<typeof sessionFor>;

// ---------- fixtures ficticios (mismos del censo) ----------
type Dict = { id: string; name: string };
const dict = (table: string) => tables[table] as Dict[];
const byName = (list: Dict[], name: unknown) =>
  list.find((entry) => entry.name?.toLowerCase() === String(name ?? '').toLowerCase())?.id ?? null;

function adminRelease(r: CatalogRow, status = 'published', version = 4) {
  return {
    id: r.id, slug: r.slug, title: r.title, release_date: r.release_date,
    release_type_id: byName(dict('release_types'), r.type), label_id: byName(dict('labels'), r.label),
    review: r.review ?? '', status, credit_quality: r.credit_quality ?? 'proposed', catalog_version: version,
    updated_at: '2026-09-30T14:30:00Z',
    artist_ids: (r.primary_artists ?? []).map((a) => a.id), collaborator_ids: (r.collaborators ?? []).map((a) => a.id),
    genre_ids: (r.genres ?? []).map((g) => byName(dict('genres'), g)).filter(Boolean),
    country_ids: (r.countries ?? []).map((g) => byName(dict('countries'), g)).filter(Boolean),
    radar: { experimental: r.experimental ?? 0, denso: r.denso ?? 0, sintetico: r.sintetico ?? 0, bailable: r.bailable ?? 0, rapido: r.rapido ?? 0 },
    links: r.buy_link
      ? [{ provider: /bandcamp/.test(r.buy_link) ? 'Bandcamp' : /spotify/.test(r.buy_link) ? 'Spotify' : /soundcloud/.test(r.buy_link) ? 'SoundCloud' : 'Enlace', url: r.buy_link, is_primary: true }]
      : [],
    cover_url: r.cover || null,
    source: { mode: 'imported', provider: 'Bandcamp', url: null, cover_source_url: null },
    signals: { draft: status === 'draft', incomplete: false, missing_fields: [] as string[], missing_cover: false, open_report_count: 0 }
  };
}

/**
 * Señales del Estudio (D2), con el mismo criterio que la base: lo que impide
 * publicar. Los reportes abiertos se cuentan cuando ya existen los reportes.
 */
function withSignals<T extends ReturnType<typeof adminRelease>>(release: T): T {
  const missing: string[] = [];
  if (!release.release_date) missing.push('release_date');
  if (!release.release_type_id) missing.push('release_type');
  if (!release.label_id) missing.push('label');
  if (!release.artist_ids.length) missing.push('primary_artist');
  if (!release.genre_ids.length) missing.push('genre');
  if (!release.country_ids.length) missing.push('country');
  if (!release.cover_url || !/^https:\/\//i.test(release.cover_url)) missing.push('cover');
  if (!release.links.some((link) => link.is_primary && /^https:\/\//i.test(link.url))) missing.push('primary_link');
  release.signals = { ...release.signals, incomplete: missing.length > 0, missing_fields: missing, missing_cover: missing.includes('cover') };
  return release;
}

export const adminItems = [
  ...sample.slice(0, 25).map((r, i) => withSignals(adminRelease(r, i === 2 ? 'draft' : i === 7 ? 'archived' : 'published'))),
  withSignals(adminRelease(pick.noCover, 'draft'))
];
export const adminSelected = withSignals(adminRelease(pick.collab, 'published'));
const adminActor = { id: ids.admin, username: 'jmamanche', display_name: 'JD Mamanché' };
export const adminHistory = {
  release_id: adminSelected.id,
  items: [
    { change_set_id: 'c1', operation: 'update', reason: 'Corrección de créditos: separar colaboradores', status: 'applied', base_version: 3, result_version: 4, created_at: '2026-09-30T14:30:00Z', reverted_at: null, actor: adminActor, before_state: { ...adminSelected, title: 'Killing mariposas', catalog_version: 3 }, after_state: adminSelected },
    { change_set_id: 'c2', operation: 'publish', reason: 'Publicación inicial', status: 'applied', base_version: 2, result_version: 3, created_at: '2026-09-20T10:00:00Z', reverted_at: null, actor: adminActor, before_state: { ...adminSelected, status: 'draft', catalog_version: 2 }, after_state: { ...adminSelected, catalog_version: 3 } },
    { change_set_id: 'c3', operation: 'update', reason: 'Importación desde Sheets', status: 'applied', base_version: 1, result_version: 2, created_at: '2026-09-15T09:00:00Z', reverted_at: '2026-09-16T09:00:00Z', actor: { id: ids.admin, username: 'sistema', display_name: 'Importador' }, before_state: { ...adminSelected, catalog_version: 1 }, after_state: { ...adminSelected, catalog_version: 2 } }
  ]
};

const names = (credits: Credit[] | null) => (credits ?? []).map((a) => a.name);
const payloadOf = (r: CatalogRow, note = '') => ({
  version: 2, title: r.title, primary_artists: names(r.primary_artists), collaborators: names(r.collaborators),
  release_type: 'album', release_date: r.release_date, genres: r.genres ?? [], countries: r.countries ?? [], label: r.label, team_note: note
});
export const detectedSource = (r: CatalogRow) => ({
  provider: 'bandcamp', source_available: true, title: r.title, artists: names(r.primary_artists), type: r.type, release_date: r.release_date, cover_url: r.cover
});
function contribution(r: CatalogRow, i: number, over: Record<string, unknown> = {}) {
  return {
    id: `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb${String(i).padStart(2, '0')}`, author_id: ids.community, status: 'pending',
    source_url: r.buy_link, source_provider: 'bandcamp',
    payload: payloadOf(r, i % 2 ? 'Lo escuché en una sesión de radio local, vale la pena revisar los créditos de remix.' : ''),
    payload_version: 2, payload_quality: 'confirmed', detected_metadata: detectedSource(r),
    queue_kind: 'community', submitted_at: `2026-09-2${i}T14:00:00Z`, reviewer_note: null, reviewed_at: null, release_id: null,
    created_at: '2026-09-18T13:00:00Z', updated_at: `2026-09-2${i}T14:00:00Z`, ...over
  };
}
export const queue = [
  contribution(sample[30], 1, { queue_kind: 'collaborator', author_id: ids.collaborator }),
  contribution(sample[31], 2, { status: 'ready_for_admin' }),
  contribution(sample[32], 3),
  contribution(sample[33], 4),
  contribution(sample[34], 5)
];
export const ownContributions = [
  contribution(sample[35], 6, { status: 'draft', submitted_at: null }),
  contribution(sample[36], 7, { status: 'changes_requested', reviewer_note: 'Falta el sello: confirma si es autoeditado o si salió por un sello.' }),
  contribution(sample[37], 8, { status: 'pending' }),
  contribution(sample[38], 9, { status: 'approved', release_id: sample[38].id }),
  contribution(sample[39], 1, { status: 'rejected', reviewer_note: 'Ya existe en el catálogo.' })
];
export const reports = [
  { id: 'r1', author_id: ids.community, category: 'catalog_error', description: 'El país de este lanzamiento está mal: el artista es de Ecuador, no de Colombia.', page_url: `${PUBLIC_ORIGIN}/lanzamiento/${sample[3].slug}`, release_id: sample[3].id, technical_context: {}, screenshot_path: null, status: 'new', assigned_to: null, created_at: '2026-09-29T12:00:00Z', updated_at: '2026-09-29T12:00:00Z' },
  { id: 'r2', author_id: ids.collaborator, category: 'technical_bug', description: 'El reproductor de SoundCloud no carga en Safari iOS.', page_url: `${PUBLIC_ORIGIN}/`, release_id: null, technical_context: {}, screenshot_path: null, status: 'triaged', assigned_to: null, created_at: '2026-09-28T12:00:00Z', updated_at: '2026-09-28T12:00:00Z' }
];
const OPEN_REPORT = new Set(['new', 'triaged', 'in_progress']);
for (const release of [...adminItems, adminSelected]) {
  release.signals.open_report_count = reports.filter((report) => report.release_id === release.id && OPEN_REPORT.has(report.status)).length;
}
/** Conteos de las vistas rápidas del Estudio (D2), a escala del catálogo real. */
export const adminQuickViewCounts = { total: 2790, draft: 300, incomplete: 712, missing_cover: 30, open_reports: 15, statuses: null };
const owner = { username: 'comunidad', display_name: 'Comunidad' };
export const crateRows = [
  { id: 'cr1', owner_id: ids.community, name: 'Para abrir el set', description: 'Intros lentas, texturas y percusión que crece.', slug: 'para-abrir-el-set', is_public: true, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z', crate_items: [{ count: 6 }], profiles: owner },
  { id: 'cr2', owner_id: ids.community, name: 'Dembow raro', description: null, slug: 'dembow-raro', is_public: false, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z', crate_items: [{ count: 3 }], profiles: owner },
  { id: 'cr3', owner_id: ids.community, name: 'Pendientes por escuchar con calma este fin de semana largo', description: 'Una lista con un nombre muy largo para probar cortes.', slug: 'pendientes', is_public: true, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z', crate_items: [{ count: 0 }], profiles: owner }
];
export const crateItems = [
  ...sample.slice(8, 14).map((r, i) => ({
    id: `ci${i}`, crate_id: 'cr1', release_id: r.id, lanzamiento_slug: r.slug,
    note: i === 1 ? 'Funciona perfecto después de un ambient.' : null, added_at: `2026-09-0${i + 1}T00:00:00Z`, position: i
  })),
  // U14: la colección privada también tiene portadas para su mosaico (3 de 4).
  ...sample.slice(14, 17).map((r, i) => ({
    id: `ci-dr${i}`, crate_id: 'cr2', release_id: r.id, lanzamiento_slug: r.slug,
    note: null, added_at: `2026-08-0${i + 1}T00:00:00Z`, position: i
  }))
];
/**
 * Perfil público (D1, U14): redes y preferencia de aportes. Comunidad muestra
 * sus aportes aceptados y dos redes; admin y colaboradora no.
 */
export function publicProfileFor(username: string) {
  const role = (Object.keys(roleUser) as Role[]).find((candidate) => roleUser[candidate].username === username);
  if (!role) return null;
  const community = role === 'comunidad';
  return {
    ...profileFor(role),
    social_bandcamp: community ? 'comunidad' : null,
    social_bandcamp_kind: community ? 'fan' : null,
    social_soundcloud: null,
    social_instagram: community ? 'comunidad.mx' : null,
    social_x: null,
    social_facebook: null,
    show_accepted_contributions: community
  };
}

/** Respuesta de get_public_accepted_contributions: solo si el perfil lo permite. */
export function publicAcceptedFor(profileId: string) {
  const profile = (Object.keys(roleUser) as Role[]).map((role) => publicProfileFor(roleUser[role].username)).find((p) => p?.id === profileId);
  if (!profile?.show_accepted_contributions) return [];
  return ownContributions
    .filter((c) => c.status === 'approved' && c.release_id)
    .map((c) => ({ release_id: c.release_id, accepted_at: '2026-09-20T12:00:00Z' }));
}

export function profileFor(role: Role) {
  const { id, username } = roleUser[role];
  return {
    id, username, display_name: role === 'comunidad' ? 'Comunidad' : 'JD Mamanché',
    bio: 'Escucha de sellos pequeños y radio comunitaria.', created_at: '2026-01-01T00:00:00Z'
  };
}
