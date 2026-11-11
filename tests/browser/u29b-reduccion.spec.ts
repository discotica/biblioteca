import { expect, test, type Page } from '@playwright/test';

// U29b (tablero D, «Reducida»): tras el primer scroll hacia abajo la franja con
// bienvenida o nota beta pasa a la banda de 120 con título 28, campo de 420 y
// chips. Solo desktop, solo lectura del scroll. Lo que NO cambia: la URL, el
// historial, la sesión de la bienvenida y la paginación (U18 H15, E12, E17, E19).

const betaEnabled = process.env.VITE_BETA_INVITATION_ENABLED === 'true';

const rows = Array.from({ length: 36 }, (_, index) => ({
  id: `29292929-2929-4929-8929-${String(index + 1).padStart(12, '0')}`,
  slug: `release-u29b-${index + 1}`,
  title: `Release U29b ${index + 1}`,
  release_date: `2026-${String((index % 9) + 1).padStart(2, '0')}-15`,
  type: index % 2 ? 'EP' : 'Álbum',
  label: 'Sello U29b', review: '', experimental: 2, denso: 3, sintetico: 1, bailable: 4, rapido: 2,
  artists: [`Artista U29b ${index + 1}`],
  primary_artists: [{ id: `artist-u29b-${index + 1}`, slug: `artista-u29b-${index + 1}`, name: `Artista U29b ${index + 1}`, position: 0 }],
  collaborators: [], credit_quality: 'verified', genres: ['Electro'], countries: ['Colombia'], buy_link: '', cover: ''
}));

test.beforeEach(async ({ page }) => {
  await page.route('**/rest/v1/catalog_releases**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'content-range': `0-${rows.length - 1}/${rows.length}` },
    body: JSON.stringify(rows)
  }));
  await page.route('**/rest/v1/rpc/resolve_release_slug', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
});

const box = (page: Page, selector: string) => page.locator(selector).first().evaluate((node) => {
  const rect = node.getBoundingClientRect();
  return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), height: Math.round(rect.height), width: Math.round(rect.width) };
});

// Un scroll de usuario (rueda), no `scrollTo`: es lo que dispara la reducción.
const wheel = async (page: Page, dy: number) => {
  await page.mouse.move(700, 600);
  await page.mouse.wheel(0, dy);
};
const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY));
const franjaForma = (page: Page) => page.locator('.franja').getAttribute('data-franja');
const settled = (page: Page) => page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => null))).then(() => true));

// Cuenta lo que la página escribe en el scroll: la reducción no debe escribir nada.
const spyScrollWrites = (page: Page) => page.addInitScript(() => {
  const w = window as unknown as { __scrollWrites: string[] };
  w.__scrollWrites = [];
  for (const name of ['scrollTo', 'scrollBy', 'scroll'] as const) {
    const original = window[name].bind(window);
    (window as unknown as Record<string, unknown>)[name] = (...args: unknown[]) => {
      w.__scrollWrites.push(/sveltejs\/kit/.test(new Error().stack ?? '') ? `${name}:kit` : name);
      return (original as (...a: unknown[]) => void)(...args);
    };
  }
  const intoView = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (...args: []) {
    w.__scrollWrites.push('scrollIntoView');
    return intoView.apply(this, args);
  };
});
const scrollWrites = (page: Page) => page.evaluate(() => (window as unknown as { __scrollWrites: string[] }).__scrollWrites);

