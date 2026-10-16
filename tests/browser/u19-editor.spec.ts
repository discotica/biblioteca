import { readFileSync } from 'node:fs';
import { expect, test, type Page, type Route } from '@playwright/test';

// U19 G3 — La cola se corrige en el editor del Estudio. Supabase simulado con los RPC que documentó
// G1 y el de G3 (resolve_catalog_names); un solo estado del servidor para varias sesiones, así el
// bloqueo del autor («tomada») se prueba con dos navegadores. Los permisos y la validación reales
// están en tests/sql/u19-g1-verify.sql y tests/sql/u19-g3-verify.sql.
// Con U19_CAPTURAS=1 guarda las capturas del relevo en docs/modernizacion/capturas-u19/.

const project = 'hgocyrzhgohetfpzbmfs';
const base = `https://${project}.supabase.co`;
const users = {
  comunidad: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  colaborador: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  admin: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'
};
const ids = {
  compilado: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb31',
  segunda: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb32',
  created: '11111111-1111-4111-8111-000000000031',
  listRelease: '11111111-1111-4111-8111-000000000041',
  openRelease: '11111111-1111-4111-8111-000000000042'
};
const captures = process.env.U19_CAPTURAS === '1';
const captureDir = 'docs/modernizacion/capturas-u19';
const captureStyle = captures ? readFileSync('tests/visual/support/capture-document.css', 'utf8') : undefined;

type Role = keyof typeof users;
type Entry = { id: string; name: string; slug: string; status?: string };
type Call = { rpc: string; body: any; role: Role };

const entry = (prefix: string, status?: string) => (name: string, index: number): Entry => ({
  id: `${prefix}-${index}`, name, slug: `${prefix}-${index}`, ...(status ? { status } : {})
});
const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

function proposal(id: string, title: string, over: Record<string, any> = {}) {
  return {
    id, author_id: users.comunidad, status: 'pending', queue_kind: 'community',
    source_url: `https://artista.bandcamp.com/album/${id.slice(-2)}`, source_provider: 'bandcamp',
    payload: {
      version: 3, title, primary_artists: ['Artista del catálogo', 'Artista nueva uno', 'Artista nueva dos'], collaborators: [],
      release_type: 'compilado', release_date: '2026-09-18', genres: ['Techno'], countries: ['Colombia'], label: 'Sello nuevo',
      team_note: 'Lo escuché en la radio.'
    },
    payload_version: 3, payload_quality: 'confirmed',
    detected_metadata: { provider: 'bandcamp', source_available: true, title, artists: ['Artista del catálogo'], cover_url: 'https://images.example.test/compilado.jpg' },
    submitted_at: '2026-10-15T14:00:00Z', taken_at: null as string | null, reviewer_note: null as string | null, reviewed_at: null, release_id: null as string | null,
    created_at: '2026-10-15T13:00:00Z', updated_at: '2026-10-15T14:00:00.123456+00:00', ...over
  };
}

/** Un servidor simulado, compartido por las sesiones de un test. */
class Server {
  calls: Call[] = [];
  contributions = [proposal(ids.compilado, 'Compilado de la radio'), proposal(ids.segunda, 'Segunda propuesta', { payload: { ...proposal(ids.segunda, 'Segunda propuesta').payload, primary_artists: ['Artista del catálogo'], label: 'Sello del catálogo' } })];
  artists: Entry[] = ['Artista del catálogo', 'Artista de la lista', 'Artista del editor'].map(entry('artist'));
  labels: Entry[] = ['Independiente', 'Sello del catálogo'].map(entry('label'));
  genres: Entry[] = ['Ambient', 'Techno'].map(entry('genre', 'selectable'));
  countries: Entry[] = ['Chile', 'Colombia'].map(entry('country', 'selectable'));
  types: Entry[] = ['Álbum', 'EP', 'Single', 'Compilado', 'Sample Pack'].map((name, index) => ({ id: `type-${index}`, name, slug: ['album', 'ep', 'single', 'compilado', 'sample-pack'][index] }));
  releases: Record<string, any> = {};
  /** Retraso de la lectura de artistas por id (RC2-P1-01). */
  artistDelay: (ids: string[]) => number = () => 0;
  version = 0;

  rpcs(role: Role) {
    return this.calls.filter((call) => call.role === role).map((call) => call.rpc);
  }

