<script lang="ts">
  // Perfil (U14). Ajeno: colecciones públicas, redes y aportes aceptados si su
  // dueño lo permite. Propio: además, acceso al Estudio (admin y colaborador),
  // edición de redes (en Editar cuenta) y el interruptor de aportes públicos.
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { getProfileRole, type ProfileRole } from '$lib/stores/contributionsStore';
  import { portadasDeColecciones, type Crate } from '$lib/stores/cratesStore';
  import {
    loadPublicAcceptedContributions,
    profileSocialLinks,
    setShowAcceptedContributions,
    type PublicProfile
  } from '$lib/services/profiles';
  import { fetchReleasesForCrate, type Release } from '$lib/utils/catalogoStore';
  import PageLayout from '$lib/layouts/PageLayout.svelte';
  import { Button, Checkbox, EmptyState, LoadingIndicator, Notice, SocialLinks } from '$lib/ui';
  import LanzamientoFila from '$lib/components/LanzamientoFila.svelte';
  import { STUDIO_SECTIONS, studioSectionHref, studioSectionsFor } from '$lib/domain/studio';
  import CollectionTile from '$lib/components/colecciones/CollectionTile.svelte';

  let { data }: { data: { perfil: PublicProfile; d1: boolean; crates: Crate[] } } = $props();

  const ACCEPTED_PAGE = 24;
  const editorialEnabled = import.meta.env.VITE_EDITORIAL_ENABLED === 'true';
  const adminCatalogEnabled = import.meta.env.VITE_ADMIN_CATALOG_ENABLED === 'true';

  const perfil = $derived(data.perfil);
  const nombre = $derived(perfil.display_name || perfil.username);
  const inicial = $derived(nombre[0].toUpperCase());
  const año = $derived(new Date(perfil.created_at).getFullYear());
  const socialLinks = $derived(profileSocialLinks(perfil));

  let isOwnProfile = $state(false);
  let role = $state<ProfileRole | ''>('');
  let covers = $state(new Map<string, (string | null)[]>());

  // Aportes aceptados (D1): la RPC solo devuelve algo si la preferencia está activa.
  // svelte-ignore state_referenced_locally
  let showAccepted = $state(data.perfil.show_accepted_contributions);
  let savingPreference = $state(false);
  let preferenceError = $state('');
  let accepted = $state<Release[]>([]);
  let acceptedLoading = $state(false);
  let acceptedMore = $state(false);
  let acceptedOffset = 0;

  // Acceso al Estudio (ronda 3, I3): sale del perfil propio de admin y
  // colaborador, no del header. Una entrada por sección que ve el rol (U15).
  const studioLinks = $derived(
    studioSectionsFor(role, { adminCatalog: adminCatalogEnabled, editorial: editorialEnabled }).map((id) => ({
      label: STUDIO_SECTIONS.find((section) => section.id === id)!.label,
      href: studioSectionHref(id)
    }))
  );

  const acceptedAvailable = $derived(editorialEnabled && data.d1);
  /** Los demás ven la sección solo si la persona lo permite y hay algo que mostrar. */
  const showAcceptedSection = $derived(acceptedAvailable && (isOwnProfile || (showAccepted && accepted.length > 0)));

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

  onMount(async () => {
    if (data.crates.length) {
      portadasDeColecciones(data.crates.map((crate) => crate.id))
        .then((next) => (covers = next))
        .catch(() => {});
    }
    if (showAccepted) void loadAccepted(true);
    const { data: auth } = await supabase.auth.getUser();
    isOwnProfile = auth.user?.id === perfil.id;
    if (!isOwnProfile) return;
    try {
      role = await getProfileRole(perfil.id);
    } catch {
      role = '';
    }
  });

  const collectionHref = (crate: Crate) =>
    `/coleccion/${encodeURIComponent(crate.slug)}?usuario=${encodeURIComponent(perfil.username)}`;
</script>

<svelte:head>
  <title>@{perfil.username} — Biblioteca Discótica</title>
</svelte:head>

