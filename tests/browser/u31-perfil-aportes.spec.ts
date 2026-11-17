import { expect, test, type Page, type Route } from '@playwright/test';

// U31 (tableros F, K y N): el perfil como casa, la salida de Mis colecciones y
// la página Mis aportes. Supabase simulado por completo: nada sale a la red.

const project = 'hgocyrzhgohetfpzbmfs';
const ownerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa031';
const visitorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa039';

const releaseIds = { aceptado: '31313131-3131-4131-8131-313131313101', publicado: '31313131-3131-4131-8131-313131313102' };
const catalog = [
  { id: releaseIds.aceptado, slug: 'tierra-caliente', title: 'Tierra caliente', cover: 'https://example.test/tierra.jpg' },
  { id: releaseIds.publicado, slug: 'puente-sur', title: 'Puente Sur', cover: 'https://example.test/puente.jpg' }
].map((r) => ({
  ...r, release_date: '2026-08-09', type: 'EP', label: 'Sello U31', review: '', experimental: 1, denso: 2, sintetico: 3, bailable: 4, rapido: 5,
  artists: ['Artista U31'], primary_artists: [{ id: 'artist-u31', slug: 'artista-u31', name: 'Artista U31', position: 0 }],
  collaborators: [], credit_quality: 'verified', genres: ['Ambient'], countries: ['Colombia'], buy_link: null
}));

function contribution(id: string, status: string, title: string, extra: Record<string, unknown> = {}) {
  return {
    id, author_id: ownerId, status, source_url: `https://artista.bandcamp.com/album/${id}`, source_provider: 'bandcamp',
    payload: {
      version: 3, title, primary_artists: title ? ['Laura Ríos'] : [], collaborators: [], release_type: title ? 'ep' : '',
      release_date: '2026-10-01', genres: [], countries: [], label: '', cover_url: title ? `https://example.test/${id}.jpg` : undefined
    },
    payload_version: 3, payload_quality: 'confirmed', detected_metadata: {}, queue_kind: 'community',
    submitted_at: '2026-11-04T12:00:00Z', taken_at: null, reviewer_note: null, reviewed_at: '2026-11-05T12:00:00Z',
    release_id: null, created_at: '2026-11-01T12:00:00Z', updated_at: '2026-11-02T12:00:00Z', ...extra
  };
}

const CONTRIBUTIONS = [
  contribution('c-cambios', 'changes_requested', 'Frecuencia baja', { reviewer_note: 'Falta el país del sello.' }),
  contribution('c-borrador', 'draft', ''),
  contribution('c-pendiente', 'pending', 'Selva de cables'),
  contribution('c-tomada', 'pending', 'Altiplano FM', { taken_at: '2026-11-05T00:00:00Z' }),
  contribution('c-lista', 'ready_for_admin', 'Marea interna'),
  contribution('c-aceptada', 'approved', 'Tierra caliente', { release_id: releaseIds.aceptado }),
  contribution('c-rechazada', 'rejected', 'Ruido blanco', { reviewer_note: 'Este lanzamiento ya está en el catálogo.' })
];

const crate = (id: string, name: string, isPublic: boolean) => ({
  id, owner_id: ownerId, name, description: null, slug: id, is_public: isPublic,
  created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z'
});
const CRATES = [crate('para-abrir-el-set', 'Para abrir el set', true), crate('pendientes', 'Pendientes por escuchar', false)];

type Options = {
  as?: 'owner' | 'visitor' | null;
  crates?: typeof CRATES;
  contributions?: ReturnType<typeof contribution>[];
  /** Perfil recién nacido: sin bio ni redes. */
  bare?: boolean;
  /** Nombre para mostrar (título de la cenefa). */
  displayName?: string;
};

