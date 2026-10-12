import { expect, test, type Page, type Route } from '@playwright/test';

// U17 — Estudio: propuestas y reportes en bandeja. Supabase simulado: ninguna
// petición sale a la red. Lo que se prueba:
// - lista y detalle a la vez en ancho; en móvil, lista y después detalle, con retorno;
// - el detalle muestra solo lo propuesto y marca lo editado respecto de lo detectado;
// - acciones por rol iguales a E10, con los mismos cuerpos de RPC (E09, E18);
// - un admin aprueba y corrige el lanzamiento sin salir del Estudio ni escribir URLs.
// Con U17_CAPTURAS=1 guarda capturas del flujo en docs/modernizacion/capturas-u17/.

const project = 'hgocyrzhgohetfpzbmfs';
const base = `https://${project}.supabase.co`;
type Role = 'colaborador' | 'admin';
const userIds: Record<Role | 'comunidad', string> = {
  comunidad: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  colaborador: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  admin: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'
};
const ids = {
  community: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01',
  second: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02',
  collab: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb03',
  ready: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb04'
};
const createdRelease = '11111111-1111-4111-8111-000000000077';
const linkedRelease = '11111111-1111-4111-8111-000000000004';
const typeId = '55555555-5555-4555-8555-555555555555';
const labelId = '44444444-4444-4444-8444-444444444444';
const artistId = '22222222-2222-4222-8222-222222222222';
const capturas = process.env.U17_CAPTURAS === '1';

const payload = (title: string, over: Record<string, unknown> = {}) => ({
  version: 2, title, primary_artists: ['Artista principal'], collaborators: ['Artista invitada'], release_type: 'album',
  release_date: '2026-09-18', genres: ['Ambient'], countries: ['Colombia'], label: 'Sello ejemplo', team_note: '', ...over
});

function contribution(id: string, title: string, over: Record<string, unknown> = {}) {
  return {
    id, author_id: userIds.comunidad, status: 'pending',
    source_url: `https://artista.bandcamp.com/album/${id.slice(-2)}`, source_provider: 'bandcamp',
    payload: payload(title), payload_version: 2, payload_quality: 'confirmed',
    detected_metadata: { provider: 'bandcamp', source_available: true, title, artists: ['Artista principal'], type: 'Álbum', release_date: '2026-09-18', cover_url: 'https://images.example.test/cover.jpg' },
    queue_kind: 'community', submitted_at: '2026-09-20T14:00:00Z', reviewer_note: null as string | null, reviewed_at: null, release_id: null as string | null,
    created_at: '2026-09-20T13:00:00Z', updated_at: '2026-09-20T14:00:00Z', ...over
  };
}

const defaultContributions = () => [
  // Título y tipo editados respecto de lo detectado; sin nota.
  contribution(ids.community, 'Propuesta comunitaria', {
    payload: payload('Propuesta comunitaria', { release_type: 'ep' }),
    detected_metadata: { provider: 'bandcamp', source_available: true, title: 'Título detectado', artists: ['Artista principal'], type: 'Álbum', release_date: '2026-09-18', cover_url: 'https://images.example.test/cover.jpg' }
  }),
  contribution(ids.second, 'Segunda propuesta', { payload: payload('Segunda propuesta', { team_note: 'La escuché en vivo.' }), submitted_at: '2026-09-21T14:00:00Z' }),
  contribution(ids.collab, 'Aporte de colaboración', { author_id: userIds.colaborador, queue_kind: 'collaborator' }),
  // Fuente ilegible: todo a mano, sin marcas.
  contribution(ids.ready, 'Propuesta preparada', { status: 'ready_for_admin', detected_metadata: { provider: 'bandcamp', source_available: false } })
];

