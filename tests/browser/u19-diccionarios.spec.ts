import { expect, test, type Page, type Route } from '@playwright/test';

// U19 (G4) — Diccionarios del Estudio. Supabase simulado: ninguna petición sale a la red. Los
// permisos y las comprobaciones viven en la base (tests/sql/u19-g4-verify.sql); aquí se prueba que
// la pantalla manda lo que debe y dice lo que el servidor responde.

const project = 'hgocyrzhgohetfpzbmfs';
const base = `https://${project}.supabase.co`;
type Role = 'colaborador' | 'admin';
const userIds: Record<Role, string> = {
  colaborador: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  admin: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'
};

type Item = { id: string; name: string; slug: string; status: string | null; release_count: number; published_count: number; aliases: string[]; slug_aliases: string[]; public_slug: string | null };
const item = (id: string, name: string, over: Partial<Item> = {}): Item => ({
  id, name, slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}--1`, status: null, release_count: 2, published_count: 2,
  aliases: [], slug_aliases: [], public_slug: null, ...over
});

const DATA: Record<string, Item[]> = {
  genre: [
    item('g1', 'Techno', { status: 'selectable', release_count: 40, published_count: 38 }),
    item('g2', 'Trip Hop', { status: 'legacy', release_count: 1, published_count: 0 }),
    item('g3', 'Triphop', { status: 'legacy', release_count: 1, published_count: 0 })
  ],
  country: [
    item('c1', 'Colombia', { status: 'selectable', release_count: 300, published_count: 300 }),
    item('c2', 'Estados Unidos', { status: 'legacy', aliases: ['EE.UU', 'EEUU', 'USA'] }),
    item('c3', 'WORLD', { status: 'retired', release_count: 101, published_count: 101 })
  ],
  label: [
    item('l1', 'Incorrecto', { public_slug: 'incorrecto', release_count: 12, published_count: 12, slug_aliases: ['in-correcto'], aliases: ['In-Correcto'] }),
    item('l2', 'NVR', { public_slug: 'nvr', release_count: 0, published_count: 0 }),
    item('l3', 'Sello Vacío', { public_slug: 'sello-vacio', release_count: 0, published_count: 0 })
  ],
  artist: [
    item('a1', 'Anaquia', { slug: 'anaquia--7aeffac6', public_slug: 'anaquia--7aeffac6', release_count: 10, published_count: 10 }),
    item('a2', 'Anaquia)', { slug: 'anaquia--da160ccf', public_slug: 'anaquia--da160ccf', release_count: 1, published_count: 1 })
  ]
};

type Call = { fn: string; body: any };
type Reply = (fn: string, body: any) => { status?: number; body: unknown } | null | undefined;

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

function listReply(body: any) {
  const all = DATA[body.p_kind] ?? [];
  const filter = body.p_filter ?? 'all';
  const query = String(body.p_query ?? '').toLowerCase();
  const items = all.filter((entry) => (filter === 'all' || (filter === 'orphans' ? entry.release_count === 0 : entry.status === filter))
    && (!query || entry.name.toLowerCase().includes(query) || entry.aliases.some((alias) => alias.toLowerCase().includes(query))));
  const counts = { all: all.length, orphans: all.filter((e) => !e.release_count).length, selectable: all.filter((e) => e.status === 'selectable').length, legacy: all.filter((e) => e.status === 'legacy').length, retired: all.filter((e) => e.status === 'retired').length };
  return { kind: body.p_kind, filter, page: body.p_page ?? 1, page_size: body.p_page_size ?? 50, total: items.length, counts, items };
}

/** Simula Supabase para un rol y registra las RPC que pide la página. */
async function mockDictionaries(page: Page, role: Role, reply: Reply = () => null) {
  const calls: Call[] = [];
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

  await page.route(`${base}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    let body: any = null;
    try { body = request.postDataJSON(); } catch { /* GET */ }
    if (path.startsWith('/auth/v1/')) return json(route, { id });
    if (path === '/rest/v1/profiles') return json(route, [{ role }]);
    if (path.startsWith('/rest/v1/rpc/')) {
      const fn = path.slice('/rest/v1/rpc/'.length);
      calls.push({ fn, body });
      if (fn.startsWith('admin_') && role !== 'admin') return json(route, { code: '42501', message: 'Administrative role required' }, 403);
      const custom = reply(fn, body);
      if (custom) return json(route, custom.body, custom.status ?? 200);
      if (fn === 'admin_list_catalog_dictionary') return json(route, listReply(body));
      if (fn === 'admin_catalog_quick_view_counts') return json(route, { total: 0, draft: 0, incomplete: 0, missing_cover: 0, open_reports: 0, statuses: null });
      return json(route, {});
    }
    return json(route, []);
  });
  return calls;
}

