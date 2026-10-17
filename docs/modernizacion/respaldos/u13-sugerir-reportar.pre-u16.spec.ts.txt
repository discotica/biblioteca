import { expect, test, type Page, type Route } from '@playwright/test';

// U13 — Sugerir por pasos y reportar con el lanzamiento identificado.
// Con U13_CAPTURAS=1 guarda las capturas del relevo en docs/modernizacion/capturas-u13/.

const project = 'hgocyrzhgohetfpzbmfs';
const base = `https://${project}.supabase.co`;
const ids = {
  community: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  admin: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  draft: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  changes: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4',
  release: '11111111-1111-4111-8111-111111111111'
};
const captures = process.env.U13_CAPTURAS === '1';
const captureDir = 'docs/modernizacion/capturas-u13';

type Role = 'comunidad' | 'admin';
type Calls = { submit: any[]; save: any[]; create: any[]; reports: any[] };

const detected = {
  provider: 'bandcamp', source_available: true, title: 'Pulso I', artists: ['Artista detectado', 'Segunda artista'],
  type: 'EP', release_date: '2026-09-18', cover_url: 'https://images.example.test/cover.jpg'
};

function contribution(input: Record<string, unknown> = {}) {
  return {
    id: ids.draft, author_id: ids.community, status: 'draft',
    source_url: 'https://artista.bandcamp.com/album/pulso', source_provider: 'bandcamp',
    payload: {
      version: 2, title: 'Pulso I', primary_artists: ['Artista detectado'], collaborators: [],
      release_type: 'ep', release_date: '2026-09-18', genres: ['Ambient'], countries: ['Colombia']
    },
    payload_version: 2, payload_quality: 'confirmed', detected_metadata: detected, queue_kind: null,
    submitted_at: null, reviewer_note: null, reviewed_at: null, release_id: null,
    created_at: '2026-10-09T10:00:00Z', updated_at: '2026-10-09T10:00:00Z',
    ...input
  };
}

const releaseRow = {
  id: ids.release, slug: 'u13-pulso', title: 'Pulso compartido', release_date: '2026-08-09', type: 'EP',
  label: 'Sello U13', review: 'Reseña breve.', experimental: 1, denso: 2, sintetico: 3, bailable: 4, rapido: 5,
  artists: ['Artista Principal'], primary_artists: [{ id: 'a1', slug: 'artista-principal', name: 'Artista Principal', position: 0 }],
  collaborators: [], credit_quality: 'verified', genres: ['Ambient'], countries: ['Colombia'],
  buy_link: 'https://example.test/comprar', cover: 'https://images.example.test/release.jpg'
};

const json = (route: Route, body: unknown, status = 200, contentType = 'application/json') =>
  route.fulfill({ status, contentType, body: JSON.stringify(body) });

async function authenticate(page: Page, role: Role) {
  const userId = role === 'admin' ? ids.admin : ids.community;
  const username = role === 'admin' ? 'admin' : 'comunidad';
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: `${username}@example.test`, app_metadata: {}, user_metadata: { username }, created_at: '2026-09-18T00:00:00Z' };
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

