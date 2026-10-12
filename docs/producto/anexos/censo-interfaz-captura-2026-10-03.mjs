// ANEXO DE REFERENCIA (plan de interfaz, etapa U1). Es el script que generó las
// 127 capturas del censo del 2026-10-03. No corre tal cual: necesita en CENSO_DIR
// releases.json ({ pick, sample }) y dicts.json ({ extra }) leídos de staging, y un
// servidor de desarrollo en :5199. U1 lo convierte en una suite reproducible.
// Captura el catálogo visual de Discótica. Lectura real de staging (anon) +
// sesiones simuladas por rol para vistas privadas. No escribe nada remoto.
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const SP = process.env.CENSO_DIR ?? 'build/censo'; // datos de muestra (releases.json, dicts.json) y salida
const OUT = `${SP}/shots`;
const BASE = 'http://127.0.0.1:5199';
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const SUPA = env.VITE_SUPABASE_URL;
const ANON = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const PROJECT = new URL(SUPA).hostname.split('.')[0];
const { pick, sample } = JSON.parse(fs.readFileSync(`${SP}/releases.json`, 'utf8'));
const dicts = JSON.parse(fs.readFileSync(`${SP}/dicts.json`, 'utf8'));
const extra = Object.fromEntries(dicts.extra.map((r) => [r.slug, r]));
const REVIEW = extra['jotadellicias-vol-1-jotadelli--40a0db1c'];
const SOUNDCLOUD = extra['madafa-mistik--271ebb1c'];
const NOCOVER = extra['nalgxs-cuervo--6516762c'];

const VP = {
  D: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  T: { viewport: { width: 834, height: 1112 }, deviceScaleFactor: 1, hasTouch: true },
  M: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }
};

