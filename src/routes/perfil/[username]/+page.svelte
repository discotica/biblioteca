<script lang="ts">
  // Perfil (U14; U31, tableros F y K): la casa. Cenefa con la huella de la
  // persona y su título; debajo, sus colecciones. El dueño ve además Mis
  // aportes fijado (solo él, D2), sus colecciones privadas con el «…» de
  // compartir, editar y eliminar, y crea colecciones desde aquí: la antigua Mis
  // colecciones redirige a esta página. Ajeno: colecciones públicas, redes y
  // aportes aceptados si su dueño lo permite.
  import { onMount } from 'svelte';
  import { afterNavigate, replaceState } from '$app/navigation';
  import { getProfileRole, type ProfileRole } from '$lib/stores/contributionsStore';
  import { crates, cratesLoaded, enlaceColeccion, portadasDeColecciones, type Crate } from '$lib/stores/cratesStore';
  import {
    loadPublicAcceptedContributions,
    profileSocialLinks,
    setShowAcceptedContributions,
    type PublicProfile
  } from '$lib/services/profiles';
  import { loadAportesPropios, resumenAportes } from '$lib/services/aportes';
  import { fetchReleasesForCrate, type Release } from '$lib/utils/catalogoStore';
  import { Cenefa, type Rol } from '$lib/generative';
  import { MOBILE_QUERY } from '$lib/ui/breakpoints';
  import { Button, Checkbox, EmptyState, Icon, LoadingIndicator, Notice, SocialLinks, type MenuItem } from '$lib/ui';
  import LanzamientoFila from '$lib/components/LanzamientoFila.svelte';
  import { STUDIO_SECTIONS, studioSectionHref, studioSectionsFor } from '$lib/domain/studio';
  import CollectionTile from '$lib/components/colecciones/CollectionTile.svelte';
  import AportesTile from '$lib/components/colecciones/AportesTile.svelte';
  import CollectionFormDialog from '$lib/components/colecciones/CollectionFormDialog.svelte';
  import DeleteCollectionDialog from '$lib/components/colecciones/DeleteCollectionDialog.svelte';
  import { copyLink } from '$lib/components/colecciones/share';

  let { data }: { data: { perfil: PublicProfile; d1: boolean; own: boolean; crates: Crate[] } } = $props();

  // Avisos al llegar desde un enlace de correo (U12, U30) o desde la antigua Mis
  // colecciones (U31). Se leen una vez y se quitan de la URL, para que recargar
  // o compartir el perfil no los repita.
  const AVISOS: Record<string, { title: string; text: string }> = {
    'cuenta-confirmada': {
      title: 'Tu cuenta está confirmada',
      text: 'Ya puedes crear colecciones, compartirlas y sugerir lanzamientos.'
    },
    contrasena: { title: 'Contraseña actualizada', text: 'Usa tu contraseña nueva la próxima vez que entres.' }
  };
  let aviso = $state<{ title: string; text: string } | null>(null);
  /** Resultado de la última acción del «…» o del diálogo (crear, compartir, eliminar). */
  let feedback = $state<{ tone: 'success' | 'error'; text: string } | null>(null);

  // afterNavigate y no onMount: replaceState necesita el router ya iniciado,
  // y en una carga directa onMount corre antes. `?crear=1` (Añadir a colección
  // → Nueva colección, y la antigua /mis-colecciones?crear=1) abre el diálogo.
  afterNavigate(({ to }) => {
    if (!to) return;
    if (data.own && to.url.searchParams.get('crear') === '1') openCreate();
    const avisoParam = to.url.searchParams.get('aviso');
    if (!avisoParam) return;
    aviso = AVISOS[avisoParam] ?? null;
    const url = new URL(to.url);
    url.searchParams.delete('aviso');
    replaceState(url, {});
  });

  const ACCEPTED_PAGE = 24;
  const editorialEnabled = import.meta.env.VITE_EDITORIAL_ENABLED === 'true';
  const adminCatalogEnabled = import.meta.env.VITE_ADMIN_CATALOG_ENABLED === 'true';

  const perfil = $derived(data.perfil);
  const own = $derived(data.own);
  const nombre = $derived(perfil.display_name || perfil.username);
  const socialLinks = $derived(profileSocialLinks(perfil));

  /** El dueño lee del store (crear, editar y eliminar se ven al momento); los demás, las públicas. */
  const lista = $derived(own ? $crates : data.crates);

  // Cenefa: 380 en desktop y 280 en móvil. El alto es del lienzo, no del CSS:
  // estirar el canvas deformaría los puntos.
  let movil = $state(typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches);
  const cenefaAlto = $derived(movil ? 280 : 380);

  let role = $state<ProfileRole | ''>('');
  /** Gama de la huella: el rol del perfil (público), o el que se lee para el Estudio. */
  const rolHuella = $derived.by<Rol>(() => {
    const value = role || perfil.role || '';
    return value === 'admin' ? 'admin' : value === 'colaborador' ? 'colaborador' : 'usuario';
  });

  let covers = $state(new Map<string, (string | null)[]>());
  let aportes = $state<{ meta: string; covers: (string | null)[] }>({ meta: '', covers: [] });

  // Diálogos de colección (antes en Mis colecciones).
  let formOpen = $state(false);
  let editing = $state<Crate | null>(null);
  let deleteOpen = $state(false);
  let deleting = $state<Crate | null>(null);

  // Aportes aceptados (D1): la RPC solo devuelve algo si la preferencia está activa.
  // svelte-ignore state_referenced_locally
  let showAccepted = $state(data.perfil.show_accepted_contributions ?? false);
  let savingPreference = $state(false);
  let preferenceError = $state('');
  let accepted = $state<Release[]>([]);
  let acceptedLoading = $state(false);
  let acceptedMore = $state(false);
  let acceptedOffset = 0;

  // Acceso al Estudio (ronda 3, I3): el perfil propio de admin y colaborador
  // tiene una entrada por sección que ve el rol (U15). Desde U28 también está
  // «Estudio» en el cabecero.
  const studioLinks = $derived(
    studioSectionsFor(role, { adminCatalog: adminCatalogEnabled, editorial: editorialEnabled }).map((id) => ({
      label: STUDIO_SECTIONS.find((section) => section.id === id)!.label,
      href: studioSectionHref(id)
    }))
  );

  const acceptedAvailable = $derived(editorialEnabled && data.d1);
  /** Los demás ven la sección solo si la persona lo permite y hay algo que mostrar. */
  const showAcceptedSection = $derived(acceptedAvailable && (own || (showAccepted && accepted.length > 0)));

  async function loadAccepted(reset = false) {
    if (!acceptedAvailable) return;
    if (reset) {
      accepted = [];
      acceptedOffset = 0;
    }
    acceptedLoading = true;
    try {
      const rows = await loadPublicAcceptedContributions(perfil.id, { limit: ACCEPTED_PAGE, offset: acceptedOffset });
      acceptedOffset += rows.length;
      acceptedMore = rows.length === ACCEPTED_PAGE;
      const releases = await fetchReleasesForCrate(rows.map((row) => row.release_id), []);
      const byId = new Map(releases.map((release) => [release.id, release]));
      const next = rows.map((row) => byId.get(row.release_id)).filter((release): release is Release => Boolean(release));
      accepted = [...accepted, ...next];
    } catch {
      acceptedMore = false;
    } finally {
      acceptedLoading = false;
    }
  }

  // El interruptor ya cambió (bind): se guarda y, si falla, vuelve atrás.
  async function togglePreference() {
    const next = showAccepted;
    preferenceError = '';
    savingPreference = true;
    try {
      await setShowAcceptedContributions(perfil.id, next);
      await loadAccepted(true);
    } catch {
      showAccepted = !next;
      preferenceError = 'No pudimos guardar la preferencia. Vuelve a intentarlo.';
    } finally {
      savingPreference = false;
    }
  }

  // Mosaicos: se piden de nuevo cuando cambia el conjunto de colecciones.
  let coversKey = '';
  $effect(() => {
    const key = lista.map((crate) => crate.id).join(',');
    if (!key || key === coversKey) return;
    coversKey = key;
    portadasDeColecciones(lista.map((crate) => crate.id))
      .then((next) => (covers = next))
      .catch(() => {}); // sin portadas, el mosaico muestra el logo
  });

  onMount(() => {
    const query = window.matchMedia(MOBILE_QUERY);
    const onChange = () => (movil = query.matches);
    query.addEventListener('change', onChange);

    if (showAccepted) void loadAccepted(true);
    return () => query.removeEventListener('change', onChange);
  });

  // Rol (Estudio) y Mis aportes, solo en el perfil propio. Por perfil y no al
  // montar: ir de un perfil a otro reutiliza la página, y lo del dueño no puede
  // quedarse pintado (ni teñir la huella) en el perfil de otra persona.
  $effect(() => {
    const id = perfil.id;
    const mine = own;
    role = '';
    aportes = { meta: '', covers: [] };
    if (!mine) return;
    let vigente = true;
    if (editorialEnabled) {
      loadAportesPropios(id)
        .then((result) => { if (vigente) aportes = resumenAportes(result); })
        .catch(() => {});
    }
    getProfileRole(id)
      .then((value) => { if (vigente) role = value; })
      .catch(() => {});
    return () => { vigente = false; };
  });

  function openCreate() {
    editing = null;
    formOpen = true;
  }

  async function share(crate: Crate) {
    const ok = await copyLink(enlaceColeccion(crate, perfil.username));
    feedback = ok
      ? { tone: 'success', text: `Copiamos el enlace de «${crate.name}».` }
      : { tone: 'error', text: 'No pudimos copiar el enlace. Ábrela y copia la dirección del navegador.' };
  }

  function actionsFor(crate: Crate): MenuItem[] {
    return [
      crate.is_public
        ? { label: 'Compartir', icon: 'compartir', onselect: () => share(crate) }
        : { label: 'Compartir (es privada)', icon: 'compartir', disabled: true },
      { label: 'Editar', onselect: () => { editing = crate; formOpen = true; } },
      { label: 'Eliminar', tone: 'danger', onselect: () => { deleting = crate; deleteOpen = true; } }
    ];
  }

  const collectionHref = (crate: Crate) =>
    `/coleccion/${encodeURIComponent(crate.slug)}?usuario=${encodeURIComponent(perfil.username)}`;
