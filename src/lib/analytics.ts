// Google Analytics 4 con consentimiento previo.
//
// GA4 deja cookies propias (_ga, _ga_*) que no son necesarias para que el sitio
// funcione, así que solo se cargan si la persona lo acepta. Modo «básico» de
// Consent Mode: sin aceptación no se descarga gtag.js ni sale ninguna
// petición a Google (tampoco pings sin cookies).
//
// Las vistas de página se envían a mano, una por cambio de ruta (afterNavigate
// en el layout): los filtros del inicio y la ficha modal cambian la query con
// pushState, y contarlos como páginas inflaría las vistas. En el flujo de
// datos de GA4 hay que desactivar «Cambios de página basados en eventos del
// historial del navegador» (Medición mejorada) para no contar dos veces.
//
// Sin VITE_GA_MEASUREMENT_ID (desarrollo, CI, pruebas) no hay nada: ni barra
// ni script.

import { writable } from 'svelte/store';

export type AnalyticsConsent = 'granted' | 'denied';

const MEASUREMENT_ID = (import.meta.env.VITE_GA_MEASUREMENT_ID ?? '').trim();
export const CONSENT_KEY = 'discotica:consent:analytics:v1';

export const analyticsEnabled = /^G-[A-Z0-9]+$/.test(MEASUREMENT_ID);

/** null: todavía no ha elegido (se muestra la barra). */
export const analyticsConsent = writable<AnalyticsConsent | null>(readConsent());

type Gtag = (...args: unknown[]) => void;
type GtagWindow = Window & { dataLayer?: unknown[]; gtag?: Gtag };

let loaded = false;
let lastPath: string | null = null;

function readConsent(): AnalyticsConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

function gtag(...args: unknown[]): void {
  const w = window as GtagWindow;
  w.dataLayer = w.dataLayer ?? [];
  // gtag.js espera el objeto `arguments`, no un arreglo.
  w.gtag = w.gtag ?? function () { (w.dataLayer as unknown[]).push(arguments); };
  w.gtag(...args);
}

function load(): void {
  if (loaded || !analyticsEnabled) return;
  loaded = true;
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'granted'
  });
  gtag('js', new Date());
  gtag('config', MEASUREMENT_ID, { send_page_view: false, anonymize_ip: true });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
  document.head.append(script);
}

/** Guarda la elección. Aceptar carga GA y cuenta la página actual. */
export function setAnalyticsConsent(value: AnalyticsConsent): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // Sin almacenamiento la elección dura lo que la pestaña.
  }
  analyticsConsent.set(value);
  if (value === 'granted') {
    load();
    lastPath = null;
    trackPageView();
    return;
  }
  if (loaded) {
    // Retirar el consentimiento: GA deja de escribir cookies desde ya y se
    // borran las que dejó. La página no vuelve a cargarlo en la próxima visita.
    gtag('consent', 'update', { analytics_storage: 'denied' });
    clearGaCookies();
  }
}

/** Llamar al montar el layout: si ya había aceptado, carga GA. */
export function initAnalytics(): void {
  if (analyticsEnabled && readConsent() === 'granted') load();
}

/** Una vista por ruta; los cambios solo de query no cuentan. */
export function trackPageView(): void {
  if (!loaded) return;
  const { pathname } = window.location;
  if (pathname === lastPath) return;
  lastPath = pathname;
  gtag('event', 'page_view', {
    page_location: `${window.location.origin}${pathname}`,
    page_path: pathname,
    page_title: document.title
  });
}

function clearGaCookies(): void {
  const host = window.location.hostname;
  const domains = ['', host, `.${host}`, `.${host.split('.').slice(-2).join('.')}`];
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0]?.trim();
    if (!name || !(name === '_ga' || name.startsWith('_ga_'))) continue;
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ''}`;
    }
  }
}
