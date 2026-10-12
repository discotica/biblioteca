// Suite de regresión visual del censo de interfaz (2026-10-03), etapa U1.
// Cada test es una captura con el mismo ID del censo. Cómo usarla en cada etapa:
// tests/visual/README.md. Resumen:
//   antes de editar   npm run visual:compare   → debe dar 0 diferencias
//   después de editar npm run visual:compare   → solo cambian capturas del alcance
//   al cerrar         npm run visual:capture   → nueva línea base, si la etapa cambia la interfaz a propósito
import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page, type PageAssertionsToHaveScreenshotOptions } from '@playwright/test';
import { installNetwork, type MockOptions } from './support/mocks';
import { hasWorkSans, loadLazyImages, prepareContext, settle, waitNetworkIdle, waitRendered } from './support/stabilize';
import { ARTIST_SLUG, LABEL_SLUG, VARIOS_CARD_TITLE, pick, sample, type Role } from './support/data';

const BASE = `http://127.0.0.1:${process.env.VISUAL_PORT}`;
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

type Vp = 'D' | 'T' | 'M';
const VP = {
  D: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  T: { viewport: { width: 834, height: 1112 }, deviceScaleFactor: 1, hasTouch: true },
  M: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }
} as const;

type Shot = {
  id: string;
  vp: Vp;
  url: string;
  role?: Role;
  /** Sin la marca de bienvenida atendida (primera entrada de la pestaña). */
  fresh?: boolean;
  mock?: MockOptions;
  /** Antes de navegar (p. ej. otro tamaño de viewport). */
  before?: (page: Page) => Promise<void>;
  /** Selector que confirma el estado a capturar. */
  ready?: string;
  /** Interacción posterior a la carga. */
  setup?: (page: Page) => Promise<void>;
  /** Captura de un elemento en lugar de la página. */
  selector?: string;
  full?: boolean;
  maxH?: number;
  /** Estado intermedio: no espera reposo de red (carga en curso). */
  loading?: boolean;
  /** Página local en lugar de una ruta de la app (correos). */
  html?: () => string;
  /** Motivo por el que la captura no se estabiliza. Se compara, pero no hace fallar la corrida. */
  unstable?: string;
  /** Captura del anexo que no figura en el censo. */
  supplementary?: boolean;
};

// ---------- lista de capturas ----------
const S: Shot[] = [];
const add = (id: string, vp: Vp, url: string, o: Partial<Shot> = {}) => S.push({ id, vp, url, ...o });
const each = (vps: Vp[], id: string, url: string, o: Partial<Shot> = {}) => vps.forEach((vp) => add(`${id}-${vp}`, vp, url, o));

const B = pick.collab.slug; // Bandcamp, 1 principal + 9 colaboradores
const COMP = pick.compilado.slug;
const SPOT = pick.spotify.slug;
const LONG = pick.longTitle.slug;
const CATALOG_READY = '.resultados__grid, .resultados__vacio, .resultados__error';
const MODAL_READY = '[role="dialog"] .release-detail';

// U10b: el campo de texto es el disparador del panel.
const openSearch = async (page: Page) => { await page.click('.home-search .busqueda-input'); await page.waitForSelector('#panel-busqueda'); await settle(page); };
// U10b-2: el botón Filtros de la barra abre la hoja.
const openSheet = async (page: Page) => { await page.click('.mobile-search-filters button'); await page.waitForSelector('.filtros-mobile-sheet'); await settle(page); };
const scrollModalBottom = async (page: Page) => {
  await page.evaluate(() => {
    document.querySelectorAll('[data-release-scroll-region], .release-detail__info, .release-detail__layout').forEach((el) => el.scrollTo(0, el.scrollHeight));
  });
  await settle(page);
};
const holdCatalog: MockOptions = {
  override: async ({ path: p }) => {
    if (!p.includes('catalog_releases')) return false;
    await new Promise(() => {}); // la carga nunca termina: estado "cargando"
    return true;
  }
};
const failCatalog: MockOptions = {
  override: async ({ path: p, route }) => {
    if (!p.includes('catalog_releases')) return false;
    await route.abort('failed');
    return true;
  }
};

