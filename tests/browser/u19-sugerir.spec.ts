import { readFileSync } from 'node:fs';
import { expect, test, type Page, type Route } from '@playwright/test';

// U19 G2 — Sugerir: un solo flujo para crear, para todos los roles. Supabase simulado con los RPC
// que documentó G1 (expediente de U19, «Contrato del servidor»); los permisos y la validación
// reales están en tests/sql/u19-g1-verify.sql.
// Con U19_CAPTURAS=1 guarda las capturas del relevo en docs/modernizacion/capturas-u19/.

const project = 'hgocyrzhgohetfpzbmfs';
const base = `https://${project}.supabase.co`;
const ids = {
  comunidad: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  colaborador: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  admin: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  contribution: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  release: '11111111-1111-4111-8111-111111111111'
};
const captures = process.env.U19_CAPTURAS === '1';
const captureDir = 'docs/modernizacion/capturas-u19';
const captureStyle = captures ? readFileSync('tests/visual/support/capture-document.css', 'utf8') : undefined;
const source = 'https://artista.bandcamp.com/album/pulso';

type Role = 'comunidad' | 'colaborador' | 'admin';
type Entry = { id: string; name: string; slug: string };
type Duplicate = { match: 'none' | 'catalog' | 'queue'; state: string | null; release_slug: string | null; release_id: string | null; contribution_id: string | null };

const detected = {
  provider: 'bandcamp', source_available: true, title: 'Pulso I', artists: ['Artista detectado'],
  type: 'Compilado', release_date: '2026-09-18', cover_url: 'https://images.example.test/cover.jpg'
};
const noDuplicate: Duplicate = { match: 'none', state: null, release_slug: null, release_id: null, contribution_id: null };

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const entry = (prefix: string) => (name: string, index: number): Entry => ({ id: `${prefix}-${index}`, name, slug: `${prefix}-${index}` });

