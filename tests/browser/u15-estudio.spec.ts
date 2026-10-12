import { expect, test, type Page, type Route } from '@playwright/test';

// U15 — Estudio: estructura y catálogo. Supabase simulado: ninguna petición
// sale a la red. Los permisos efectivos están en la base (E06, E09, E18, D2);
// aquí se prueba que la interfaz no los amplía ni los reduce.

const project = 'hgocyrzhgohetfpzbmfs';
const base = `https://${project}.supabase.co`;
type Role = 'anonimo' | 'comunidad' | 'colaborador' | 'admin';
const userIds: Record<Exclude<Role, 'anonimo'>, string> = {
  comunidad: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  colaborador: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  admin: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'
};
const typeId = '55555555-5555-4555-8555-555555555555';
const labelId = '44444444-4444-4444-8444-444444444444';
const artistId = '22222222-2222-4222-8222-222222222222';

const idFor = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
type Missing = 'release_date' | 'release_type' | 'label' | 'primary_artist' | 'genre' | 'country' | 'cover' | 'primary_link';

function release(n: number, over: { status?: string; missing?: Missing[]; reports?: number } = {}) {
  const missing = over.missing ?? [];
  return {
    id: idFor(n), slug: `lanzamiento-${n}`, title: `Lanzamiento ${n}`, release_date: '2026-09-01',
    release_type_id: typeId, label_id: labelId, review: '', status: over.status ?? 'draft', credit_quality: 'proposed',
    catalog_version: 3, updated_at: '2026-09-17T14:30:00Z', artist_ids: [artistId], collaborator_ids: [],
    genre_ids: [], country_ids: [], radar: { experimental: 1, denso: 1, sintetico: 1, bailable: 1, rapido: 1 },
    links: [{ provider: 'Bandcamp', url: `https://bandcamp.test/${n}`, is_primary: true }],
    cover_url: missing.includes('cover') ? null : `https://images.example.test/${n}.jpg`,
    signals: { draft: (over.status ?? 'draft') === 'draft', incomplete: missing.length > 0, missing_fields: missing, missing_cover: missing.includes('cover'), open_report_count: over.reports ?? 0 }
  };
}

