// U19 (G2): un solo flujo para crear. Sugerir es la entrada de todos los roles; lo que cambia por
// rol es el envío y la pantalla final. Lógica pura: los RPC y los permisos son del servidor.

import { normalizeSearch } from '../ui/combobox.ts';
import type { SourceDuplicate } from './contributionContract.ts';
import { STUDIO_BASE, studioReleaseHref } from './studio.ts';

export type SuggestRole = 'comunidad' | 'colaborador' | 'admin';

/** «Independiente» es un sello más; en Sugerir aparece fijo al principio de la lista. */
export const INDEPENDENT_LABEL = 'Independiente';

/** Los nombres con «Independiente» primero y sin repetirlo. */
export function pinIndependent(names: readonly string[]): string[] {
  const independent = normalizeSearch(INDEPENDENT_LABEL);
  return [INDEPENDENT_LABEL, ...names.filter((name) => normalizeSearch(name) !== independent)];
}

/** Sin espacios ni signos: «Trip Hop», «trip-hop» y «Triphop» se escriben igual. */
const compact = (text: string) => normalizeSearch(text).replace(/[^\p{L}\p{N}]+/gu, '');
const words = (text: string) => normalizeSearch(text).split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 4);

/**
 * Términos con los que se buscan parecidos en el catálogo: hasta tres palabras de tres letras o
 * más, las más largas primero. «Sello Raro Records» encuentra «Sello Raro» y «Pirañas» encuentra
 * «Los Pirañas». Si el nombre no tiene ninguna, el nombre entero.
 */
export function similarSearchTerms(name: string): string[] {
  const seen = new Set<string>();
  const terms = name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length >= 3)
    .sort((a, b) => b.length - a.length)
    .filter((word) => !seen.has(normalizeSearch(word)) && seen.add(normalizeSearch(word)))
    .slice(0, 3);
  return terms.length ? terms : [name.trim()].filter(Boolean);
}

/**
 * Compara un nombre escrito con los del catálogo. `exact` es el que se llama igual sin distinguir
 * mayúsculas ni tildes (el servidor lo resuelve a ese); `similar`, los que se escriben casi igual,
 * contienen al otro o comparten una palabra de cuatro letras o más, en ese orden.
 */
export function compareNames(name: string, candidates: readonly string[], limit = 3): { exact: string | null; similar: string[] } {
  const target = normalizeSearch(name);
  const exact = candidates.find((candidate) => normalizeSearch(candidate) === target) ?? null;
  if (exact || !target) return { exact, similar: [] };
  const targetCompact = compact(name);
  const targetWords = new Set(words(name));
  const ranked: Array<{ name: string; rank: number; index: number }> = [];
  const seen = new Set<string>();
  candidates.forEach((candidate, index) => {
    const key = normalizeSearch(candidate);
    if (!key || seen.has(key)) return;
    seen.add(key);
    const other = compact(candidate);
    let rank = -1;
    if (other === targetCompact) rank = 0;
    else if (other.length >= 3 && targetCompact.length >= 3 && (other.includes(targetCompact) || targetCompact.includes(other))) rank = 1;
    else if (words(candidate).some((word) => targetWords.has(word))) rank = 2;
    if (rank >= 0) ranked.push({ name: candidate, rank, index });
  });
  ranked.sort((a, b) => a.rank - b.rank || a.index - b.index);
  return { exact: null, similar: ranked.slice(0, limit).map((entry) => entry.name) };
}

/** El botón del último paso dice lo que hace en cada rol. */
export function submitLabel(role: SuggestRole | ''): string {
  return role === 'admin' ? 'Crear borrador' : 'Enviar a revisión';
}

/** Lo que pasa al enviar, en el último paso. */
export function submitLead(role: SuggestRole | ''): string {
  return role === 'admin'
    ? 'Revisa los datos. Se crea un borrador en el catálogo, con su historial; lo publicas desde el Estudio.'
    : 'Revisa la propuesta antes de enviarla. El equipo la revisa y ninguna propuesta se publica automáticamente.';
}