async function authenticate(page: Page, role: Role) {
  const userId = ids[role];
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: `${role}@example.test`, app_metadata: {}, user_metadata: { username: role }, created_at: '2026-09-18T00:00:00Z' };
  const session = {
    access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: userId, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.signature`,
    refresh_token: 'fixture-refresh-token', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user
  };
  await page.context().addCookies([{
    name: `sb-${project}-auth-token`, value: `base64-${encode(session)}`,
    domain: '127.0.0.1', path: '/', httpOnly: false, secure: false, sameSite: 'Lax'
  }]);
  return { user, userId };
}

/** Filtro `ilike` de PostgREST (`%texto%` o exacto), sin distinguir mayúsculas. */
function ilike(url: URL, rows: Entry[]) {
  const filter = url.searchParams.get('name');
  if (!filter?.startsWith('ilike.')) return rows;
  const term = filter.slice('ilike.'.length);
  const value = term.replace(/^%|%$/g, '').toLowerCase();
  return rows.filter((row) => term.startsWith('%') ? row.name.toLowerCase().includes(value) : row.name.toLowerCase() === value);
}

async function mock(page: Page, role: Role, options: { duplicate?: Duplicate; submitError?: { message: string; details?: string } } = {}) {
  const { user, userId } = await authenticate(page, role);
  const calls = { create: [] as any[], submit: [] as any[], adminDraft: [] as any[], dictionaryQueries: [] as string[] };
  const artists: Entry[] = ['Artista del catálogo', 'Artista invitada', 'Artista detectado', 'Los Pirañas'].map(entry('artist'));
  const labels: Entry[] = ['Independiente', 'Sello U13', 'Sello Raro'].map(entry('label'));
  const genres = ['Ambient', 'Electrónica', 'Techno'].map(entry('genre'));
  const countries = ['Chile', 'Colombia', 'México'].map(entry('country'));
  const types = ['Álbum', 'EP', 'Single', 'Compilado', 'Sample Pack'].map(entry('type'));
  let release: Record<string, any> | null = null;

  await page.route(`${base}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const rpc = path.match(/\/rpc\/(\w+)$/)?.[1];
    if (path.startsWith('/auth/v1/')) return json(route, user);
    if (path === '/rest/v1/profiles') return json(route, url.searchParams.get('select') === 'role' ? { role } : { id: userId, username: role, role });
    if (path === '/rest/v1/genres' || path === '/rest/v1/countries') {
      calls.dictionaryQueries.push(url.search);
      return json(route, path.endsWith('genres') ? genres : countries);
    }
    if (path === '/rest/v1/release_types') return json(route, types);
    if (path === '/rest/v1/labels') return json(route, ilike(url, labels));
    if (path === '/rest/v1/artists') {
      const idFilter = url.searchParams.get('id');
      if (idFilter?.startsWith('in.(')) {
        const wanted = idFilter.slice(4, -1).split(',');
        return json(route, artists.filter((artist) => wanted.includes(artist.id)));
      }
      return json(route, ilike(url, artists));
    }
    if (path === '/rest/v1/artist_aliases' || path === '/rest/v1/label_aliases') return json(route, []);
    if (path === '/rest/v1/contributions') return json(route, []);
    if (rpc === 'check_source_duplicate') return json(route, options.duplicate ?? noDuplicate);
    if (rpc === 'create_contribution_draft') {
      const body = request.postDataJSON();
      calls.create.push(body);
      return json(route, { id: ids.contribution, author_id: userId, status: 'draft', source_url: body.p_source_url, payload: body.p_payload, detected_metadata: body.p_detected_metadata, updated_at: '2026-10-15T10:00:00.123456+00:00' });
    }
    if (rpc === 'submit_contribution') {
      const body = request.postDataJSON();
      calls.submit.push(body);
      if (options.submitError) return json(route, { code: '22023', message: options.submitError.message, details: options.submitError.details ?? null, hint: null }, 400);
      return json(route, { id: body.p_contribution_id, status: 'pending', queue_kind: role === 'colaborador' ? 'collaborator' : 'community', payload: body.p_payload });
    }
    if (rpc === 'admin_create_draft_from_suggestion') {
      // Como el servidor de G1: los artistas y el sello que no existen se crean en la misma operación.
      const body = request.postDataJSON();
      calls.adminDraft.push(body);
      const ensure = (rows: Entry[], prefix: string, name: string) => {
        const found = rows.find((row) => row.name.toLowerCase() === name.toLowerCase());
        if (found) return found.id;
        const created = entry(`${prefix}-new`)(name, rows.length);
        rows.push(created);
        return created.id;
      };
      const payload = body.p_payload;
      release = {
        id: ids.release, slug: 'pulso-i--a1b2c3d4', title: payload.title, release_date: payload.release_date,
        release_type_id: types.find((type) => type.name === 'Compilado')!.id, label_id: ensure(labels, 'label', payload.label),
        review: '', status: 'draft', credit_quality: 'proposed', catalog_version: 1, updated_at: '2026-10-15T10:00:00Z',
        artist_ids: payload.primary_artists.map((name: string) => ensure(artists, 'artist', name)),
        collaborator_ids: payload.collaborators.map((name: string) => ensure(artists, 'artist', name)),
        genre_ids: payload.genres.map((name: string) => genres.find((genre) => genre.name === name)!.id),
        country_ids: payload.countries.map((name: string) => countries.find((country) => country.name === name)!.id),
        radar: payload.radar ?? {}, links: [{ provider: 'bandcamp', url: body.p_source_url, is_primary: true }], cover_url: detected.cover_url,
        source: { mode: 'manual', provider: null, url: null, cover_source_url: null },
        signals: { draft: true, incomplete: false, missing_fields: [], missing_cover: false, open_report_count: 0 }
      };
      return json(route, { release_id: ids.release, release_slug: release.slug, status: 'draft', catalog_version: 1, change_set_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' });
    }
    if (rpc === 'admin_get_catalog_release') return json(route, release);
    if (rpc === 'admin_get_catalog_history') return json(route, { release_id: ids.release, items: [] });
    if (rpc === 'admin_list_catalog_releases') return json(route, { items: release ? [release] : [], total: release ? 1 : 0, page: 1, page_size: 25 });
    if (rpc === 'admin_catalog_quick_view_counts') return json(route, { draft: 1, incomplete: 0, missing_cover: 0, open_reports: 0, total: 1, statuses: null });
    if (path.includes('/functions/v1/inspect-release-source')) return json(route, detected);
    return json(route, []);
  });
  await page.route('https://images.example.test/**', (route) => route.fulfill({
    status: 200, contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#3a6b8c"/></svg>'
  }));
  return calls;
}