const defaultReports = () => [
  { id: 'r1', author_id: userIds.comunidad, category: 'catalog_error', description: 'El país está mal: es de Ecuador.', page_url: '/lanzamiento/lanzamiento-4', release_id: linkedRelease, technical_context: { route: '/lanzamiento/lanzamiento-4', viewport: { width: 390, height: 844 }, user_agent: 'Mozilla/5.0 (iPhone)', locale: 'es-CO', online: true, app_version: '1.0.0', catalog_source: 'canonical' }, screenshot_path: null, status: 'new', assigned_to: null, created_at: '2026-09-29T12:00:00Z', updated_at: '2026-09-29T12:00:00Z' },
  { id: 'r2', author_id: userIds.comunidad, category: 'technical_bug', description: 'El reproductor no carga.', page_url: '/', release_id: null, technical_context: {}, screenshot_path: 'u/r2/screenshot.png', status: 'triaged', assigned_to: null, created_at: '2026-09-28T12:00:00Z', updated_at: '2026-09-28T12:00:00Z' },
  { id: 'r3', author_id: userIds.comunidad, category: 'general_feedback', description: 'Gracias por el catálogo.', page_url: '/', release_id: null, technical_context: {}, screenshot_path: null, status: 'closed', assigned_to: userIds.admin, created_at: '2026-09-27T12:00:00Z', updated_at: '2026-09-27T12:00:00Z' }
];