// Inicio
each(['D', 'M'], 'home-welcome', '/', { fresh: true });
each(['D', 'M'], 'home-beta', '/?beta=1&nombre=Laura', { fresh: true });
each(['D', 'T', 'M'], 'home', '/');
each(['D', 'T', 'M'], 'home-full', '/', { full: true, maxH: 4200 });
add('home-loading-D', 'D', '/', { loading: true, ready: '.loader', mock: holdCatalog });
add('home-error-D', 'D', '/', { ready: '.resultados__error', mock: failCatalog });
add('home-search-D', 'D', '/', { setup: openSearch, full: true, maxH: 1700 });
add('home-search-suggest-D', 'D', '/', { setup: async (page) => { await openSearch(page); await page.fill('.home-search .busqueda-input', 'trib'); await page.waitForSelector('#sugerencias-busqueda'); await settle(page); } });
add('home-search-pais-D', 'D', '/', { setup: async (page) => { await openSearch(page); await page.click('.cloud-dropdown summary'); await settle(page); } });
add('home-search-tipo-D', 'D', '/', { setup: async (page) => { await openSearch(page); await page.click('.filtros-grilla .campo details.dropdown summary'); await settle(page); } });
each(['D', 'M'], 'home-filtered', '/?genero=Techno&genero=Tribal&pais=Colombia&texto=entra%C3%B1as&a%C3%B1o=2025');
add('home-filtered-panel-D', 'D', '/?genero=Techno&pais=Colombia', { setup: openSearch, full: true, maxH: 1800 });
add('home-radar-D', 'D', '/?radar_bailable=5&radar_rapido=4&radar_denso=3', { setup: openSearch, full: true, maxH: 1900 });
add('home-radar-results-D', 'D', '/?radar_bailable=5&radar_rapido=4&radar_denso=3');
add('home-approx-D', 'D', '/?genero=Cumbia&pais=Chile&a%C3%B1o=2019&type=Single');
add('home-empty-D', 'D', '/?texto=zzqxwvkkk');
add('home-page2-D', 'D', '/?p=2', { full: true, maxH: 2600 });
add('home-pagination-D', 'D', '/', { selector: '.resultados__paginacion-inferior', setup: async (page) => { await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await settle(page); } });
add('home-sheet-M', 'M', '/', { setup: openSheet });
// U10: modo lista (el selector está en la barra en desktop y junto a «Buscar» en móvil) y carga en móvil.
add('home-list-D', 'D', '/', { supplementary: true, setup: async (page) => { await page.click('.results-bar .ui-view-toggle [aria-label="Lista"]'); await page.waitForSelector('.resultados__grid .fila'); await settle(page); } });
add('home-list-M', 'M', '/', { supplementary: true, setup: async (page) => { await page.click('.mobile-search-row [aria-label="Lista"]'); await page.waitForSelector('.resultados__grid .fila'); await settle(page); } });
add('home-loading-M', 'M', '/', { supplementary: true, loading: true, ready: '.loader', mock: holdCatalog });
add('home-sheet-radar-M', 'M', '/', {
  setup: async (page) => {
    await openSheet(page);
    await page.evaluate(() => { const b = document.querySelector('.ui-sheet__body'); b?.scrollTo(0, b.scrollHeight); });
    await settle(page);
  }
});
add('home-sheet-filtered-M', 'M', '/?genero=Techno&genero=Tribal&pais=Colombia&a%C3%B1o=2025', { setup: openSheet });
add('home-sheet-pais-M', 'M', '/', { setup: async (page) => { await openSheet(page); await page.click('.filtros-mobile-sheet .cloud-dropdown summary'); await settle(page); } });
add('home-scrolled-M', 'M', '/', {
  supplementary: true,
  setup: async (page) => {
    await page.evaluate(() => scrollTo(0, 1500));
    await settle(page);
    await page.evaluate(() => scrollTo(0, 1350));
    await settle(page);
  }
});

// Tarjeta
const card = (n: number) => `.resultados__grid > article:nth-of-type(${n})`;
add('card-grid-D', 'D', '/', { selector: card(1) });
add('card-hover-D', 'D', '/', { selector: card(1), setup: async (page) => { await page.hover(`${card(1)} .portada`); await settle(page); } });
add('card-collab-D', 'D', '/', { selector: card(2) });
add('card-two-D', 'D', '/', { selector: card(3) });
add('card-varios-open-D', 'D', '/', {
  setup: async (page) => {
    const trigger = page.locator('.resultados__grid > article').filter({ hasText: VARIOS_CARD_TITLE }).locator('.ui-menu__trigger');
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    await settle(page);
  }
});
const scrollToGrid = async (page: Page) => { await page.evaluate(() => document.querySelector('.resultados__grid')?.scrollIntoView()); await settle(page); };
add('card-row-D', 'D', '/', { setup: scrollToGrid });
add('card-row-M', 'M', '/', { setup: async (page) => { await page.evaluate(() => document.querySelector('.resultados__grid > article:nth-of-type(2)')?.scrollIntoView()); await settle(page); } });
add('card-row-T', 'T', '/', { setup: scrollToGrid });