type Snapshot = ReturnType<typeof release>;
type Options = {
  /** Todas las filas; el mock pagina de 25 en 25. */
  items?: Snapshot[];
  batch?: (body: { p_operation: string; p_items: { release_id: string; expected_version: number }[]; p_reason: string }) => unknown;
  contributions?: Record<string, unknown>[];
  reports?: Record<string, unknown>[];
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

const defaultItems = () => [
  release(1, { status: 'published' }),
  release(2),
  release(3, { missing: ['cover'] }),
  release(4, { status: 'published', reports: 1 })
];

const contributionFor = (over: Record<string, unknown> = {}) => ({
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01', author_id: userIds.comunidad, status: 'pending',
  source_url: 'https://bandcamp.test/propuesta', source_provider: 'bandcamp',
  payload: { version: 2, title: 'Propuesta comunitaria', primary_artists: ['Artista'], collaborators: [], release_type: 'album', release_date: '2026-09-01', genres: ['Techno'], countries: ['Colombia'], label: '', team_note: '' },
  payload_version: 2, payload_quality: 'confirmed', detected_metadata: { title: 'Propuesta comunitaria' }, queue_kind: 'community',
  submitted_at: '2026-09-20T00:00:00Z', reviewer_note: null, reviewed_at: null, release_id: null,
  created_at: '2026-09-20T00:00:00Z', updated_at: '2026-09-20T00:00:00Z', ...over
});

/** Simula Supabase para un rol y registra las RPC y tablas que pide la página. */
async function mockStudio(page: Page, role: Role, options: Options = {}) {
  const calls: { path: string; body: any }[] = [];
  const items = options.items ?? defaultItems();
  const contributions = options.contributions ?? [contributionFor()];
  const reports = options.reports ?? [
    { id: 'r1', author_id: userIds.comunidad, category: 'catalog_error', description: 'El país está mal.', page_url: `/lanzamiento/lanzamiento-4`, release_id: idFor(4), technical_context: {}, screenshot_path: null, status: 'new', assigned_to: null, created_at: '2026-09-29T12:00:00Z', updated_at: '2026-09-29T12:00:00Z' },
    { id: 'r2', author_id: userIds.comunidad, category: 'technical_bug', description: 'El reproductor no carga.', page_url: '/', release_id: null, technical_context: {}, screenshot_path: null, status: 'triaged', assigned_to: null, created_at: '2026-09-28T12:00:00Z', updated_at: '2026-09-28T12:00:00Z' }
  ];

  if (role !== 'anonimo') {
    const id = userIds[role];
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: id, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
    const session = {
      access_token: `${header}.${payload}.signature`, refresh_token: 'fixture', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer',
      user: { id, aud: 'authenticated', role: 'authenticated', email: `${role}@example.test`, app_metadata: {}, user_metadata: { username: role }, created_at: '2026-09-17T00:00:00Z' }
    };
    await page.context().addCookies([{
      name: `sb-${project}-auth-token`, value: `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`,
      domain: '127.0.0.1', path: '/', httpOnly: false, secure: false, sameSite: 'Lax'
    }]);
  }

  await page.route(`${base}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    let body: any = null;
    try { body = request.postDataJSON(); } catch { /* GET */ }
    calls.push({ path: `${path}${url.search}`, body });
    if (path.startsWith('/auth/v1/')) return role === 'anonimo' ? json(route, {}, 401) : json(route, { id: userIds[role] });
    if (path === '/rest/v1/profiles') return json(route, role === 'anonimo' ? [] : [{ role }]);
    if (path === '/rest/v1/labels') return json(route, [{ id: labelId, name: 'Sello', slug: 'sello' }]);
    if (path === '/rest/v1/release_types') return json(route, [{ id: typeId, name: 'Álbum', slug: 'album' }]);
    if (path === '/rest/v1/genres' || path === '/rest/v1/countries') return json(route, []);
    if (path === '/rest/v1/artists') return json(route, [{ id: artistId, name: 'Artista de prueba', slug: 'artista' }]);
    if (path === '/rest/v1/contributions') {
      const releaseFilter = url.searchParams.get('release_id');
      if (releaseFilter) return json(route, contributions.filter((item) => `eq.${item.release_id}` === releaseFilter));
      return json(route, role === 'admin' || role === 'colaborador' ? contributions.filter((item) => item.status === 'pending' || item.status === 'ready_for_admin') : []);
    }
    if (path === '/rest/v1/problem_reports') return json(route, role === 'admin' ? reports : []);
    if (path.startsWith('/rest/v1/rpc/')) {
      const fn = path.slice('/rest/v1/rpc/'.length);
      if (fn.startsWith('admin_') && role !== 'admin') return json(route, { code: '42501', message: 'permission denied' }, 403);
      if (fn === 'admin_list_catalog_releases') {
        const view = body?.p_quick_view as string | null;
        const filtered = items.filter((item) => !view
          || (view === 'draft' && item.signals.draft)
          || (view === 'incomplete' && item.signals.incomplete)
          || (view === 'missing_cover' && item.signals.missing_cover)
          || (view === 'open_reports' && item.signals.open_report_count > 0));
        const pageNumber = Number(body?.p_page ?? 1);
        return json(route, { items: filtered.slice((pageNumber - 1) * 25, pageNumber * 25), total: filtered.length, page: pageNumber, page_size: 25, quick_view: view });
      }
      if (fn === 'admin_catalog_quick_view_counts') return json(route, { total: items.length, draft: 2, incomplete: 1, missing_cover: 1, open_reports: 1, statuses: null });
      if (fn === 'admin_get_catalog_release') return json(route, items.find((item) => item.id === body.p_release_id) ?? release(99));
      if (fn === 'admin_get_catalog_history') return json(route, { release_id: body.p_release_id, items: [] });
      if (fn === 'admin_batch_update_catalog_releases') {
        const reply = options.batch?.(body) ?? {
          applied: true, operation: body.p_operation, batch_id: 'batch-1', requested: body.p_items.length,
          applied_count: body.p_items.length, unchanged_count: 0, rolled_back_count: 0, rejected_count: 0,
          items: body.p_items.map((item: any, index: number) => ({ ...item, result: 'applied', catalog_version: item.expected_version + 1, change_set_id: `cs-${index}` }))
        };
        return json(route, reply);
      }
      if (fn === 'review_contribution') return json(route, contributionFor({ status: body.p_action, release_id: body.p_action === 'approved' ? idFor(7) : null }));
      return json(route, {});
    }
    return json(route, []);
  });
  await page.route('https://images.example.test/**', (route) => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#27351f"/></svg>' }));
  return calls;
}

const adminCalls = (calls: { path: string }[]) => calls.filter((call) => call.path.includes('/rpc/admin_'));
const listCalls = (calls: { path: string; body: any }[]) => calls.filter((call) => call.path.endsWith('/rpc/admin_list_catalog_releases'));
const studioNav = (page: Page) => page.getByRole('navigation', { name: 'Estudio' });
const pickRow = (page: Page, title: string) => page.getByRole('checkbox', { name: `Seleccionar ${title}`, exact: true }).check();
const noHorizontalOverflow = (page: Page) =>
  expect.poll(() => page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth <= window.innerWidth) return 'ok';
    // Qué se sale, para el informe del fallo.
    return [...document.querySelectorAll('body *')].filter((el) => el.getBoundingClientRect().right > width + 1).slice(0, 4)
      .map((el) => `${el.tagName}.${[...el.classList].join('.')} ${Math.round(el.getBoundingClientRect().right)}`).join(' | ');
  })).toBe('ok');

test.describe('U15 rutas', () => {
  test('las rutas anteriores llevan a su sección conservando la query', async ({ page }) => {
    await mockStudio(page, 'admin');
    await page.goto('/admin/catalogo?vista=incompletos');
    await expect(page).toHaveURL(/\/estudio\/catalogo\?vista=incompletos$/);
    await expect(page.getByRole('heading', { name: 'Incompletos', level: 2 })).toBeVisible();
    await page.goto('/editorial?origen=correo');
    await expect(page).toHaveURL(/\/estudio\/propuestas\?origen=correo$/);
    await expect(page.getByRole('heading', { name: 'Propuestas', level: 1 })).toBeVisible();
    await page.goto('/estudio');
    await expect(page).toHaveURL(/\/estudio\/catalogo$/);
  });

  test('/estudio abre Propuestas para colaborador', async ({ page }) => {
    await mockStudio(page, 'colaborador');
    await page.goto('/estudio');
    await expect(page).toHaveURL(/\/estudio\/propuestas$/);
  });
});

test.describe('U15 permisos por rol', () => {
  test('sin sesión: pide entrar y vuelve a la misma sección', async ({ page }) => {
    const calls = await mockStudio(page, 'anonimo');
    await page.goto('/estudio/reportes?lanzamiento=x');
    await expect(page.getByRole('heading', { name: 'Inicia sesión', level: 1 })).toBeVisible();
    await expect(page.getByRole('main').getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/auth/login?redirect=%2Festudio%2Freportes%3Flanzamiento%3Dx');
    await expect(studioNav(page)).toHaveCount(0);
    expect(adminCalls(calls)).toEqual([]);
  });

  test('comunidad: sin acceso a ninguna sección ni a sus datos', async ({ page }) => {
    const calls = await mockStudio(page, 'comunidad');
    for (const path of ['/estudio/catalogo', '/estudio/propuestas', '/estudio/reportes']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: 'Sin acceso al Estudio', level: 1 })).toBeVisible();
      await expect(studioNav(page)).toHaveCount(0);
    }
    expect(adminCalls(calls)).toEqual([]);
    expect(calls.filter((call) => /contributions|problem_reports/.test(call.path))).toEqual([]);
  });

  test('colaborador: solo Propuestas, como en /editorial', async ({ page }) => {
    const calls = await mockStudio(page, 'colaborador');
    await page.goto('/estudio/propuestas');
    await expect(studioNav(page).getByRole('link')).toHaveText([/^\s*Propuestas\s*1$/]);
    await expect(page.getByRole('heading', { name: 'Cola comunitaria' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Marcar lista para administración' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Revisar publicación|Rechazar|Solicitar cambios/ })).toHaveCount(0);
    for (const path of ['/estudio/catalogo', '/estudio/reportes', '/estudio/catalogo?lanzamiento=x']) {
      await page.goto(path);
      await expect(page.getByText('Esta sección es solo para administración')).toBeVisible();
      await expect(page.getByRole('main').getByRole('table')).toHaveCount(0);
    }
    expect(adminCalls(calls)).toEqual([]);
    expect(calls.filter((call) => call.path.includes('problem_reports'))).toEqual([]);
  });

  test('admin: las tres secciones, vistas rápidas con conteo y ancho completo', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockStudio(page, 'admin');
    await page.goto('/estudio/catalogo');
    const nav = studioNav(page);
    await expect(nav.getByRole('link', { name: /^Catálogo/ })).toHaveAttribute('aria-current', 'page');
    await expect(nav.getByRole('list', { name: 'Catálogo' }).getByRole('link')).toHaveText([/Borradores\s*2/, /Incompletos\s*1/, /Sin portada\s*1/, /Con reportes\s*1/]);
    await expect(nav.getByRole('link', { name: /^Propuestas/ })).toHaveText(/Propuestas\s*1/);
    await expect(nav.getByRole('link', { name: /^Reportes/ })).toHaveText(/Reportes\s*2/);
    await expect(page.locator('main > :first-child')).toHaveClass(/l-container--full/);
    await expect(page.locator('footer.site-footer, footer.footer')).toHaveCount(0);
  });
});

test.describe('U15 catálogo', () => {
  test('vistas rápidas por la barra lateral y, en móvil, por un selector', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const calls = await mockStudio(page, 'admin');
    await page.goto('/estudio/catalogo');
    await expect(page.getByText('Lanzamiento 1', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Vista')).toBeHidden();
    await studioNav(page).getByRole('link', { name: /^Incompletos/ }).click();
    await expect(page).toHaveURL(/\?vista=incompletos$/);
    await expect(studioNav(page).getByRole('link', { name: /^Incompletos/ })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('heading', { name: 'Incompletos', level: 2 })).toBeVisible();
    await expect.poll(() => listCalls(calls).at(-1)?.body.p_quick_view).toBe('incomplete');
    await expect(page.getByRole('cell', { name: /Falta: Portada/ })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByLabel('Vista')).toBeVisible();
    await page.getByLabel('Vista').selectOption('con-reportes');
    await expect(page).toHaveURL(/\?vista=con-reportes$/);
    await expect.poll(() => listCalls(calls).at(-1)?.body.p_quick_view).toBe('open_reports');
    await expect(page.getByRole('link', { name: '1 reporte' })).toBeVisible();
    // Móvil: la lista sigue sin selección ni lote (el editor sí edita desde U16).
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    await noHorizontalOverflow(page);
  });

  test('lote con éxito: confirma, envía versiones y observación, e informa por elemento', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const calls = await mockStudio(page, 'admin');
    await page.goto('/estudio/catalogo');
    await pickRow(page, 'Lanzamiento 1');
    await pickRow(page, 'Lanzamiento 2');
    const bar = page.getByRole('region', { name: 'Selección' });
    await expect(bar).toContainText('2 seleccionados');
    await bar.getByRole('button', { name: 'Publicar' }).click();

    const dialog = page.getByRole('dialog', { name: 'Publicar 2 lanzamientos' });
    await expect(dialog.getByRole('list', { name: 'Lanzamientos del lote' }).getByRole('listitem')).toHaveCount(2);
    const confirm = dialog.getByRole('button', { name: 'Publicar 2' });
    await confirm.click();
    await expect(dialog.getByRole('alert')).toContainText('Añade una observación');
    expect(calls.filter((call) => call.path.includes('admin_batch_update'))).toEqual([]);

    const listsBefore = listCalls(calls).length;
    const countsBefore = calls.filter((call) => call.path.includes('quick_view_counts')).length;
    await dialog.getByLabel(/Observación del cambio/).fill('Publicación de temporada');
    await confirm.click();
    const resultDialog = page.getByRole('dialog', { name: 'Lote aplicado' });
    await expect(resultDialog.getByRole('status')).toContainText('Se publicaron 2 lanzamientos.');
    await expect(resultDialog.getByRole('list', { name: 'Resultado por lanzamiento' }).getByRole('listitem')).toHaveText([/Lanzamiento 1\s*Publicado/, /Lanzamiento 2\s*Publicado/]);
    const batch = calls.find((call) => call.path.includes('admin_batch_update'))!;
    expect(batch.body).toEqual({
      p_operation: 'publish',
      p_items: [{ release_id: idFor(1), expected_version: 3 }, { release_id: idFor(2), expected_version: 3 }],
      p_reason: 'Publicación de temporada'
    });
    expect(listCalls(calls).length).toBeGreaterThan(listsBefore);
    await expect.poll(() => calls.filter((call) => call.path.includes('quick_view_counts')).length).toBeGreaterThan(countsBefore);

    await resultDialog.getByRole('button', { name: 'Cerrar', exact: true }).last().click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Selección' })).toHaveCount(0);
    await expect(page.getByRole('main').getByRole('status').first()).toContainText('Se publicaron 2 lanzamientos.');
  });

  test('lote con error: no cambia nada, dice por qué en cada uno y conserva la selección', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockStudio(page, 'admin', {
      batch: (body) => ({
        applied: false, operation: body.p_operation, batch_id: null, requested: 2,
        applied_count: 0, unchanged_count: 0, rolled_back_count: 1, rejected_count: 1,
        items: [
          { ...body.p_items[0], result: 'rolled_back' },
          { ...body.p_items[1], result: 'rejected', error: { code: '40001', message: 'stale write' } }
        ]
      })
    });
    await page.goto('/estudio/catalogo');
    await pickRow(page, 'Lanzamiento 1');
    await pickRow(page, 'Lanzamiento 4');
    await page.getByRole('region', { name: 'Selección' }).getByRole('button', { name: 'Archivar' }).click();
    const dialog = page.getByRole('dialog', { name: 'Archivar 2 lanzamientos' });
    await dialog.getByLabel(/Observación del cambio/).fill('Duplicados');
    await dialog.getByRole('button', { name: 'Archivar 2' }).click();

    const result = page.getByRole('dialog', { name: 'No se aplicó el lote' });
    await expect(result.getByRole('alert')).toContainText('No cambió nada: 1 lanzamiento no se pudo archivar y el lote se deshizo completo.');
    const rows = result.getByRole('list', { name: 'Resultado por lanzamiento' }).getByRole('listitem');
    await expect(rows.nth(0)).toContainText('Sin cambios: otro elemento del lote falló');
    await expect(rows.nth(1)).toContainText('Cambió desde que cargaste la lista');
    await expect(rows.nth(1).getByRole('link', { name: 'Abrir en el editor' })).toHaveAttribute('href', `/estudio/catalogo?lanzamiento=${idFor(4)}`);
    await expect(result).not.toContainText('40001');
    // Detrás del diálogo la selección sigue intacta (el diálogo deja el resto inerte).
    await expect(page.locator('.catalogo__batch-count')).toContainText('2 seleccionados');

    await result.getByRole('button', { name: 'Quitar los rechazados' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Selección' })).toContainText('1 seleccionado');
  });

  test('el lote no deja publicar incompletos ni pasar de 50', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const many = Array.from({ length: 60 }, (_, index) => release(index + 1, index === 2 ? { missing: ['cover', 'label'] } : {}));
    const calls = await mockStudio(page, 'admin', { items: many });
    await page.goto('/estudio/catalogo');
    await pickRow(page, 'Lanzamiento 3');
    await page.getByRole('region', { name: 'Selección' }).getByRole('button', { name: 'Publicar' }).click();
    const dialog = page.getByRole('dialog', { name: 'Publicar 1 lanzamiento' });
    await expect(dialog.getByRole('alert')).toContainText('1 lanzamiento no se puede publicar');
    await expect(dialog.getByText('Falta: Portada, Sello')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Publicar 1' })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Quitar de la selección' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('region', { name: 'Selección' })).toHaveCount(0);

    // Tres páginas: 25 + 25 caben; la 51 bloquea el lote y lo dice.
    const selectPage = () => page.getByRole('checkbox', { name: /^Seleccionar los \d+ de esta página$/ }).check();
    await selectPage();
    await page.getByRole('button', { name: 'Página siguiente' }).click();
    await expect(page.getByText('Lanzamiento 26', { exact: true })).toBeVisible();
    await selectPage();
    const bar = page.getByRole('region', { name: 'Selección' });
    await expect(bar).toContainText('50 seleccionados');
    await expect(bar.getByRole('button', { name: 'Publicar' })).toBeEnabled();
    await page.getByRole('button', { name: 'Página siguiente' }).click();
    await pickRow(page, 'Lanzamiento 51');
    await expect(bar).toContainText('51 seleccionados');
    await expect(bar).toContainText('Un lote admite hasta 50. Quita 1 para continuar.');
    await expect(bar.getByRole('button', { name: 'Publicar' })).toBeDisabled();
    await expect(bar.getByRole('button', { name: 'Archivar' })).toBeDisabled();
    expect(calls.filter((call) => call.path.includes('admin_batch_update'))).toEqual([]);
  });

  test('enlaces cruzados: reporte → lanzamiento → sus reportes y propuestas', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const calls = await mockStudio(page, 'admin', {
      contributions: [contributionFor(), contributionFor({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02', status: 'approved', release_id: idFor(4), payload: { ...contributionFor().payload, title: 'Propuesta aceptada' } })]
    });
    await page.goto('/estudio/catalogo');
    await page.getByRole('link', { name: '1 reporte' }).click();
    await expect(page).toHaveURL(new RegExp(`/estudio/reportes\\?lanzamiento=${idFor(4)}$`));
    // U17: bandeja; en ancho, el único reporte del lanzamiento se abre en el detalle.
    await expect(page.getByRole('article')).toHaveCount(1);
    await expect(page.getByRole('article')).toContainText('El país está mal.');

    await page.getByRole('article').getByRole('link', { name: 'Abrir el lanzamiento en el Catálogo' }).click();
    await expect(page).toHaveURL(new RegExp(`/estudio/catalogo\\?lanzamiento=${idFor(4)}$`));
    await expect(page.locator('.editor__head')).toContainText('Lanzamiento 4');
    // U16: lo relacionado está en "Más acciones"; los reportes abiertos, también en la cabecera.
    await expect(page.locator('.editor__head').getByRole('link', { name: '1 reporte' })).toHaveAttribute('href', `/estudio/reportes?lanzamiento=${idFor(4)}`);
    await page.getByRole('button', { name: 'Más acciones' }).click();
    const related = page.getByRole('menu');
    await expect(related.getByRole('menuitem', { name: 'Reportes abiertos (1)' })).toHaveAttribute('href', `/estudio/reportes?lanzamiento=${idFor(4)}`);
    await expect(related.getByRole('menuitem', { name: 'Ver ficha pública' })).toHaveAttribute('href', '/lanzamiento/lanzamiento-4');
    await related.getByRole('menuitem', { name: 'Propuestas' }).click();
    await expect(page).toHaveURL(new RegExp(`/estudio/propuestas\\?lanzamiento=${idFor(4)}$`));
    await expect(page.getByRole('article')).toHaveCount(1);
    await expect(page.getByRole('article')).toContainText('Propuesta aceptada');
    await expect(page.getByRole('article').getByRole('button')).toHaveCount(0);
    expect(calls.some((call) => call.path.includes(`release_id=eq.${idFor(4)}`))).toBe(true);

    // Al aprobar, el aviso lleva al lanzamiento creado sin escribir URLs.
    await page.getByRole('link', { name: 'Ver todas' }).click();
    const card = page.getByRole('article', { name: 'Propuesta comunitaria' });
    await card.getByRole('button', { name: 'Revisar publicación' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Aprobar y publicar' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Aceptado' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Abrir el lanzamiento en el Catálogo' })).toHaveAttribute('href', `/estudio/catalogo?lanzamiento=${idFor(7)}`);
  });

  test('el editor se abre por URL y "Volver" regresa a la vista de la lista', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockStudio(page, 'admin');
    await page.goto('/estudio/catalogo?vista=borradores');
    await page.getByRole('link', { name: 'Editar Lanzamiento 2' }).click();
    await expect(page).toHaveURL(/\?vista=borradores&lanzamiento=/);
    await expect(page.locator('.editor__head')).toContainText('Lanzamiento 2');
    await page.getByRole('button', { name: 'Volver al catálogo' }).click();
    await expect(page).toHaveURL(/\/estudio\/catalogo\?vista=borradores$/);
    await expect(page.getByRole('heading', { name: 'Borradores', level: 2 })).toBeVisible();
  });
});

test.describe('U15 matriz de anchos', () => {
  for (const width of [390, 834, 1440]) {
    test(`admin sin desborde a ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await mockStudio(page, 'admin');
      for (const [path, ready] of [['/estudio/catalogo', 'Lanzamiento 1'], ['/estudio/propuestas', 'Cola comunitaria'], ['/estudio/reportes', 'El país está mal.']]) {
        await page.goto(path);
        await expect(page.getByText(ready, { exact: true }).first()).toBeVisible();
        await noHorizontalOverflow(page);
      }
    });
  }
});
