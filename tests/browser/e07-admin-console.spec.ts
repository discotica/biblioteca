import { expect, test, type Page, type Route } from '@playwright/test';

const adminId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const releaseId = '11111111-1111-4111-8111-111111111111';
const artistA = '22222222-2222-4222-8222-222222222222';
const artistB = '33333333-3333-4333-8333-333333333333';
const labelId = '44444444-4444-4444-8444-444444444444';
const typeId = '55555555-5555-4555-8555-555555555555';
const genreId = '66666666-6666-4666-8666-666666666666';
const countryId = '77777777-7777-4777-8777-777777777777';
const createdLabelId = '88888888-8888-4888-8888-888888888880';
const createdGenreId = '99999999-9999-4999-8999-999999999990';

const snapshot = {
  id: releaseId,
  slug: 'un-titulo-muy-largo-para-verificar-la-tabla',
  title: 'Un título muy largo para verificar la densidad de la tabla administrativa',
  release_date: '2026-09-12',
  release_type_id: typeId,
  label_id: labelId,
  review: '',
  status: 'draft',
  credit_quality: 'proposed',
  catalog_version: 4,
  updated_at: '2026-09-17T14:30:00Z',
  artist_ids: [artistA],
  collaborator_ids: [artistB],
  genre_ids: [genreId],
  country_ids: [countryId],
  radar: { experimental: 4, denso: 3, sintetico: 5, bailable: 2, rapido: 4 },
  links: [{ provider: 'Bandcamp', url: 'https://discoteca.example.test/album/release', is_primary: true }],
  cover_url: 'https://images.example.test/cover.jpg',
  source: { mode: 'imported', provider: 'Bandcamp', url: null, cover_source_url: null }
};

const history = {
  release_id: releaseId,
  items: [{
    change_set_id: '88888888-8888-4888-8888-888888888888',
    operation: 'update',
    reason: 'Corrección editorial',
    status: 'applied',
    base_version: 3,
    result_version: 4,
    created_at: '2026-09-17T14:30:00Z',
    reverted_at: null,
    actor: { id: adminId, username: 'jmamanche', display_name: 'JM Amanche' },
    before_state: { ...snapshot, title: 'Título anterior', catalog_version: 3 },
    after_state: snapshot
  }]
};