const of = (calls: Call[], fn: string) => calls.filter((call) => call.fn === fn);
const last = (calls: Call[], fn: string) => of(calls, fn).at(-1)?.body;
const dialog = (page: Page) => page.getByRole('dialog');
/** Mismo criterio que /lab (U5): cada control responde a 21 px de su centro en las cuatro direcciones. */
const touchMisses = (page: Page) => page.evaluate(() => {
  const failed: string[] = [];
  for (const control of document.querySelectorAll<HTMLElement>('.dic :is(button, a[href], input, select)')) {
    if (!control.checkVisibility()) continue;
    control.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    const rect = control.getBoundingClientRect();
    const [cx, cy] = [rect.left + rect.width / 2, rect.top + rect.height / 2];
    for (const [x, y] of [[cx, cy - 21], [cx, cy + 21], [cx - 21, cy], [cx + 21, cy]]) {
      const hit = document.elementFromPoint(x, y);
      if (!hit || !(hit === control || control.contains(hit))) {
        failed.push(`${control.tagName} "${(control.getAttribute('aria-label') || control.textContent || '').trim().slice(0, 30)}"`);
        break;
      }
    }
  }
  return failed;
});

test.describe('U19 G4 diccionarios', () => {
  test('solo admin: el colaborador no ve la sección ni la carga', async ({ page }) => {
    const calls = await mockDictionaries(page, 'colaborador');
    await page.goto('/estudio/diccionarios');
    await expect(page.getByText('Esta sección es solo para administración')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Estudio' }).getByRole('link', { name: 'Diccionarios' })).toHaveCount(0);
    expect(of(calls, 'admin_list_catalog_dictionary')).toHaveLength(0);
  });

  test('cuatro pestañas en la URL, con filtro y búsqueda por alias', async ({ page }) => {
    const calls = await mockDictionaries(page, 'admin');
    await page.goto('/estudio/diccionarios');
    await expect(page.getByRole('navigation', { name: 'Estudio' }).getByRole('link', { name: 'Diccionarios' })).toHaveAttribute('aria-current', 'page');
    const tabs = page.getByRole('navigation', { name: 'Diccionarios' });
    await expect(tabs.getByRole('link')).toHaveText(['Géneros', 'Países', 'Sellos', 'Artistas']);
    await expect(tabs.getByRole('link', { name: 'Géneros' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('row', { name: /Techno/ })).toContainText('40 lanzamientos · 38 publicados');
    await expect(page.getByRole('button', { name: 'Nuevo género' })).toBeVisible();

    await tabs.getByRole('link', { name: 'Países' }).click();
    await expect(page).toHaveURL(/\?tipo=paises$/);
    await expect(page.getByRole('row', { name: /Estados Unidos/ })).toContainText('También: EE.UU, EEUU, USA');
    await expect(page.getByRole('row', { name: /WORLD/ })).toContainText('Retirado');
    await page.getByLabel('Mostrar').selectOption('legacy');
    await expect(page).toHaveURL(/\?tipo=paises&filtro=legado$/);
    await expect.poll(() => last(calls, 'admin_list_catalog_dictionary')).toMatchObject({ p_kind: 'country', p_filter: 'legacy' });
    await page.getByRole('searchbox', { name: 'Buscar en países' }).fill('eeuu');
    await expect(page).toHaveURL(/\?tipo=paises&filtro=legado&q=eeuu$/);
    await expect(page.getByRole('row', { name: /Estados Unidos/ })).toBeVisible();
    await expect.poll(() => last(calls, 'admin_list_catalog_dictionary')).toMatchObject({ p_kind: 'country', p_filter: 'legacy', p_query: 'eeuu' });

    await tabs.getByRole('link', { name: 'Sellos' }).click();
    await expect(page).toHaveURL(/\?tipo=sellos$/);
    await expect(page.getByRole('searchbox', { name: 'Buscar en sellos' })).toHaveValue('');
    await expect(page.getByRole('button', { name: /^Nuevo/ })).toHaveCount(0);
    const incorrecto = page.getByRole('row', { name: /Incorrecto/ });
    await expect(incorrecto.getByRole('link', { name: '/sello/incorrecto' })).toBeVisible();
    await expect(incorrecto).toContainText('Redirigen: in-correcto');
    expect(await touchMisses(page)).toEqual([]);
    await tabs.getByRole('link', { name: 'Artistas' }).click();
    await expect(page.getByRole('row', { name: /Anaquia\)/ }).getByRole('link')).toHaveAttribute('href', '/artista/anaquia--da160ccf');
  });

  test('crear un género pide observación y manda nombre, estado y motivo', async ({ page }) => {
    const calls = await mockDictionaries(page, 'admin', (fn, body) => fn === 'admin_create_catalog_dictionary_value'
      ? { body: { kind: 'genre', value: { id: 'g9', name: body.p_name, status: body.p_status, slug: 'x', aliases: [] } } } : null);
    await page.goto('/estudio/diccionarios');
    await page.getByRole('button', { name: 'Nuevo género' }).click();
    await dialog(page).getByLabel('Nombre').fill('Kuduro');
    await dialog(page).getByLabel('Estado').selectOption('legacy');
    await expect(dialog(page)).toContainText('Se conserva en sus lanzamientos y la hoja lo acepta, pero no se ofrece.');
    const create = dialog(page).getByRole('button', { name: 'Crear género' });
    await expect(create).toBeDisabled();
    await dialog(page).getByLabel(/Observación del cambio/).fill('Lo pidió el equipo');
    await create.click();
    await expect(page.getByRole('status').filter({ hasText: 'Se creó «Kuduro» como legado.' })).toBeVisible();
    expect(last(calls, 'admin_create_catalog_dictionary_value')).toEqual({ p_kind: 'genre', p_name: 'Kuduro', p_status: 'legacy', p_reason: 'Lo pidió el equipo' });
  });

  test('renombrar avisa del alias y de la URL, y muestra el conflicto en el campo', async ({ page }) => {
    const calls = await mockDictionaries(page, 'admin', (fn) => fn === 'admin_rename_catalog_dictionary_value'
      ? { status: 409, body: { code: '23505', message: 'dictionary_value_exists', details: 'Incorrecto' } } : null);
    await page.goto('/estudio/diccionarios?tipo=sellos');
    await page.getByRole('button', { name: 'Acciones de NVR' }).click();
    await page.getByRole('menuitem', { name: 'Renombrar…' }).click();
    await dialog(page).getByLabel('Nombre nuevo').fill('incorrecto');
    await expect(dialog(page).getByRole('list', { name: 'Qué va a pasar' })).toContainText('«NVR» queda como alias');
    await expect(dialog(page).getByRole('list', { name: 'Qué va a pasar' })).toContainText('Su URL vieja redirige a la nueva.');
    await dialog(page).getByLabel(/Observación del cambio/).fill('Grafía');
    await dialog(page).getByRole('button', { name: 'Renombrar' }).click();
    await expect(dialog(page).getByText('Ya existe «Incorrecto». Para unirlos, usa «Fusionar con…».')).toBeVisible();
    await expect(dialog(page).getByLabel('Nombre nuevo')).toHaveAttribute('aria-invalid', 'true');
    expect(last(calls, 'admin_rename_catalog_dictionary_value')).toEqual({ p_kind: 'label', p_id: 'l2', p_name: 'incorrecto', p_reason: 'Grafía' });
  });

  test('fusionar busca el valor que se conserva, dice qué pasa y manda los dos ids', async ({ page }) => {
    const calls = await mockDictionaries(page, 'admin', (fn, body) => fn === 'admin_merge_catalog_dictionary_values'
      ? { body: { kind: 'genre', source: { id: body.p_source_id, name: 'Triphop' }, value: { id: body.p_target_id, name: 'Trip Hop' }, release_count: 1, slug_aliases_added: [] } } : null);
    await page.goto('/estudio/diccionarios?filtro=legado');
    await page.getByRole('button', { name: 'Acciones de Triphop' }).click();
    await page.getByRole('menuitem', { name: 'Fusionar con…' }).click();
    await dialog(page).getByLabel('Conservar').fill('trip');
    await expect.poll(() => last(calls, 'admin_list_catalog_dictionary')).toMatchObject({ p_kind: 'genre', p_query: 'trip', p_page_size: 20 });
    // El propio valor no se ofrece.
    await expect(dialog(page).getByRole('option')).toHaveCount(1);
    await dialog(page).getByRole('option', { name: /^Trip Hop/ }).click();
    const consequences = dialog(page).getByRole('list', { name: 'Qué va a pasar' });
    await expect(consequences).toContainText('Su lanzamiento pasa a «Trip Hop».');
    await expect(consequences).toContainText('«Triphop» deja de existir y queda como alias de «Trip Hop».');
    await dialog(page).getByLabel(/Observación del cambio/).fill('Duplicado de la hoja');
    await dialog(page).getByRole('button', { name: 'Fusionar' }).click();
    await expect(page.getByRole('status').filter({ hasText: '«Triphop» se fusionó en «Trip Hop» (1 lanzamiento). Su grafía queda como alias.' })).toBeVisible();
    expect(last(calls, 'admin_merge_catalog_dictionary_values')).toEqual({ p_kind: 'genre', p_source_id: 'g3', p_target_id: 'g2', p_reason: 'Duplicado de la hoja' });
  });

  test('estado: seleccionable o legado, nunca retirado desde aquí', async ({ page }) => {
    const calls = await mockDictionaries(page, 'admin', (fn, body) => fn === 'admin_set_catalog_dictionary_status'
      ? { body: { kind: 'country', changed: true, previous_status: 'retired', value: { id: body.p_id, name: 'WORLD', status: body.p_status } } } : null);
    await page.goto('/estudio/diccionarios?tipo=paises');
    await page.getByRole('button', { name: 'Acciones de WORLD' }).click();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem')).toHaveText(['Renombrar…', 'Fusionar con…', 'Marcar seleccionable', 'Marcar legado']);
    await menu.getByRole('menuitem', { name: 'Marcar legado' }).click();
    await expect(dialog(page)).toContainText('Sus 101 lanzamientos lo conservan.');
    await dialog(page).getByLabel(/Observación del cambio/).fill('Hasta corregir la hoja');
    await dialog(page).getByRole('button', { name: 'Marcar legado' }).click();
    await expect(page.getByRole('status').filter({ hasText: '«WORLD» ahora es legado.' })).toBeVisible();
    expect(last(calls, 'admin_set_catalog_dictionary_status')).toEqual({ p_kind: 'country', p_id: 'c3', p_status: 'legacy', p_reason: 'Hasta corregir la hoja' });
  });

  test('huérfanos: solo se seleccionan los que no tienen lanzamientos, y el servidor manda', async ({ page }) => {
    let refuse = true;
    const calls = await mockDictionaries(page, 'admin', (fn, body) => {
      if (fn !== 'admin_delete_catalog_dictionary_orphans') return null;
      return refuse
        ? { status: 409, body: { code: '23503', message: 'dictionary_value_in_use', details: 'Sello Vacío' } }
        : { body: { kind: 'label', deleted_count: body.p_ids.length, items: body.p_ids.map((id: string) => ({ id, name: id === 'l2' ? 'NVR' : 'Sello Vacío' })) } };
    });
    await page.goto('/estudio/diccionarios?tipo=sellos');
    await expect(page.getByRole('checkbox', { name: 'Seleccionar Incorrecto' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Acciones de Incorrecto' })).toBeVisible();
    await page.getByRole('button', { name: 'Acciones de Incorrecto' }).click();
    await expect(page.getByRole('menuitem', { name: 'Borrar…' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.getByRole('checkbox', { name: 'Seleccionar los 2 sin lanzamientos de esta página' }).check();
    const selection = page.getByRole('region', { name: 'Selección' });
    await expect(selection).toContainText('2 seleccionados');
    await selection.getByRole('button', { name: 'Borrar' }).click();
    await expect(dialog(page).getByRole('heading', { name: 'Borrar 2 sellos' })).toBeVisible();
    await expect(dialog(page).getByRole('list', { name: 'Se borran' })).toContainText('NVR');
    await dialog(page).getByLabel(/Observación del cambio/).fill('Limpieza');
    await dialog(page).getByRole('button', { name: 'Borrar 2' }).click();
    await expect(dialog(page).getByText('No se borró nada: Sello Vacío tiene lanzamientos.')).toBeVisible();
    refuse = false;
    await dialog(page).getByRole('button', { name: 'Borrar 2' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Se borraron 2 sellos sin lanzamientos.' })).toBeVisible();
    await expect(selection).toHaveCount(0);
    expect(last(calls, 'admin_delete_catalog_dictionary_orphans')).toEqual({ p_kind: 'label', p_ids: ['l2', 'l3'], p_reason: 'Limpieza' });
  });

  test('móvil: sin selección en lote, sin desbordar y con las acciones por fila', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockDictionaries(page, 'admin');
    await page.goto('/estudio/diccionarios?tipo=sellos');
    await expect(page.getByRole('row', { name: /NVR/ })).toBeVisible();
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await touchMisses(page)).toEqual([]);
    const actions = page.getByRole('button', { name: 'Acciones de NVR' });
    await actions.click();
    await expect(page.getByRole('menuitem', { name: 'Borrar…' })).toBeVisible();
  });
});

test.describe('U19 G4 URL viejas', () => {
  async function mockPublic(page: Page) {
    await page.route(`${base}/**`, async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/rest/v1/artist_slug_aliases') {
        return json(route, url.searchParams.get('slug') === 'eq.anaquia--da160ccf' ? { artist: { slug: 'anaquia--7aeffac6' } } : null);
      }
      if (url.pathname === '/rest/v1/label_slug_aliases') {
        return json(route, url.searchParams.get('slug') === 'eq.in-correcto' ? { label: { name: 'Incorrecto' } } : null);
      }
      if (url.pathname.startsWith('/auth/v1/')) return json(route, {}, 401);
      return json(route, []);
    });
  }

  test('la URL de un artista fusionado lleva a la del conservado', async ({ page }) => {
    await mockPublic(page);
    await page.goto('/artista/anaquia--da160ccf?vista=lista');
    await expect(page).toHaveURL(/\/artista\/anaquia--7aeffac6\?vista=lista$/);
  });

  test('la URL de un sello fusionado o renombrado lleva a la del conservado', async ({ page }) => {
    await mockPublic(page);
    await page.goto('/sello/in-correcto');
    await expect(page).toHaveURL(/\/sello\/incorrecto$/);
  });

  test('una URL que no es alias se queda donde está', async ({ page }) => {
    await mockPublic(page);
    await page.goto('/sello/no-existe');
    await expect(page).toHaveURL(/\/sello\/no-existe$/);
    await expect(page.getByText('Este sello aún no tiene lanzamientos en Discótica.')).toBeVisible();
  });
});