// Modal
each(['D', 'T', 'M'], 'modal', `/?modal=${B}`, { ready: MODAL_READY });
each(['D', 'M'], 'modal-bottom', `/?modal=${B}`, { ready: MODAL_READY, setup: scrollModalBottom });
add('modal-mid-M', 'M', `/?modal=${B}`, { ready: MODAL_READY, setup: async (page) => { await page.evaluate(() => { document.querySelectorAll('.release-detail__layout').forEach((el) => el.scrollTo(0, 700)); }); await settle(page); } });
// U9: la ficha ya no resume con "Varios artistas"; el Compilado muestra todos los créditos por rol.
add('modal-varios-D', 'D', `/?modal=${COMP}`, { ready: `${MODAL_READY} [data-release-credits]` });
add('modal-radar-D', 'D', `/?modal=${B}`, { ready: MODAL_READY, setup: async (page) => { await page.hover('.release-detail__cover'); await settle(page); } });
add('modal-spotify-D', 'D', `/?modal=${SPOT}`, { ready: MODAL_READY });
add('modal-soundcloud-D', 'D', `/?modal=${pick.soundcloud.slug}`, { ready: MODAL_READY });
add('modal-review-D', 'D', `/?modal=${pick.review.slug}`, { ready: MODAL_READY });
add('modal-longtitle-D', 'D', `/?modal=${LONG}`, { ready: MODAL_READY });
add('modal-nocover-D', 'D', `/?modal=${pick.noCover.slug}`, { ready: MODAL_READY });
add('modal-1100-D', 'D', `/?modal=${B}`, { ready: MODAL_READY, before: async (page) => page.setViewportSize({ width: 1100, height: 760 }) });
add('modal-crate-D', 'D', `/?modal=${B}`, { role: 'comunidad', ready: MODAL_READY, setup: async (page) => { await page.click('.btn-add-crate'); await settle(page); } });
add('modal-tablet-landscape-T', 'T', `/?modal=${B}`, { ready: MODAL_READY, before: async (page) => page.setViewportSize({ width: 1112, height: 834 }) });
add('debug-modal-overlap', 'D', `/?modal=${B}`, {
  ready: MODAL_READY,
  // Diagnóstico del censo: naranja = columna de portada, azul = portada, rojo = marco del reproductor.
  // Contornos hacia dentro: no alteran el layout que se diagnostica.
  setup: async (page) => {
    await page.addStyleTag({ content: `
      .release-detail__cover-column{outline:4px solid #ff8a00!important;outline-offset:-4px}
      .release-detail__cover{outline:4px solid #2f7bff!important;outline-offset:-4px}
      .release-player__frame{outline:4px solid #ff2b2b!important;outline-offset:-4px}` });
    await settle(page);
  }
});

// Ficha página
each(['D', 'M'], 'ficha', `/lanzamiento/${B}`, { ready: '.release-detail', full: true, maxH: 3000 });
add('ficha-comp-D', 'D', `/lanzamiento/${COMP}`, { ready: '.release-detail', full: true, maxH: 2400 });

// Header / footer
add('header-menu-D', 'D', '/', { setup: async (page) => { await page.click('.menu-trigger'); await settle(page); } });
add('header-menu-M', 'M', '/', { setup: async (page) => { await page.click('.hamburger'); await settle(page); } });
add('header-auth-D', 'D', '/', { role: 'comunidad', selector: '.site-header' });
add('header-auth-menu-M', 'M', '/', { role: 'comunidad', setup: async (page) => { await page.click('.hamburger'); await settle(page); } });
add('header-anon-D', 'D', '/', { selector: '.site-header' });
add('footer-D', 'D', '/', { selector: 'footer' });
add('footer-M', 'M', '/', { selector: 'footer' });
// U7: menú de cuenta del avatar (desktop) y acceso al Estudio desde el perfil propio.
add('header-account-menu-D', 'D', '/', { role: 'comunidad', supplementary: true, setup: async (page) => { await page.click('.account-menu .ui-menu__trigger'); await page.waitForSelector('[role=menu]'); await settle(page); } });

// Taxonomías
each(['D', 'M'], 'artista', `/artista/${ARTIST_SLUG}`, { full: true, maxH: 3000 });
each(['D', 'M'], 'sello', `/sello/${LABEL_SLUG}`, { full: true, maxH: 3000 });