function json(route: Route, body: unknown) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockAdmin(page: Page) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: adminId, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  const accessToken = `${header}.${payload}.signature`;
  const session = {
    access_token: accessToken,
    refresh_token: 'fixture-refresh-token',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: { id: adminId, aud: 'authenticated', role: 'authenticated', email: 'admin@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-09-17T00:00:00Z' }
  };
  const cookieValue = `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
  await page.context().addCookies([{
    name: 'sb-hgocyrzhgohetfpzbmfs-auth-token',
    value: cookieValue,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: false,
    secure: false,
    sameSite: 'Lax'
  }]);

  await page.route('https://hgocyrzhgohetfpzbmfs.supabase.co/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.startsWith('/auth/v1/')) return json(route, session.user);
    if (url.pathname.endsWith('/rest/v1/profiles')) return json(route, [{ role: 'admin' }]);
    if (url.pathname.endsWith('/rest/v1/labels')) return json(route, [{ id: labelId, name: 'Sello de prueba', slug: 'sello-de-prueba' }]);
    if (url.pathname.endsWith('/rest/v1/release_types')) return json(route, [{ id: typeId, name: 'Álbum', slug: 'album' }]);
    if (url.pathname.endsWith('/rest/v1/genres')) return json(route, [{ id: genreId, name: 'Electrónica', slug: 'electronica' }]);
    if (url.pathname.endsWith('/rest/v1/countries')) return json(route, [{ id: countryId, name: 'Colombia', slug: 'colombia' }]);
    if (url.pathname.endsWith('/rest/v1/artists')) return json(route, [
      { id: artistA, name: 'Artista principal', slug: 'artista-principal' },
      { id: artistB, name: 'Artista colaborador', slug: 'artista-colaborador' }
    ]);
    if (url.pathname.endsWith('/rest/v1/rpc/admin_list_catalog_releases')) return json(route, { items: [snapshot], total: 1, page: 1, page_size: 25 });
    if (url.pathname.endsWith('/rest/v1/rpc/admin_get_catalog_release')) return json(route, snapshot);
    if (url.pathname.endsWith('/rest/v1/rpc/admin_get_catalog_history')) return json(route, history);
    return json(route, {});
  });
  await page.route('https://images.example.test/**', (route) => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="#27351f"/><circle cx="150" cy="150" r="70" fill="#8cff18"/></svg>' }));
}

test.beforeEach(async ({ page }) => {
  await mockAdmin(page);
});

// U15: la consola vive en el Estudio (/estudio/catalogo) y cada fila es un enlace al editor.
async function openFixtureRelease(page: Page) {
  await page.goto('/estudio/catalogo');
  await page.getByRole('link', { name: `Editar ${snapshot.title}`, exact: true }).click();
}

test('E07 muestra una tabla amplia y un editor simplificado', async ({ page }) => {
  let lastSearch: string | null = null;
  let listPayload: Record<string, unknown> | null = null;
  await page.route('https://hgocyrzhgohetfpzbmfs.supabase.co/rest/v1/rpc/admin_list_catalog_releases', async (route) => {
    listPayload = route.request().postDataJSON();
    lastSearch = listPayload.p_query as string | null;
    await json(route, { items: [snapshot], total: 1, page: 1, page_size: 25 });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/estudio/catalogo');
  await expect(page.getByRole('heading', { name: 'Catálogo', level: 1 })).toBeVisible();
  await expect(page.getByText(snapshot.title, { exact: true })).toBeVisible();
  expect(listPayload).toMatchObject({ p_page: 1, p_page_size: 25, p_order_key: 'release_date', p_order_direction: 'desc' });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByPlaceholder('Buscar por título, artista, sello o ID').fill('densidad');
  await expect.poll(() => lastSearch).toBe('densidad');

  await page.getByRole('link', { name: `Editar ${snapshot.title}`, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/estudio/catalogo\\?lanzamiento=${releaseId}$`));
  // U16: una sola página con secciones e índice lateral, sin pestañas ni vista previa.
  await expect(page.getByRole('navigation', { name: 'Secciones del lanzamiento' }).getByRole('link')).toHaveText([/^Datos/, /^Créditos/, /^Clasificación/, /^Medios/, /^Historial/]);
  for (const name of ['Datos', 'Créditos', 'Clasificación', 'Medios', 'Historial']) await expect(page.getByRole('heading', { level: 2, name, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edición' })).toHaveCount(0);
  await expect(page.getByText(/vista previa/i)).toHaveCount(0);
  await expect(page.getByText('Calidad de créditos')).toHaveCount(0);
  await expect(page.getByText('Reseña (opcional)')).toBeVisible();
  await expect(page.getByText('Identificador interno')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('E07 integra la búsqueda de artistas en cada grupo y edita también en móvil', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openFixtureRelease(page);
  const primaryGroup = page.getByRole('group', { name: 'Artistas principales' });
  await expect(primaryGroup.getByRole('combobox', { name: 'Añadir a artistas principales' })).toBeVisible();
  await expect(primaryGroup.getByPlaceholder('Buscar artista…')).toBeVisible();
  await expect(page.getByText('Añadir créditos')).toHaveCount(0);

  // U16: móvil ya no es consulta; el índice pasa a un selector.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText('Vista de consulta. Abre esta ficha en desktop para editar.')).toHaveCount(0);
  await expect(page.getByLabel('Título')).toBeEditable();
  await expect(page.getByLabel('Ir a la sección')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('E07 bloquea la ruta directa sin sesión o con roles no administrativos', async ({ page }) => {
  await page.context().clearCookies();
  // La ruta anterior redirige al Estudio, que pide sesión.
  await page.goto('/admin/catalogo');
  await expect(page).toHaveURL(/\/estudio\/catalogo$/);
  await expect(page.getByRole('heading', { name: 'Inicia sesión' })).toBeVisible();

  await mockAdmin(page);
  const adminCalls: string[] = [];
  page.on('request', (request) => { if (request.url().includes('/rpc/admin_')) adminCalls.push(request.url()); });
  await page.route('https://hgocyrzhgohetfpzbmfs.supabase.co/rest/v1/profiles**', (route) => json(route, [{ role: 'comunidad' }]));
  await page.goto('/estudio/catalogo');
  await expect(page.getByRole('heading', { name: 'Sin acceso al Estudio' })).toBeVisible();
  await page.unroute('https://hgocyrzhgohetfpzbmfs.supabase.co/rest/v1/profiles**');

  // El rol se lee una vez por sesión: otra cuenta, otra página.
  await page.route('https://hgocyrzhgohetfpzbmfs.supabase.co/rest/v1/profiles**', (route) => json(route, [{ role: 'colaborador' }]));
  await page.reload();
  await expect(page.getByText('Esta sección es solo para administración')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Estudio' }).getByRole('link')).toHaveText(['Propuestas']);
  expect(adminCalls).toEqual([]);
});

test('E07 valida en cliente y muestra el rechazo del servidor', async ({ page }) => {
  await openFixtureRelease(page);
  let updateRequests = 0;
  await page.route('https://hgocyrzhgohetfpzbmfs.supabase.co/rest/v1/rpc/admin_update_catalog_release', async (route) => {
    updateRequests += 1;
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ code: '22023', message: 'El servidor rechazó el payload de prueba.', details: null, hint: null })
    });
  });

  await page.getByPlaceholder('Título del lanzamiento').fill('');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByRole('alert')).toContainText('El título es obligatorio.');
  expect(updateRequests).toBe(0);

  await page.getByPlaceholder('Título del lanzamiento').fill(snapshot.title);
  await page.getByPlaceholder('¿Qué cambió?').fill('Validación de contrato');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByRole('alert')).toContainText('El servidor rechazó el payload de prueba.');
  expect(updateRequests).toBe(1);
});

test('E07 edita un borrador, lo publica y lo archiva sin cambiar UUID ni slug', async ({ page }) => {
  // Desde U19 el borrador nace en Sugerir (admin_create_draft_from_suggestion); aquí se abre ya creado.
  const canonicalSlug = 'borrador-de-prueba';
  let current: Record<string, any> = {
    ...snapshot, title: 'Borrador de prueba', slug: canonicalSlug, status: 'draft', catalog_version: 1,
    release_date: null, release_type_id: null, label_id: null, collaborator_ids: [], genre_ids: [], country_ids: [], links: [], cover_url: null
  };
  const writes: Record<string, unknown>[] = [];
  await page.route('https://hgocyrzhgohetfpzbmfs.supabase.co/rest/v1/rpc/admin_list_catalog_releases', (route) => json(route, { items: [current], total: 1, page: 1, page_size: 25, order_key: 'release_date', order_direction: 'desc' }));
  await page.route('https://hgocyrzhgohetfpzbmfs.supabase.co/rest/v1/rpc/admin_get_catalog_release', (route) => json(route, current));
  await page.route('https://hgocyrzhgohetfpzbmfs.supabase.co/rest/v1/rpc/admin_update_catalog_release', async (route) => {
    const body = route.request().postDataJSON();
    writes.push(body);
    const operation = body.p_operation as string;
    current = { ...current, ...body.p_payload, id: releaseId, slug: current.slug, status: operation === 'publish' ? 'published' : operation === 'archive' ? 'archived' : 'draft', catalog_version: current.catalog_version + 1, updated_at: snapshot.updated_at };
    await json(route, { release_id: releaseId, catalog_version: current.catalog_version, change_set_id: `${operation}-change` });
  });

  await page.goto(`/estudio/catalogo?lanzamiento=${releaseId}`);
  await expect(page.getByPlaceholder('Título del lanzamiento')).toHaveValue('Borrador de prueba');

  await page.getByPlaceholder('https://bandcamp.com/…').fill('https://bandcamp.com/borrador');
  await page.getByLabel('Tipo').selectOption(typeId);
  await page.getByLabel('Fecha de lanzamiento').fill('2026-09-17');
  await page.getByPlaceholder('Busca un sello existente').fill('Sello de prueba');
  // U16: géneros y países con el combobox, en lugar de la nube.
  await page.getByRole('combobox', { name: 'Géneros' }).fill('Electr');
  await page.getByRole('option', { name: 'Electrónica' }).click();
  await page.getByRole('combobox', { name: 'Países' }).fill('Colom');
  await page.getByRole('option', { name: 'Colombia' }).click();
  await page.getByPlaceholder('https://…').fill('https://images.example.test/borrador.jpg');
  await page.getByPlaceholder('¿Qué cambió?').fill('Publicación completa');
  await page.getByRole('button', { name: 'Publicar' }).click();
  await page.getByRole('dialog', { name: 'Publicar lanzamiento' }).getByRole('button', { name: 'Confirmar publicación' }).click();
  await expect(page.locator('.editor__feedback')).toContainText('Lanzamiento publicado.');
  expect(writes[0]).toMatchObject({ p_release_id: releaseId, p_expected_version: 1, p_operation: 'publish', p_payload: { slug: canonicalSlug, title: 'Borrador de prueba' } });

  await page.getByPlaceholder('¿Qué cambió?').fill('Archivo editorial');
  // U16: Archivar se separa de Guardar, en "Más acciones".
  await page.getByRole('button', { name: 'Más acciones' }).click();
  await page.getByRole('menuitem', { name: 'Archivar lanzamiento' }).click();
  await page.getByRole('dialog', { name: 'Archivar lanzamiento' }).getByRole('button', { name: 'Archivar' }).click();
  await expect(page.locator('.editor__feedback')).toContainText('Lanzamiento archivado.');
  expect(writes[1]).toMatchObject({ p_release_id: releaseId, p_expected_version: 2, p_operation: 'archive', p_payload: { slug: canonicalSlug } });
});

test('E07 crea sellos y géneros solo mediante las RPC auditadas confirmadas', async ({ page }) => {
  const calls: Record<string, Record<string, unknown>> = {};
  await page.route('https://hgocyrzhgohetfpzbmfs.supabase.co/rest/v1/rpc/admin_create_catalog_label', async (route) => {
    calls.label = route.request().postDataJSON();
    await json(route, { label_id: createdLabelId, name: 'Sello confirmado', created: true, duplicate: false, audit_event_id: 71, catalog_version: 1 });
  });
  await page.route('https://hgocyrzhgohetfpzbmfs.supabase.co/rest/v1/rpc/admin_create_catalog_genre', async (route) => {
    calls.genre = route.request().postDataJSON();
    await json(route, { genre_id: createdGenreId, name: 'Género confirmado', created: true, duplicate: false, audit_event_id: 72, catalog_version: 1 });
  });
  await openFixtureRelease(page);

  await page.getByPlaceholder('Busca un sello existente').fill('Sello confirmado');
  await page.getByRole('button', { name: 'Crear sello «Sello confirmado»' }).click();
  const labelDialog = page.getByRole('dialog', { name: 'Crear sello confirmado' });
  await expect(labelDialog.getByPlaceholder('Nombre del sello')).toBeFocused();
  await labelDialog.getByPlaceholder('Nombre del sello').fill('Sello confirmado');
  await labelDialog.getByPlaceholder('¿Por qué se crea este valor?').fill('Alta editorial confirmada');
  await labelDialog.getByRole('button', { name: 'Confirmar y auditar' }).click();
  await expect(page.locator('.editor__feedback')).toContainText('Sello creado y auditado.');
  expect(calls.label).toMatchObject({ p_name: 'Sello confirmado', p_confirm: true, p_reason: 'Alta editorial confirmada' });
  await expect(page.getByPlaceholder('Busca un sello existente')).toHaveValue('Sello confirmado');

  // U16: el alta de género sale del combobox ("Crear género «…»").
  await page.getByRole('combobox', { name: 'Géneros' }).fill('Género confirmado');
  await page.getByRole('option', { name: 'Crear género «Género confirmado»' }).click();
  const genreDialog = page.getByRole('dialog', { name: 'Crear género confirmado' });
  await expect(genreDialog.getByPlaceholder('Nombre del género')).toBeFocused();
  await expect(genreDialog.getByPlaceholder('Nombre del género')).toHaveValue('Género confirmado');
  await genreDialog.getByPlaceholder('¿Por qué se crea este valor?').fill('Taxonomía editorial confirmada');
  await genreDialog.getByRole('button', { name: 'Confirmar y auditar' }).click();
  await expect(page.locator('.editor__feedback')).toContainText('Género creado y auditado.');
  expect(calls.genre).toMatchObject({ p_name: 'Género confirmado', p_confirm: true, p_reason: 'Taxonomía editorial confirmada' });
  await expect(page.getByRole('button', { name: 'Quitar género Género confirmado' })).toBeVisible();
});

test('E07 recupera el snapshot ante un conflicto de versión', async ({ page }) => {
  await openFixtureRelease(page);
  await page.route('https://hgocyrzhgohetfpzbmfs.supabase.co/rest/v1/rpc/admin_update_catalog_release', (route) => route.fulfill({
    status: 409,
    contentType: 'application/json',
    body: JSON.stringify({ code: '40001', message: 'stale write', details: null, hint: null })
  }));

  await page.getByPlaceholder('¿Qué cambió?').fill('Edición concurrente');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByRole('alert')).toContainText('Otra persona editó este lanzamiento');
  await expect(page.locator('.editor__version')).toHaveText('v4');
});