async function mock(page: Page, role: Role, rows: ReturnType<typeof contribution>[] = []) {
  const { user, userId } = await authenticate(page, role);
  const calls: Calls = { submit: [], save: [], create: [], reports: [] };
  let stored = [...rows];
  await page.route(`${base}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path.startsWith('/auth/v1/')) return json(route, user);
    if (path === '/rest/v1/profiles') return json(route, url.searchParams.get('select') === 'role' ? { role } : { id: userId, username: user.user_metadata.username, role });
    const entries = (names: string[], prefix: string) => names.map((name, index) => ({ id: `${prefix}-${index}`, name, slug: `${prefix}-${index}` }));
    if (path === '/rest/v1/genres') return json(route, entries(['Ambient', 'Electrónica', 'Techno'], 'genre'));
    if (path === '/rest/v1/countries') return json(route, entries(['Chile', 'Colombia', 'México'], 'country'));
    if (path === '/rest/v1/release_types') return json(route, entries(['Álbum', 'EP', 'Single', 'Compilado', 'Sample Pack'], 'type'));
    if (path === '/rest/v1/labels') return json(route, entries(['Sello U13'], 'label'));
    if (path === '/rest/v1/artists') {
      const filter = url.searchParams.get('name') ?? '';
      const term = filter.replace(/^ilike\./, '');
      const contains = term.startsWith('%');
      const value = term.replace(/^%|%$/g, '').toLowerCase();
      return json(route, entries(['Artista del catálogo', 'Artista invitada', 'Artista detectado'], 'artist')
        .filter((artist) => contains ? artist.name.toLowerCase().includes(value) : artist.name.toLowerCase() === value));
    }
    if (path === '/rest/v1/contributions') {
      const id = url.searchParams.get('id')?.replace(/^eq\./, '');
      return json(route, id ? stored.find((item) => item.id === id) ?? null : stored);
    }
    if (path.endsWith('/rpc/create_contribution_draft')) {
      const body = request.postDataJSON();
      calls.create.push(body);
      const created = contribution({ source_url: body.p_source_url, payload: body.p_payload, detected_metadata: body.p_detected_metadata });
      stored = [created, ...stored.filter((item) => item.id !== created.id)];
      return json(route, created);
    }
    if (path.endsWith('/rpc/save_contribution_draft')) {
      const body = request.postDataJSON();
      calls.save.push(body);
      const saved = contribution({ id: body.p_contribution_id, source_url: body.p_source_url, payload: body.p_payload, detected_metadata: body.p_detected_metadata });
      stored = stored.map((item) => item.id === saved.id ? saved : item);
      return json(route, saved);
    }
    if (path.endsWith('/rpc/submit_contribution')) {
      const body = request.postDataJSON();
      calls.submit.push(body);
      return json(route, contribution({ id: body.p_contribution_id, status: 'pending', payload: body.p_payload }));
    }
    if (path.includes('/functions/v1/inspect-release-source')) return json(route, detected);
    if (path === '/rest/v1/problem_reports' && request.method() === 'POST') {
      const body = request.postDataJSON();
      calls.reports.push(body);
      return json(route, { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', ...body, status: 'new' }, 201, 'application/vnd.pgrst.object+json');
    }
    if (path === '/rest/v1/rpc/resolve_release_slug') return json(route, [{ release_id: releaseRow.id, canonical_slug: releaseRow.slug, match_kind: 'canonical', alias_kind: null }]);
    if (path === '/rest/v1/catalog_releases') {
      const id = url.searchParams.get('id') ?? '';
      if (id.startsWith('eq.')) return json(route, releaseRow, 200, 'application/vnd.pgrst.object+json');
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/1' }, body: JSON.stringify([releaseRow]) });
    }
    // Consola: listas vacías y diccionarios.
    if (path.startsWith('/rest/v1/rpc/')) return json(route, []);
    return json(route, []);
  });
  await page.route('https://images.example.test/**', (route) => route.fulfill({
    status: 200, contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#3a6b8c"/></svg>'
  }));
  return { calls, rows: () => stored };
}

async function addChip(page: Page, label: string, text: string, option = text, chip = option) {
  await page.getByRole('combobox', { name: label }).fill(text);
  await page.getByRole('option', { name: new RegExp(option) }).first().click();
  await expect(page.getByRole('button', { name: `Quitar ${chip}` })).toBeVisible();
}

const noOverflow = (page: Page) =>
  expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

async function shot(page: Page, name: string) {
  if (captures) await page.screenshot({ path: `${captureDir}/${name}.png`, fullPage: true, animations: 'disabled', caret: 'hide' });
}

const currentStep = (page: Page) => page.locator('[aria-current="step"]');

for (const width of [390, 1440]) {
  test(`U13 sugerir completo a ${width}: el botón Sugerir abre el primer paso, se vuelve sin perder datos y se envía sin nota`, async ({ page }) => {
    const { calls } = await mock(page, 'comunidad');
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto('/manual');

    // El botón del header lleva directo a crear la sugerencia, sin pantalla intermedia.
    const sugerir = page.getByRole('banner').getByRole('link', { name: 'Sugerir' }).first();
    await sugerir.click();
    await expect(page).toHaveURL(/\/sugerir$/);
    await expect(page.getByLabel('Enlace de la fuente')).toBeFocused();
    await expect(currentStep(page)).toContainText('Fuente');
    await noOverflow(page);
    await shot(page, `1-fuente-${width}`);

    await page.getByLabel('Enlace de la fuente').fill('https://artista.bandcamp.com/album/pulso');
    await page.getByRole('button', { name: 'Detectar' }).click();

    // Paso 2: datos detectados, listas con chips.
    await expect(currentStep(page)).toContainText('Revisar datos');
    await expect(page.getByRole('heading', { level: 2, name: /Revisar datos/ })).toBeFocused();
    await expect(page.getByLabel('Título')).toHaveValue('Pulso I');
    await expect(page.getByRole('button', { name: 'Quitar Artista detectado' })).toBeVisible();
    await expect(page.getByText('La fuente sugiere “EP”; confírmalo manualmente.')).toBeVisible();
    await addChip(page, 'Colaboradores', 'invit', 'Artista invitada');
    await page.getByLabel(/^Tipo/).selectOption('ep');
    await addChip(page, 'Géneros', 'amb', 'Ambient');
    // Un país que aún no está en el catálogo se puede añadir, como el texto libre de E10.
    await addChip(page, 'Países', 'Perú', 'Añadir «Perú»', 'Perú');
    await page.keyboard.press('Escape');
    await page.getByLabel(/^Sello/).fill('Sello propio');
    await noOverflow(page);
    await shot(page, `2-datos-${width}`);

    // Atrás conserva todo; la fuente sin cambios solo continúa (no vuelve a detectar).
    await page.getByRole('button', { name: 'Atrás' }).click();
    await expect(page.getByLabel('Enlace de la fuente')).toHaveValue('https://artista.bandcamp.com/album/pulso');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByLabel('Título')).toHaveValue('Pulso I');
    await expect(page.getByRole('button', { name: 'Quitar Perú' })).toBeVisible();
    await expect(page.getByLabel(/^Sello/)).toHaveValue('Sello propio');

    // Paso 3: la nota es opcional.
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(currentStep(page)).toContainText('Nota');
    await expect(page.getByLabel(/^Nota para el equipo/)).toHaveValue('');
    await expect(page.getByText('Puedes enviarla sin nota.', { exact: false })).toBeVisible();
    await noOverflow(page);
    await shot(page, `3-nota-${width}`);

    // Atrás/adelante del navegador también recorren los pasos sin perder datos.
    await page.goBack();
    await expect(page.getByLabel('Título')).toHaveValue('Pulso I');
    await page.goForward();
    await expect(page.getByLabel(/^Nota para el equipo/)).toBeVisible();

    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(currentStep(page)).toContainText('Enviar');
    const summary = page.locator('dl');
    await expect(summary).toContainText('Pulso I');
    await expect(summary).toContainText('Artista detectado, Segunda artista');
    await expect(summary).toContainText('Artista invitada');
    await expect(summary).toContainText('Perú');
    await expect(page.getByText('Sin nota')).toBeVisible();
    await noOverflow(page);
    await shot(page, `4-enviar-${width}`);

    await page.getByRole('button', { name: 'Enviar a revisión' }).click();
    await expect(page.getByRole('heading', { name: 'Propuesta enviada' })).toBeVisible();
    await shot(page, `5-enviada-${width}`);

    expect(calls.submit).toHaveLength(1);
    const payload = calls.submit[0].p_payload;
    expect(payload).toEqual({
      version: 2, title: 'Pulso I', primary_artists: ['Artista detectado', 'Segunda artista'], collaborators: ['Artista invitada'],
      release_type: 'ep', release_date: '2026-09-18', genres: ['Ambient'], countries: ['Perú'],
      label: 'Sello propio'
    });
    expect(payload).not.toHaveProperty('team_note');
  });
}

test('U13 propuesta de cambio sin nota: se reenvía una propuesta con cambios solicitados dejando la nota vacía', async ({ page }) => {
  const changes = contribution({
    id: ids.changes, status: 'changes_requested', reviewer_note: 'Aclara los créditos.',
    payload: { ...contribution().payload, team_note: 'Nota original' }
  });
  const { calls } = await mock(page, 'comunidad', [changes]);
  await page.goto(`/sugerir?draft=${ids.changes}`);
  await expect(currentStep(page)).toContainText('Revisar datos');
  await expect(page.getByText('Aclara los créditos.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardar borrador' })).toHaveCount(0);
  await page.getByLabel('Título').fill('Pulso I (corregido)');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel(/^Nota para el equipo/).fill('');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText('Sin nota')).toBeVisible();
  await shot(page, 'cambio-sin-nota-1440');
  await page.getByRole('button', { name: 'Enviar a revisión' }).click();
  await expect(page.getByRole('heading', { name: 'Propuesta enviada' })).toBeVisible();
  expect(calls.create).toHaveLength(0);
  expect(calls.submit).toHaveLength(1);
  expect(calls.submit[0].p_contribution_id).toBe(ids.changes);
  expect(calls.submit[0].p_payload.title).toBe('Pulso I (corregido)');
  expect(calls.submit[0].p_payload).not.toHaveProperty('team_note');
});

test('U13 el borrador se conserva entre visitas: se guarda en un paso y se retoma con todos los datos', async ({ page }) => {
  const { calls } = await mock(page, 'comunidad');
  await page.goto('/sugerir');
  await page.getByLabel('Enlace de la fuente').fill('https://artista.bandcamp.com/album/pulso');
  await page.getByRole('button', { name: 'Detectar' }).click();
  await addChip(page, 'Géneros', 'tech', 'Techno');
  await page.getByRole('button', { name: 'Continuar' }).click();
  // Incompleto (sin tipo ni país): el paso 2 lo marca y no avanza.
  await expect(page.getByText('Confirma el tipo de lanzamiento.')).toBeVisible();
  await expect(page.getByLabel(/^Tipo/)).toBeFocused();
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.getByText('Borrador guardado. Puedes retomarlo desde tu perfil.')).toBeVisible();
  expect(calls.create).toHaveLength(1);
  expect(calls.create[0].p_payload.genres).toEqual(['Techno']);

  await page.goto('/');
  await page.goto(`/sugerir?draft=${ids.draft}`);
  await expect(currentStep(page)).toContainText('Revisar datos');
  await expect(page.getByLabel('Título')).toHaveValue('Pulso I');
  await expect(page.getByRole('button', { name: 'Quitar Techno' })).toBeVisible();
  await page.getByRole('button', { name: 'Atrás' }).click();
  await expect(page.getByLabel('Enlace de la fuente')).toHaveValue('https://artista.bandcamp.com/album/pulso');
});

test('U13 admin: Sugerir muestra el mismo flujo y el último paso abre la consola con lo rellenado', async ({ page }) => {
  await mock(page, 'admin');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/manual');
  await page.getByRole('banner').getByRole('link', { name: 'Sugerir' }).first().click();
  await expect(page).toHaveURL(/\/sugerir$/);
  await expect(page.getByLabel('Enlace de la fuente')).toBeFocused();
  await page.getByLabel('Enlace de la fuente').fill('https://artista.bandcamp.com/album/pulso');
  await page.getByRole('button', { name: 'Detectar' }).click();
  await expect(page.getByLabel('Título')).toHaveValue('Pulso I');
  // Sin borradores: E09 no dejaría enviarlos.
  await expect(page.getByRole('button', { name: 'Guardar borrador' })).toHaveCount(0);
  await page.getByLabel(/^Tipo/).selectOption('ep');
  await addChip(page, 'Géneros', 'amb', 'Ambient');
  await addChip(page, 'Países', 'Perú', 'Añadir «Perú»', 'Perú');
  await page.keyboard.press('Escape');
  await page.getByLabel(/^Sello/).fill('Sello U13');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByLabel(/^Observación del cambio/)).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('button', { name: 'Enviar a revisión' })).toHaveCount(0);
  await shot(page, 'admin-enviar-1440');
  await page.getByRole('button', { name: 'Continuar en el Estudio' }).click();

  // U15: el alta vive en el Catálogo del Estudio y su URL la mantiene abierta.
  await expect(page).toHaveURL(/\/estudio\/catalogo\?nuevo=1$/);
  await expect(page.getByText('Nuevo lanzamiento', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Pulso I' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Datos traídos de Sugerir' })).toContainText('Segunda artista (artista)');
  await expect(page.getByRole('status').filter({ hasText: 'Datos traídos de Sugerir' })).toContainText('Perú (país)');
  await expect(page.getByPlaceholder('https://bandcamp.com/…')).toHaveValue('https://artista.bandcamp.com/album/pulso');
  await expect(page.getByPlaceholder('¿Qué cambió?')).toHaveValue('Alta desde Sugerir.');
  await shot(page, 'admin-consola-1440');
  // El traspaso se lee una vez: recargar la consola no lo repite.
  expect(await page.evaluate(() => sessionStorage.getItem('discotica:sugerir-a-consola'))).toBeNull();
});

test('U13 reportar desde la ficha: el lanzamiento llega identificado y el reporte lo incluye', async ({ page }) => {
  const { calls } = await mock(page, 'comunidad');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/lanzamiento/${releaseRow.slug}`);
  const report = page.locator('[data-release-actions]').getByRole('link', { name: 'Reportar un problema' });
  await expect(report).toHaveAttribute('href', `/reportar?release_id=${ids.release}`);
  await report.click();
  await expect(page).toHaveURL(new RegExp(`/reportar\\?release_id=${ids.release}`));
  const card = page.getByRole('region', { name: 'Lanzamiento del reporte' });
  await expect(card).toContainText('Pulso compartido');
  await expect(card).toContainText('Artista Principal');
  await expect(card.getByRole('link', { name: 'Ver ficha' })).toHaveAttribute('href', `/lanzamiento/${releaseRow.slug}`);
  await expect(page.getByLabel('Categoría')).toHaveValue('catalog_error');
  await expect(page.getByText('Ningún archivo elegido')).toBeVisible();
  // El selector nativo ("Choose File") no se ve: lo sustituye el botón en español.
  await expect(page.locator('input[type=file]')).toHaveClass(/sr-only/);
  await noOverflow(page);
  await shot(page, 'reportar-ficha-1440');

  await page.getByRole('button', { name: 'Enviar reporte' }).click();
  await expect(page.getByText('Describe el problema para poder investigarlo.')).toBeVisible();
  await expect(page.getByLabel(/^Descripción/)).toBeFocused();
  await page.getByLabel(/^Descripción/).fill('El año no coincide con la fuente.');
  await page.locator('input[type=file]').setInputFiles({ name: 'captura.png', mimeType: 'image/png', buffer: Buffer.from('png') });
  await expect(page.getByText('captura.png')).toBeVisible();
  await page.getByRole('button', { name: 'Quitar la captura' }).click();
  await expect(page.getByText('Ningún archivo elegido')).toBeVisible();
  await page.getByRole('button', { name: 'Enviar reporte' }).click();
  await expect(page.getByText('Tu reporte fue enviado.', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Volver al lanzamiento' })).toHaveAttribute('href', `/lanzamiento/${releaseRow.slug}`);
  expect(calls.reports).toHaveLength(1);
  expect(calls.reports[0]).toMatchObject({ category: 'catalog_error', release_id: ids.release, description: 'El año no coincide con la fuente.' });
});

for (const width of [390, 1440]) {
  test(`U13 reportar desde el menú global, sin lanzamiento, a ${width}`, async ({ page }) => {
    await mock(page, 'comunidad');
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/manual');
    // Antes de U13 el menú se montaba dos veces y ningún enlace navegaba.
    await page.getByRole('banner').getByRole('button', { name: width === 390 ? 'Abrir menú' : 'Menú' }).click();
    await expect(page.getByRole('navigation', { name: 'Menú' })).toHaveCount(1);
    const item = page.getByRole('navigation', { name: 'Menú' }).getByRole('link', { name: 'Reportar un problema' });
    await item.click();
    await expect(page).toHaveURL(/\/reportar$/);
    await expect(page.getByRole('region', { name: 'Lanzamiento del reporte' })).toHaveCount(0);
    await expect(page.getByLabel('Categoría')).toHaveValue('technical_bug');
    await noOverflow(page);
    await shot(page, `reportar-menu-${width}`);
  });
}