test.describe('desktop 1440', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('la bienvenida se reduce tras el primer scroll hacia abajo y no antes; el campo de pulso es el mismo', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await spyScrollWrites(page);
    await page.goto('/');
    await expect(page.locator('[data-welcome-banner]')).toBeVisible();
    await expect(page.locator('.card--grid').first()).toBeVisible();
    await page.locator('canvas.ui-campo-pulso').evaluate((node) => { (node as unknown as { __mismo: boolean }).__mismo = true; });
    expect(await franjaForma(page)).toBe('bienvenida');
    expect((await box(page, '.franja')).height).toBe(460);
    const escriturasAntes = (await scrollWrites(page)).length;

    // Por debajo del umbral (48): nada cambia.
    await wheel(page, 30);
    await expect.poll(() => scrollY(page)).toBeGreaterThan(0);
    expect(await scrollY(page)).toBeLessThan(48);
    expect(await franjaForma(page)).toBe('bienvenida');
    expect((await box(page, '.franja')).height).toBe(460);

    // Pasado el umbral, hacia abajo: la banda de 120.
    await wheel(page, 200);
    await expect(page.locator('.franja')).toHaveAttribute('data-franja', 'reducida');
    await expect.poll(async () => (await box(page, '.franja')).height).toBe(120);
    const title = page.getByRole('heading', { level: 1, name: 'Explora la biblioteca' });
    await expect(title).toHaveCount(1);
    await expect(title).toBeVisible();
    await expect(title).toHaveCSS('font-size', '28px');
    expect((await box(page, '.home-search__field')).width).toBe(420);
    expect((await box(page, '.home-search .busqueda-input-row')).height).toBe(48);

    // La bienvenida no se cerró: sigue montada, oculta, con su cierre fuera del tabulador.
    await expect(page.locator('[data-welcome-banner]')).toHaveCount(1);
    await expect(page.locator('[data-welcome-banner]')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Cerrar bienvenida' })).toHaveCount(0);

    // Una sola instancia del campo, y es el mismo nodo (no se remontó).
    await expect(page.locator('canvas.ui-campo-pulso')).toHaveCount(1);
    expect(await page.locator('canvas.ui-campo-pulso').evaluate((node) => (node as unknown as { __mismo?: boolean }).__mismo === true)).toBe(true);

    // Volver arriba no la reexpande: se queda reducida para esta visita.
    await wheel(page, -3000);
    await expect.poll(() => scrollY(page)).toBe(0);
    expect(await franjaForma(page)).toBe('reducida');
    expect((await box(page, '.franja')).height).toBe(120);
    await expect(page.locator('[data-welcome-banner]')).toBeHidden();

    // La reducción solo leyó el scroll.
    expect((await scrollWrites(page)).length).toBe(escriturasAntes);
  });

  test('subir primero no reduce: solo cuenta el scroll hacia abajo que pasa el umbral', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('.card--grid').first()).toBeVisible();
    await wheel(page, -400);
    await page.waitForTimeout(150);
    expect(await franjaForma(page)).toBe('bienvenida');
  });

  test('con un botón del puntero pulsado no reduce: lo hace al soltar, para no mover el destino del clic', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('.card--grid').first()).toBeVisible();
    await page.mouse.move(700, 600);
    await page.mouse.down();
    await page.mouse.wheel(0, 300);
    await expect.poll(() => scrollY(page)).toBeGreaterThan(48);
    await page.waitForTimeout(150);
    expect(await franjaForma(page)).toBe('bienvenida');
    await page.mouse.up();
    await expect(page.locator('.franja')).toHaveAttribute('data-franja', 'reducida');
  });

  test('un salto que deja la franja fuera de la vista espera a que el scroll se asiente', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('.card--grid').first()).toBeVisible();
    await page.evaluate(() => window.scrollTo({ top: 1400, behavior: 'instant' }));
    await expect.poll(() => scrollY(page)).toBeGreaterThan(1000);
    // Todavía no: la reducción espera al reposo del scroll (150 ms).
    expect(await franjaForma(page)).toBe('bienvenida');
    await expect(page.locator('.franja')).toHaveAttribute('data-franja', 'reducida');
    expect(await page.locator('.franja').evaluate((node) => node.getAnimations().length)).toBe(0);
  });

  test('la URL, el historial y la sesión de la bienvenida no cambian al reducir', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('.card--grid').first()).toBeVisible();
    const snapshot = () => page.evaluate(() => ({
      href: location.href,
      length: history.length,
      state: JSON.stringify(history.state),
      session: JSON.stringify(Object.entries(sessionStorage).sort())
    }));
    const antes = await snapshot();

    await wheel(page, 300);
    await expect(page.locator('.franja')).toHaveAttribute('data-franja', 'reducida');
    await wheel(page, -3000);
    await expect.poll(() => scrollY(page)).toBe(0);
    expect(await snapshot()).toEqual(antes);
  });

  test('con movimiento: la grilla no salta (su posición en el documento solo baja de la de partida a la final) y no queda ninguna animación', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    await expect(page.locator('.card--grid').first()).toBeVisible();
    await page.locator('canvas.ui-campo-pulso').evaluate((node) => { (node as unknown as { __mismo: boolean }).__mismo = true; });
    const docTop = () => page.locator('.resultados__grid').evaluate((node) => node.getBoundingClientRect().top + window.scrollY);
    const inicio = await docTop();

    // Muestrea cada cuadro la posición de la grilla en coordenadas de documento.
    await page.evaluate(() => {
      const muestras: number[] = [];
      (window as unknown as { __muestras: number[] }).__muestras = muestras;
      const grid = document.querySelector('.resultados__grid')!;
      const tick = () => {
        muestras.push(grid.getBoundingClientRect().top + window.scrollY);
        if (muestras.length < 120) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await wheel(page, 120);
    await expect(page.locator('.franja')).toHaveAttribute('data-franja', 'reducida');
    await expect.poll(() => page.evaluate(() => (window as unknown as { __muestras: number[] }).__muestras.length)).toBeGreaterThanOrEqual(120);
    await settled(page);

    const muestras = await page.evaluate(() => (window as unknown as { __muestras: number[] }).__muestras);
    const final = await docTop();
    expect(final).toBeLessThan(inicio - 300);
    // Nunca por encima de la partida ni por debajo de la meta, y siempre bajando.
    const saltos = muestras.flatMap((y, i) => (
      y > inicio + 1 || y < final - 1 || (i > 0 && y > muestras[i - 1] + 1) ? [`#${i}: ${Math.round(y)}`] : []
    ));
    expect(saltos, `inicio ${Math.round(inicio)}, final ${Math.round(final)}, muestras ${muestras.map(Math.round).join(' ')}`).toEqual([]);
    // El primer cuadro tras reducir parte de donde estaba: sin salto inicial.
    expect(muestras.some((y) => y < inicio - 1)).toBe(true);
    await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);
    expect(await franjaForma(page)).toBe('reducida');
    expect((await box(page, '.franja')).height).toBe(120);
    expect(await page.locator('canvas.ui-campo-pulso').evaluate((node) => (node as unknown as { __mismo?: boolean }).__mismo === true)).toBe(true);
  });

  test('con movimiento: en el instante cero la grilla y el campo están donde estaban (sin salto de partida)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    await expect(page.locator('.card--grid').first()).toBeVisible();
    const medir = () => page.evaluate(() => {
      const doc = (selector: string) => {
        const rect = document.querySelector(selector)!.getBoundingClientRect();
        return { x: Math.round(rect.left + window.scrollX), y: Math.round(rect.top + window.scrollY), w: Math.round(rect.width) };
      };
      return { grilla: doc('.resultados__grid'), campo: doc('.home-search__field'), franja: Math.round(document.querySelector('.franja')!.getBoundingClientRect().height) };
    });
    await settled(page);
    const antes = await medir();

    // Congela las animaciones en su primer fotograma justo al reducir.
    await page.evaluate(() => {
      const congelar = () => {
        const propias = (animacion: Animation) => {
          const objetivo = (animacion.effect as KeyframeEffect | null)?.target as Element | null;
          return !!objetivo && !!objetivo.closest('.franja, .home-search') && !objetivo.closest('.franja__campo');
        };
        const animaciones = document.getAnimations().filter(propias);
        if (!animaciones.some((animacion) => (animacion.effect as KeyframeEffect).target?.classList.contains('franja'))) return requestAnimationFrame(congelar);
        for (const animacion of animaciones) { animacion.pause(); animacion.currentTime = 0; }
        (window as unknown as { __congeladas: number }).__congeladas = animaciones.length;
      };
      requestAnimationFrame(congelar);
    });
    await wheel(page, 120);
    await expect.poll(() => page.evaluate(() => (window as unknown as { __congeladas?: number }).__congeladas ?? 0)).toBeGreaterThanOrEqual(4);
    const cero = await medir();
    expect(cero.franja).toBe(antes.franja);
    expect(Math.abs(cero.grilla.y - antes.grilla.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(cero.campo.y - antes.campo.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(cero.campo.x - antes.campo.x)).toBeLessThanOrEqual(1);
    expect(cero.campo.w).toBe(antes.campo.w);
  });

  test('la paginación desde abajo aterriza con el cabecero visible y la grilla justo debajo', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    await expect(page.locator('.card--grid').first()).toBeVisible();
    const next = page.getByRole('navigation', { name: 'Paginación inferior de resultados' }).getByRole('button', { name: 'Página siguiente' });
    await next.scrollIntoViewIfNeeded();
    await next.click();
    await expect(page).toHaveURL(/[?&]p=2/);
    await expect(page.locator('.franja')).toHaveAttribute('data-franja', 'reducida');
    await settled(page);

    await expect.poll(async () => {
      const grid = await box(page, '.resultados__grid');
      const header = await box(page, 'header.site-header');
      return header.top === 0 && grid.top >= header.bottom && grid.top <= header.bottom + 48;
    }, { timeout: 5000 }).toBe(true);
    await expect(page.locator('header.site-header')).toHaveAttribute('data-header-visible', 'true');
  });

  test('la paginación sin haber hecho scroll reduce la franja antes de medir y aterriza igual que desde abajo', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await spyScrollWrites(page);
    await page.goto('/');
    await expect(page.locator('.card--grid').first()).toBeVisible();
    expect(await franjaForma(page)).toBe('bienvenida');
    const margen = await page.locator('.resultados__grid').evaluate((node) => parseFloat(getComputedStyle(node).scrollMarginTop));

    await page.getByRole('navigation', { name: 'Paginación superior de resultados' }).getByRole('button', { name: 'Página siguiente' }).click();
    await expect(page).toHaveURL(/[?&]p=2/);
    await expect(page.locator('.franja')).toHaveAttribute('data-franja', 'reducida');
    await settled(page);

    // Misma regla que desde abajo: la grilla deja la reserva del cabecero (72) y su
    // margen propio. Bajando, el cabecero se oculta (E14); la reserva sigue ahí.
    await expect.poll(async () => {
      const grid = await box(page, '.resultados__grid');
      const header = await box(page, 'header.site-header');
      return Math.abs(grid.top - (header.height + margen)) <= 1;
    }, { timeout: 5000 }).toBe(true);
    // Solo la paginación escribió el scroll: la reducción no (el resto es de SvelteKit).
    expect((await scrollWrites(page)).filter((name) => !name.endsWith(':kit'))).toEqual(['scrollIntoView']);
  });

  test('sin bienvenida ni nota la banda ya está reducida y el scroll no cambia nada', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?pais=Colombia');
    await expect(page.locator('.card--grid').first()).toBeVisible();
    const antes = await box(page, '.franja');
    await wheel(page, 300);
    await page.waitForTimeout(150);
    expect(await franjaForma(page)).toBe('reducida');
    expect(await page.locator('.franja').getAttribute('data-franja-modo')).toBe('reducida');
    expect((await box(page, '.franja')).height).toBe(antes.height);
  });
});