const currentStep = (page: Page) => page.locator('[aria-current="step"]');
const combobox = (page: Page, name: string) => page.getByRole('combobox', { name: new RegExp(`^${name}(\\(opcional\\))?$`) });

async function addChip(page: Page, label: string, text: string, option = text, chip = option) {
  await combobox(page, label).fill(text);
  await page.getByRole('option', { name: option, exact: true }).click();
  await expect(page.getByRole('button', { name: `Quitar ${chip}` })).toBeVisible();
}

async function shot(page: Page, name: string) {
  // Header y «Buscar» en su sitio del documento, como la suite visual (capture-document.css).
  if (captures) await page.screenshot({ path: `${captureDir}/${name}.png`, fullPage: true, animations: 'disabled', caret: 'hide', style: captureStyle });
}

/** Paso 1 → 2 con la fuente detectada. */
async function detect(page: Page) {
  await page.goto('/sugerir');
  await page.getByLabel('Enlace de la fuente').fill(source);
  await page.getByRole('button', { name: 'Detectar' }).click();
  await expect(currentStep(page)).toContainText('Revisar datos');
}

/** Completa lo obligatorio que la detección no trae. */
async function completeData(page: Page, label = 'Independiente') {
  await page.getByLabel(/^Tipo/).selectOption('compilado');
  await addChip(page, 'Géneros', 'amb', 'Ambient');
  await addChip(page, 'Países', 'col', 'Colombia');
  await page.keyboard.press('Escape');
  await combobox(page, 'Sello').click();
  await page.getByRole('option', { name: label, exact: true }).click();
}

for (const role of ['comunidad', 'colaborador'] as const) {
  test(`U19 ${role}: envía a la cola con la propuesta v3 y su pantalla final`, async ({ page }) => {
    const calls = await mock(page, role);
    await page.setViewportSize({ width: 1440, height: 900 });
    await detect(page);
    await completeData(page);
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByLabel(/^Nota para el equipo/)).toBeVisible();
    await page.getByLabel(/^Nota para el equipo/).fill('Lo escuché en la radio.');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByText('El equipo la revisa y ninguna propuesta se publica automáticamente.', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Enviar a revisión' }).click();
    await expect(page.getByRole('heading', { name: 'Propuesta enviada' })).toBeVisible();
    await shot(page, `final-${role}-1440`);

    expect(calls.adminDraft).toHaveLength(0);
    expect(calls.submit).toHaveLength(1);
    expect(calls.submit[0].p_payload).toEqual({
      version: 3, title: 'Pulso I', primary_artists: ['Artista detectado'], collaborators: [], release_type: 'compilado',
      release_date: '2026-09-18', genres: ['Ambient'], countries: ['Colombia'], label: 'Independiente', team_note: 'Lo escuché en la radio.'
    });
    const done = page.getByRole('status').filter({ hasText: 'Propuesta enviada' });
    if (role === 'comunidad') {
      await expect(done.getByRole('link', { name: 'Ver mis aportes' })).toHaveAttribute('href', '/mis-aportes');
      await expect(done.getByRole('link', { name: 'Ir al Estudio' })).toHaveCount(0);
    } else {
      await expect(done).toContainText('cola de colaboración');
      await expect(done.getByRole('link', { name: 'Ir al Estudio' })).toHaveAttribute('href', '/estudio');
    }
    await done.getByRole('button', { name: 'Sugerir otro' }).click();
    await expect(page.getByLabel('Enlace de la fuente')).toHaveValue('');
    await expect(page.getByLabel('Enlace de la fuente')).toBeFocused();
  });
}