</script>

<svelte:head>
  <title>@{perfil.username} — Biblioteca Discótica</title>
</svelte:head>

<div class="perfil">
  <header class="perfil-cabeza">
    <Cenefa nombre={perfil.username} rol={rolHuella} alto={cenefaAlto} velo={false} class="perfil-cabeza__cenefa" />
    <div class="perfil-cabeza__velo" style:height="{cenefaAlto}px" aria-hidden="true"></div>
    <div class="l-container l-container--wide perfil-cabeza__contenido" style:--cenefa-alto="{cenefaAlto}px">
      <!-- El título ocupa todo el ancho del contenedor, en su propia fila: lo que
           va a la derecha (redes y botones) nunca lo estrecha ni le corta palabras. -->
      <h1 class="perfil-cabeza__titulo">{nombre}</h1>
      <div class="perfil-cabeza__fila">
        <p class="perfil-cabeza__linea">
          <span class="perfil-cabeza__usuario">@{perfil.username}</span>
          {#if perfil.bio}
            · <span class="perfil-cabeza__bio">{perfil.bio}</span>
          {:else if own}
            · <a class="perfil-cabeza__invita" href="/cuenta">Escribe tu bio</a>
          {/if}
          {#if own && data.d1 && !socialLinks.length}
            · <a class="perfil-cabeza__invita" href="/cuenta#redes">Añade tus redes</a>
          {/if}
        </p>
        {#if socialLinks.length || own}
          <div class="perfil-cabeza__acciones">
            <SocialLinks links={socialLinks} label={`Redes de @${perfil.username}`} variant="secondary" newTab class="perfil-cabeza__redes" />
            {#if own}
              <div class="perfil-cabeza__cuenta">
                <Button variant="secondary" icon="editar" href="/cuenta">Editar perfil</Button>
                <Button variant="secondary" icon="ajustes" href="/cuenta/ajustes">Ajustes</Button>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </header>

  <div class="l-container l-container--wide perfil-cuerpo">
    {#if aviso}
      <Notice tone="success" title={aviso.title} class="perfil-aviso">{aviso.text}</Notice>
    {/if}
    {#if feedback}
      <Notice tone={feedback.tone} class="perfil-aviso">{feedback.text}</Notice>
    {/if}

    <section id="colecciones" class="perfil-seccion" aria-labelledby="colecciones-title">
      <div class="perfil-seccion__head">
        <h2 id="colecciones-title" class="perfil-seccion__titulo">Colecciones</h2>
        {#if own}<Button icon="agregar" onclick={openCreate}>Nueva colección</Button>{/if}
      </div>

      {#if own || lista.length}
        <ul class="perfil-grid">
          {#if own && editorialEnabled}
            <li><AportesTile covers={aportes.covers} meta={aportes.meta} /></li>
          {/if}
          {#each lista as crate (crate.id)}
            <li>
              <CollectionTile
                {crate}
                covers={covers.get(crate.id) ?? []}
                href={collectionHref(crate)}
                actions={own ? actionsFor(crate) : undefined}
                showVisibility={own}
              />
            </li>
          {/each}
          {#if own && $cratesLoaded && lista.length === 0}
            <!-- Perfil recién nacido (tablero K): el mismo diálogo que «Nueva colección» (D5). -->
            <li>
              <button type="button" class="perfil-crear" onclick={openCreate}>
                <Icon name="agregar" size="lg" />
                <span>Crea tu primera colección</span>
              </button>
            </li>
            <li class="perfil-fantasma" aria-hidden="true"></li>
            <li class="perfil-fantasma" aria-hidden="true"></li>
          {/if}
        </ul>
      {:else}
        <EmptyState size="inline" message="Este perfil no tiene colecciones públicas todavía." />
      {/if}
    </section>

    {#if showAcceptedSection}
      <section id="aportes" class="perfil-seccion" aria-labelledby="aportes-title">
        <div class="perfil-seccion__head">
          <h2 id="aportes-title" class="perfil-seccion__titulo">Aportes aceptados</h2>
        </div>

        {#if own}
          <div class="perfil-preferencia">
            <Checkbox
              variant="switch"
              name="show-accepted"
              bind:checked={showAccepted}
              disabled={savingPreference}
              onchange={togglePreference}
              hint={showAccepted
                ? 'Quien visite tu perfil ve los lanzamientos que aportaste y el equipo aceptó.'
                : 'Solo tú ves esta sección. Actívalo para mostrar en tu perfil los lanzamientos que aportaste.'}
            >Mostrar mis aportes aceptados</Checkbox>
            {#if preferenceError}<Notice tone="error">{preferenceError}</Notice>{/if}
          </div>
        {/if}

        {#if showAccepted}
          {#if accepted.length}
            <ul class="lanzamientos-lista perfil-aportes">
              {#each accepted as release (release.id)}<li><LanzamientoFila lanzamiento={release} /></li>{/each}
            </ul>
            {#if acceptedMore}
              <div class="perfil-mas">
                <Button variant="secondary" loading={acceptedLoading} onclick={() => loadAccepted()}>Mostrar más</Button>
              </div>
            {/if}
          {:else if acceptedLoading}
            <LoadingIndicator label="Cargando aportes" />
          {:else if own}
            <EmptyState size="inline" message="Todavía no tienes aportes aceptados." actionLabel="Sugerir un lanzamiento" actionHref="/sugerir" />
          {/if}
        {/if}
      </section>
    {/if}

    {#if studioLinks.length}
      <section class="studio" aria-labelledby="studio-title">
        <div>
          <h2 id="studio-title">Estudio</h2>
          <p>Las herramientas del equipo.</p>
        </div>
        <div class="studio__links">
          {#each studioLinks as link}
            <Button variant="secondary" href={link.href} iconEnd="flecha-derecha">{link.label}</Button>
          {/each}
        </div>
      </section>
    {/if}
  </div>
</div>

{#if own}
  <CollectionFormDialog
    bind:open={formOpen}
    crate={editing}
    onsaved={(saved) => {
      feedback = { tone: 'success', text: editing ? `Guardamos «${saved.name}».` : `Creamos «${saved.name}».` };
      coversKey = '';
    }}
  />

  <DeleteCollectionDialog
    bind:open={deleteOpen}
    crate={deleting}
    ondeleted={(deleted) => (feedback = { tone: 'success', text: `Eliminamos «${deleted.name}».` })}
  />
{/if}

<style>
  /* ---- Cabecera: cenefa a todo el ancho y el contenedor del sitio encima ---- */
  .perfil-cabeza {
    position: relative;
    isolation: isolate;
  }
  .perfil-cabeza :global(.perfil-cabeza__cenefa),
  .perfil-cabeza__velo {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: -1;
  }
  .perfil-cabeza__velo { background: var(--color-velo-perfil); }

  /* Título arriba, a todo el ancho; debajo, la línea de @usuario y bio con las
     acciones a la derecha. El bloque se apoya en el borde inferior de la cenefa. */
  .perfil-cabeza__contenido {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    min-height: var(--cenefa-alto);
    padding-bottom: var(--perfil-cabeza-pad);
  }

  .perfil-cabeza__fila {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-4) var(--space-6);
  }
  .perfil-cabeza__fila > .perfil-cabeza__linea { min-width: 0; }

  .perfil-cabeza__titulo {
    margin: 0;
    color: var(--color-texto);
    font-size: var(--text-entidad);
    font-weight: 700;
    letter-spacing: -0.035em;
    line-height: var(--text-entidad-lh);
    overflow-wrap: break-word;
  }

  .perfil-cabeza__linea {
    max-width: var(--measure-reading);
    margin: var(--space-3) 0 0;
    color: var(--color-texto-alto);
    font-size: var(--text-lg);
    line-height: 1.625rem;
  }
  .perfil-cabeza__invita {
    color: var(--color-acento);
    font-weight: 600;
    text-decoration: none;
  }
  .perfil-cabeza__invita:hover { text-decoration: underline; }

  .perfil-cabeza__acciones {
    flex: none;
    display: flex;
    gap: var(--space-4);
  }
  .perfil-cabeza__cuenta { display: flex; gap: var(--space-2); }

  /* Botones sobre la cenefa: 40 de alto, como los controles del cabecero, y
     fondo al 70 % para leerse sobre los puntos. */
  .perfil-cabeza__acciones :global(.ui-btn) { --btn-h: var(--control-h-md); }
  .perfil-cabeza__acciones :global(.ui-social) { gap: var(--space-2); }
  .perfil-cabeza__acciones :global(.ui-btn--secondary:not(:hover)) { background: var(--color-boton-cenefa); }

  /* ---- Cuerpo ---- */
  .perfil-cuerpo { padding-top: var(--space-6); padding-bottom: var(--page-pad-bottom); }
  :global(.perfil-aviso) { margin-bottom: var(--space-6); }

  .perfil-seccion { display: flex; flex-direction: column; gap: var(--space-5); }
  .perfil-seccion + .perfil-seccion,
  .perfil-seccion + .studio { margin-top: var(--space-8); }
  .perfil-seccion__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    min-height: var(--control-h-md);
  }
  .perfil-seccion__titulo {
    margin: 0;
    color: var(--color-texto);
    font-size: var(--text-perfil-seccion);
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: var(--text-perfil-seccion-lh);
  }
  .perfil-seccion__head :global(.ui-btn) { --btn-h: var(--control-h-md); }

  /* 4 × 270 en 1152 (desktop), 3 en tablet y 2 en móvil. */
  .perfil-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--tile-gap-y) var(--tile-gap-x);
  }
  .perfil-grid > li { min-width: 0; }

  /* Tile verde del perfil recién nacido: abre el diálogo de Nueva colección. */
  .perfil-crear {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    width: 100%;
    aspect-ratio: 1 / 1;
    padding: 1.25rem;
    border: 0;
    border-radius: var(--radius-sm);
    background: var(--color-acento);
    color: var(--color-sobre-acento);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .perfil-crear :global(.ui-icon) { width: 40px; height: 40px; }
  .perfil-crear span {
    font-size: var(--text-tile-cta);
    font-weight: 700;
    letter-spacing: -0.01em;
    line-height: var(--text-tile-cta-lh);
  }
  .perfil-crear:hover { background: var(--color-acento-hover); }
  .perfil-crear:focus-visible { outline: 2px solid var(--focus-ring-color); outline-offset: 2px; box-shadow: var(--focus-ring); }

  /* Huecos punteados: completan la fila hasta el ancho de la cuadrícula. */
  .perfil-fantasma {
    aspect-ratio: 1 / 1;
    border: 1px dashed var(--color-linea-fuerte);
    border-radius: var(--radius-sm);
  }

  .perfil-preferencia { display: flex; flex-direction: column; gap: var(--space-3); }
  .perfil-aportes { margin: 0; padding: 0; list-style: none; }
  .perfil-mas { display: flex; justify-content: center; }

  .studio {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-5);
    border: 1px solid var(--color-linea-formulario);
    border-radius: var(--radius-base);
    background: var(--color-panel-formulario);
  }
  .studio h2 { margin: 0; font-size: var(--text-lg); font-weight: 700; }
  .studio p { margin: var(--space-1) 0 0; color: var(--color-texto-medio); font-size: var(--text-sm); }
  .studio__links { display: flex; flex-wrap: wrap; gap: var(--space-2); }

  @media (max-width: 1023px) {
    .perfil-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .perfil-fantasma + .perfil-fantasma { display: none; }
  }

  @media (max-width: 768px) {
    .perfil-cabeza__velo { background: var(--color-velo-perfil-movil); }
    .perfil-cabeza__fila { display: block; }
    .perfil-cabeza__contenido {
      display: block;
      min-height: 0;
      padding-top: var(--perfil-titulo-top-movil);
      padding-bottom: 0;
    }
    .perfil-cabeza__titulo { font-size: var(--text-entidad-m); line-height: var(--text-entidad-m-lh); }
    .perfil-cabeza__linea { margin-top: var(--space-2); font-size: var(--text-md); line-height: 1.5rem; }
    .perfil-cabeza__acciones { flex-direction: column; gap: var(--space-2); margin-top: var(--space-3); }
    .perfil-cabeza__acciones :global(.ui-btn) { --btn-h: var(--control-h-lg); }
    .perfil-cabeza__cuenta { display: grid; grid-template-columns: 1fr 1fr; }
    .perfil-cabeza__acciones :global(.ui-btn--secondary:not(:hover)) { background: transparent; }

    .perfil-cuerpo { padding-top: var(--space-5); }
    .perfil-seccion { gap: var(--space-3); }
    .perfil-seccion__titulo { font-size: var(--text-2xl); line-height: 1.75rem; }
    .perfil-seccion__head :global(.ui-btn) { --btn-h: var(--control-h-lg); }
    .perfil-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4) var(--space-3); }
    .perfil-fantasma { display: none; }
    .perfil-crear { padding: var(--space-4); }
    .perfil-crear span { font-size: var(--text-tile-cta-m); line-height: var(--text-tile-cta-m-lh); }
  }
</style>
