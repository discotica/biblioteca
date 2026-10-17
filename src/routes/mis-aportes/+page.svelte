<script lang="ts">
  // Mis aportes (U14): página propia con los aportes de la persona en filas
  // compactas (estado, lanzamiento, fecha y una acción). Mismos estados y datos
  // que la sección "Mis propuestas" del perfil, que reemplaza.
  import { onMount } from 'svelte';
  import PageLayout from '$lib/layouts/PageLayout.svelte';
  import { Button, Chip, EmptyState, ErrorState, LoadingIndicator } from '$lib/ui';
  import {
    CONTRIBUTION_STATUS_LABELS,
    loadOwnContributions,
    type Contribution
  } from '$lib/stores/contributionsStore';
  import { fetchReleasesForCrate } from '$lib/utils/catalogoStore';
  import {
    CONTRIBUTION_ROW_TONES,
    contributionRowAction,
    contributionRowDate,
    contributionTaken
  } from '$lib/domain/contributionRows';

  let { data }: { data: { userId: string; username: string } } = $props();

  const editorialEnabled = import.meta.env.VITE_EDITORIAL_ENABLED === 'true';

  let contributions = $state<Contribution[]>([]);
  let releaseSlugs = $state(new Map<string, string>());
  let loading = $state(true);
  let loadError = $state(false);

  const formatter = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' });

  async function load() {
    loading = true;
    loadError = false;
    try {
      contributions = await loadOwnContributions(data.userId);
      // Enlace de los aceptados: solo si el lanzamiento sigue publicado.
      const ids = contributions.filter((c) => c.status === 'approved' && c.release_id).map((c) => c.release_id as string);
      if (ids.length) {
        const releases = await fetchReleasesForCrate(ids, []).catch(() => []);
        releaseSlugs = new Map(releases.filter((r) => r.id).map((r) => [r.id as string, r.slug]));
      }
    } catch {
      loadError = true;
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    if (editorialEnabled) void load();
  });

  const crumbs = $derived(
    data.username ? [{ label: `@${data.username}`, href: `/perfil/${data.username}` }, { label: 'Mis aportes' }] : undefined
  );
</script>

<svelte:head>
  <title>Mis aportes — Biblioteca Discótica</title>
</svelte:head>

<PageLayout container="regular" breadcrumbs={crumbs} title="Mis aportes" description="Los lanzamientos que sugeriste y en qué punto está cada uno.">
  {#snippet actions()}
    {#if editorialEnabled}<Button icon="agregar" href="/sugerir">Sugerir un lanzamiento</Button>{/if}
  {/snippet}

  {#if !editorialEnabled}
    <EmptyState message="Los aportes no están disponibles por ahora." />
  {:else if loading}
    <LoadingIndicator label="Cargando aportes" />
  {:else if loadError}
    <ErrorState message="No pudimos cargar tus aportes." onaction={load} />
  {:else if contributions.length === 0}
    <EmptyState
      message="Todavía no has sugerido lanzamientos."
      detail="Tus borradores y envíos aparecen aquí."
      actionLabel="Sugerir un lanzamiento"
      actionHref="/sugerir"
    />
  {:else}
    <ul class="aportes" aria-label="Aportes">
      {#each contributions as contribution (contribution.id)}
        {@const date = contributionRowDate(contribution)}
        {@const action = contributionRowAction(contribution, contribution.release_id ? releaseSlugs.get(contribution.release_id) : null)}
        <li class="aporte">
          <div class="aporte__main">
            <h2 class="aporte__title">{contribution.payload?.title || 'Borrador sin título'}</h2>
            <p class="aporte__meta">
              <Chip kind="status" label={CONTRIBUTION_STATUS_LABELS[contribution.status]} tone={CONTRIBUTION_ROW_TONES[contribution.status]} />
              <span>{date.label} <time datetime={date.value}>{formatter.format(new Date(date.value))}</time></span>
              {#if contribution.source_provider}<span class="aporte__source">{contribution.source_provider}</span>{/if}
            </p>
            {#if contributionTaken(contribution)}
              <p class="aporte__note">El equipo ya la está revisando: ya no se puede editar.</p>
            {/if}
            {#if contribution.reviewer_note}
              <p class="aporte__note"><span class="aporte__note-label">Nota del equipo:</span> {contribution.reviewer_note}</p>
            {/if}
          </div>
          {#if action}
            <div class="aporte__action">
              <Button variant="secondary" href={action.href} aria-label={`${action.label}: ${contribution.payload?.title || 'borrador sin título'}`}>{action.label}</Button>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</PageLayout>

<style>
  .aportes {
    margin: 0;
    padding: 0;
    list-style: none;
    border-top: 1px solid var(--color-linea-sutil);
  }

  /* Fila compacta: título y datos a la izquierda, la acción a la derecha y a su
     tamaño normal (nunca a todo el ancho), también en móvil. */
  .aporte {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2) var(--space-4);
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--color-linea-sutil);
  }
  .aporte__main { min-width: 0; }

  .aporte__title {
    margin: 0;
    color: var(--color-texto);
    font-size: var(--text-md);
    font-weight: 700;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }

  .aporte__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1) var(--space-3);
    margin: var(--space-1) 0 0;
    color: var(--color-texto-tenue);
    font-size: var(--text-xs);
  }
  .aporte__source { text-transform: capitalize; }

  .aporte__note {
    margin: var(--space-2) 0 0;
    color: var(--color-texto-medio);
    font-size: var(--text-xs);
    line-height: 1.5;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .aporte__note-label { font-weight: 700; }

  .aporte__action { flex: none; }
</style>
