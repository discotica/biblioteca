// Red de la suite visual. Todo lo que no sale del servidor local se resuelve aquí:
// - Supabase ficticio: auth simulada por rol, PostgREST sobre el snapshot de
//   staging y los fixtures del censo, funciones Edge simuladas.
// - Portadas y reproductores externos: respaldos locales.
// - Cualquier otra petición externa se aborta y queda registrada.
// Nada se reenvía a la red: no hay escrituras remotas posibles.
import type { BrowserContext, Request, Route } from '@playwright/test';
import { evaluateRead, type Row } from './postgrest';
import { coverSvg, embedHtml, embedProvider } from './fallbacks';
import {
  BROKEN_COVERS, SUPABASE_PROJECT, SUPABASE_URL, adminHistory, adminItems, adminQuickViewCounts, adminSelected, crateItems, crateRows,
  detectedSource, ownContributions, profileFor, publicAcceptedFor, publicProfileFor, queue, reports, sample, sessionFor,
  tables, type Role
} from './data';

export type MockContext = {
  url: URL; path: string; request: Request; route: Route; single: boolean;
  send: (body: unknown, status?: number, headers?: Record<string, string>) => Promise<void>;
};
export type MockOptions = {
  /** Intercepta antes que los mocks por defecto. Devuelve true si atendió la petición. */
  override?: (ctx: MockContext) => Promise<boolean | void>;
  noCrates?: boolean;
};
export type NetworkLog = { unmocked: string[]; blocked: string[]; writes: string[] };

const SNAPSHOT_TABLES = new Set(['catalog_releases', 'labels', 'genres', 'countries', 'release_types', 'artists']);

/** Peticiones en curso por contexto, para esperar por estado y no por tiempo. */
const inflight = new WeakMap<BrowserContext, { count: number }>();
export const pendingRequests = (ctx: BrowserContext) => inflight.get(ctx)?.count ?? 0;

// ---------- Diccionarios del Estudio (U19, G4) ----------
// Lista sobre el snapshot (solo publicados: publicados = total). Los estados de G1 se aplican solo
// aquí, para no cambiar las listas de Sugerir y del editor. Sin alias: el snapshot es anterior a G1.
type DictionaryBody = { p_kind: string; p_query?: string | null; p_filter?: string; p_page?: number; p_page_size?: number };
const G1_LEGACY = new Set(['Alemania', 'Australia', 'Austria', 'Canada', 'Corea del Sur', 'España', 'Estados Unidos', 'Francia', 'Hungría', 'India',
  'Islandia', 'Italia', 'Japón', 'Libano', 'Países Bajos', 'Pakistan', 'Reino Unido', 'Rumania', 'Suecia', 'Suiza', 'Trip Hop', 'Triphop', 'Hard', 'Progresivo', 'Sample']);