// Cuenta
const fillRegistro = async (page: Page, valueFor: (type: string | null, index: number, autocomplete: string) => string | null) => {
  // Las redes (U12) son opcionales: el relleno las deja vacías.
  const inputs = page.locator('form input:not([name^="social_"])');
  const n = await inputs.count();
  for (let i = 0; i < n; i++) {
    const el = inputs.nth(i);
    const type = await el.getAttribute('type');
    const value = valueFor(type, i, (await el.getAttribute('autocomplete')) || '');
    if (type === 'checkbox') { if (value) await el.check(); continue; }
    if (value != null) await el.fill(value);
  }
};
each(['D', 'M'], 'login', '/auth/login');
add('login-error-D', 'D', '/auth/login', {
  setup: async (page) => {
    await page.fill('input[type=text], input[autocomplete=username], input:not([type=password])', 'usuario');
    await page.fill('input[type=password]', 'malacontraseña');
    await page.click('button[type=submit]');
    await page.waitForSelector('.error-msg, [role=alert]');
    await settle(page);
  }
});
each(['D', 'M'], 'registro', '/auth/registro', { full: true });
add('registro-filled-D', 'D', '/auth/registro', {
  full: true,
  setup: async (page) => {
    await fillRegistro(page, (type, i, ac) => type === 'checkbox' ? null : type === 'email' ? 'nueva@example.test' : type === 'password' ? 'una-contraseña' : /user/.test(ac) || i === 0 ? 'usuario_tomado' : 'Nueva Persona');
    await page.locator('form input').first().blur();
    await settle(page);
  }
});
add('registro-error-D', 'D', '/auth/registro', {
  full: true,
  setup: async (page) => {
    let pw = 0;
    await fillRegistro(page, (type) => type === 'checkbox' ? null : type === 'email' ? 'nueva@example.test' : type === 'password' ? (pw++ ? 'distinta-1' : 'una-contraseña') : 'nueva_persona');
    await page.click('button[type=submit]');
    await settle(page);
  }
});
add('registro-success-D', 'D', '/auth/registro', {
  full: true,
  setup: async (page) => {
    await fillRegistro(page, (type) => type === 'checkbox' ? 'check' : type === 'email' ? 'nueva@example.test' : type === 'password' ? 'una-contraseña' : 'nueva_persona_x');
    await settle(page);
    await page.click('button[type=submit]');
    await page.waitForSelector('form', { state: 'detached' }).catch(() => {});
    await settle(page);
  }
});
each(['D', 'M'], 'recuperar', '/auth/recuperar');
add('recuperar-sent-D', 'D', '/auth/recuperar', {
  setup: async (page) => {
    await page.fill('input[type=email]', 'nueva@example.test');
    await page.click('button[type=submit]');
    await settle(page);
  }
});
add('reset-error-D', 'D', '/auth/reset');
each(['D', 'M'], 'reset-recovery', '/auth/reset?type=recovery');
add('reset-signup-D', 'D', '/auth/reset?flow=signup&type=signup', { supplementary: true });
// U12: "Revisa tu correo" (tras el alta y sin correo conocido), aviso de cuenta confirmada y editar cuenta.
add('confirmar-M', 'M', '/auth/registro', {
  supplementary: true,
  setup: async (page) => {
    await fillRegistro(page, (type) => type === 'checkbox' ? 'check' : type === 'email' ? 'nueva@gmail.com' : type === 'password' ? 'una-contraseña' : 'nueva_persona_x');
    await page.click('button[type=submit]');
    await page.waitForURL('**/auth/confirmar');
    await settle(page);
  }
});
add('confirmar-sin-correo-D', 'D', '/auth/confirmar', { supplementary: true });
add('miscrates-confirmada-D', 'D', '/mis-colecciones?aviso=cuenta-confirmada', { role: 'comunidad', supplementary: true, ready: '.crates-grid' });
each(['D', 'M'], 'cuenta', '/cuenta', { role: 'comunidad', full: true, ready: '.account-sections', supplementary: true });