for (const width of [390, 1440]) {
  test(`U19 admin a ${width}: crea un borrador con artistas y sello nuevos, que aparecen en sus créditos (U19-01)`, async ({ page }) => {
    const calls = await mock(page, 'admin');
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto('/sugerir');
    // Sin eyebrow; la descripción corta solo en el paso 1.
    await expect(page.getByText('Catálogo abierto')).toHaveCount(0);
    const description = page.getByText('Pega el enlace del lanzamiento y revisa los datos que detectamos.');
    await expect(description).toBeVisible();
    await shot(page, `1-fuente-${width}`);
    await page.getByLabel('Enlace de la fuente').fill(source);
    await page.getByRole('button', { name: 'Detectar' }).click();
    await expect(currentStep(page)).toContainText('Revisar datos');
    await expect(description).toHaveCount(0);
    // Sin borradores de propuesta: admin crea directamente el borrador del catálogo.
    await expect(page.getByRole('button', { name: 'Guardar borrador' })).toHaveCount(0);

    // Un compilado con artistas nuevos y un sello nuevo.
    await addChip(page, 'Artistas principales', 'Artista nueva', 'Añadir «Artista nueva»', 'Artista nueva');
    await addChip(page, 'Colaboradores', 'Invitado nuevo', 'Añadir «Invitado nuevo»', 'Invitado nuevo');
    await page.getByLabel(/^Tipo/).selectOption('compilado');
    await addChip(page, 'Géneros', 'tech', 'Techno');
    await addChip(page, 'Países', 'chi', 'Chile');
    await page.keyboard.press('Escape');
    await addChip(page, 'Sello', 'Sello nuevo', 'Añadir «Sello nuevo»', 'Sello nuevo');
    // Radar opcional, con los controles del editor.
    await page.getByRole('checkbox', { name: /^Proponer un radar/ }).check();
    await page.getByLabel('Experimental').fill('4');
    await page.getByLabel('Bailable').fill('2');
    await shot(page, `2-datos-${width}`);
    await page.getByRole('button', { name: 'Continuar' }).click();

    await page.getByLabel(/^Observación del cambio/).fill('Compilado de la radio');
    await shot(page, `3-nota-${width}`);
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByText('Se crea un borrador en el catálogo', { exact: false })).toBeVisible();
    const summary = page.locator('dl');
    await expect(summary).toContainText('Artista detectado, Artista nueva');
    await expect(summary).toContainText('Sello nuevo');
    await expect(summary).toContainText('Experimental 4 · Denso 0 · Sintético 0 · Bailable 2 · Rápido 0');
    await expect(page.getByRole('button', { name: 'Enviar a revisión' })).toHaveCount(0);
    await shot(page, `4-enviar-${width}`);
    await page.getByRole('button', { name: 'Crear borrador' }).click();

    await expect(page.getByRole('heading', { name: 'Borrador creado' })).toBeVisible();
    await shot(page, `final-admin-${width}`);
    expect(calls.submit).toHaveLength(0);
    expect(calls.create).toHaveLength(0);
    expect(calls.adminDraft).toHaveLength(1);
    expect(calls.adminDraft[0]).toEqual({
      p_source_url: source, p_source_provider: 'bandcamp', p_reason: 'Compilado de la radio',
      p_detected_metadata: { ...detected, provider: 'bandcamp' },
      // La observación va al historial, no a la propuesta (sería la reseña).
      p_payload: {
        version: 3, title: 'Pulso I', primary_artists: ['Artista detectado', 'Artista nueva'], collaborators: ['Invitado nuevo'],
        release_type: 'compilado', release_date: '2026-09-18', genres: ['Techno'], countries: ['Chile'], label: 'Sello nuevo',
        radar: { experimental: 4, denso: 0, sintetico: 0, bailable: 2, rapido: 0 }
      }
    });

    const done = page.getByRole('status').filter({ hasText: 'Borrador creado' });
    await expect(done.getByRole('link', { name: 'Ir al Estudio' })).toHaveAttribute('href', '/estudio');
    await expect(done.getByRole('button', { name: 'Añadir otro' })).toBeVisible();
    await done.getByRole('link', { name: 'Abrir el borrador' }).click();

    // U19-01: los artistas nuevos están en los créditos del borrador y el sello en su campo.
    await expect(page).toHaveURL(new RegExp(`/estudio/catalogo\\?lanzamiento=${ids.release}$`));
    await expect(page.getByRole('group', { name: 'Artistas principales' }).locator('.credit__name')).toHaveText(['Artista detectado', 'Artista nueva']);
    await expect(page.getByRole('group', { name: 'Colaboradores' }).locator('.credit__name')).toHaveText(['Invitado nuevo']);
    await expect(page.getByLabel('Sello')).toHaveValue('Sello nuevo');
    await expect(page.getByText('Datos traídos de Sugerir')).toHaveCount(0);
  });
}