function editorRelease(id: string, title: string) {
  return {
    id, slug: 'propuesta-comunitaria', title, release_date: '2026-09-18', release_type_id: typeId, label_id: labelId, review: '',
    status: 'published', credit_quality: 'proposed', catalog_version: 1, updated_at: '2026-10-10T12:00:00Z',
    artist_ids: [artistId], collaborator_ids: [], genre_ids: [], country_ids: [], radar: { experimental: 1, denso: 1, sintetico: 1, bailable: 1, rapido: 1 },
    links: [{ provider: 'bandcamp', url: 'https://artista.bandcamp.com/album/01', is_primary: true }],
    cover_url: 'https://images.example.test/cover.jpg', source: { mode: 'contribution', provider: 'bandcamp', url: null, cover_source_url: null },
    signals: { draft: false, incomplete: false, missing_fields: [], missing_cover: false, open_report_count: 0 }
  };
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

type Write = { rpc: string; body: Record<string, any> };

/** Supabase con estado: las decisiones sacan la propuesta de la cola, como E09. */
async function mockStudio(page: Page, role: Role) {
  const writes: Write[] = [];
  let contributions = defaultContributions();
  let reports = defaultReports();
  const releases: Record<string, ReturnType<typeof editorRelease>> = {
    [linkedRelease]: { ...editorRelease(linkedRelease, 'Lanzamiento 4'), slug: 'lanzamiento-4' }
  };

  const id = userIds[role];
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const claims = Buffer.from(JSON.stringify({ sub: id, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  const session = {
    access_token: `${header}.${claims}.signature`, refresh_token: 'fixture', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer',
    user: { id, aud: 'authenticated', role: 'authenticated', email: `${role}@example.test`, app_metadata: {}, user_metadata: { username: role }, created_at: '2026-09-17T00:00:00Z' }
  };
  await page.context().addCookies([{
    name: `sb-${project}-auth-token`, value: `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`,
    domain: '127.0.0.1', path: '/', httpOnly: false, secure: false, sameSite: 'Lax'
  }]);

  // Lo que ve cada rol con la RLS de E09: admin todo; colaborador lo suyo y la cola comunitaria ajena.
  const visible = () => contributions.filter((item) => role === 'admin'
    || item.author_id === id
    || (item.queue_kind === 'community' && item.status === 'pending'));

  await page.route(`${base}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const rpc = path.match(/\/rpc\/(\w+)$/)?.[1];
    let body: any = null;
    try { body = request.postDataJSON(); } catch { /* GET */ }
    if (path.startsWith('/auth/v1/')) return json(route, session.user);
    if (path === '/rest/v1/profiles') return json(route, [{ role }]);
    if (path === '/rest/v1/labels') return json(route, [{ id: labelId, name: 'Sello ejemplo', slug: 'sello-ejemplo' }]);
    if (path === '/rest/v1/release_types') return json(route, [{ id: typeId, name: 'Álbum', slug: 'album' }]);
    if (path === '/rest/v1/genres' || path === '/rest/v1/countries') return json(route, []);
    if (path === '/rest/v1/artists') return json(route, [{ id: artistId, name: 'Artista principal', slug: 'artista-principal' }]);
    if (path === '/rest/v1/contributions') {
      const release = url.searchParams.get('release_id');
      if (release) return json(route, visible().filter((item) => `eq.${item.release_id}` === release));
      return json(route, visible().filter((item) => item.status === 'pending' || item.status === 'ready_for_admin'));
    }
    if (path === '/rest/v1/problem_reports') return json(route, role === 'admin' ? reports : []);
    if (rpc) {
      if (rpc.startsWith('admin_') && role !== 'admin') return json(route, { code: '42501', message: 'permission denied' }, 403);
      if (rpc === 'review_contribution') {
        writes.push({ rpc, body });
        const item = contributions.find((entry) => entry.id === body.p_contribution_id)!;
        const updated = { ...item, status: body.p_action, reviewer_note: body.p_note, release_id: body.p_action === 'approved' ? createdRelease : null };
        if (body.p_action === 'approved') releases[createdRelease] = editorRelease(createdRelease, item.payload.title);
        contributions = contributions.map((entry) => (entry.id === item.id ? updated : entry));
        return json(route, updated);
      }
      if (rpc === 'prepare_contribution_for_admin') {
        writes.push({ rpc, body });
        const item = contributions.find((entry) => entry.id === body.p_contribution_id)!;
        const updated = { ...item, status: 'ready_for_admin' };
        contributions = contributions.map((entry) => (entry.id === item.id ? updated : entry));
        return json(route, updated);
      }
      if (rpc === 'admin_update_problem_report') {
        writes.push({ rpc, body });
        const updated = { ...reports.find((entry) => entry.id === body.p_report_id)!, status: body.p_status, assigned_to: body.p_assigned_to };
        reports = reports.map((entry) => (entry.id === updated.id ? updated : entry));
        return json(route, updated);
      }
      if (rpc === 'admin_list_catalog_releases') {
        const items = Object.values(releases);
        return json(route, { items, total: items.length, page: 1, page_size: 25, quick_view: null });
      }
      if (rpc === 'admin_catalog_quick_view_counts') return json(route, { total: 1, draft: 0, incomplete: 0, missing_cover: 0, open_reports: 1, statuses: null });
      if (rpc === 'admin_get_catalog_release') return json(route, releases[body.p_release_id]);
      if (rpc === 'admin_get_catalog_history') return json(route, { release_id: body.p_release_id, items: [] });
      if (rpc === 'admin_update_catalog_release') {
        writes.push({ rpc, body });
        const current = releases[body.p_release_id];
        releases[body.p_release_id] = { ...current, ...body.p_payload, catalog_version: current.catalog_version + 1 };
        return json(route, { release_id: body.p_release_id, catalog_version: current.catalog_version + 1, change_set_id: 'cs-1' });
      }
      return json(route, {});
    }
    return json(route, []);
  });
  await page.route('https://images.example.test/**', (route) => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#27351f"/></svg>' }));
  return writes;
}

const row = (page: Page, title: string) => page.getByRole('link', { name: new RegExp(`^${title}`) });
const detail = (page: Page, title?: string) => (title ? page.getByRole('article', { name: title }) : page.getByRole('article'));
const editedFields = (page: Page) => detail(page).locator('.l-inbox-field').filter({ hasText: 'Editado' }).locator('dt > span:first-child');
const noHorizontalOverflow = (page: Page) =>
  expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

async function capture(page: Page, name: string) {
  if (!capturas) return;
  await page.waitForTimeout(150);
  await page.screenshot({ path: `docs/modernizacion/capturas-u17/${name}.png`, fullPage: true });
}

test.describe('U17 propuestas', () => {
  test('a 1440: lista y detalle a la vez, solo lo propuesto y lo editado marcado', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockStudio(page, 'admin');
    await page.goto('/estudio/propuestas');

    const list = page.getByRole('region', { name: 'Propuestas en cola' });
    await expect(list.getByRole('heading', { level: 2 })).toHaveText(['Cola prioritaria', 'Cola comunitaria']);
    // Sin elegir nada, se abre la primera de la lista.
    await expect(row(page, 'Aporte de colaboración')).toHaveAttribute('aria-current', 'true');
    await expect(detail(page, 'Aporte de colaboración')).toBeVisible();
    const listBox = (await list.boundingBox())!;
    const detailBox = (await detail(page).boundingBox())!;
    expect(listBox.x + listBox.width).toBeLessThanOrEqual(detailBox.x);
    expect(Math.abs(listBox.y - detailBox.y)).toBeLessThan(2);
    await capture(page, '1-bandeja-1440');

    // Elegir reemplaza la entrada del historial y deja el foco en la lista.
    const historyLength = await page.evaluate(() => history.length);
    await row(page, 'Propuesta comunitaria').click();
    await expect(page).toHaveURL(new RegExp(`/estudio/propuestas\\?propuesta=${ids.community}$`));
    expect(await page.evaluate(() => history.length)).toBe(historyLength);
    await expect(row(page, 'Propuesta comunitaria')).toBeFocused();
    await expect(row(page, 'Propuesta comunitaria')).toContainText('2 campos editados');

    const proposal = detail(page, 'Propuesta comunitaria');
    await expect(proposal.locator('dt > span:first-child')).toHaveText(['Título', 'Artistas principales', 'Colaboradores', 'Tipo', 'Fecha', 'Sello', 'Géneros', 'Países']);
    await expect(editedFields(page)).toHaveText(['Título', 'Tipo']);
    await expect(proposal.locator('.l-inbox-field').filter({ hasText: 'Tipo' }).locator('dd')).toHaveText('EP');
    // Lo detectado no se muestra; solo se marca.
    await expect(proposal.getByText('Título detectado')).toHaveCount(0);
    await expect(proposal.getByText('Sin nota')).toBeVisible();
    await expect(proposal.getByRole('link', { name: /Abrir la fuente en Bandcamp/ })).toHaveAttribute('target', '_blank');
    await expect(proposal.getByRole('img', { name: /Portada de la fuente/ })).toBeVisible();
    await capture(page, '2-detalle-editado-1440');

    // Sin campos editados y con nota; fuente ilegible: sin marcas y dicho en una línea.
    await row(page, 'Segunda propuesta').click();
    await expect(detail(page, 'Segunda propuesta').getByText('Coincide con lo que detectó la fuente.')).toBeVisible();
    await expect(editedFields(page)).toHaveCount(0);
    await expect(detail(page).getByText('La escuché en vivo.')).toBeVisible();
    await row(page, 'Propuesta preparada').click();
    await expect(detail(page, 'Propuesta preparada').getByText('La fuente no se pudo leer: todos los datos se escribieron a mano.')).toBeVisible();
    await expect(editedFields(page)).toHaveCount(0);

    // Enlace directo; un id que ya no está abre la primera.
    await page.goto(`/estudio/propuestas?propuesta=${ids.second}`);
    await expect(detail(page, 'Segunda propuesta')).toBeVisible();
    await page.goto('/estudio/propuestas?propuesta=ya-no-existe');
    await expect(detail(page, 'Aporte de colaboración')).toBeVisible();
  });

  test('un admin aprueba una propuesta y corrige el lanzamiento sin salir del Estudio ni escribir URLs', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const writes = await mockStudio(page, 'admin');
    const visited: string[] = [];
    page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) visited.push(new URL(frame.url()).pathname); });

    // La única URL escrita es la entrada al Estudio; lo demás son clics.
    await page.goto('/estudio');
    await page.getByRole('navigation', { name: 'Estudio' }).getByRole('link', { name: /^Propuestas/ }).click();
    await row(page, 'Propuesta comunitaria').click();
    const proposal = detail(page, 'Propuesta comunitaria');
    await proposal.getByRole('button', { name: 'Revisar publicación' }).click();
    const dialog = page.getByRole('dialog', { name: 'Propuesta comunitaria' });
    await expect(dialog.getByText('Confirma el lanzamiento que se publicará con estos datos.')).toBeVisible();
    await capture(page, '3-aprobar-1440');
    await dialog.getByRole('button', { name: 'Aprobar y publicar' }).click();

    const notice = page.getByRole('status').filter({ hasText: 'Propuesta comunitaria: Aceptado.' });
    await expect(notice).toBeVisible();
    // La aprobada sale de la cola y se abre la siguiente, con el foco en su título.
    await expect(row(page, 'Propuesta comunitaria')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 2, name: 'Segunda propuesta' })).toBeFocused();
    // La vista sube al aviso: su enlace queda a la vista, no bajo el header.
    await expect(notice.getByRole('link', { name: 'Abrir el lanzamiento en el Catálogo' })).toBeInViewport();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.getByRole('navigation', { name: 'Estudio' }).getByRole('link', { name: /^Propuestas/ })).toHaveText(/Propuestas\s*3/);
    await capture(page, '4-aprobada-1440');

    await notice.getByRole('link', { name: 'Abrir el lanzamiento en el Catálogo' }).click();
    await expect(page).toHaveURL(new RegExp(`/estudio/catalogo\\?lanzamiento=${createdRelease}$`));
    await expect(page.getByRole('heading', { level: 1, name: 'Propuesta comunitaria' })).toBeVisible();
    await page.getByLabel('Título').fill('Propuesta comunitaria (edición corregida)');
    await page.getByPlaceholder('¿Qué cambió?').fill('Corrección tras aprobar la propuesta');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.locator('.editor__feedback')).toHaveText('Cambios guardados.');
    await capture(page, '5-corregido-1440');

    expect(writes.map((write) => write.rpc)).toEqual(['review_contribution', 'admin_update_catalog_release']);
    expect(writes[0].body).toEqual({ p_contribution_id: ids.community, p_action: 'approved', p_note: null });
    expect(writes[1].body).toMatchObject({
      p_release_id: createdRelease, p_expected_version: 1, p_operation: 'update',
      p_reason: 'Corrección tras aprobar la propuesta', p_payload: { title: 'Propuesta comunitaria (edición corregida)' }
    });
    expect(visited.length).toBeGreaterThan(0);
    expect(visited.every((path) => path.startsWith('/estudio'))).toBe(true);
  });

  test('pedir cambios y rechazar exigen nota; con nota, la propuesta sale y se abre la siguiente', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const writes = await mockStudio(page, 'admin');
    await page.goto(`/estudio/propuestas?propuesta=${ids.community}`);
    const proposal = detail(page, 'Propuesta comunitaria');

    await proposal.getByRole('button', { name: 'Rechazar' }).click();
    await expect(proposal.getByText('Escribe una nota antes de rechazar.')).toBeVisible();
    await expect(proposal.getByLabel('Nota para la persona autora')).toBeFocused();
    await expect(proposal.getByLabel('Nota para la persona autora')).toHaveAttribute('aria-invalid', 'true');
    await proposal.getByRole('button', { name: 'Solicitar cambios' }).click();
    await expect(proposal.getByText('Escribe una nota para solicitar cambios.')).toBeVisible();
    expect(writes).toEqual([]);
    await capture(page, '6-nota-obligatoria-1440');

    await proposal.getByLabel('Nota para la persona autora').fill('Confirma el sello, por favor.');
    await proposal.getByRole('button', { name: 'Solicitar cambios' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Propuesta comunitaria: Cambios solicitados.' })).toBeVisible();
    await expect(row(page, 'Propuesta comunitaria')).toHaveCount(0);
    // La siguiente de la lista ocupa su lugar, sin la nota ni el error de la anterior.
    await expect(page.getByRole('heading', { level: 2, name: 'Segunda propuesta' })).toBeFocused();
    await expect(detail(page, 'Segunda propuesta').getByLabel('Nota para la persona autora')).toHaveValue('');

    await detail(page).getByLabel('Nota para la persona autora').fill('Ya existe en el catálogo.');
    await detail(page).getByRole('button', { name: 'Rechazar' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Segunda propuesta: Rechazado.' })).toBeVisible();
    // Era la última: se abre la anterior.
    await expect(page.getByRole('heading', { level: 2, name: 'Propuesta preparada' })).toBeFocused();

    expect(writes.map((write) => write.body)).toEqual([
      { p_contribution_id: ids.community, p_action: 'changes_requested', p_note: 'Confirma el sello, por favor.' },
      { p_contribution_id: ids.second, p_action: 'rejected', p_note: 'Ya existe en el catálogo.' }
    ]);
  });

  test('colaborador: prepara la propuesta tal como llegó y no decide', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const writes = await mockStudio(page, 'colaborador');
    await page.goto('/estudio/propuestas');
    const list = page.getByRole('region', { name: 'Propuestas en cola' });
    await expect(list.getByRole('heading', { level: 2 })).toHaveText(['Cola comunitaria', 'Mis aportes prioritarios']);
    await expect(page.getByRole('button', { name: /Revisar publicación|Solicitar cambios|Rechazar/ })).toHaveCount(0);

    await row(page, 'Aporte de colaboración').click();
    await expect(detail(page, 'Aporte de colaboración').getByText('Pendiente de revisión administrativa.')).toBeVisible();
    await expect(detail(page).getByRole('button')).toHaveCount(0);

    await row(page, 'Propuesta comunitaria').click();
    const proposal = detail(page, 'Propuesta comunitaria');
    await proposal.getByLabel(/^Nota interna/).fill('Fuente verificada en Bandcamp.');
    await capture(page, '7-colaborador-1440');
    await proposal.getByRole('button', { name: 'Marcar lista para administración' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Propuesta comunitaria quedó lista para administración.' })).toBeVisible();
    await expect(row(page, 'Propuesta comunitaria')).toHaveCount(0);

    const original = defaultContributions()[0];
    expect(writes).toEqual([{
      rpc: 'prepare_contribution_for_admin',
      body: { p_contribution_id: ids.community, p_working_payload: original.payload, p_internal_note: 'Fuente verificada en Bandcamp.' }
    }]);
  });
});

test.describe('U17 móvil', () => {
  test('a 390: lista, después detalle, y "Volver" regresa con el foco en la propuesta', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockStudio(page, 'admin');
    await page.goto('/estudio/propuestas');
    await expect(row(page, 'Propuesta comunitaria')).toBeVisible();
    // En móvil no se abre nada solo.
    await expect(detail(page)).toHaveCount(0);
    await expect(row(page, 'Propuesta comunitaria')).not.toHaveAttribute('aria-current', 'true');
    await noHorizontalOverflow(page);
    await capture(page, '8-lista-390');

    await row(page, 'Propuesta comunitaria').click();
    await expect(page).toHaveURL(new RegExp(`propuesta=${ids.community}$`));
    await expect(page.getByRole('region', { name: 'Propuestas en cola' })).toBeHidden();
    await expect(page.getByRole('heading', { level: 2, name: 'Propuesta comunitaria' })).toBeFocused();
    await expect(editedFields(page)).toHaveText(['Título', 'Tipo']);
    await noHorizontalOverflow(page);
    await capture(page, '9-detalle-390');

    await page.getByRole('button', { name: 'Volver a las propuestas' }).click();
    await expect(page).toHaveURL(/\/estudio\/propuestas$/);
    await expect(row(page, 'Propuesta comunitaria')).toBeFocused();
    await expect(detail(page)).toHaveCount(0);

    // "Atrás" del navegador hace lo mismo.
    await row(page, 'Segunda propuesta').click();
    await expect(detail(page, 'Segunda propuesta')).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/estudio\/propuestas$/);
    await expect(row(page, 'Segunda propuesta')).toBeVisible();

    // Enlace directo en móvil: detalle con retorno a la lista.
    await page.goto(`/estudio/propuestas?propuesta=${ids.second}`);
    await page.getByRole('button', { name: 'Volver a las propuestas' }).click();
    await expect(page).toHaveURL(/\/estudio\/propuestas$/);
    await expect(row(page, 'Segunda propuesta')).toBeFocused();
  });

  test('a 390: decidir vuelve a la lista con el aviso', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const writes = await mockStudio(page, 'admin');
    await page.goto('/estudio/propuestas');
    await row(page, 'Propuesta comunitaria').click();
    await detail(page).getByRole('button', { name: 'Revisar publicación' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Aprobar y publicar' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Aceptado' })).toBeVisible();
    await expect(page).toHaveURL(/\/estudio\/propuestas$/);
    await expect(detail(page)).toHaveCount(0);
    await expect(row(page, 'Propuesta comunitaria')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Abrir el lanzamiento en el Catálogo' })).toHaveAttribute('href', `/estudio/catalogo?lanzamiento=${createdRelease}`);
    expect(writes).toHaveLength(1);
  });
});

test.describe('U17 reportes', () => {
  test('la misma bandeja: estados traducidos, enlace al lanzamiento y clasificación de E18', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const writes = await mockStudio(page, 'admin');
    await page.goto('/estudio/reportes');
    const list = page.getByRole('region', { name: 'Reportes' });
    await expect(list.getByRole('heading', { level: 2 })).toHaveText(['Abiertos', 'Resueltos y cerrados']);
    await expect(list.locator('.ui-chip')).toHaveText(['Nuevo', 'Clasificado', 'Cerrado']);
    // Ningún estado crudo en inglés.
    for (const raw of ['new', 'triaged', 'in_progress', 'resolved', 'closed']) {
      await expect(page.getByText(raw, { exact: true })).toHaveCount(0);
    }

    const report = detail(page, 'Error de catálogo');
    await expect(report.getByText('El país está mal: es de Ecuador.')).toBeVisible();
    await expect(report.getByRole('link', { name: 'Abrir el lanzamiento en el Catálogo' })).toHaveAttribute('href', `/estudio/catalogo?lanzamiento=${linkedRelease}`);
    await expect(report.getByRole('link', { name: 'Ver sus reportes' })).toHaveAttribute('href', `/estudio/reportes?lanzamiento=${linkedRelease}`);
    await expect(report.getByLabel('Estado').locator('option')).toHaveText(['Nuevo', 'Clasificado', 'En curso', 'Resuelto', 'Cerrado']);
    await report.getByText('Contexto técnico').click();
    await expect(report.getByText('390 × 844')).toBeVisible();
    await capture(page, '10-reportes-1440');

    await report.getByLabel('Estado').selectOption('resolved');
    await report.getByLabel(/^Respuesta interna/).fill('País corregido en el editor.');
    await report.getByRole('button', { name: 'Guardar clasificación' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Reporte actualizado: Resuelto.' })).toBeVisible();
    // Pasa a resueltos y sigue abierto en el detalle.
    await expect(page.getByRole('region', { name: 'Reportes' }).locator('section').nth(1).getByRole('link', { name: /^El país está mal/ })).toBeVisible();
    await expect(detail(page, 'Error de catálogo').getByLabel('Estado')).toHaveValue('resolved');
    expect(writes).toEqual([{
      rpc: 'admin_update_problem_report',
      body: { p_report_id: 'r1', p_status: 'resolved', p_assigned_to: userIds.admin, p_note: 'País corregido en el editor.' }
    }]);

    // Del reporte al lanzamiento, sin salir del Estudio.
    await detail(page).getByRole('link', { name: 'Abrir el lanzamiento en el Catálogo' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Lanzamiento 4' })).toBeVisible();
  });

  test('a 390: lista y detalle con retorno, sin desborde', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockStudio(page, 'admin');
    await page.goto('/estudio/reportes');
    await expect(detail(page)).toHaveCount(0);
    await row(page, 'El reproductor no carga').click();
    await expect(page.getByRole('heading', { level: 2, name: 'Problema técnico' })).toBeFocused();
    await expect(detail(page).getByText('Adjunta (privada)')).toBeVisible();
    await noHorizontalOverflow(page);
    await capture(page, '11-reporte-390');
    await page.getByRole('button', { name: 'Volver a los reportes' }).click();
    await expect(row(page, 'El reproductor no carga')).toBeFocused();
  });
});

test.describe('U17 matriz de anchos', () => {
  for (const width of [390, 834, 1440]) {
    test(`propuestas y reportes con detalle abierto, sin desborde a ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await mockStudio(page, 'admin');
      for (const [path, title] of [[`/estudio/propuestas?propuesta=${ids.community}`, 'Propuesta comunitaria'], ['/estudio/reportes?reporte=r1', 'Error de catálogo']]) {
        await page.goto(path);
        await expect(detail(page, title)).toBeVisible();
        await noHorizontalOverflow(page);
        if (width === 834) await capture(page, `12-${path.includes('reportes') ? 'reporte' : 'propuesta'}-834`);
      }
    });
  }
});
