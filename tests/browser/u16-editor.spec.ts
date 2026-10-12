import { expect, test, type Page, type Route } from '@playwright/test';

// U16 — Estudio: editor. Supabase simulado: ninguna petición sale a la red.
// Lo que se prueba aquí, a 390 y 1440:
// - crear, editar, archivar y revertir funcionan en los dos anchos;
// - el payload de cada mutación auditada (E06) es exactamente el de E07 para la
//   misma edición: mismas claves, mismos valores, misma versión, operación y
//   observación. Como E06 audita lo que recibe, la auditoría registra igual;
// - la página: índice (selector en móvil), barra de guardar fija, combobox.

const project = 'hgocyrzhgohetfpzbmfs';
const base = `https://${project}.supabase.co`;
const adminId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const releaseId = '11111111-1111-4111-8111-111111111111';
const createdId = '11111111-1111-4111-8111-222222222222';
const artistA = '22222222-2222-4222-8222-222222222222';
const artistB = '33333333-3333-4333-8333-333333333333';
const labelId = '44444444-4444-4444-8444-444444444444';
const typeId = '55555555-5555-4555-8555-555555555555';
const genreId = '66666666-6666-4666-8666-666666666666';
const genreTwo = '66666666-6666-4666-8666-666666666667';
const countryId = '77777777-7777-4777-8777-777777777777';

const snapshot = {
  id: releaseId,
  slug: 'killing-mariposas',
  title: 'Killing Mariposas',
  release_date: '2026-09-12',
  release_type_id: typeId,
  label_id: labelId,
  review: 'Reseña existente.',
  status: 'published',
  credit_quality: 'verified',
  catalog_version: 4,
  updated_at: '2026-09-17T14:30:00Z',
  artist_ids: [artistA],
  collaborator_ids: [artistB],
  genre_ids: [genreId],
  country_ids: [countryId],
  radar: { experimental: 4, denso: 3, sintetico: 5, bailable: 2, rapido: 4 },
  links: [
    { provider: 'Bandcamp', url: 'https://artista.bandcamp.com/album/killing', is_primary: true },
    { provider: 'Spotify', url: 'https://open.spotify.com/album/x', is_primary: false }
  ],
  cover_url: 'https://images.example.test/cover.jpg',
  source: { mode: 'imported', provider: 'Bandcamp', url: null, cover_source_url: null },
  signals: { draft: false, incomplete: false, missing_fields: [], missing_cover: false, open_report_count: 0 }
};

/** El payload que E07 enviaba: el snapshot sin identidad, versión, fecha, procedencia ni señales. */
function payloadOf(value: typeof snapshot) {
  const { id: _id, catalog_version: _v, updated_at: _u, source: _s, signals: _g, ...rest } = value;
  return rest;
}