test('U19 duplicado: el enlace publicado se avisa en el paso 1, enlaza a la ficha y se puede seguir', async ({ page }) => {
  await mock(page, 'comunidad', { duplicate: { match: 'catalog', state: 'published', release_slug: 'pulso-i', release_id: null, contribution_id: null } });
  await page.goto('/sugerir');
  await page.getByLabel('Enlace de la fuente').fill(source);
  await page.getByRole('button', { name: 'Detectar' }).click();
  const notice = page.getByRole('status').filter({ hasText: 'Este enlace ya está en el catálogo.' });
  await expect(notice).toBeVisible();
  await expect(currentStep(page)).toContainText('Fuente');
  await expect(notice.getByRole('link', { name: 'Ver la ficha' })).toHaveAttribute('href', '/lanzamiento/pulso-i');
  await shot(page, 'duplicado-1440');
  await page.getByRole('button', { name: 'Continuar igualmente' }).click();
  await expect(currentStep(page)).toContainText('Revisar datos');
  await expect(page.getByLabel('Título')).toHaveValue('Pulso I');
  // Otra fuente borra el aviso.
  await page.getByRole('button', { name: 'Atrás' }).click();
  await page.getByLabel('Enlace de la fuente').fill('https://otra.bandcamp.com/album/x');
  await expect(notice).toHaveCount(0);
});

test('U19 duplicado: una propuesta ajena en la cola se avisa sin exponerla', async ({ page }) => {
  await mock(page, 'comunidad', { duplicate: { match: 'queue', state: 'pending', release_slug: null, release_id: null, contribution_id: null } });
  await page.goto('/sugerir');
  await page.getByLabel('Enlace de la fuente').fill(source);
  await page.getByRole('button', { name: 'Detectar' }).click();
  const notice = page.getByRole('status').filter({ hasText: 'Alguien ya propuso este enlace y está en revisión.' });
  await expect(notice).toBeVisible();
  await expect(notice.getByRole('link')).toHaveCount(0);
});