test('E07 presenta auditoría, conserva foco y ejecuta reversión confirmada', async ({ page }) => {
  let revertPayload: Record<string, unknown> | null = null;
  await openFixtureRelease(page);
  await page.route('https://hgocyrzhgohetfpzbmfs.supabase.co/rest/v1/rpc/admin_revert_catalog_change', async (route) => {
    revertPayload = route.request().postDataJSON();
    await json(route, { release_id: releaseId, catalog_version: 5, change_set_id: '99999999-9999-4999-8999-999999999999' });
  });

  // U16: el historial es la última sección; el índice lleva a ella.
  await page.getByRole('navigation', { name: 'Secciones del lanzamiento' }).getByRole('link', { name: /Historial/ }).click();
  await expect(page.getByText('Corrección editorial')).toBeVisible();
  await expect(page.locator('.history__meta')).toContainText('JM Amanche · versión 3 → 4');
  const trigger = page.getByRole('button', { name: 'Revertir este cambio' });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Revertir cambio' });
  await expect(dialog).toBeVisible();
  // La observación de la reversión va en el propio diálogo.
  await expect(dialog.getByLabel('Observación de la reversión')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  // Lo escrito en la barra se trae como punto de partida.
  await page.getByPlaceholder('¿Qué cambió?').fill('Restaurar estado anterior');
  await trigger.click();
  await expect(dialog.getByLabel('Observación de la reversión')).toHaveValue('Restaurar estado anterior');
  await dialog.getByRole('button', { name: 'Revertir cambio', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Cambio revertido mediante una nueva entrada auditada.');
  expect(revertPayload).toMatchObject({
    p_change_set_id: history.items[0].change_set_id,
    p_expected_version: history.items[0].result_version,
    p_reason: 'Restaurar estado anterior'
  });
});