  /** Lo que ve cada rol con la RLS de E09: admin todo; colaborador la cola comunitaria; el autor lo suyo. */
  visible(role: Role) {
    return this.contributions.filter((item) => role === 'admin'
      || (role === 'colaborador' && item.queue_kind === 'community' && item.status === 'pending')
      || item.author_id === users[role]);
  }

  nextUpdatedAt() {
    this.version += 1;
    return `2026-10-16T12:00:0${this.version}.65432${this.version}+00:00`;
  }

  async attach(page: Page, role: Role) {
    const userId = users[role];
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: `${role}@example.test`, app_metadata: {}, user_metadata: { username: role }, created_at: '2026-09-18T00:00:00Z' };
    const session = {
      access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: userId, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.signature`,
      refresh_token: 'fixture', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user
    };
    await page.context().addCookies([{
      name: `sb-${project}-auth-token`, value: `base64-${encode(session)}`,
      domain: '127.0.0.1', path: '/', httpOnly: false, secure: false, sameSite: 'Lax'
    }]);

    await page.route(`${base}/**`, async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      const rpc = path.match(/\/rpc\/(\w+)$/)?.[1];
      let body: any = null;
      try { body = request.postDataJSON(); } catch { /* GET */ }
      if (path.startsWith('/auth/v1/')) return json(route, user);
      if (path === '/rest/v1/profiles') return json(route, url.searchParams.get('select') === 'role' ? { role } : { id: userId, username: role, role });
      if (path === '/rest/v1/labels') return json(route, this.labels);
      if (path === '/rest/v1/genres') return json(route, this.genres);
      if (path === '/rest/v1/countries') return json(route, this.countries);
      if (path === '/rest/v1/release_types') return json(route, this.types);
      if (path === '/rest/v1/artist_aliases' || path === '/rest/v1/label_aliases') return json(route, []);
      if (path === '/rest/v1/artists') {
        const idFilter = url.searchParams.get('id');
        if (idFilter?.startsWith('in.(')) {
          const wanted = idFilter.slice(4, -1).split(',').map((value) => value.replace(/"/g, ''));
          const delay = this.artistDelay(wanted);
          if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
          return json(route, this.artists.filter((artist) => wanted.includes(artist.id)));
        }
        const term = (url.searchParams.get('name') ?? '').replace(/^ilike\.%?|%$/g, '').toLowerCase();
        return json(route, this.artists.filter((artist) => artist.name.toLowerCase().includes(term)));
      }
      if (path === '/rest/v1/contributions') {
        const byId = url.searchParams.get('id');
        if (byId) return json(route, this.visible(role).find((item) => `eq.${item.id}` === byId) ?? null);
        const author = url.searchParams.get('author_id');
        if (author) return json(route, this.contributions.filter((item) => `eq.${item.author_id}` === author));
        return json(route, this.visible(role).filter((item) => item.status === 'pending' || item.status === 'ready_for_admin'));
      }
      if (path === '/rest/v1/problem_reports' || path === '/rest/v1/crates') return json(route, []);
      if (!rpc) return json(route, []);

      this.calls.push({ rpc, body, role });
      if (rpc.startsWith('admin_') && role !== 'admin') return json(route, { code: '42501', message: 'Administrative role required' }, 403);
      const find = () => this.contributions.find((item) => item.id === body.p_contribution_id)!;
      const replace = (next: ReturnType<typeof proposal>) => {
        this.contributions = this.contributions.map((item) => (item.id === next.id ? next : item));
        return json(route, next);
      };
      switch (rpc) {
        case 'resolve_catalog_names': {
          const pool = body.p_kind === 'artist' ? this.artists : this.labels;
          return json(route, body.p_names.map((name: string) => {
            const found = pool.find((item) => item.name.toLowerCase() === name.toLowerCase());
            return { name, id: found?.id ?? null, canonical: found?.name ?? null };
          }));
        }
        case 'save_contribution_correction': {
          const item = find();
          if (body.p_expected_updated_at !== item.updated_at) return json(route, { code: '40001', message: 'contribution_version_conflict' }, 409);
          return replace({ ...item, payload: body.p_payload, taken_at: item.taken_at ?? '2026-10-16T12:00:00Z', updated_at: this.nextUpdatedAt() });
        }
        case 'prepare_contribution_for_admin':
          return replace({ ...find(), status: 'ready_for_admin', taken_at: '2026-10-16T12:00:00Z', updated_at: this.nextUpdatedAt() });
        case 'review_contribution':
          return replace({ ...find(), status: body.p_action, reviewer_note: body.p_note, taken_at: '2026-10-16T12:00:00Z' });
        case 'accept_contribution': {
          const item = find();
          if (body.p_expected_updated_at !== item.updated_at) return json(route, { code: '40001', message: 'contribution_version_conflict' }, 409);
          this.contributions = this.contributions.map((entry) => (entry.id === item.id ? { ...item, status: 'approved', release_id: ids.created } : entry));
          return json(route, { release_id: ids.created, release_slug: 'compilado', status: body.p_publish ? 'published' : 'draft', catalog_version: 1, change_set_id: 'cs-1', contribution_id: item.id });
        }
        case 'update_submitted_contribution': {
          const item = find();
          if (item.taken_at) return json(route, { code: '55000', message: 'contribution_taken', details: null, hint: null }, 400);
          return replace({ ...item, payload: body.p_payload, updated_at: this.nextUpdatedAt() });
        }
        case 'check_source_duplicate':
          return json(route, { match: 'none', state: null, release_slug: null, release_id: null, contribution_id: null });
        case 'admin_list_catalog_releases': {
          const items = Object.values(this.releases).filter((release: any) => release.id === ids.listRelease);
          return json(route, { items, total: items.length, page: 1, page_size: 25, quick_view: null });
        }
        case 'admin_catalog_quick_view_counts':
          return json(route, { total: 1, draft: 0, incomplete: 0, missing_cover: 0, open_reports: 0, statuses: null });
        case 'admin_get_catalog_release':
          return json(route, this.releases[body.p_release_id]);
        case 'admin_get_catalog_history':
          return json(route, { release_id: body.p_release_id, items: [] });
        default:
          return json(route, {});
      }
    });
    await page.route('https://images.example.test/**', (route) => route.fulfill({
      status: 200, contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#3a6b8c"/></svg>'
    }));
  }
}