const history = {
  release_id: releaseId,
  items: [{
    change_set_id: '88888888-8888-4888-8888-888888888888', operation: 'update', reason: 'Corrección editorial', status: 'applied',
    base_version: 3, result_version: 4, created_at: '2026-09-17T14:30:00Z', reverted_at: null, batch_id: null,
    actor: { id: adminId, username: 'jmamanche', display_name: 'JM Amanche' },
    before_state: { ...payloadOf(snapshot), title: 'Título anterior', catalog_version: 3 }, after_state: { ...payloadOf(snapshot), catalog_version: 4 }
  }]
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

type Write = { rpc: string; body: Record<string, any> };

async function mockAdmin(page: Page) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const claims = Buffer.from(JSON.stringify({ sub: adminId, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  const session = {
    access_token: `${header}.${claims}.signature`, refresh_token: 'fixture', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer',
    user: { id: adminId, aud: 'authenticated', role: 'authenticated', email: 'admin@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-09-17T00:00:00Z' }
  };
  await page.context().addCookies([{
    name: `sb-${project}-auth-token`, value: `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`,
    domain: '127.0.0.1', path: '/', httpOnly: false, secure: false, sameSite: 'Lax'
  }]);

  let current: typeof snapshot = structuredClone(snapshot);
  const writes: Write[] = [];
  await page.route(`${base}/**`, async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const rpc = path.match(/\/rpc\/(\w+)$/)?.[1];
    if (path.startsWith('/auth/v1/')) return json(route, session.user);
    if (path.endsWith('/rest/v1/profiles')) return json(route, [{ role: 'admin' }]);
    if (path.endsWith('/rest/v1/labels')) return json(route, [{ id: labelId, name: 'TraTraTrax', slug: 'tratratrax' }]);
    if (path.endsWith('/rest/v1/release_types')) return json(route, [{ id: typeId, name: 'Álbum', slug: 'album' }]);
    if (path.endsWith('/rest/v1/genres')) return json(route, [{ id: genreId, name: 'Electrónica', slug: 'electronica' }, { id: genreTwo, name: 'Techno', slug: 'techno' }]);
    if (path.endsWith('/rest/v1/countries')) return json(route, [{ id: countryId, name: 'Colombia', slug: 'colombia' }]);
    if (path.endsWith('/rest/v1/artists')) return json(route, [
      { id: artistA, name: 'Luca Durán', slug: 'luca-duran' },
      { id: artistB, name: 'Kelman Duran', slug: 'kelman-duran' }
    ]);
    if (rpc === 'admin_list_catalog_releases') return json(route, { items: [current], total: 1, page: 1, page_size: 25 });
    if (rpc === 'admin_catalog_quick_view_counts') return json(route, { draft: 0, incomplete: 0, missing_cover: 0, open_reports: 0, total: 1, statuses: null });
    if (rpc === 'admin_get_catalog_release') return json(route, current);
    if (rpc === 'admin_get_catalog_history') return json(route, history);
    if (rpc === 'admin_create_catalog_release' || rpc === 'admin_update_catalog_release' || rpc === 'admin_revert_catalog_change') {
      const body = route.request().postDataJSON();
      writes.push({ rpc, body });
      const operation = rpc === 'admin_create_catalog_release' ? 'create' : body.p_operation ?? 'revert';
      const id = rpc === 'admin_create_catalog_release' ? createdId : releaseId;
      current = {
        ...current,
        ...(body.p_payload ?? {}),
        id,
        status: operation === 'archive' ? 'archived' : operation === 'publish' ? 'published' : (body.p_payload?.status ?? current.status),
        catalog_version: operation === 'create' ? 1 : current.catalog_version + 1
      };
      return json(route, { release_id: id, catalog_version: current.catalog_version, change_set_id: `${operation}-change` });
    }
    if (url.hostname.includes('supabase')) return json(route, []);
    return route.continue();
  });
  await page.route('https://images.example.test/**', (route) => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="#27351f"/></svg>' }));
  return writes;
}

const widths = [
  { name: '390', size: { width: 390, height: 844 } },
  { name: '1440', size: { width: 1440, height: 900 } }
] as const;

async function openRelease(page: Page) {
  await page.goto(`/estudio/catalogo?lanzamiento=${releaseId}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Killing Mariposas' })).toBeVisible();
}

const feedback = (page: Page) => page.locator('.editor__feedback');

async function noHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

for (const width of widths) {
  test.describe(`U16 editor a ${width.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(width.size);
    });

    test('crear: el borrador nuevo envía el payload de E07 y la URL pasa a su id', async ({ page }) => {
      const writes = await mockAdmin(page);
      await page.goto('/estudio/catalogo?nuevo=1');
      await expect(page.getByText('Nuevo lanzamiento', { exact: true })).toBeVisible();
      await expect(page.getByText('El historial aparecerá después de crear el borrador.')).toBeVisible();
      await page.getByLabel('Título').fill('Pulso I');
      const group = page.getByRole('group', { name: 'Artistas principales' });
      await group.getByRole('combobox').fill('Luca');
      await page.getByRole('option', { name: 'Luca Durán' }).click();
      await expect(group.locator('.credit__name')).toHaveText(['Luca Durán']);
      await page.getByPlaceholder('¿Qué cambió?').fill('Alta editorial');
      await page.getByRole('button', { name: 'Crear borrador' }).click();
      await expect(feedback(page)).toHaveText('Borrador creado.');
      await expect(page).toHaveURL(new RegExp(`\\?lanzamiento=${createdId}$`));

      expect(writes).toHaveLength(1);
      expect(writes[0].rpc).toBe('admin_create_catalog_release');
      expect(writes[0].body).toEqual({
        p_reason: 'Alta editorial',
        p_payload: {
          slug: 'pulso-i', title: 'Pulso I', release_date: null, release_type_id: null, label_id: null, review: '',
          status: 'draft', credit_quality: 'proposed', artist_ids: [artistA], collaborator_ids: [], genre_ids: [], country_ids: [],
          radar: { experimental: 0, denso: 0, sintetico: 0, bailable: 0, rapido: 0 }, links: [], cover_url: null
        }
      });
      // Tras crear, la observación se vacía y el editor muestra el lanzamiento guardado.
      await expect(page.getByPlaceholder('¿Qué cambió?')).toHaveValue('');
      await expect(page.locator('.editor__version')).toHaveText('v1');
    });

    test('editar: guardar sin cambios y con cambios envía exactamente lo editado', async ({ page }) => {
      const writes = await mockAdmin(page);
      await openRelease(page);
      await expect(page.locator('.editor__dirty')).toHaveText('Sin cambios.');

      // Sin cambios: el payload es el snapshot tal como llegó (E07 hacía lo mismo).
      await page.getByPlaceholder('¿Qué cambió?').fill('Revisión sin cambios');
      await page.getByRole('button', { name: 'Guardar cambios' }).click();
      await expect(feedback(page)).toHaveText('Cambios guardados.');
      expect(writes[0]).toEqual({
        rpc: 'admin_update_catalog_release',
        body: { p_release_id: releaseId, p_expected_version: 4, p_payload: payloadOf(snapshot), p_reason: 'Revisión sin cambios', p_operation: 'update' }
      });

      // Con cambios en cada sección: título, créditos, clasificación y medios.
      await page.getByLabel('Título').fill('Killing Mariposas (remaster)');
      await expect(page.locator('.editor__dirty')).toHaveText('Cambios sin guardar.');
      await page.getByRole('group', { name: 'Colaboradores' }).getByRole('button', { name: 'Mover a principales' }).click();
      await expect(page.getByRole('group', { name: 'Artistas principales' }).locator('.credit__name')).toHaveText(['Luca Durán', 'Kelman Duran']);
      await page.getByRole('combobox', { name: 'Géneros' }).fill('tech');
      await page.getByRole('option', { name: 'Techno' }).click();
      await page.keyboard.press('Escape');
      await page.getByLabel('Experimental').fill('1');
      await page.getByLabel('Link de compra o escucha').fill('https://soundcloud.com/luca/killing');
      await page.getByPlaceholder('¿Qué cambió?').fill('Corrección completa');
      await page.getByRole('button', { name: 'Guardar cambios' }).click();
      await expect(feedback(page)).toHaveText('Cambios guardados.');
      expect(writes[1].body).toEqual({
        p_release_id: releaseId,
        p_expected_version: 5,
        p_reason: 'Corrección completa',
        p_operation: 'update',
        p_payload: {
          ...payloadOf(snapshot),
          title: 'Killing Mariposas (remaster)',
          artist_ids: [artistA, artistB],
          collaborator_ids: [],
          genre_ids: [genreId, genreTwo],
          radar: { ...snapshot.radar, experimental: 1 },
          links: [{ provider: 'SoundCloud', url: 'https://soundcloud.com/luca/killing', is_primary: true }, snapshot.links[1]]
        }
      });
      await noHorizontalOverflow(page);
    });

    test('archivar: desde "Más acciones", con observación y la operación de E06', async ({ page }) => {
      const writes = await mockAdmin(page);
      await openRelease(page);
      // Sin observación no se abre la confirmación.
      await page.getByRole('button', { name: 'Más acciones' }).click();
      await page.getByRole('menuitem', { name: 'Archivar lanzamiento' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(feedback(page)).toHaveText('Añade una observación del cambio. El historial auditado la exige.');
      await expect(page.getByPlaceholder('¿Qué cambió?')).toBeFocused();

      await page.getByPlaceholder('¿Qué cambió?').fill('Retiro editorial');
      await page.getByRole('button', { name: 'Más acciones' }).click();
      await page.getByRole('menuitem', { name: 'Archivar lanzamiento' }).click();
      await page.getByRole('dialog', { name: 'Archivar lanzamiento' }).getByRole('button', { name: 'Archivar', exact: true }).click();
      await expect(feedback(page)).toHaveText('Lanzamiento archivado.');
      await expect(page.locator('.editor__head')).toContainText('Archivado');
      expect(writes).toEqual([{
        rpc: 'admin_update_catalog_release',
        body: { p_release_id: releaseId, p_expected_version: 4, p_payload: payloadOf(snapshot), p_reason: 'Retiro editorial', p_operation: 'archive' }
      }]);
    });

    test('revertir: desde el historial, con la versión exacta del change set', async ({ page }) => {
      const writes = await mockAdmin(page);
      await openRelease(page);
      if (width.name === '390') await page.getByLabel('Ir a la sección').selectOption('historial');
      else await page.getByRole('navigation', { name: 'Secciones del lanzamiento' }).getByRole('link', { name: /Historial/ }).click();
      await expect(page.getByRole('heading', { level: 2, name: 'Historial' })).toBeInViewport();
      await page.getByRole('button', { name: 'Revertir este cambio' }).click();
      const dialog = page.getByRole('dialog', { name: 'Revertir cambio' });
      // Sin observación, el diálogo lo pide y no envía nada.
      await dialog.getByRole('button', { name: 'Revertir cambio', exact: true }).click();
      await expect(dialog.getByRole('alert')).toHaveText('Añade una observación para explicar la reversión.');
      await dialog.getByLabel('Observación de la reversión').fill('Volver al título anterior');
      await dialog.getByRole('button', { name: 'Revertir cambio', exact: true }).click();
      await expect(feedback(page)).toHaveText('Cambio revertido mediante una nueva entrada auditada.');
      expect(writes).toEqual([{
        rpc: 'admin_revert_catalog_change',
        body: { p_change_set_id: history.items[0].change_set_id, p_expected_version: 4, p_reason: 'Volver al título anterior' }
      }]);
    });

    test('la barra de guardar queda fija abajo y el índice lleva a cada sección', async ({ page }) => {
      await mockAdmin(page);
      await openRelease(page);
      const bar = page.getByRole('region', { name: 'Guardar' });
      const viewport = page.viewportSize()!;
      if (width.name === '390') await page.getByLabel('Ir a la sección').selectOption('clasificacion');
      else await page.getByRole('navigation', { name: 'Secciones del lanzamiento' }).getByRole('link', { name: 'Clasificación' }).click();
      await expect(page.getByRole('heading', { level: 2, name: 'Clasificación' })).toBeInViewport();
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
      // La barra está dentro del viewport, pegada abajo, aunque la sección quede arriba.
      await expect.poll(async () => {
        const box = await bar.boundingBox();
        return box ? Math.round(box.y + box.height) : -1;
      }).toBeLessThanOrEqual(viewport.height);
      await expect(bar.getByRole('button', { name: 'Guardar cambios' })).toBeInViewport();
      if (width.name === '390') {
        // El selector también queda fijo arriba y marca la sección.
        await expect(page.getByLabel('Ir a la sección')).toBeInViewport();
        await expect(page.getByLabel('Ir a la sección')).toHaveValue('clasificacion');
        await expect(page.getByRole('navigation', { name: 'Secciones del lanzamiento' })).toBeHidden();
      } else {
        await expect(page.getByRole('navigation', { name: 'Secciones del lanzamiento' }).getByRole('link', { name: 'Clasificación' })).toHaveAttribute('aria-current', 'location');
        await expect(page.getByLabel('Ir a la sección')).toBeHidden();
      }
      // Sin vista previa del sitio y sin la nube completa de géneros.
      await expect(page.getByText(/vista previa/i)).toHaveCount(0);
      await expect(page.getByRole('checkbox', { name: 'Techno' })).toHaveCount(0);
      await noHorizontalOverflow(page);
    });
  });
}

test('arrastrar un colaborador delante del principal lo convierte en el primero (1440)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const writes = await mockAdmin(page);
  await openRelease(page);
  const principal = page.getByRole('group', { name: 'Artistas principales' });
  const guests = page.getByRole('group', { name: 'Colaboradores' });
  await guests.locator('.credit').filter({ hasText: 'Kelman Duran' }).dragTo(principal.locator('.credit').filter({ hasText: 'Luca Durán' }));
  await expect(principal.locator('.credit__name')).toHaveText(['Kelman Duran', 'Luca Durán']);
  await expect(guests.locator('.credit__name')).toHaveCount(0);
  await page.getByPlaceholder('¿Qué cambió?').fill('Orden de créditos');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(feedback(page)).toHaveText('Cambios guardados.');
  expect(writes[0].body.p_payload).toEqual({ ...payloadOf(snapshot), artist_ids: [artistB, artistA], collaborator_ids: [] });
});

test('tablet (834): índice lateral, sin desborde y barra de guardar a la vista', async ({ page }) => {
  await page.setViewportSize({ width: 834, height: 1112 });
  await mockAdmin(page);
  await openRelease(page);
  await expect(page.getByRole('navigation', { name: 'Secciones del lanzamiento' })).toBeVisible();
  await expect(page.getByLabel('Ir a la sección')).toBeHidden();
  await expect(page.getByRole('region', { name: 'Guardar' }).getByRole('button', { name: 'Guardar cambios' })).toBeInViewport();
  await noHorizontalOverflow(page);
});