test('U19 listas cerradas: géneros y países solo de la lista seleccionable; no se puede escribir otro', async ({ page }) => {
  const calls = await mock(page, 'comunidad');
  await detect(page);
  expect(calls.dictionaryQueries.every((query) => query.includes('status=eq.selectable'))).toBe(true);
  expect(calls.dictionaryQueries).toHaveLength(2);
  for (const [label, text] of [['Géneros', 'Polka'], ['Países', 'España']] as const) {
    const field = combobox(page, label);
    await expect(field).toHaveAttribute('placeholder', 'Selecciona uno o más valores');
    await field.fill(text);
    await expect(page.getByRole('option', { name: new RegExp(`Añadir`) })).toHaveCount(0);
    await expect(page.getByText('Sin coincidencias')).toBeVisible();
    await field.press('Enter');
    await expect(page.getByRole('button', { name: `Quitar ${text}` })).toHaveCount(0);
    await field.press('Escape');
    await field.fill('');
  }
});

test('U19 listas cerradas: si el servidor rechaza un valor de legado, el error queda en su campo', async ({ page }) => {
  await mock(page, 'comunidad', { submitError: { message: 'genre_not_selectable', details: 'Trip Hop' } });
  await detect(page);
  await completeData(page);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Enviar a revisión' }).click();
  await expect(currentStep(page)).toContainText('Revisar datos');
  await expect(page.getByText('«Trip Hop» no está en la lista de géneros.')).toBeVisible();
  await expect(combobox(page, 'Géneros')).toBeFocused();
});

test('U19 sello: es obligatorio, «Independiente» va fijo arriba y avisa de nombres parecidos', async ({ page }) => {
  await mock(page, 'comunidad');
  await detect(page);
  await page.getByLabel(/^Tipo/).selectOption('ep');
  await addChip(page, 'Géneros', 'amb', 'Ambient');
  await addChip(page, 'Países', 'col', 'Colombia');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText('El sello es obligatorio. Si es autoeditado, elige «Independiente».')).toBeVisible();
  await expect(combobox(page, 'Sello')).toBeFocused();

  // «Independiente» primero, sin escribir y al buscar otro.
  await combobox(page, 'Sello').click();
  await expect(page.getByRole('listbox', { name: 'Sello' }).getByRole('option').first()).toHaveText('Independiente');
  await combobox(page, 'Sello').fill('Sello');
  await expect(page.getByRole('listbox', { name: 'Sello' }).getByRole('option').first()).toHaveText('Independiente');
  await expect(page.getByRole('option', { name: 'Sello U13', exact: true })).toBeVisible();

  // Un sello nuevo parecido a uno existente: se avisa y se puede usar el existente.
  await combobox(page, 'Sello').fill('Sello U-13');
  await page.getByRole('option', { name: 'Añadir «Sello U-13»' }).click();
  const warning = page.getByRole('status').filter({ hasText: '«Sello U-13» no está en el catálogo y se creará como nuevo.' });
  await expect(warning).toBeVisible();
  await warning.getByRole('button', { name: 'Usar «Sello U13»' }).click();
  await expect(page.getByRole('button', { name: 'Quitar Sello U13' })).toBeVisible();
  await expect(warning).toHaveCount(0);

  // Elegir otro sustituye al anterior: un solo sello.
  await combobox(page, 'Sello').click();
  await page.getByRole('option', { name: 'Independiente', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Quitar Independiente' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Quitar Sello U13' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(currentStep(page)).toContainText('Nota');
});

test('U19 artistas: un nombre nuevo parecido a uno del catálogo se avisa y se sustituye por el existente', async ({ page }) => {
  await mock(page, 'comunidad');
  await detect(page);
  await addChip(page, 'Artistas principales', 'Pirañas', 'Añadir «Pirañas»', 'Pirañas');
  const warning = page.getByRole('status').filter({ hasText: '«Pirañas» no está en el catálogo y se creará como nuevo.' });
  await expect(warning).toBeVisible();
  await warning.getByRole('button', { name: 'Usar «Los Pirañas»' }).click();
  await expect(page.getByRole('button', { name: 'Quitar Los Pirañas' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Quitar Pirañas' })).toHaveCount(0);
  // Un artista que ya está en el catálogo no avisa.
  await expect(page.getByRole('status').filter({ hasText: '«Artista detectado» no está en el catálogo' })).toHaveCount(0);
});