test.describe('beta con flag activo', () => {
  test.skip(!betaEnabled, 'Estas comprobaciones requieren VITE_BETA_INVITATION_ENABLED=true.');
  test.use({ viewport: { width: 1440, height: 900 } });

  test('la nota beta se reduce igual y no cierra ni limpia beta/nombre de la URL', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?beta=1&nombre=Laura&pais=Colombia');
    await expect(page.locator('[data-beta-invitation]')).toBeVisible();
    await expect(page.locator('.card--grid').first()).toBeVisible();
    const historyBefore = await page.evaluate(() => history.length);
    const urlBefore = page.url();
    expect((await box(page, '.franja')).height).toBeGreaterThanOrEqual(460);

    await wheel(page, 300);
    await expect(page.locator('.franja')).toHaveAttribute('data-franja', 'reducida');
    await expect.poll(async () => (await box(page, '.franja')).height).toBe(120);
    await expect(page.locator('[data-beta-invitation]')).toHaveCount(1);
    await expect(page.locator('[data-beta-invitation]')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Cerrar invitación beta' })).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1, name: 'Explora la biblioteca' })).toBeVisible();
    expect((await box(page, '.home-search__field')).width).toBe(420);

    await wheel(page, -3000);
    await expect.poll(() => scrollY(page)).toBe(0);
    expect(page.url()).toBe(urlBefore);
    expect(page.url()).toContain('beta=1');
    expect(page.url()).toContain('nombre=Laura');
    expect(await page.evaluate(() => history.length)).toBe(historyBefore);
  });
});

test.describe('móvil 390', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('no hay banda reducida: la bienvenida no cambia ni empuja con el scroll', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('[data-welcome-banner]')).toBeVisible();
    await expect(page.locator('.card--grid').first()).toBeVisible();
    const docTop = (selector: string) => page.locator(selector).first().evaluate((node) => Math.round(node.getBoundingClientRect().top + window.scrollY));
    const antes = { franja: await box(page, '.franja'), grilla: await docTop('.resultados__grid') };

    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(200);
    await page.evaluate(() => window.scrollTo(0, 120));
    await page.waitForTimeout(150);

    expect(await franjaForma(page)).toBe('bienvenida');
    expect(await docTop('.resultados__grid')).toBe(antes.grilla);
    await page.evaluate(() => window.scrollTo(0, 0));
    expect((await box(page, '.franja')).height).toBe(antes.franja.height);
    await expect(page.locator('[data-welcome-banner]')).toBeVisible();
    await expect(page.locator('.home-search__titulo')).toHaveCount(0);
  });
});