<PageLayout container="regular" title={nombre}>
  {#snippet actions()}
    {#if isOwnProfile}
      {#if editorialEnabled}<Button variant="secondary" href="/mis-aportes">Mis aportes</Button>{/if}
      <Button variant="secondary" href="/cuenta">Editar cuenta</Button>
    {/if}
  {/snippet}
  {#snippet leading()}
    <div class="avatar" aria-hidden="true">{inicial}</div>
  {/snippet}
  {#snippet meta()}
    <p class="perfil-username">@{perfil.username}</p>
    {#if perfil.bio}
      <p class="perfil-bio">{perfil.bio}</p>
    {/if}
    <p class="perfil-meta">En Discótica desde {año}</p>
    {#if socialLinks.length || (isOwnProfile && data.d1)}
      <div class="perfil-redes">
        <SocialLinks links={socialLinks} label={`Redes de @${perfil.username}`} size="sm" newTab />
        {#if isOwnProfile && data.d1}
          <Button variant="link" size="sm" href="/cuenta#redes">{socialLinks.length ? 'Editar redes' : 'Añadir tus redes'}</Button>
        {/if}
      </div>
    {/if}
  {/snippet}

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

  <section id="colecciones" class="perfil-seccion" aria-labelledby="colecciones-title">
    <div class="perfil-seccion__head">
      <h2 id="colecciones-title" class="seccion-titulo">
        Colecciones públicas
        <span class="seccion-conteo">{data.crates.length}</span>
      </h2>
      {#if isOwnProfile}<Button variant="link" size="sm" href="/mis-colecciones">Mis colecciones</Button>{/if}
    </div>

    {#if data.crates.length === 0}
      <EmptyState
        size="inline"
        message={isOwnProfile ? 'Todavía no tienes colecciones públicas.' : 'Este perfil no tiene colecciones públicas todavía.'}
        detail={isOwnProfile ? 'Las colecciones que marques como públicas aparecen aquí.' : undefined}
      />
    {:else}
      <ul class="collection-grid">
        {#each data.crates as crate (crate.id)}
          <li><CollectionTile {crate} covers={covers.get(crate.id) ?? []} href={collectionHref(crate)} /></li>
        {/each}
      </ul>
    {/if}
  </section>

  {#if showAcceptedSection}
    <section id="aportes" class="perfil-seccion" aria-labelledby="aportes-title">
      <div class="perfil-seccion__head">
        <h2 id="aportes-title" class="seccion-titulo">Aportes aceptados</h2>
      </div>

      {#if isOwnProfile}
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
        {:else if isOwnProfile}
          <EmptyState size="inline" message="Todavía no tienes aportes aceptados." actionLabel="Sugerir un lanzamiento" actionHref="/sugerir" />
        {/if}
      {/if}
    </section>
  {/if}
</PageLayout>

<style>
  .avatar {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--color-acento-dim);
    border: 1px solid var(--color-borde-hover);
    color: var(--color-acento);
    font-size: var(--text-2xl);
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .perfil-username { font-size: var(--text-xs); color: var(--color-texto-tenue); margin: 0; }
  .perfil-bio { font-size: var(--text-sm); color: var(--color-texto-tenue); margin: var(--space-1) 0 0; line-height: 1.6; }
  .perfil-meta { font-size: var(--text-2xs); color: var(--color-texto-tenue); margin: var(--space-1) 0 0; }
  .perfil-redes { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin-top: var(--space-2); }

  .studio {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    margin-bottom: var(--space-7);
    padding: var(--space-4) var(--space-5);
    border: 1px solid var(--color-acento-suave);
    border-radius: var(--radius-base);
    background: var(--color-acento-tinte);
  }
  .studio h2 { margin: 0; font-size: var(--text-lg); }
  .studio p { margin: var(--space-1) 0 0; color: var(--color-texto-medio); font-size: var(--text-sm); }
  .studio__links { display: flex; flex-wrap: wrap; gap: var(--space-2); }

  .perfil-seccion { display: flex; flex-direction: column; gap: var(--space-4); }
  .perfil-seccion + .perfil-seccion { margin-top: var(--space-7); }
  .perfil-seccion__head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); }

  .seccion-titulo {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    color: var(--color-texto-tenue);
    font-size: var(--text-md);
    font-weight: 800;
    letter-spacing: .04em;
    text-transform: uppercase;
  }
  .seccion-conteo {
    padding: 0 var(--space-2);
    border: 1px solid var(--color-linea);
    border-radius: var(--radius-pill);
    background: var(--color-superficie-2);
    color: var(--color-texto-tenue);
    font-size: var(--text-2xs);
    font-weight: 700;
  }

  .collection-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--mosaic-min-w), 1fr));
    gap: var(--space-6) var(--space-4);
  }

  .perfil-preferencia { display: flex; flex-direction: column; gap: var(--space-3); }
  .perfil-aportes { margin: 0; padding: 0; list-style: none; }
  .perfil-mas { display: flex; justify-content: center; }
</style>