// ---------- fixtures ----------
const ids = { community: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', collaborator: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', admin: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3' };
const byName = (list, name) => list.find((e) => e.name?.toLowerCase() === String(name ?? '').toLowerCase())?.id ?? null;
function snapshot(r, status = 'published', version = 4) {
  return {
    id: r.id, slug: r.slug, title: r.title, release_date: r.release_date,
    release_type_id: byName(dicts.release_types, r.type), label_id: byName(dicts.labels, r.label),
    review: r.review ?? '', status, credit_quality: r.credit_quality ?? 'proposed', catalog_version: version,
    updated_at: '2026-09-30T14:30:00Z',
    artist_ids: (r.primary_artists ?? []).map((a) => a.id), collaborator_ids: (r.collaborators ?? []).map((a) => a.id),
    genre_ids: (r.genres ?? []).map((g) => byName(dicts.genres, g)).filter(Boolean),
    country_ids: (r.countries ?? []).map((g) => byName(dicts.countries, g)).filter(Boolean),
    radar: { experimental: r.experimental ?? 0, denso: r.denso ?? 0, sintetico: r.sintetico ?? 0, bailable: r.bailable ?? 0, rapido: r.rapido ?? 0 },
    links: r.buy_link ? [{ provider: /bandcamp/.test(r.buy_link) ? 'Bandcamp' : /spotify/.test(r.buy_link) ? 'Spotify' : /soundcloud/.test(r.buy_link) ? 'SoundCloud' : 'Enlace', url: r.buy_link, is_primary: true }] : [],
    cover_url: r.cover || null,
    source: { mode: 'imported', provider: 'Bandcamp', url: null, cover_source_url: null }
  };
}
const adminItems = sample.slice(0, 25).map((r, i) => snapshot(r, i === 2 ? 'draft' : i === 7 ? 'archived' : 'published'));
adminItems.push(snapshot(NOCOVER, 'draft'));
const adminSelected = snapshot(pick.collab, 'published');
const adminHistory = {
  release_id: adminSelected.id,
  items: [
    { change_set_id: 'c1', operation: 'update', reason: 'Corrección de créditos: separar colaboradores', status: 'applied', base_version: 3, result_version: 4, created_at: '2026-09-30T14:30:00Z', reverted_at: null, actor: { id: ids.admin, username: 'jmamanche', display_name: 'JD Mamanché' }, before_state: { ...adminSelected, title: 'Killing mariposas', catalog_version: 3 }, after_state: adminSelected },
    { change_set_id: 'c2', operation: 'publish', reason: 'Publicación inicial', status: 'applied', base_version: 2, result_version: 3, created_at: '2026-09-20T10:00:00Z', reverted_at: null, actor: { id: ids.admin, username: 'jmamanche', display_name: 'JD Mamanché' }, before_state: { ...adminSelected, status: 'draft', catalog_version: 2 }, after_state: { ...adminSelected, catalog_version: 3 } },
    { change_set_id: 'c3', operation: 'update', reason: 'Importación desde Sheets', status: 'applied', base_version: 1, result_version: 2, created_at: '2026-09-15T09:00:00Z', reverted_at: '2026-09-16T09:00:00Z', actor: { id: ids.admin, username: 'sistema', display_name: 'Importador' }, before_state: { ...adminSelected, catalog_version: 1 }, after_state: { ...adminSelected, catalog_version: 2 } }
  ]
};

const payloadOf = (r, note = '') => ({ version: 2, title: r.title, primary_artists: (r.primary_artists ?? []).map((a) => a.name), collaborators: (r.collaborators ?? []).map((a) => a.name), release_type: 'album', release_date: r.release_date, genres: r.genres ?? [], countries: r.countries ?? [], label: r.label, team_note: note });
function contribution(r, i, over = {}) {
  return {
    id: `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb${String(i).padStart(2, '0')}`, author_id: ids.community, status: 'pending',
    source_url: r.buy_link, source_provider: 'bandcamp', payload: payloadOf(r, i % 2 ? 'Lo escuché en una sesión de radio local, vale la pena revisar los créditos de remix.' : ''),
    payload_version: 2, payload_quality: 'confirmed',
    detected_metadata: { provider: 'bandcamp', source_available: true, title: r.title, artists: (r.primary_artists ?? []).map((a) => a.name), type: r.type, release_date: r.release_date, cover_url: r.cover },
    queue_kind: 'community', submitted_at: `2026-09-2${i}T14:00:00Z`, reviewer_note: null, reviewed_at: null, release_id: null,
    created_at: '2026-09-18T13:00:00Z', updated_at: `2026-09-2${i}T14:00:00Z`, ...over
  };
}
const queue = [
  contribution(sample[30], 1, { queue_kind: 'collaborator', author_id: ids.collaborator }),
  contribution(sample[31], 2, { status: 'ready_for_admin' }),
  contribution(sample[32], 3),
  contribution(sample[33], 4),
  contribution(sample[34], 5)
];
const ownContributions = [
  contribution(sample[35], 6, { status: 'draft', submitted_at: null }),
  contribution(sample[36], 7, { status: 'changes_requested', reviewer_note: 'Falta el sello: confirma si es autoeditado o si salió por un sello.' }),
  contribution(sample[37], 8, { status: 'pending' }),
  contribution(sample[38], 9, { status: 'approved', release_id: sample[38].id }),
  contribution(sample[39], 1, { status: 'rejected', reviewer_note: 'Ya existe en el catálogo.' })
];
const reports = [
  { id: 'r1', author_id: ids.community, category: 'catalog_error', description: 'El país de este lanzamiento está mal: el artista es de Ecuador, no de Colombia.', page_url: `${BASE}/lanzamiento/${sample[3].slug}`, release_id: sample[3].id, technical_context: {}, screenshot_path: null, status: 'new', assigned_to: null, created_at: '2026-09-29T12:00:00Z', updated_at: '2026-09-29T12:00:00Z' },
  { id: 'r2', author_id: ids.collaborator, category: 'technical_bug', description: 'El reproductor de SoundCloud no carga en Safari iOS.', page_url: `${BASE}/`, release_id: null, technical_context: {}, screenshot_path: null, status: 'triaged', assigned_to: null, created_at: '2026-09-28T12:00:00Z', updated_at: '2026-09-28T12:00:00Z' }
];
const crateRows = [
  { id: 'cr1', owner_id: ids.community, name: 'Para abrir el set', description: 'Intros lentas, texturas y percusión que crece.', slug: 'para-abrir-el-set', is_public: true, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z', crate_items: [{ count: 6 }], profiles: { username: 'comunidad', display_name: 'Comunidad' } },
  { id: 'cr2', owner_id: ids.community, name: 'Dembow raro', description: null, slug: 'dembow-raro', is_public: false, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z', crate_items: [{ count: 3 }], profiles: { username: 'comunidad', display_name: 'Comunidad' } },
  { id: 'cr3', owner_id: ids.community, name: 'Pendientes por escuchar con calma este fin de semana largo', description: 'Una lista con un nombre muy largo para probar cortes.', slug: 'pendientes', is_public: true, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z', crate_items: [{ count: 0 }], profiles: { username: 'comunidad', display_name: 'Comunidad' } }
];
const crateItems = sample.slice(8, 14).map((r, i) => ({ id: `ci${i}`, crate_id: 'cr1', release_id: r.id, lanzamiento_slug: r.slug, note: i === 1 ? 'Funciona perfecto después de un ambient.' : null, added_at: `2026-09-0${i + 1}T00:00:00Z` }));

function sessionFor(role) {
  const userId = ids[role === 'comunidad' ? 'community' : role === 'colaborador' ? 'collaborator' : 'admin'];
  const username = role === 'comunidad' ? 'comunidad' : role === 'colaborador' ? 'colaboradora' : 'jmamanche';
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: userId, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 36000 })).toString('base64url');
  return {
    access_token: `${header}.${payload}.signature`, refresh_token: 'fixture-refresh', expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, token_type: 'bearer',
    user: { id: userId, aud: 'authenticated', role: 'authenticated', email: `${username}@example.test`, app_metadata: {}, user_metadata: { username }, created_at: '2026-09-18T00:00:00Z' }
  };
}

async function installMocks(ctx, role, opts = {}) {
  const session = role ? sessionFor(role) : null;
  if (session) {
    await ctx.addCookies([{ name: `sb-${PROJECT}-auth-token`, value: `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`, domain: '127.0.0.1', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' }]);
  }
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const p = u.pathname;
    const single = (req.headers().accept || '').includes('vnd.pgrst.object');
    const send = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const pass = () => route.continue({ headers: { ...req.headers(), authorization: `Bearer ${ANON}` } });
    if (opts.override) { const handled = await opts.override({ u, p, req, send, single, route }); if (handled !== undefined) return handled; }
    if (p.startsWith('/auth/v1/')) {
      if (p.endsWith('/signup')) return send({ id: 'new-user', aud: 'authenticated', email: 'nueva@example.test', user_metadata: { username: 'nueva' }, identities: [{}], created_at: '2026-10-03T00:00:00Z' });
      if (p.endsWith('/recover')) return send({});
      if (!session) return pass();
      return send(session.user);
    }
    if (p.includes('/functions/v1/login-with-username')) return send({ error: 'Credenciales inválidas' }, 400);
    if (p.includes('/functions/v1/inspect-release-source')) { const r = sample[20]; return send({ provider: 'bandcamp', source_available: true, title: r.title, artists: (r.primary_artists ?? []).map((a) => a.name), type: r.type, release_date: r.release_date, cover_url: r.cover }); }
    if (!session) return pass();
    const sel = u.searchParams.get('select') || '';
    if (p === '/rest/v1/profiles') {
      if (sel === 'role') return single ? send({ role }) : send([{ role }]);
      if (u.searchParams.get('username')) return send(single ? { id: session.user.id, username: session.user.user_metadata.username, display_name: role === 'comunidad' ? 'Comunidad' : 'JD Mamanché', bio: 'Escucha de sellos pequeños y radio comunitaria.', created_at: '2026-01-01T00:00:00Z' } : [{ id: session.user.id }]);
      return send(single ? { id: session.user.id, username: session.user.user_metadata.username, display_name: 'Comunidad', bio: null, created_at: '2026-01-01T00:00:00Z' } : []);
    }
    if (p === '/rest/v1/crates') { const rows = opts.noCrates ? [] : crateRows; return single ? send(rows[0] ?? null) : send(rows); }
    if (p === '/rest/v1/crate_items') return send(single ? crateItems[0] : crateItems);
    if (p === '/rest/v1/contributions') {
      const idf = u.searchParams.get('id');
      const all = [...queue, ...ownContributions];
      if (idf?.startsWith('eq.')) return send(all.find((c) => c.id === idf.slice(3)) ?? null);
      if (u.searchParams.get('author_id')) return send(ownContributions);
      return send(role === 'admin' || role === 'colaborador' ? queue : []);
    }
    if (p === '/rest/v1/problem_reports') return send(reports);
    if (p.endsWith('/rpc/admin_list_catalog_releases')) return send({ items: adminItems, total: 2790, page: 1, page_size: 25 });
    if (p.endsWith('/rpc/admin_get_catalog_release')) return send(adminSelected);
    if (p.endsWith('/rpc/admin_get_catalog_history')) return send(adminHistory);
    if (p.startsWith('/rest/v1/rpc/admin_')) return send({});
    return pass();
  });
}

// ---------- runner ----------
const manifest = [];
const WELCOME_HANDLED = () => { try { sessionStorage.setItem('discotica:welcome:handled:v1', '1'); } catch {} };
const settle = (page, ms = 900) => page.waitForTimeout(ms);
async function waitCatalog(page) {
  await page.waitForSelector('.resultados__grid, .resultados__vacio, .resultados__error', { timeout: 20000 }).catch(() => {});
  await page.evaluate(async () => {
    const imgs = [...document.images].filter((i) => { const r = i.getBoundingClientRect(); return r.top < innerHeight * 1.5; });
    await Promise.all(imgs.map((i) => i.complete ? null : new Promise((res) => { i.onload = i.onerror = res; setTimeout(res, 4000); })));
  });
}

async function run(browser, s) {
  const ctx = await browser.newContext({ ...VP[s.vp], locale: 'es-CO', reducedMotion: 'reduce' });
  if (!s.fresh) await ctx.addInitScript(WELCOME_HANDLED);
  await installMocks(ctx, s.role ?? null, s.mock ?? {});
  const page = await ctx.newPage();
  try {
    if (s.before) await s.before(page, ctx);
    await page.goto(BASE + s.url, { waitUntil: 'domcontentloaded' });
    if (s.url === '/' || s.url.startsWith('/?')) { if (!s.noWait) await waitCatalog(page); }
    await settle(page, s.wait ?? 1200);
    if (s.setup) await s.setup(page);
    await settle(page, 500);
    const file = `${s.id}.jpg`;
    const opt = { path: `${OUT}/${file}`, type: 'jpeg', quality: 72, animations: 'disabled' };
    if (s.selector) {
      const el = page.locator(s.selector).first();
      await el.screenshot({ ...opt });
    } else if (s.full) {
      const h = await page.evaluate(() => document.documentElement.scrollHeight);
      const vw = VP[s.vp].viewport.width;
      opt.fullPage = true;
      if (h > (s.maxH ?? 3200)) opt.clip = { x: 0, y: 0, width: vw, height: s.maxH ?? 3200 };
      await page.screenshot(opt);
    } else await page.screenshot(opt);
    manifest.push({ id: s.id, vp: s.vp, url: s.url, role: s.role ?? 'anon', ok: true });
    console.log('ok', s.id);
  } catch (e) {
    manifest.push({ id: s.id, vp: s.vp, url: s.url, ok: false, error: String(e).slice(0, 200) });
    console.log('FAIL', s.id, String(e).slice(0, 200));
    await page.screenshot({ path: `${OUT}/${s.id}.jpg`, type: 'jpeg', quality: 60 }).catch(() => {});
  } finally { await ctx.close(); }
}

// ---------- shot list ----------
const S = [];
const add = (id, vp, url, o = {}) => S.push({ id, vp, url, ...o });
const each = (vps, id, url, o) => vps.forEach((vp) => add(`${id}-${vp}`, vp, url, o));

const B = pick.collab.slug; // bandcamp, 1 principal + 9 colaboradores
const COMP = pick.compilado.slug;
const SPOT = pick.spotify.slug;
const LONG = pick.longTitle.slug;
const openSearch = async (page) => { await page.click('.boton-buscar-toggle'); await settle(page, 600); };
const openSheet = async (page) => { await page.click('.mobile-search-bar'); await settle(page, 700); };
const scrollModalBottom = async (page) => { await page.evaluate(() => { document.querySelectorAll('[data-release-scroll-region], .release-detail__info, .release-detail__layout').forEach((el) => el.scrollTo(0, el.scrollHeight)); }); await settle(page, 1200); };

// Inicio
each(['D', 'M'], 'home-welcome', '/', { fresh: true });
each(['D', 'M'], 'home-beta', '/?beta=1&nombre=Laura', { fresh: true });
each(['D', 'T', 'M'], 'home', '/');
each(['D', 'T', 'M'], 'home-full', '/', { full: true, maxH: 4200 });
add('home-loading-D', 'D', '/', { noWait: true, wait: 300, mock: { override: async ({ p, route }) => { if (p.includes('catalog_releases')) { await new Promise((r) => setTimeout(r, 15000)); return route.abort(); } } } });
add('home-error-D', 'D', '/', { mock: { override: async ({ p, route }) => { if (p.includes('catalog_releases')) return route.abort(); } } });
add('home-search-D', 'D', '/', { setup: openSearch, full: true, maxH: 1700 });
add('home-search-suggest-D', 'D', '/', { setup: async (page) => { await openSearch(page); await page.fill('.busqueda-input', 'trib'); await settle(page, 700); } });
add('home-search-pais-D', 'D', '/', { setup: async (page) => { await openSearch(page); await page.click('.cloud-dropdown summary'); await settle(page, 500); } });
add('home-search-tipo-D', 'D', '/', { setup: async (page) => { await openSearch(page); await page.click('.select-row details.dropdown summary'); await settle(page, 500); } });
each(['D', 'M'], 'home-filtered', '/?genero=Techno&genero=Tribal&pais=Colombia&texto=entra%C3%B1as&a%C3%B1o=2025');
add('home-filtered-panel-D', 'D', '/?genero=Techno&pais=Colombia', { setup: openSearch, full: true, maxH: 1800 });
add('home-radar-D', 'D', '/?radar_bailable=5&radar_rapido=4&radar_denso=3', { setup: openSearch, full: true, maxH: 1900 });
add('home-radar-results-D', 'D', '/?radar_bailable=5&radar_rapido=4&radar_denso=3');
add('home-approx-D', 'D', '/?genero=Cumbia&pais=Chile&a%C3%B1o=2019&type=Single');
add('home-empty-D', 'D', '/?texto=zzqxwvkkk');
add('home-page2-D', 'D', '/?p=2', { full: true, maxH: 2600 });
add('home-pagination-D', 'D', '/', { selector: '.resultados__paginacion-inferior', setup: async (page) => page.evaluate(() => scrollTo(0, document.body.scrollHeight)) });
add('home-sheet-M', 'M', '/', { setup: openSheet });
add('home-sheet-radar-M', 'M', '/', { setup: async (page) => { await openSheet(page); await page.click('.sheet-radar summary'); await settle(page, 400); await page.evaluate(() => { const b = document.querySelector('.filtros-mobile-body'); b.scrollTo(0, b.scrollHeight); }); } });
add('home-sheet-filtered-M', 'M', '/?genero=Techno&genero=Tribal&pais=Colombia&a%C3%B1o=2025', { setup: openSheet });
add('home-sheet-pais-M', 'M', '/', { setup: async (page) => { await openSheet(page); await page.click('.filtros-mobile-sheet .cloud-dropdown summary'); await settle(page, 400); } });
add('home-scrolled-M', 'M', '/', { setup: async (page) => { await page.evaluate(() => scrollTo(0, 1500)); await settle(page, 400); await page.evaluate(() => scrollTo(0, 1350)); } });

// Tarjeta
add('card-grid-D', 'D', '/', { selector: '.resultados__grid > article:nth-of-type(1)' });
add('card-hover-D', 'D', '/', { selector: '.resultados__grid > article:nth-of-type(1)', setup: async (page) => page.hover('.resultados__grid > article:nth-of-type(1) .cover-container') });
add('card-collab-D', 'D', '/', { selector: '.resultados__grid > article:nth-of-type(2)' });
add('card-two-D', 'D', '/', { selector: '.resultados__grid > article:nth-of-type(3)' });
add('card-varios-open-D', 'D', '/', { setup: async (page) => { const t = page.locator('.resultados__grid > article').filter({ hasText: 'Curation 03' }).locator('.credit-summary__summary'); await t.scrollIntoViewIfNeeded(); await t.click(); await settle(page, 400); } });
add('card-row-D', 'D', '/', { setup: async (page) => page.evaluate(() => document.querySelector('.resultados__grid').scrollIntoView()) });
add('card-row-M', 'M', '/', { setup: async (page) => page.evaluate(() => { const g = document.querySelector('.resultados__grid > article:nth-of-type(2)'); g.scrollIntoView(); }) });
add('card-row-T', 'T', '/', { setup: async (page) => page.evaluate(() => document.querySelector('.resultados__grid').scrollIntoView()) });

// Modal
each(['D', 'T', 'M'], 'modal', `/?modal=${B}`, { wait: 2500 });
each(['D', 'M'], 'modal-bottom', `/?modal=${B}`, { wait: 2500, setup: scrollModalBottom });
add('modal-mid-M', 'M', `/?modal=${B}`, { wait: 2500, setup: async (page) => page.evaluate(() => { document.querySelectorAll('.release-detail__layout').forEach((el) => el.scrollTo(0, 700)); }) });
add('modal-varios-D', 'D', `/?modal=${COMP}`, { wait: 2500, setup: async (page) => { await page.click('.release-detail__artists-trigger'); } });
add('modal-radar-D', 'D', `/?modal=${B}`, { wait: 2500, setup: async (page) => page.hover('.release-detail__cover') });
add('modal-spotify-D', 'D', `/?modal=${SPOT}`, { wait: 3000 });
add('modal-soundcloud-D', 'D', `/?modal=${SOUNDCLOUD.slug}`, { wait: 3000 });
add('modal-review-D', 'D', `/?modal=${REVIEW.slug}`, { wait: 2500 });
add('modal-longtitle-D', 'D', `/?modal=${LONG}`, { wait: 2500 });
add('modal-nocover-D', 'D', `/?modal=${NOCOVER.slug}`, { wait: 2500 });
add('modal-1100-D', 'D', `/?modal=${B}`, { wait: 2500, before: async (page) => page.setViewportSize({ width: 1100, height: 760 }) });
add('modal-crate-D', 'D', `/?modal=${B}`, { role: 'comunidad', wait: 2500, setup: async (page) => { await page.click('.btn-add-crate'); await settle(page, 500); } });
add('modal-tablet-landscape-T', 'T', `/?modal=${B}`, { wait: 2500, before: async (page) => page.setViewportSize({ width: 1112, height: 834 }) });

// Ficha página
each(['D', 'M'], 'ficha', `/lanzamiento/${B}`, { full: true, wait: 2500, maxH: 3000 });
add('ficha-comp-D', 'D', `/lanzamiento/${COMP}`, { full: true, wait: 2500, maxH: 2400 });

// Header / footer
add('header-menu-D', 'D', '/', { setup: async (page) => page.click('.menu-trigger') });
add('header-menu-M', 'M', '/', { setup: async (page) => page.click('.hamburger') });
add('header-auth-D', 'D', '/', { role: 'comunidad', selector: '.site-header' });
add('header-auth-menu-M', 'M', '/', { role: 'comunidad', setup: async (page) => page.click('.hamburger') });
add('header-anon-D', 'D', '/', { selector: '.site-header' });
add('footer-D', 'D', '/', { selector: 'footer' });
add('footer-M', 'M', '/', { selector: 'footer' });

// Taxonomías
each(['D', 'M'], 'artista', '/artista/entranas--38c34929', { full: true, wait: 3500, maxH: 3000 });
each(['D', 'M'], 'sello', '/sello/trampa', { full: true, wait: 3500, maxH: 3000 });

// Auth
each(['D', 'M'], 'login', '/auth/login');
add('login-error-D', 'D', '/auth/login', { setup: async (page) => { await page.fill('input[type=text], input[autocomplete=username], input:not([type=password])', 'usuario'); await page.fill('input[type=password]', 'malacontraseña'); await page.click('button[type=submit]'); await settle(page, 1200); } });
each(['D', 'M'], 'registro', '/auth/registro', { full: true });
add('registro-filled-D', 'D', '/auth/registro', { full: true, setup: async (page) => {
  const inputs = page.locator('form input');
  const n = await inputs.count();
  for (let i = 0; i < n; i++) { const el = inputs.nth(i); const t = await el.getAttribute('type'); const ac = (await el.getAttribute('autocomplete')) || ''; if (t === 'checkbox') continue; if (t === 'email') await el.fill('nueva@example.test'); else if (t === 'password') await el.fill('una-contraseña'); else if (/user/.test(ac) || i === 0) { await el.fill('usuario_tomado'); } else await el.fill('Nueva Persona'); }
  await page.locator('form input').first().blur(); await settle(page, 1200);
} });
add('registro-error-D', 'D', '/auth/registro', { full: true, setup: async (page) => {
  const inputs = page.locator('form input'); const n = await inputs.count(); let pw = 0;
  for (let i = 0; i < n; i++) { const el = inputs.nth(i); const t = await el.getAttribute('type'); if (t === 'checkbox') continue; if (t === 'email') await el.fill('nueva@example.test'); else if (t === 'password') await el.fill(pw++ ? 'distinta-1' : 'una-contraseña'); else await el.fill('nueva_persona'); }
  await page.click('button[type=submit]'); await settle(page, 800);
} });
add('registro-success-D', 'D', '/auth/registro', { full: true, setup: async (page) => {
  const inputs = page.locator('form input'); const n = await inputs.count();
  for (let i = 0; i < n; i++) { const el = inputs.nth(i); const t = await el.getAttribute('type'); if (t === 'checkbox') { await el.check(); continue; } if (t === 'email') await el.fill('nueva@example.test'); else if (t === 'password') await el.fill('una-contraseña'); else await el.fill('nueva_persona_x'); }
  await settle(page, 1200); await page.click('button[type=submit]'); await settle(page, 1500);
} });
each(['D', 'M'], 'recuperar', '/auth/recuperar');
add('recuperar-sent-D', 'D', '/auth/recuperar', { setup: async (page) => { await page.fill('input[type=email]', 'nueva@example.test'); await page.click('button[type=submit]'); await settle(page, 1200); } });
add('reset-error-D', 'D', '/auth/reset');
add('reset-recovery-D', 'D', '/auth/reset?type=recovery');
add('reset-signup-D', 'D', '/auth/reset?flow=signup&type=signup');

// Comunidad
each(['D', 'M'], 'sugerir-anon', '/sugerir');
each(['D', 'M'], 'sugerir', '/sugerir', { role: 'comunidad', full: true });
add('sugerir-detected-D', 'D', '/sugerir', { role: 'comunidad', full: true, setup: async (page) => { await page.fill('input[type=url], input[name*=source], form input', 'https://artista.bandcamp.com/album/propuesta'); await page.getByRole('button', { name: /Detectar|Leer|Buscar datos/i }).first().click(); await settle(page, 1800); } });
add('sugerir-detected-M', 'M', '/sugerir', { role: 'comunidad', full: true, setup: async (page) => { await page.fill('input[type=url], input[name*=source], form input', 'https://artista.bandcamp.com/album/propuesta'); await page.getByRole('button', { name: /Detectar|Leer|Buscar datos/i }).first().click(); await settle(page, 1800); } });
add('sugerir-admin-D', 'D', '/sugerir', { role: 'admin' });
each(['D', 'M'], 'reportar', `/reportar?release_id=${sample[3].id}`, { role: 'comunidad', full: true });
add('reportar-anon-D', 'D', '/reportar');

// Crates y perfil
add('miscrates-anon-D', 'D', '/mis-crates');
each(['D', 'M'], 'miscrates', '/mis-crates', { role: 'comunidad', full: true });
add('miscrates-empty-D', 'D', '/mis-crates', { role: 'comunidad', mock: { noCrates: true } });
each(['D', 'M'], 'crate-crear', '/mis-crates?crear=1', { role: 'comunidad' });
each(['D', 'M'], 'crate', '/crate/para-abrir-el-set?usuario=comunidad', { role: 'comunidad', full: true, wait: 3000 });
each(['D', 'M'], 'perfil', '/perfil/comunidad', { role: 'comunidad', full: true, wait: 2000 });

// Editorial
add('editorial-anon-D', 'D', '/editorial');
each(['D', 'M'], 'editorial-admin', '/editorial', { role: 'admin', full: true, wait: 2000, maxH: 4200 });
add('editorial-approve-D', 'D', '/editorial', { role: 'admin', wait: 2000, setup: async (page) => { await page.getByRole('button', { name: /Aprobar/ }).first().click(); await settle(page, 600); } });
add('editorial-colab-D', 'D', '/editorial', { role: 'colaborador', full: true, wait: 2000, maxH: 3600 });

// Admin catálogo
add('admin-anon-D', 'D', '/admin/catalogo');
add('admin-norole-D', 'D', '/admin/catalogo', { role: 'comunidad', wait: 1500 });
each(['D', 'T', 'M'], 'admin-list', '/admin/catalogo', { role: 'admin', full: true, wait: 2500, maxH: 3000 });
add('admin-filters-D', 'D', '/admin/catalogo', { role: 'admin', wait: 2500, setup: async (page) => { await page.getByRole('button', { name: /Filtros/ }).first().click(); await settle(page, 500); } });
add('admin-selection-D', 'D', '/admin/catalogo', { role: 'admin', wait: 2500, setup: async (page) => { const c = page.locator('tbody input[type=checkbox]'); await c.nth(0).check(); await c.nth(1).check(); await settle(page, 300); } });
const openEditor = async (page) => { await page.locator('button[aria-label^="Editar "]').nth(1).click(); await settle(page, 1800); };
each(['D', 'T'], 'admin-editor', '/admin/catalogo', { role: 'admin', wait: 2500, full: true, maxH: 4600, setup: openEditor });
add('admin-editor-top-D', 'D', '/admin/catalogo', { role: 'admin', wait: 2500, setup: openEditor });
add('admin-editor-M', 'M', '/admin/catalogo', { role: 'admin', wait: 2500, full: true, maxH: 4000, setup: openEditor });
add('admin-history-D', 'D', '/admin/catalogo', { role: 'admin', wait: 2500, full: true, maxH: 3000, setup: async (page) => { await openEditor(page); await page.getByRole('button', { name: /Historial/ }).click(); await settle(page, 600); } });
add('admin-finder-D', 'D', '/admin/catalogo', { role: 'admin', wait: 2500, setup: async (page) => { await openEditor(page); const b = page.getByRole('button', { name: /Añadir|Agregar/ }).first(); await b.scrollIntoViewIfNeeded(); await b.click(); await settle(page, 400); const i = page.locator('.inline-finder input').first(); await i.fill('entr'); await settle(page, 1500); } });
add('admin-publish-D', 'D', '/admin/catalogo', { role: 'admin', wait: 2500, setup: async (page) => { await openEditor(page); const b = page.getByRole('button', { name: /Archivar/ }).first(); await b.scrollIntoViewIfNeeded(); await b.click(); await settle(page, 600); } });
add('admin-new-D', 'D', '/admin/catalogo', { role: 'admin', wait: 2500, full: true, maxH: 4000, setup: async (page) => { await page.getByRole('button', { name: /Nuevo/ }).first().click(); await settle(page, 1000); } });

// Info
each(['D', 'M'], 'manual', '/manual', { full: true, maxH: 5200 });
add('privacidad-D', 'D', '/privacidad', { full: true, maxH: 3600 });
each(['D', 'M'], '404', '/ruta-que-no-existe');

// ---------- go ----------
const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
const list = only ? S.filter((s) => only.test(s.id)) : S;
const browser = await chromium.launch();
const conc = 4;
let i = 0;
await Promise.all(Array.from({ length: conc }, async () => { while (i < list.length) { const s = list[i++]; await run(browser, s); } }));
await browser.close();
const prev = fs.existsSync(`${SP}/manifest.json`) ? JSON.parse(fs.readFileSync(`${SP}/manifest.json`, 'utf8')) : [];
const merged = Object.values(Object.fromEntries([...prev, ...manifest].map((m) => [m.id, m])));
fs.writeFileSync(`${SP}/manifest.json`, JSON.stringify(merged, null, 1));
console.log('done', manifest.filter((m) => m.ok).length, '/', manifest.length);