// Correos: reconstrucción de las plantillas por defecto de Supabase (no hay plantillas en el repositorio).
// Si supabase/config.toml declara content_path para confirmation/recovery, se captura esa plantilla.
function emailTemplate(kind: 'confirmation' | 'recovery') {
  const config = fs.readFileSync(path.join(ROOT, 'supabase/config.toml'), 'utf8');
  const block = config.match(new RegExp(`^\\[auth\\.email\\.template\\.${kind}\\]([\\s\\S]*?)(?=^\\[)`, 'm'))?.[1] ?? '';
  const subject = block.match(/^subject\s*=\s*"(.*)"/m)?.[1];
  const contentPath = block.match(/^content_path\s*=\s*"(.*)"/m)?.[1];
  const custom = contentPath && fs.existsSync(path.join(ROOT, contentPath)) ? fs.readFileSync(path.join(ROOT, contentPath), 'utf8') : null;
  const defaults = {
    confirmation: { subject: 'Confirm Your Signup', body: '<h2>Confirm your signup</h2>\n<p>Follow this link to confirm your user:</p>\n<p><a href="{{ .ConfirmationURL }}">Confirm your mail</a></p>' },
    recovery: { subject: 'Reset Your Password', body: '<h2>Reset Password</h2>\n<p>Follow this link to reset the password for your user:</p>\n<p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>' }
  }[kind];
  const body = (custom ?? defaults.body)
    .replaceAll('{{ .ConfirmationURL }}', 'https://discotica.com/auth/reset?flow=signup')
    .replaceAll('{{ .Email }}', 'nueva@example.test')
    .replaceAll('{{ .SiteURL }}', 'https://discotica.com');
  const from = custom ? 'Discótica <hola@discotica.com>' : 'Supabase Auth &lt;noreply@mail.app.supabase.io&gt;';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;background:#e9e9e9;font:14px/1.4 Arial,sans-serif;color:#222}
    .client{max-width:760px;margin:32px auto;background:#fff;border:1px solid #ccc}
    .meta{padding:16px 20px;border-bottom:1px solid #ddd;background:#f7f7f7}.meta div{margin:2px 0}.meta b{display:inline-block;width:64px;color:#666;font-weight:normal}
    .mail{padding:20px}</style></head><body><div class="client"><div class="meta">
    <div><b>De</b>${from}</div><div><b>Para</b>nueva@example.test</div><div><b>Asunto</b>${subject ?? defaults.subject}</div>
    </div><div class="mail">${body}</div></div></body></html>`;
}
add('email-confirm', 'D', 'about:blank', { html: () => emailTemplate('confirmation') });
add('email-reset', 'D', 'about:blank', { html: () => emailTemplate('recovery') });

// Comunidad
const detect = async (page: Page) => {
  await page.fill('input[type=url], input[name*=source], form input', 'https://artista.bandcamp.com/album/propuesta');
  await page.getByRole('button', { name: /Detectar|Leer|Buscar datos/i }).first().click();
  await settle(page);
  await waitRendered(page);
};
each(['D', 'M'], 'sugerir-anon', '/sugerir');
each(['D', 'M'], 'sugerir', '/sugerir', { role: 'comunidad', full: true });
each(['D', 'M'], 'sugerir-detected', '/sugerir', { role: 'comunidad', full: true, setup: detect });
add('sugerir-admin-D', 'D', '/sugerir', { role: 'admin' });
each(['D', 'M'], 'reportar', `/reportar?release_id=${sample[3].id}`, { role: 'comunidad', full: true });
add('reportar-anon-D', 'D', '/reportar', { supplementary: true });

// Crates y perfil
add('miscrates-anon-D', 'D', '/mis-colecciones', { supplementary: true });
each(['D', 'M'], 'miscrates', '/mis-colecciones', { role: 'comunidad', full: true });
add('miscrates-empty-D', 'D', '/mis-colecciones', { role: 'comunidad', mock: { noCrates: true } });
each(['D', 'M'], 'crate-crear', '/mis-colecciones?crear=1', { role: 'comunidad' });
each(['D', 'M'], 'crate', '/coleccion/para-abrir-el-set?usuario=comunidad', { role: 'comunidad', full: true });
each(['D', 'M'], 'perfil', '/perfil/comunidad', { role: 'comunidad', full: true });
add('perfil-admin-D', 'D', '/perfil/jmamanche', { role: 'admin', ready: '.studio', full: true, supplementary: true });
add('perfil-colab-M', 'M', '/perfil/colaboradora', { role: 'colaborador', ready: '.studio', full: true, supplementary: true });
// U14: mis aportes, perfil visto por otra persona, colección en lista, de visitante y acciones.
const CRATE_URL = '/coleccion/para-abrir-el-set?usuario=comunidad';
const listView = async (page: Page) => {
  await page.getByRole('button', { name: 'Lista', exact: true }).click();
  await page.mouse.move(0, 0);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await settle(page);
};
each(['D', 'M'], 'aportes', '/mis-aportes', { role: 'comunidad', ready: '.aportes', full: true, supplementary: true });
add('aportes-anon-D', 'D', '/mis-aportes', { supplementary: true });
each(['D', 'M'], 'perfil-visitante', '/perfil/comunidad', { ready: '#aportes .fila', full: true, supplementary: true });
add('perfil-oculto-D', 'D', '/perfil/colaboradora', { role: 'comunidad', ready: '#colecciones', full: true, supplementary: true });
add('miscrates-T', 'T', '/mis-colecciones', { role: 'comunidad', full: true, supplementary: true });
add('miscrates-menu-D', 'D', '/mis-colecciones', {
  role: 'comunidad', supplementary: true,
  setup: async (page) => { await page.getByRole('button', { name: 'Acciones de «Para abrir el set»' }).click(); await page.waitForSelector('[role=menu]'); await settle(page); }
});
add('crate-T', 'T', CRATE_URL, { role: 'comunidad', full: true, supplementary: true });
each(['D', 'M'], 'crate-lista', CRATE_URL, { role: 'comunidad', full: true, supplementary: true, setup: listView });
each(['D', 'M'], 'crate-visitante', CRATE_URL, { full: true, supplementary: true });
add('crate-editar-D', 'D', CRATE_URL, {
  role: 'comunidad', supplementary: true,
  setup: async (page) => { await page.getByRole('button', { name: 'Editar', exact: true }).click(); await page.waitForSelector('[role=dialog]'); await settle(page); }
});

// Estudio (U15): la estación editorial y la consola viven en /estudio. Los IDs
// del censo se conservan; cada uno apunta a la sección equivalente.
add('editorial-anon-D', 'D', '/estudio/propuestas');
each(['D', 'M'], 'editorial-admin', '/estudio/propuestas', { role: 'admin', full: true, maxH: 4200 });
// "Aprobar" abre el diálogo de resumen desde "Revisar publicación".
add('editorial-approve-D', 'D', '/estudio/propuestas', {
  role: 'admin',
  setup: async (page) => {
    await page.getByRole('button', { name: /Revisar publicación/ }).first().click();
    await page.getByRole('button', { name: /Aprobar y publicar/ }).waitFor();
    await settle(page);
  }
});
add('editorial-colab-D', 'D', '/estudio/propuestas', { role: 'colaborador', full: true, maxH: 3600 });

// Catálogo del Estudio
const STUDIO = '/estudio/catalogo';
const openEditor = async (page: Page) => {
  await page.locator('a[aria-label^="Editar "]').nth(1).click();
  await page.waitForSelector('.editor__head');
  await settle(page);
  await waitRendered(page);
};
add('admin-anon-D', 'D', STUDIO);
add('admin-norole-D', 'D', STUDIO, { role: 'comunidad' });
each(['D', 'T', 'M'], 'admin-list', STUDIO, { role: 'admin', full: true, maxH: 3000 });
// Antes "Filtros" abría un panel; desde U15 los filtros están en la barra.
add('admin-filters-D', 'D', STUDIO, { role: 'admin', setup: async (page) => { await page.getByLabel('Estado').selectOption('draft'); await settle(page); } });
add('admin-selection-D', 'D', STUDIO, {
  role: 'admin',
  setup: async (page) => {
    const boxes = page.locator('tbody input[type=checkbox]');
    await boxes.nth(0).check();
    await boxes.nth(1).check();
    await settle(page);
  }
});
each(['D', 'T'], 'admin-editor', STUDIO, { role: 'admin', full: true, maxH: 4600, setup: openEditor });
add('admin-editor-top-D', 'D', STUDIO, { role: 'admin', setup: openEditor });
add('admin-editor-M', 'M', STUDIO, { role: 'admin', full: true, maxH: 4000, setup: openEditor });
// U16: el historial es la última sección de la página; el índice lleva a ella.
add('admin-history-D', 'D', STUDIO, {
  role: 'admin',
  setup: async (page) => { await openEditor(page); await page.getByRole('navigation', { name: 'Secciones del lanzamiento' }).getByRole('link', { name: /Historial/ }).click(); await settle(page); }
});
add('admin-finder-D', 'D', STUDIO, {
  role: 'admin',
  setup: async (page) => {
    await openEditor(page);
    // U16: cada grupo de créditos busca con el combobox, sin panel aparte.
    const search = page.getByRole('combobox', { name: 'Añadir a artistas principales' });
    await search.scrollIntoViewIfNeeded();
    await search.fill('entr');
    await page.waitForSelector('[role=listbox] [role=option]');
    await settle(page);
  }
});
add('admin-publish-D', 'D', STUDIO, {
  role: 'admin',
  setup: async (page) => {
    await openEditor(page);
    // U16: Archivar está en "Más acciones" y pide antes la observación.
    await page.getByPlaceholder('¿Qué cambió?').fill('Archivo editorial');
    await page.getByRole('button', { name: 'Más acciones' }).click();
    await page.getByRole('menuitem', { name: 'Archivar lanzamiento' }).click();
    await page.waitForSelector('[role=dialog]');
    await settle(page);
  }
});
add('admin-new-D', 'D', STUDIO, { role: 'admin', full: true, maxH: 4000, setup: async (page) => { await page.getByRole('button', { name: /Nuevo/ }).first().click(); await page.waitForSelector('.editor__head'); await settle(page); } });
// U16: móvil edita (antes solo consulta): selector de sección arriba y guardar abajo, fijos.
add('estudio-editor-top-M', 'M', STUDIO, { role: 'admin', supplementary: true, setup: openEditor });
add('estudio-editor-medios-M', 'M', STUDIO, {
  role: 'admin', supplementary: true,
  setup: async (page) => {
    await openEditor(page);
    // El header retoma la referencia de scroll un tick después de cada cambio de
    // foco. selectOption enfoca el selector y salta a la vez, y la captura dependía
    // de quién ganaba; enfocar antes reproduce el orden de una persona (header oculto).
    const section = page.getByLabel('Ir a la sección');
    await section.focus();
    await settle(page);
    await section.selectOption('medios');
    await settle(page);
  }
});
// Géneros y países con el combobox de U6, en lugar de la nube completa.
add('estudio-editor-generos-D', 'D', STUDIO, {
  role: 'admin', supplementary: true,
  setup: async (page) => {
    await openEditor(page);
    const genres = page.getByRole('combobox', { name: 'Géneros' });
    // Enfocar primero: el scroll del foco ocurre con el campo enfocado y el header
    // no se oculta (estado aceptado en U16). Con scrollIntoViewIfNeeded + fill, el
    // header dependía de si el scroll llegaba antes que el foco (ver medios-M).
    await genres.focus();
    await settle(page);
    await genres.fill('tech');
    await page.waitForSelector('[role=listbox] [role=option]');
    await settle(page);
  }
});
add('estudio-editor-guardado-D', 'D', STUDIO, {
  role: 'admin', supplementary: true,
  setup: async (page) => {
    await openEditor(page);
    await page.getByLabel('Título').fill('Killing Mariposas (edición)');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await page.waitForSelector('.editor__feedback--error');
    await settle(page);
  }
});

// U15: vistas rápidas, lote y secciones nuevas del Estudio.
const pickRows = async (page: Page, rows: number[]) => {
  const boxes = page.locator('tbody input[type=checkbox]');
  for (const row of rows) await boxes.nth(row).check();
};
// La fila 25 es el borrador sin portada: el lote de publicar lo marca como incompleto.
const openBatch = (rows: number[], button: 'Publicar' | 'Archivar') => async (page: Page) => {
  await pickRows(page, rows);
  await page.locator('.catalogo__batch').getByRole('button', { name: button }).click();
  await page.waitForSelector('[role=dialog]');
  await settle(page);
};
const batchReply = (applied: boolean): MockOptions => ({
  override: async ({ path: p, request, send }) => {
    if (!p.endsWith('/rpc/admin_batch_update_catalog_releases')) return false;
    const body = request.postDataJSON() as { p_operation: string; p_items: { release_id: string; expected_version: number }[] };
    const items = body.p_items.map((item, index) => applied
      ? { ...item, result: index === 0 ? 'unchanged' : 'applied', catalog_version: item.expected_version + (index === 0 ? 0 : 1), change_set_id: `cs${index}` }
      : index === 1
        ? { ...item, result: 'rejected', error: { code: '40001', message: 'stale' } }
        : index === 2
          ? { ...item, result: 'rejected', error: { code: '22023', message: 'http' } }
          : { ...item, result: 'rolled_back' });
    const count = (result: string) => items.filter((item) => item.result === result).length;
    await send({ applied, operation: body.p_operation, batch_id: applied ? 'b1' : null, requested: items.length, applied_count: count('applied'), unchanged_count: count('unchanged'), rolled_back_count: count('rolled_back'), rejected_count: count('rejected'), items });
    return true;
  }
});
const confirmBatch = async (page: Page) => {
  await page.getByLabel(/Observación del cambio/).fill('Revisión de temporada');
  await page.locator('.ui-dialog__footer').getByRole('button', { name: /^(Publicar|Archivar) \d+$/ }).click();
  await page.waitForSelector('.batch__summary');
  await settle(page);
};
each(['D', 'M'], 'estudio-vista', `${STUDIO}?vista=incompletos`, { role: 'admin', full: true, maxH: 2400, supplementary: true });
add('estudio-lote-D', 'D', STUDIO, { role: 'admin', supplementary: true, setup: openBatch([0, 1, 25], 'Publicar') });
add('estudio-lote-ok-D', 'D', STUDIO, {
  role: 'admin', supplementary: true, mock: batchReply(true),
  setup: async (page) => { await openBatch([0, 1, 3], 'Archivar')(page); await confirmBatch(page); }
});
add('estudio-lote-error-D', 'D', STUDIO, {
  role: 'admin', supplementary: true, mock: batchReply(false),
  setup: async (page) => { await openBatch([0, 1, 3, 4], 'Publicar')(page); await confirmBatch(page); }
});
each(['D', 'M'], 'estudio-reportes', '/estudio/reportes', { role: 'admin', full: true, maxH: 2400, supplementary: true });
// U17: bandeja. En móvil, el detalle abierto (con "Volver"); en tablet, lista y detalle.
const PROPUESTA = '/estudio/propuestas?propuesta=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb03';
add('estudio-propuesta-M', 'M', PROPUESTA, { role: 'admin', full: true, maxH: 3600, supplementary: true });
add('estudio-propuestas-T', 'T', '/estudio/propuestas', { role: 'admin', full: true, maxH: 2400, supplementary: true });
add('estudio-propuesta-nota-D', 'D', PROPUESTA, {
  role: 'admin', supplementary: true,
  setup: async (page) => { await page.getByRole('button', { name: 'Rechazar' }).click(); await page.getByText('Escribe una nota antes de rechazar.').waitFor(); await settle(page); }
});
add('estudio-reporte-M', 'M', '/estudio/reportes?reporte=r1', { role: 'admin', full: true, maxH: 2400, supplementary: true });
add('estudio-colab-catalogo-D', 'D', STUDIO, { role: 'colaborador', supplementary: true });

// Información
each(['D', 'M'], 'manual', '/manual', { full: true, maxH: 5200 });
add('privacidad-D', 'D', '/privacidad', { full: true, maxH: 3600 });
each(['D', 'M'], '404', '/ruta-que-no-existe');

// Primitivas (U5): catálogo interno /lab, fuera de la navegación. Página completa.
each(['D', 'M'], 'lab', '/lab', { full: true, maxH: 10000, ready: '.lab', supplementary: true });
// Primitivas compuestas (U6): solo sus secciones, para que no dependan del largo de las de U5.
each(['D', 'M'], 'lab-u6', '/lab', { selector: '.lab__u6', ready: '.lab__u6', supplementary: true });
each(['D', 'M'], 'lab-u7', '/lab', { selector: '.lab__u7', ready: '.lab__u7', supplementary: true });
each(['D', 'M'], 'lab-u8', '/lab', { selector: '.lab__u8', ready: '.lab__u8', supplementary: true });
each(['D', 'M'], 'lab-u17', '/lab', { selector: '.lab__u17', ready: '.lab__u17', supplementary: true });

// ---------- capturas inestables ----------
// Formato: id → motivo. Se capturan y comparan, pero una diferencia no hace fallar
// la corrida: el informe las lista aparte. Ver README antes de añadir una.
const UNSTABLE: Record<string, string> = {};
for (const shot of S) if (UNSTABLE[shot.id]) shot.unstable = UNSTABLE[shot.id];

// ---------- runner ----------
const isCatalogRoute = (url: string) => url === '/' || url.startsWith('/?');

for (const shot of S) {
  test(shot.id, async ({ browser }, testInfo) => {
    testInfo.annotations.push({ type: 'vista', description: `${shot.vp} · ${shot.role ?? 'anónimo'} · ${shot.url}` });
    if (shot.supplementary) testInfo.annotations.push({ type: 'suplementaria', description: 'Captura del anexo que no figura en el censo.' });
    if (shot.unstable) testInfo.annotations.push({ type: 'inestable', description: shot.unstable });

    const ctx = await browser.newContext({
      ...VP[shot.vp],
      locale: 'es-CO',
      timezoneId: 'America/Bogota',
      colorScheme: 'light',
      reducedMotion: 'reduce'
    });
    await prepareContext(ctx, { fresh: shot.fresh });
    const network = await installNetwork(ctx, BASE, shot.role ?? null, shot.mock);
    const page = await ctx.newPage();
    const t0 = Date.now();
    const step = (label: string) => { if (process.env.VISUAL_DEBUG) console.log(`${shot.id} ${label} ${Date.now() - t0}ms`); };
    try {
      if (shot.before) await shot.before(page);

      if (shot.html) {
        await page.setContent(shot.html(), { waitUntil: 'load' });
      } else {
        await page.goto(BASE + shot.url, { waitUntil: shot.loading ? 'load' : 'networkidle' });
        step('goto');
        if (isCatalogRoute(shot.url) && !shot.loading) await page.waitForSelector(CATALOG_READY);
        if (shot.ready) await page.waitForSelector(shot.ready);
        step('ready');
        if (shot.loading) await page.evaluate(() => document.fonts.ready);
        else await waitRendered(page);
        step('rendered');
        if (!(await hasWorkSans(page))) testInfo.annotations.push({ type: 'fuente-ausente', description: 'Work Sans no está instalada: la captura usa la fuente de respaldo.' });
      }
      if (shot.setup) {
        await shot.setup(page);
        await waitRendered(page);
        step('setup');
      }

      const viewportWidth = page.viewportSize()!.width;
      const options: PageAssertionsToHaveScreenshotOptions = {};
      if (shot.full) {
        await loadLazyImages(page);
        const height = await page.evaluate(() => document.documentElement.scrollHeight);
        options.fullPage = true;
        if (height > (shot.maxH ?? 3200)) options.clip = { x: 0, y: 0, width: viewportWidth, height: shot.maxH ?? 3200 };
      }
      try {
        await (shot.selector ? expect(page.locator(shot.selector).first()) : expect(page)).toHaveScreenshot(`${shot.id}.png`, options);
        step('screenshot');
      } catch (error) {
        if (!shot.unstable) throw error;
        testInfo.annotations.push({ type: 'diferencia-inestable', description: String((error as Error).message).split('\n')[0] });
      }
    } finally {
      if (!shot.loading) await waitNetworkIdle(page, 2_000).catch(() => {});
      for (const entry of network.unmocked) testInfo.annotations.push({ type: 'sin-mock', description: entry });
      for (const entry of network.blocked) testInfo.annotations.push({ type: 'red-bloqueada', description: entry });
      for (const entry of network.writes) testInfo.annotations.push({ type: 'escritura-simulada', description: entry });
      await ctx.close();
    }
  });
}

test('el censo conserva sus 127 IDs', () => {
  const ids = new Set(S.filter((shot) => !shot.supplementary).map((shot) => shot.id));
  expect(ids.size).toBe(127);
  expect(S.length).toBe(new Set(S.map((shot) => shot.id)).size);
});