export type DoneAction = { label: string; href?: string; restart?: true; variant: 'primary' | 'secondary' | 'ghost' };

/** Pantalla final por rol (diagrama del expediente de U19). */
export function doneScreen(role: SuggestRole | '', draftHref: string | null): { title: string; text: string; actions: DoneAction[] } {
  if (role === 'admin') {
    return {
      title: 'Borrador creado',
      text: 'El lanzamiento quedó como borrador en el catálogo, con su entrada en el historial. Nadie lo ve hasta que lo publiques.',
      actions: [
        ...(draftHref ? [{ label: 'Abrir el borrador', href: draftHref, variant: 'primary' as const }] : []),
        { label: 'Ir al Estudio', href: STUDIO_BASE, variant: 'secondary' },
        { label: 'Añadir otro', restart: true, variant: 'ghost' }
      ]
    };
  }
  return {
    title: 'Propuesta enviada',
    text: role === 'colaborador'
      ? 'Tu propuesta quedó en la cola de colaboración. Admin la revisa antes de publicarla.'
      : 'Tu propuesta quedó pendiente de revisión. Puedes consultar su estado en Mis aportes.',
    actions: [
      role === 'colaborador'
        ? { label: 'Ir al Estudio', href: STUDIO_BASE, variant: 'secondary' }
        : { label: 'Ver mis aportes', href: '/mis-aportes', variant: 'secondary' },
      { label: 'Sugerir otro', restart: true, variant: 'ghost' }
    ]
  };
}

const RELEASE_STATES: Record<string, string> = { draft: 'como borrador', archived: 'archivado' };

/**
 * Aviso de duplicado al detectar la fuente. Solo usa lo que devuelve check_source_duplicate, que ya
 * oculta las propuestas ajenas. Null si no hay nada que avisar (incluida la propuesta que se edita).
 */
export function duplicateNotice(
  duplicate: SourceDuplicate | null | undefined,
  context: { role: SuggestRole | ''; draftId?: string | null }
): { text: string; link: { label: string; href: string } | null } | null {
  if (duplicate?.match !== 'catalog' && duplicate?.match !== 'queue') return null;
  if (duplicate.match === 'catalog') {
    if (duplicate.state === 'published' && duplicate.release_slug) {
      return { text: 'Este enlace ya está en el catálogo.', link: { label: 'Ver la ficha', href: `/lanzamiento/${duplicate.release_slug}` } };
    }
    const state = RELEASE_STATES[duplicate.state ?? ''];
    return {
      text: `Este enlace ya está en el catálogo${state ? `, ${state}` : ''}.`,
      link: duplicate.release_id
        ? { label: 'Abrir en el Estudio', href: studioReleaseHref(duplicate.release_id) }
        : null
    };
  }
  const id = duplicate.contribution_id;
  if (id && id === context.draftId) return null;
  if (context.role === 'admin') {
    return {
      text: 'Ya hay una propuesta con este enlace en la cola.',
      link: id ? { label: 'Ver la propuesta', href: `${STUDIO_BASE}/propuestas?propuesta=${encodeURIComponent(id)}` } : null
    };
  }
  if (id && (duplicate.state === 'draft' || duplicate.state === 'changes_requested')) {
    return {
      text: duplicate.state === 'draft' ? 'Ya tienes un borrador con este enlace.' : 'Ya enviaste este enlace y el equipo te pidió cambios.',
      link: { label: duplicate.state === 'draft' ? 'Retomar el borrador' : 'Revisar la propuesta', href: `/sugerir?draft=${encodeURIComponent(id)}` }
    };
  }
  if (id) return { text: 'Ya enviaste una propuesta con este enlace.', link: { label: 'Ver mis aportes', href: '/mis-aportes' } };
  return {
    text: 'Alguien ya propuso este enlace y está en revisión.',
    link: context.role === 'colaborador' ? { label: 'Ir a Propuestas', href: `${STUDIO_BASE}/propuestas` } : null
  };
}