async function setup(page: Page, options: Options = {}) {
  const as = options.as === undefined ? 'owner' : options.as;
  const crates = options.crates ?? CRATES;
  const contributions = options.contributions ?? CONTRIBUTIONS;
  if (as) await authenticate(page, as === 'owner' ? ownerId : visitorId, as === 'owner' ? 'comunidad' : 'visita');
  const profile = {
    id: ownerId, username: 'comunidad', display_name: options.displayName ?? 'Comunidad', role: 'comunidad', created_at: '2026-01-01T00:00:00Z',
    bio: options.bare ? null : 'Escucha de sellos pequeños y radio comunitaria.',
    social_bandcamp: options.bare ? null : 'comunidad', social_bandcamp_kind: options.bare ? null : 'fan',
    social_soundcloud: null, social_instagram: options.bare ? null : 'comunidad.mx', social_x: null, social_facebook: null,
    show_accepted_contributions: false
  };

  await page.route(`https://${project}.supabase.co/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const single = (request.headers().accept ?? '').includes('vnd.pgrst.object');
    const path = url.pathname;
    if (path.startsWith('/auth/v1/')) {
      if (!as) return json(route, { code: 401, msg: 'missing session' }, 401);
      return json(route, { id: as === 'owner' ? ownerId : visitorId, aud: 'authenticated', role: 'authenticated', user_metadata: { username: as === 'owner' ? 'comunidad' : 'visita' } });
    }
    if (path === '/rest/v1/profiles') {
      if (url.searchParams.get('select') === 'role') return json(route, { role: 'comunidad' }, single);
      return json(route, single ? profile : [profile], single);
    }
    if (path === '/rest/v1/crates') {
      // RLS: los demás solo ven las públicas.
      const visible = url.searchParams.get('is_public') === 'eq.true' ? crates.filter((c) => c.is_public) : crates;
      return json(route, visible.map((c) => ({ ...c, crate_items: [{ count: c.is_public ? 2 : 0 }] })));
    }
    if (path === '/rest/v1/crate_items') {
      return json(route, [
        { crate_id: 'para-abrir-el-set', release_id: releaseIds.aceptado },
        { crate_id: 'para-abrir-el-set', release_id: releaseIds.publicado }
      ]);
    }
    if (path === '/rest/v1/catalog_releases') {
      const ids = (url.searchParams.get('id') ?? '').replace(/^in\.\(|\)$/g, '').split(',').map((id) => id.replace(/"/g, ''));
      return json(route, catalog.filter((r) => ids.includes(r.id)));
    }
    if (path === '/rest/v1/contributions') return json(route, as === 'owner' ? contributions : []);
    return json(route, single ? null : []);
  });
  await page.route('https://example.test/**', (route) => route.fulfill({
    status: 200, contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#96f719"/></svg>'
  }));
}

function json(route: Route, body: unknown, statusOrSingle: number | boolean = 200) {
  const status = typeof statusOrSingle === 'number' ? statusOrSingle : 200;
  const single = statusOrSingle === true;
  return route.fulfill({
    status,
    contentType: single ? 'application/vnd.pgrst.object+json' : 'application/json',
    headers: status < 400 && Array.isArray(body) ? { 'content-range': `0-${Math.max(body.length - 1, 0)}/${body.length}` } : {},
    body: JSON.stringify(body)
  });
}

async function authenticate(page: Page, id: string, username: string) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: id, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  const session = {
    access_token: `${header}.${payload}.signature`, refresh_token: 'fixture-refresh-token', expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer',
    user: { id, aud: 'authenticated', role: 'authenticated', email: `${username}@example.test`, app_metadata: {}, user_metadata: { username }, created_at: '2026-09-18T00:00:00Z' }
  };
  await page.context().addCookies([{
    name: `sb-${project}-auth-token`, value: `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`,
    domain: '127.0.0.1', path: '/', httpOnly: false, secure: false, sameSite: 'Lax'
  }]);
}

const noHorizontalOverflow = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

// ---------------------------------------------------------------------------
// Perfil

test('U31 perfil propio: Mis aportes fijado primero, privadas marcadas y Nueva colección', async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/perfil/comunidad');
  await expect(page.getByRole('heading', { level: 1, name: 'Comunidad' })).toBeVisible();
  await expect(page.locator('.perfil-cabeza')).toContainText('@comunidad · Escucha de sellos pequeños');
  const main = page.locator('main');
  await expect(main.getByRole('link', { name: 'Editar perfil' })).toHaveAttribute('href', '/cuenta');
  await expect(main.getByRole('link', { name: 'Ajustes' })).toHaveAttribute('href', '/cuenta/ajustes');
  await expect(page.getByRole('list', { name: 'Redes de @comunidad' }).getByRole('link')).toHaveCount(2);

  const tiles = page.locator('.perfil-grid > li');
  await expect(tiles).toHaveCount(3);
  const aportes = tiles.first();
  await expect(aportes.getByRole('link', { name: 'Mis aportes' })).toHaveAttribute('href', '/mis-aportes');
  await expect(aportes.getByRole('img', { name: 'Fijada' })).toBeVisible();
  await expect(aportes).toContainText('7 lanzamientos · 3 en revisión');
  // El mosaico son las portadas de los aceptados: una, publicada.
  await expect(aportes.locator('.ui-cover__image')).toHaveCount(1);
  // Borde verde de 2 px por dentro.
  expect(await aportes.locator('.aportes-tile__visual').evaluate((el) => getComputedStyle(el, '::after').borderTopWidth)).toBe('2px');

  await expect(tiles.nth(1)).toContainText('2 lanzamientos');
  await expect(tiles.nth(1)).not.toContainText('Privada');
  await expect(tiles.nth(2)).toContainText('Vacía · Privada');
  await tiles.nth(2).getByRole('button', { name: 'Acciones de «Pendientes por escuchar»' }).click();
  await expect(page.getByRole('menu').getByRole('menuitem')).toHaveText(['Compartir (es privada)', 'Editar', 'Eliminar']);
  await page.keyboard.press('Escape');

  // 4 × 270 en 1152.
  expect(Math.round((await aportes.boundingBox())!.width)).toBe(270);

  await main.getByRole('button', { name: 'Nueva colección' }).click();
  await expect(page.getByRole('dialog', { name: 'Nueva colección' })).toBeVisible();
});

test('U31 perfil: el título no comparte fila con redes ni botones y no se parte a media palabra', async ({ page }) => {
  for (const width of [1024, 1440]) {
    await setup(page, { displayName: 'Discotecariografía' });
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/perfil/comunidad');
    const title = page.getByRole('heading', { level: 1, name: 'Discotecariografía' });
    await expect(title).toBeVisible();
    await expect(page.locator('main').getByRole('link', { name: 'Ajustes' })).toBeVisible();
    // Una sola línea (84 de alto) y el ancho del contenedor, aunque al lado haya redes y dos botones.
    const box = (await title.boundingBox())!;
    expect(box.height).toBeLessThanOrEqual(90);
    const container = (await page.locator('.perfil-cabeza__contenido').boundingBox())!;
    expect(Math.round(box.width)).toBeGreaterThanOrEqual(Math.round(container.width) - 48);
    // Las acciones van debajo del título, no a su lado.
    const actions = (await page.locator('.perfil-cabeza__acciones').boundingBox())!;
    expect(actions.y).toBeGreaterThanOrEqual(box.y + box.height - 1);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  }
});

test('U31 perfil recién nacido: Mis aportes vacío, «Crea tu primera colección» y tiles fantasma', async ({ page }) => {
  await setup(page, { crates: [], contributions: [], bare: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/perfil/comunidad');
  await expect(page.getByRole('link', { name: 'Escribe tu bio' })).toHaveAttribute('href', '/cuenta');
  await expect(page.getByRole('link', { name: 'Añade tus redes' })).toHaveAttribute('href', '/cuenta#redes');
  const tiles = page.locator('.perfil-grid > li');
  await expect(tiles.first()).toContainText('Sin aportes todavía');
  await expect(tiles.first().getByRole('img', { name: 'Fijada' })).toBeVisible();
  await expect(page.locator('.perfil-fantasma')).toHaveCount(2);
  await expect(page.locator('.perfil-fantasma').first()).toBeVisible();
  // D5: los dos caminos abren el mismo diálogo.
  await expect(page.locator('main').getByRole('button', { name: 'Nueva colección' })).toBeVisible();
  await page.getByRole('button', { name: 'Crea tu primera colección' }).click();
  await expect(page.getByRole('dialog', { name: 'Nueva colección' })).toBeVisible();
});

test.describe('U31 perfil a 390', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('dos columnas y sin fantasmas; nada se sale', async ({ page }) => {
    await setup(page, { crates: [], contributions: [], bare: true });
    await page.goto('/perfil/comunidad');
    const tiles = page.locator('.perfil-grid > li');
    await expect(tiles.first()).toContainText('Sin aportes todavía');
    const [a, b] = await Promise.all([tiles.nth(0).boundingBox(), tiles.nth(1).boundingBox()]);
    expect(Math.round(a!.y)).toBe(Math.round(b!.y));
    await expect(page.locator('.perfil-fantasma').first()).toBeHidden();
    await noHorizontalOverflow(page);
  });
});

test('U31 perfil ajeno: sin Mis aportes, sin privadas y sin acciones del dueño', async ({ page }) => {
  await setup(page, { as: 'visitor' });
  await page.goto('/perfil/comunidad');
  await expect(page.getByRole('heading', { level: 1, name: 'Comunidad' })).toBeVisible();
  await expect(page.locator('.perfil-grid > li')).toHaveCount(1);
  await expect(page.locator('main a[href="/mis-aportes"]')).toHaveCount(0);
  await expect(page.getByText('Pendientes por escuchar')).toHaveCount(0);
  await expect(page.locator('main').getByRole('link', { name: /Editar perfil|Ajustes/ })).toHaveCount(0);
  await expect(page.locator('main').getByRole('button', { name: /Nueva colección|Acciones de/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Escribe tu bio|Añade tus redes/ })).toHaveCount(0);
});

test('U31 /mis-colecciones redirige al perfil propio y conserva el aviso y ?crear', async ({ page }) => {
  await setup(page);
  await page.goto('/mis-colecciones?aviso=cuenta-confirmada');
  await expect(page).toHaveURL(/\/perfil\/comunidad$/);
  await expect(page.getByText('Tu cuenta está confirmada')).toBeVisible();
  await page.goto('/mis-colecciones?crear=1');
  await expect(page).toHaveURL(/\/perfil\/comunidad\?crear=1$/);
  await expect(page.getByRole('dialog', { name: 'Nueva colección' })).toBeVisible();
});

// ---------------------------------------------------------------------------
// Mis aportes

test('U31 Mis aportes: tres grupos, cifras, acciones y nota del equipo, sin la fuente', async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/mis-aportes');
  await expect(page.getByRole('heading', { level: 1, name: 'Mis aportes' })).toBeVisible();
  await expect(page.locator('main').getByRole('link', { name: '@comunidad' })).toHaveAttribute('href', '/perfil/comunidad');
  await expect(page.locator('.aportes-cifras')).toContainText('Lanzamientos7');
  await expect(page.locator('.aportes-cifras')).toContainText('En revisión3');
  await expect(page.locator('.aportes-cifras')).toContainText('Aceptados1');

  await expect(page.locator('.aportes-grupo h2')).toHaveText(['Por resolver 2', 'En revisión 3', 'Resueltos 2']);
  const group = (name: string) => page.getByRole('region', { name: new RegExp(`^${name}`) });
  // Por resolver: primero lo que pidió cambios, con «Corregir» en verde.
  const resolver = group('Por resolver').locator('.aporte');
  await expect(resolver.first()).toContainText('Frecuencia baja');
  await expect(resolver.first()).toContainText('Laura Ríos · EP');
  await expect(resolver.first()).toContainText('Revisado 5 nov 2026');
  const corregir = resolver.first().getByRole('link', { name: 'Corregir: Frecuencia baja' });
  await expect(corregir).toHaveClass(/ui-btn--primary/);
  await expect(corregir).toHaveAttribute('href', '/sugerir?draft=c-cambios');
  await expect(resolver.first().locator('.aporte__nota')).toHaveText('Nota del equipo: Falta el país del sello.');
  // Borrador sin título, sin artista ni portada: hueco punteado y «Editar».
  await expect(resolver.nth(1)).toContainText('Borrador sin título');
  await expect(resolver.nth(1)).toContainText('Sin artista');
  await expect(resolver.nth(1).locator('.aporte__sin-portada')).toHaveCount(1);
  await expect(resolver.nth(1)).toContainText('Guardado 2 nov 2026');
  await expect(resolver.nth(1).getByRole('link', { name: 'Editar: Borrador sin título' })).toHaveAttribute('href', '/sugerir?draft=c-borrador');

  // En revisión: «Editar» mientras nadie la tomó; después, gris y desactivado.
  const revision = group('En revisión');
  await expect(revision.getByRole('link', { name: 'Editar: Selva de cables' })).toHaveAttribute('href', '/sugerir?draft=c-pendiente');
  for (const title of ['Altiplano FM', 'Marea interna']) {
    const locked = revision.getByRole('link', { name: `Editar: ${title}` });
    await expect(locked).toHaveAttribute('aria-disabled', 'true');
    await expect(locked).not.toHaveAttribute('href', /./);
  }
  await expect(revision.locator('.ui-status__label')).toHaveText(['Pendiente', 'Pendiente', 'Listo para administración']);

  // Resueltos: «Ver lanzamiento» si está publicado; el rechazado, sin acción y con su nota.
  const resueltos = group('Resueltos');
  await expect(resueltos.getByRole('link', { name: 'Ver lanzamiento: Tierra caliente' })).toHaveAttribute('href', '/lanzamiento/tierra-caliente');
  const rechazado = resueltos.locator('.aporte').nth(1);
  await expect(rechazado.getByRole('link')).toHaveCount(0);
  await expect(rechazado).toContainText('Nota del equipo: Este lanzamiento ya está en el catálogo.');

  // Sin la fuente.
  await expect(page.locator('main')).not.toContainText(/bandcamp/i);
});

test.describe('U31 Mis aportes a 390', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('cifras en una línea y filas apiladas, sin salirse', async ({ page }) => {
    await setup(page);
    await page.goto('/mis-aportes');
    await expect(page.locator('.aportes-cifras-linea')).toHaveText('7 lanzamientos · 3 en revisión · 1 aceptado');
    await expect(page.locator('.aportes-cifras')).toBeHidden();
    await expect(page.locator('.aporte')).toHaveCount(7);
    await noHorizontalOverflow(page);
  });
});