const G1_RETIRED = new Set(['WORLD', 'Entrañas', 'TSA', 'EE.UU', 'EEUU', 'USA', 'UK']);
const fold = (text: unknown) => String(text ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
const slugify = (text: unknown) => fold(text).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
let dictionaryCounts: Record<string, Map<string, number>> | null = null;
function dictionaryPage(body: DictionaryBody) {
  if (!dictionaryCounts) {
    dictionaryCounts = { genre: new Map(), country: new Map(), label: new Map(), artist: new Map() };
    const bump = (kind: string, name: unknown) => dictionaryCounts![kind].set(String(name), (dictionaryCounts![kind].get(String(name)) ?? 0) + 1);
    for (const release of tables.catalog_releases as Row[]) {
      for (const name of (release.genres as string[]) ?? []) bump('genre', name);
      for (const name of (release.countries as string[]) ?? []) bump('country', name);
      for (const name of new Set([...((release.artists as string[]) ?? []), ...(((release.collaborators as Row[]) ?? []).map((c) => c.name))])) bump('artist', name);
      if (release.label) bump('label', release.label);
    }
  }
  const kind = body.p_kind;
  const table = { genre: 'genres', country: 'countries', label: 'labels', artist: 'artists' }[kind] ?? 'genres';
  const closed = kind === 'genre' || kind === 'country';
  const all = (tables[table] as Row[]).map((row) => {
    const count = dictionaryCounts![kind].get(String(row.name)) ?? 0;
    const status = !closed ? null : G1_RETIRED.has(String(row.name)) ? 'retired' : G1_LEGACY.has(String(row.name)) ? 'legacy' : 'selectable';
    return {
      id: row.id, name: row.name, slug: row.slug, status, release_count: count, published_count: count, aliases: [], slug_aliases: [],
      public_slug: kind === 'artist' ? row.slug : kind === 'label' ? slugify(row.name) : null
    };
  }).sort((a, b) => fold(a.name).localeCompare(fold(b.name)) || String(a.name).localeCompare(String(b.name)));
  const filter = body.p_filter ?? 'all';
  const query = fold(body.p_query);
  const filtered = all.filter((item) => (filter === 'all' || (filter === 'orphans' ? item.release_count === 0 : item.status === filter))
    && (!query || fold(item.name).includes(query)));
  const size = body.p_page_size ?? 50;
  const page = body.p_page ?? 1;
  return {
    kind, filter, page, page_size: size, total: filtered.length,
    counts: {
      all: all.length, orphans: all.filter((item) => !item.release_count).length,
      selectable: all.filter((item) => item.status === 'selectable').length,
      legacy: all.filter((item) => item.status === 'legacy').length,
      retired: all.filter((item) => item.status === 'retired').length
    },
    items: filtered.slice((page - 1) * size, page * size)
  };
}

export async function installNetwork(ctx: BrowserContext, base: string, role: Role | null, opts: MockOptions = {}) {
  const log: NetworkLog = { unmocked: [], blocked: [], writes: [] };
  const counter = { count: 0 };
  inflight.set(ctx, counter);
  const session = role ? sessionFor(role) : null;
  const localOrigin = new URL(base).origin;

  if (session) {
    await ctx.addCookies([{
      name: `sb-${SUPABASE_PROJECT}-auth-token`,
      value: `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`,
      url: base, httpOnly: false, secure: false, sameSite: 'Lax'
    }]);
  }

  const describe = (request: Request) => {
    const u = new URL(request.url());
    return `${request.method()} ${u.pathname}${u.search}`.slice(0, 240);
  };

  async function supabase(route: Route, request: Request) {
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const single = (request.headers().accept ?? '').includes('vnd.pgrst.object');
    const send = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
      route.fulfill({
        status, headers: { 'access-control-allow-origin': '*', ...headers },
        contentType: 'application/json', body: body === undefined ? '' : JSON.stringify(body)
      });
    if (method === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    }
    if (opts.override && (await opts.override({ url, path, request, route, single, send }))) return;

    // ---------- auth ----------
    if (path.startsWith('/auth/v1/')) {
      if (path.endsWith('/signup')) return send({ id: 'new-user', aud: 'authenticated', email: 'nueva@example.test', user_metadata: { username: 'nueva' }, identities: [{}], created_at: '2026-10-03T00:00:00Z' });
      if (path.endsWith('/recover')) return send({});
      if (path.endsWith('/resend')) return send({});
      if (path.endsWith('/logout')) return send(undefined, 204);
      if (path.endsWith('/token')) return session ? send(session) : send({ error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400);
      if (path.endsWith('/user')) return session ? send(session.user) : send({ code: 401, msg: 'missing session' }, 401);
      log.unmocked.push(describe(request));
      return send({}, 404);
    }

    // ---------- funciones Edge ----------
    if (path.startsWith('/functions/v1/')) {
      if (path.endsWith('/login-with-username')) return send({ error: 'Credenciales inválidas' }, 400);
      if (path.endsWith('/inspect-release-source')) return send(detectedSource(sample[20]));
      log.unmocked.push(describe(request));
      return send({ error: 'Función no simulada' }, 404);
    }

    // ---------- PostgREST ----------
    if (!path.startsWith('/rest/v1/')) {
      log.unmocked.push(describe(request));
      return send({}, 404);
    }
    const resource = path.slice('/rest/v1/'.length);
    const headers = request.headers();

    if (resource.startsWith('rpc/')) {
      const fn = resource.slice(4);
      if (fn === 'resolve_release_slug') {
        const slug = String((request.postDataJSON() as { p_slug?: string } | null)?.p_slug ?? '');
        const row = (tables.catalog_releases as Row[]).find((candidate) => candidate.slug === slug);
        return send(row ? [{ release_id: row.id, canonical_slug: row.slug, match_kind: 'canonical', alias_kind: null }] : []);
      }
      if (fn === 'get_public_accepted_contributions') {
        const id = String((request.postDataJSON() as { p_profile_id?: string } | null)?.p_profile_id ?? '');
        return send(publicAcceptedFor(id));
      }
      if (!session) return send({ code: '42501', message: 'permission denied' }, 401);
      if (fn === 'admin_list_catalog_releases') {
        // Vista rápida del Estudio (D2): filtra con las mismas señales.
        const view = (request.postDataJSON() as { p_quick_view?: string | null } | null)?.p_quick_view ?? null;
        const items = !view ? adminItems : adminItems.filter((item) =>
          view === 'draft' ? item.signals.draft
            : view === 'incomplete' ? item.signals.incomplete
              : view === 'missing_cover' ? item.signals.missing_cover
                : item.signals.open_report_count > 0);
        return send({ items, total: view ? items.length : 2790, page: 1, page_size: 25, quick_view: view });
      }
      if (fn === 'resolve_catalog_names') {
        // U19 (G3): qué nombres de artista o sello ya existen. Sin alias: el snapshot es anterior a G1.
        const body = request.postDataJSON() as { p_kind: string; p_names: string[] };
        const pool = (body.p_kind === 'artist' ? tables.artists : tables.labels) as Row[];
        return send(body.p_names.map((name) => {
          const row = pool.find((candidate) => String(candidate.name).toLowerCase() === name.toLowerCase());
          return { name, id: row?.id ?? null, canonical: row?.name ?? null };
        }));
      }
      if (fn === 'admin_list_catalog_dictionary') return send(dictionaryPage(request.postDataJSON() as DictionaryBody));
      if (fn === 'admin_catalog_quick_view_counts') return send(adminQuickViewCounts);
      if (fn === 'admin_get_catalog_release') return send(adminSelected);
      if (fn === 'admin_get_catalog_history') return send(adminHistory);
      log.writes.push(describe(request));
      return send({});
    }

    if (method !== 'GET' && method !== 'HEAD') {
      // Escritura simulada: se responde localmente y nunca sale a la red.
      log.writes.push(describe(request));
      return send(method === 'DELETE' ? undefined : [], method === 'DELETE' ? 204 : 201);
    }

    // Alias de U19: el snapshot es anterior a G1 y no tiene ninguno.
    if (resource === 'artist_aliases' || resource === 'label_aliases') return send([]);

    if (SNAPSHOT_TABLES.has(resource)) {
      const result = evaluateRead(tables[resource], url, headers);
      if (result) return send(result.body, result.status, result.headers);
      log.unmocked.push(describe(request));
      return send([]);
    }

    const respond = (rows: Row[]) => {
      const result = evaluateRead(rows, url, headers);
      if (result) return send(result.body, result.status, result.headers);
      log.unmocked.push(describe(request));
      return send(single ? null : rows);
    };

    // Perfil público por usuario (U14): lo lee cualquiera, como en la base.
    if (resource === 'profiles' && url.searchParams.get('username')) {
      const username = (url.searchParams.get('username') ?? '').replace(/^eq\./, '');
      const profile = publicProfileFor(username);
      return send(single ? profile : profile ? [profile] : []);
    }

    if (!session || !role) {
      // Anónimo (U14): ve las colecciones públicas y sus ítems, como con RLS.
      const publicCrates = crateRows.filter((crate) => crate.is_public);
      if (resource === 'crates') return respond(opts.noCrates ? [] : publicCrates);
      if (resource === 'crate_items') return respond(crateItems.filter((item) => publicCrates.some((crate) => crate.id === item.crate_id)));
      // Las demás tablas privadas o ficticias no devuelven filas.
      if (!['profiles', 'crates', 'crate_items', 'contributions', 'problem_reports'].includes(resource)) log.unmocked.push(describe(request));
      return respond([]);
    }

    const select = url.searchParams.get('select') ?? '';
    if (resource === 'profiles') {
      if (select === 'role') return single ? send({ role }) : send([{ role }]);
      const own = profileFor(role);
      // newsletter y redes (D1) solo los muestra "Editar cuenta" (U12); las demás vistas no los leen.
      return send(single ? { ...own, display_name: 'Comunidad', bio: null, newsletter_opt_in: true, social_bandcamp: 'comunidad', social_bandcamp_kind: 'fan', social_instagram: 'comunidad.mx', social_soundcloud: null, social_x: null, social_facebook: null } : []);
    }
    if (resource === 'crates') return respond(opts.noCrates ? [] : crateRows);
    if (resource === 'crate_items') return respond(crateItems);
    if (resource === 'contributions') {
      const id = url.searchParams.get('id');
      const all = [...queue, ...ownContributions];
      if (id?.startsWith('eq.')) return send(all.find((c) => c.id === id.slice(3)) ?? null);
      if (url.searchParams.get('author_id')) return send(ownContributions);
      return send(role === 'admin' || role === 'colaborador' ? queue : []);
    }
    if (resource === 'problem_reports') return send(reports);
    log.unmocked.push(describe(request));
    return send(single ? null : []);
  }

  await ctx.route((url) => url.origin !== localOrigin, async (route, request) => {
    counter.count++;
    try {
      const url = request.url();
      if (url.startsWith(SUPABASE_URL)) return await supabase(route, request);
      const provider = embedProvider(url);
      if (provider) return await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: embedHtml(provider) });
      if (request.resourceType() === 'image' || /\.(avif|webp|jpe?g|png|gif)(\?|$)/i.test(url)) {
        if (BROKEN_COVERS.has(url)) return await route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' });
        return await route.fulfill({ status: 200, contentType: 'image/svg+xml', body: coverSvg(url) });
      }
      log.blocked.push(`${request.resourceType()} ${url.slice(0, 200)}`);
      return await route.abort('blockedbyclient');
    } catch (error) {
      // El contexto puede cerrarse con una petición retenida (estado de carga).
      if (!String(error).includes('closed')) throw error;
    } finally {
      counter.count--;
    }
  });

  return log;
}