function release(id: string, title: string, artistId: string) {
  return {
    id, slug: title.toLowerCase().replace(/\s+/g, '-'), title, release_date: '2026-09-18', release_type_id: 'type-0', label_id: 'label-1', review: '',
    status: 'published', credit_quality: 'verified', catalog_version: 3, updated_at: '2026-10-10T12:00:00Z',
    artist_ids: [artistId], collaborator_ids: [], genre_ids: ['genre-1'], country_ids: ['country-1'], radar: {},
    links: [{ provider: 'bandcamp', url: `https://x.bandcamp.com/album/${id.slice(-2)}`, is_primary: true }], cover_url: 'https://images.example.test/r.jpg',
    signals: { draft: false, incomplete: false, missing_fields: [], missing_cover: false, open_report_count: 0 }
  };
}

async function shot(page: Page, name: string) {
  if (captures) await page.screenshot({ path: `${captureDir}/${name}.png`, fullPage: true, animations: 'disabled', caret: 'hide', style: captureStyle });
}

const credits = (page: Page, group: string) => page.getByRole('group', { name: group }).locator('.credit');
const studioNav = (page: Page) => page.getByRole('navigation', { name: 'Estudio' });
const noHorizontalOverflow = (page: Page) =>
  expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

for (const width of [1440, 390]) {
  test(`admin a ${width}: el compilado con artistas nuevos se acepta como borrador desde el editor`, async ({ page }) => {
    const server = new Server();
    await server.attach(page, 'admin');
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto(`/estudio/propuestas?propuesta=${ids.compilado}`);
    await page.getByRole('article', { name: 'Compilado de la radio' }).getByRole('link', { name: 'Abrir en el editor' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Compilado de la radio' })).toBeVisible();

    // El que existe, con su nombre; los nuevos, marcados: se crean al aceptar (U19-01).
    await expect(credits(page, 'Artistas principales')).toHaveCount(3);
    await expect(credits(page, 'Artistas principales').locator('.credit__name')).toHaveText(['Artista del catálogo', 'Artista nueva uno', 'Artista nueva dos']);
    await expect(credits(page, 'Artistas principales').nth(0)).not.toContainText('Nuevo');
    await expect(credits(page, 'Artistas principales').nth(1)).toContainText('Artista nueva uno');
    await expect(credits(page, 'Artistas principales').nth(1)).toContainText('Nuevo · se crea al aceptar');
    await expect(credits(page, 'Artistas principales').nth(2)).toContainText('Nuevo · se crea al aceptar');
    await expect(page.getByText('«Sello nuevo» es nuevo: se crea al aceptar.')).toBeVisible();
    // Lo que no está en la cola del editor del catálogo: el historial pasa a ser la propuesta.
    await expect(page.getByRole('heading', { level: 2, name: 'Propuesta' })).toBeVisible();
    await expect(page.getByText('Todavía puede editarla.', { exact: false })).toBeVisible();
    await expect(page.getByText('Lo escuché en la radio.').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Guardar' })).toBeVisible();
    for (const name of ['Pedir cambios', 'Rechazar', 'Aceptar como borrador', 'Aceptar y publicar']) await expect(page.getByRole('button', { name })).toBeVisible();
    await noHorizontalOverflow(page);
    await shot(page, `editor-propuesta-admin-${width}`);

    await page.getByRole('textbox', { name: 'Nota para quien propone' }).fill('Gracias, lo completamos en el catálogo.');
    await page.getByRole('button', { name: 'Aceptar como borrador' }).click();
    const notice = page.getByRole('status').filter({ hasText: 'Compilado de la radio: aceptada como borrador del catálogo.' });
    await expect(notice).toBeVisible();
    await expect(notice.getByRole('link', { name: 'Abrir el lanzamiento en el Catálogo' })).toHaveAttribute('href', `/estudio/catalogo?lanzamiento=${ids.created}`);
    await expect(page.getByRole('link', { name: /^Compilado de la radio/ })).toHaveCount(0);

    // Sin cambios no hay corrección: se acepta lo guardado, con la versión exacta (con microsegundos).
    expect(server.rpcs('admin').filter((rpc) => !rpc.startsWith('admin_catalog') && rpc !== 'resolve_catalog_names')).toEqual(['accept_contribution']);
    expect(server.calls.find((call) => call.rpc === 'accept_contribution')!.body).toEqual({
      p_contribution_id: ids.compilado, p_publish: false, p_expected_updated_at: '2026-10-15T14:00:00.123456+00:00', p_note: 'Gracias, lo completamos en el catálogo.'
    });
  });
}

test('admin: corrige, guarda y acepta publicando; el segundo guardado usa la versión que devolvió el primero', async ({ page }) => {
  const server = new Server();
  await server.attach(page, 'admin');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/estudio/propuestas?editar=${ids.compilado}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Compilado de la radio' })).toBeVisible();
  await expect(page.locator('.editor__dirty')).toHaveText('Sin cambios. Abrirla no la toma.');

  await page.getByLabel('Título').fill('Compilado de la radio, vol. 1');
  await page.getByRole('group', { name: 'Artistas principales' }).getByRole('button', { name: 'Quitar Artista nueva dos' }).click();
  await page.getByRole('combobox', { name: 'Sello' }).fill('Sello del');
  await page.getByRole('option', { name: 'Sello del catálogo' }).click();
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.locator('.editor__feedback')).toHaveText('Corrección guardada. Desde ahora quien la propuso ya no puede editarla.');
  await expect(page.locator('.proposal__facts')).toContainText('Ya no puede editarla: el equipo la tomó');

  await page.getByLabel('Fecha de lanzamiento').fill('2026-09-19');
  await page.getByRole('button', { name: 'Aceptar y publicar' }).click();
  const dialog = page.getByRole('dialog', { name: 'Aceptar y publicar' });
  await expect(dialog).toContainText('Artista del catálogo, Artista nueva uno');
  await expect(dialog).toContainText('Sello del catálogo');
  await dialog.getByRole('button', { name: 'Confirmar y publicar' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Compilado de la radio, vol. 1: aceptada y publicada.' })).toBeVisible();

  const writes = server.calls.filter((call) => ['save_contribution_correction', 'accept_contribution'].includes(call.rpc));
  expect(writes.map((call) => call.rpc)).toEqual(['save_contribution_correction', 'save_contribution_correction', 'accept_contribution']);
  expect(writes[0].body).toEqual({
    p_contribution_id: ids.compilado, p_expected_updated_at: '2026-10-15T14:00:00.123456+00:00', p_source_url: null, p_source_provider: null, p_note: null,
    p_payload: {
      version: 3, title: 'Compilado de la radio, vol. 1', primary_artists: ['Artista del catálogo', 'Artista nueva uno'], collaborators: [],
      release_type: 'compilado', release_date: '2026-09-18', genres: ['Techno'], countries: ['Colombia'], label: 'Sello del catálogo',
      team_note: 'Lo escuché en la radio.', review: 'Lo escuché en la radio.', cover_url: 'https://images.example.test/compilado.jpg'
    }
  });
  // Cada guardado parte del updated_at que devolvió el anterior, tal cual (texto con microsegundos).
  expect(writes[1].body.p_expected_updated_at).toBe('2026-10-16T12:00:01.654321+00:00');
  expect(writes[1].body.p_payload.release_date).toBe('2026-09-19');
  expect(writes[2].body).toEqual({ p_contribution_id: ids.compilado, p_publish: true, p_expected_updated_at: '2026-10-16T12:00:02.654322+00:00', p_note: null });
});

for (const width of [1440, 390]) {
  test(`colaborador a ${width}: corrige en el editor sin Catálogo y la marca lista; el servidor le niega el catálogo`, async ({ page }) => {
    const server = new Server();
    await server.attach(page, 'colaborador');
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto(`/estudio/propuestas?editar=${ids.compilado}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Compilado de la radio' })).toBeVisible();

    // Sin Catálogo en la barra lateral (en móvil, la barra lateral es el selector de sección).
    if (width === 1440) await expect(studioNav(page).getByRole('link')).toHaveText([/^\s*Propuestas/]);
    await expect(page.getByRole('link', { name: /^Catálogo/ })).toHaveCount(0);
    // Reseña y portada en solo lectura; sin decisiones de admin.
    await expect(page.getByLabel('URL de portada')).toHaveAttribute('readonly', '');
    await expect(page.locator('.editor__media').getByText('Solo admin cambia la reseña y la portada.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Aceptar|Rechazar|Pedir cambios/ })).toHaveCount(0);
    await noHorizontalOverflow(page);
    await shot(page, `editor-propuesta-colaborador-${width}`);

    await page.getByLabel('Título').fill('Compilado de la radio (corregido)');
    await page.getByRole('combobox', { name: 'Géneros' }).fill('Amb');
    await page.getByRole('option', { name: 'Ambient' }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Guardar corrección' }).click();
    await expect(page.locator('.editor__feedback')).toHaveText('Corrección guardada. Desde ahora quien la propuso ya no puede editarla.');
    await page.getByRole('textbox', { name: 'Nota interna para admin' }).fill('Créditos revisados en Bandcamp.');
    await page.getByRole('button', { name: 'Marcar lista para admin' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Compilado de la radio (corregido) quedó lista para administración.' })).toBeVisible();

    const correction = server.calls.find((call) => call.rpc === 'save_contribution_correction')!.body;
    expect(correction.p_payload).not.toHaveProperty('review');
    expect(correction.p_payload).not.toHaveProperty('cover_url');
    expect(correction.p_payload).toMatchObject({ title: 'Compilado de la radio (corregido)', genres: ['Techno', 'Ambient'], label: 'Sello nuevo' });
    expect(correction.p_note).toBeNull();
    // La nota interna va solo a la preparación, con la propuesta ya guardada.
    expect(server.calls.find((call) => call.rpc === 'prepare_contribution_for_admin')!.body).toEqual({
      p_contribution_id: ids.compilado, p_working_payload: {}, p_internal_note: 'Créditos revisados en Bandcamp.'
    });

    // El Catálogo administrativo no se le muestra ni se le pide al servidor.
    expect(server.rpcs('colaborador').filter((rpc) => rpc.startsWith('admin_'))).toEqual([]);
    await page.goto(`/estudio/catalogo?lanzamiento=${ids.created}`);
    await expect(page.getByText('Esta sección es solo para administración')).toBeVisible();
    expect(server.rpcs('colaborador').filter((rpc) => rpc.startsWith('admin_'))).toEqual([]);
  });
}

test('el autor edita lo enviado hasta que el equipo lo toma: dos sesiones, el siguiente guardado falla con un mensaje claro', async ({ browser }) => {
  const server = new Server();
  const authorContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const collaboratorContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const author = await authorContext.newPage();
  const collaborator = await collaboratorContext.newPage();
  await server.attach(author, 'comunidad');
  await server.attach(collaborator, 'colaborador');

  // Sesión del autor: Mis aportes ofrece editar lo enviado mientras nadie lo tomó.
  await author.goto('/mis-aportes');
  await author.getByRole('link', { name: 'Editar: Compilado de la radio' }).click();
  await expect(author).toHaveURL(new RegExp(`/sugerir\\?draft=${ids.compilado}$`));
  await expect(author.getByText('Puedes editarla mientras nadie del equipo la haya tomado.')).toBeVisible();
  await expect(author.getByRole('button', { name: 'Guardar borrador' })).toHaveCount(0);
  await author.getByLabel('Título').fill('Compilado de la radio (autor)');
  await author.getByRole('button', { name: 'Continuar' }).click();
  await author.getByRole('button', { name: 'Continuar' }).click();
  await author.getByRole('button', { name: 'Guardar y reenviar' }).click();
  await expect(author.getByRole('heading', { name: 'Cambios guardados' })).toBeVisible();

  // Vuelve a abrirla para otro cambio…
  await author.goto(`/sugerir?draft=${ids.compilado}`);
  await author.getByLabel('Título').fill('Compilado de la radio (autor, otra vez)');
  await author.getByRole('button', { name: 'Continuar' }).click();
  await author.getByRole('button', { name: 'Continuar' }).click();

  // …mientras, en otra sesión, el colaborador guarda una corrección: la toma.
  await collaborator.goto(`/estudio/propuestas?editar=${ids.compilado}`);
  await expect(collaborator.getByRole('heading', { level: 1, name: 'Compilado de la radio (autor)' })).toBeVisible();
  await collaborator.getByLabel('Fecha de lanzamiento').fill('2026-09-20');
  await collaborator.getByRole('button', { name: 'Guardar corrección' }).click();
  await expect(collaborator.locator('.editor__feedback')).toHaveText('Corrección guardada. Desde ahora quien la propuso ya no puede editarla.');

  // El siguiente guardado del autor falla en el servidor y se lo dice claro; queda para mirar.
  await author.getByRole('button', { name: 'Guardar y reenviar' }).click();
  await expect(author.getByText('El equipo ya está revisando esta propuesta y ya no se puede editar.')).toBeVisible();
  await expect(author.getByRole('button', { name: /Guardar|Continuar|Enviar/ })).toHaveCount(0);
  await expect(author.getByRole('link', { name: 'Ver mis aportes' })).toBeVisible();
  // Se ve lo guardado (la corrección del colaborador), no el cambio que no entró.
  await expect(author.getByRole('heading', { level: 2, name: 'Compilado de la radio (autor)' })).toBeVisible();
  await expect(author.getByText('2026-09-20')).toBeVisible();
  await shot(author, 'autor-bloqueado-1440');
  expect(server.contributions.find((item) => item.id === ids.compilado)!.payload.title).toBe('Compilado de la radio (autor)');

  // Al volver: Mis aportes ya no ofrece editar; abrirla de nuevo, solo lectura.
  await author.goto('/mis-aportes');
  await expect(author.getByText('El equipo ya la está revisando: ya no se puede editar.')).toBeVisible();
  await expect(author.getByRole('link', { name: 'Editar: Compilado de la radio (autor)' })).toHaveCount(0);
  await author.goto(`/sugerir?draft=${ids.compilado}`);
  await expect(author.getByText('El equipo ya está revisando esta propuesta y ya no se puede editar.')).toBeVisible();
  await expect(author.getByLabel('Título')).toHaveCount(0);

  expect(server.calls.filter((call) => call.rpc === 'update_submitted_contribution').map((call) => call.role)).toEqual(['comunidad', 'comunidad']);
  await authorContext.close();
  await collaboratorContext.close();
});

test('RC2-P1-01: la carga de artistas de la lista no borra la del editor (dos cargas que se cruzan)', async ({ page }) => {
  const server = new Server();
  // La lista muestra un lanzamiento de la página 1; el editor abre otro que no está en ella.
  server.releases[ids.listRelease] = release(ids.listRelease, 'De la lista', 'artist-1');
  server.releases[ids.openRelease] = release(ids.openRelease, 'Abierto desde un aviso', 'artist-2');
  // La lectura de la lista llega después que la del editor: antes la pisaba («Artista sin resolver»).
  server.artistDelay = (wanted) => (wanted.includes('artist-1') ? 700 : 0);
  await server.attach(page, 'admin');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/estudio/catalogo?lanzamiento=${ids.openRelease}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Abierto desde un aviso' })).toBeVisible();
  await expect(page.locator('.editor__artists')).toHaveText('Artista del editor');
  // Después de que llegue la lista, el nombre sigue ahí.
  await page.waitForTimeout(900);
  await expect(page.locator('.editor__artists')).toHaveText('Artista del editor');
  await expect(credits(page, 'Artistas principales')).toHaveText([/Artista del editor/]);
  await expect(page.getByText('Artista sin resolver')).toHaveCount(0);
});
