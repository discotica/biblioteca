<script lang="ts">
  // Mis aportes (U14; U31, tablero N): la página de revisión de los aportes de
  // la persona. Cenefa con su huella, «@usuario», título y tres cifras; debajo,
  // los aportes en tres grupos (Por resolver, En revisión y Resueltos), cada
  // uno con portada, estado, fecha con su verbo, nota del equipo y una acción
  // como mucho. Sin la fuente. Solo la ve su dueño (D2).
  import { onMount } from 'svelte';
  import { Cenefa, type Rol } from '$lib/generative';
  import { MOBILE_QUERY } from '$lib/ui/breakpoints';
  import { Button, Cover, EmptyState, ErrorState, LoadingIndicator, StatusDot } from '$lib/ui';
  import { CONTRIBUTION_STATUS_LABELS, type Contribution } from '$lib/stores/contributionsStore';
  import { loadProfileRole, profileRole } from '$lib/stores/profileRole';
  import { loadAportesPropios, portadaAporte, subtituloAporte, type AporteLanzamiento } from '$lib/services/aportes';
  import {
    CONTRIBUTION_DOT_TONES,
    contributionCounts,
    contributionRowAction,
    contributionRowDate,
    fechaAporte,
    groupContributions
  } from '$lib/domain/contributionRows';

  let { data }: { data: { userId: string; username: string } } = $props();

  const editorialEnabled = import.meta.env.VITE_EDITORIAL_ENABLED === 'true';

  let contributions = $state<Contribution[]>([]);
  let releases = $state(new Map<string, AporteLanzamiento>());
  let loading = $state(true);
  let loadError = $state(false);

  const groups = $derived(groupContributions(contributions));
  const counts = $derived(contributionCounts(contributions));

  // Cenefa: 240 en desktop y 180 en móvil, en el lienzo (no se estira).
  let movil = $state(typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches);
  const cenefaAlto = $derived(movil ? 180 : 240);

  // La huella es la del cabecero: mismo nombre y misma gama de rol.
  const rol = $derived.by<Rol>(() => {
    const value = $profileRole?.userId === data.userId ? $profileRole.role : '';
    return value === 'admin' ? 'admin' : value === 'colaborador' ? 'colaborador' : 'usuario';
  });

  const titleOf = (contribution: Contribution) => contribution.payload?.title || 'Borrador sin título';
  const LOCKED_HINT = 'El equipo ya la está revisando: ya no se puede editar.';

  async function load() {
    loading = true;
    loadError = false;
    try {
      const result = await loadAportesPropios(data.userId);
      contributions = result.contributions;
      releases = result.releases;
    } catch {
      loadError = true;
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    const query = window.matchMedia(MOBILE_QUERY);
    const onChange = () => (movil = query.matches);
    query.addEventListener('change', onChange);
    void loadProfileRole(data.userId).catch(() => {});
    if (editorialEnabled) void load();
    return () => query.removeEventListener('change', onChange);
  });

  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
</script>

<svelte:head>
  <title>Mis aportes — Biblioteca Discótica</title>
</svelte:head>

<div class="aportes-pagina">
  <header class="aportes-cabeza">
    <Cenefa nombre={data.username || data.userId} {rol} alto={cenefaAlto} velo={false} class="aportes-cabeza__cenefa" />
    <div class="aportes-cabeza__velo" style:height="{cenefaAlto}px" aria-hidden="true"></div>
    <div class="l-container l-container--wide aportes-cabeza__contenido" style:--cenefa-alto="{cenefaAlto}px">
      <div class="aportes-cabeza__texto">
        {#if data.username}<a class="aportes-cabeza__usuario" href="/perfil/{encodeURIComponent(data.username)}">@{data.username}</a>{/if}
        <h1 class="aportes-cabeza__titulo">Mis aportes</h1>
      </div>
      {#if editorialEnabled && !loading && !loadError && contributions.length}
        <dl class="aportes-cifras">
          <div><dt>Lanzamientos</dt><dd>{counts.total}</dd></div>
          <div><dt>En revisión</dt><dd>{counts.enRevision}</dd></div>
          <div><dt>Aceptados</dt><dd>{counts.aceptados}</dd></div>
        </dl>
      {/if}
    </div>
  </header>

  <div class="l-container l-container--wide aportes-cuerpo">
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
      <!-- En móvil, las tres cifras van en una línea bajo la cenefa. -->
      <p class="aportes-cifras-linea">
        {plural(counts.total, 'lanzamiento', 'lanzamientos')} · {counts.enRevision} en revisión · {plural(counts.aceptados, 'aceptado', 'aceptados')}
      </p>

      {#each groups as group (group.id)}
        <section class="aportes-grupo" aria-labelledby="grupo-{group.id}">
          <h2 class="aportes-grupo__titulo" id="grupo-{group.id}">{group.label} <span>{group.rows.length}</span></h2>
          <ul class="aportes-lista">
            {#each group.rows as contribution (contribution.id)}
              {@const date = contributionRowDate(contribution)}
              {@const releaseSlug = contribution.release_id ? releases.get(contribution.release_id)?.slug : null}
              {@const action = contributionRowAction(contribution, releaseSlug)}
              {@const cover = portadaAporte(contribution, releases)}
              {@const title = titleOf(contribution)}
              <li class="aporte">
                <div class="aporte__portada">
                  {#if cover}
                    <Cover src={cover} alt="" sizes="64px" />
                  {:else}
                    <span class="aporte__sin-portada" aria-hidden="true"></span>
                  {/if}
                </div>
                <div class="aporte__principal">
                  <h3 class="aporte__titulo">{title}</h3>
                  <p class="aporte__sub">{subtituloAporte(contribution)}</p>
                </div>
                <StatusDot class="aporte__estado" label={CONTRIBUTION_STATUS_LABELS[contribution.status]} tone={CONTRIBUTION_DOT_TONES[contribution.status]} />
                <p class="aporte__fecha">{date.label} <time datetime={date.value}>{fechaAporte(date.value)}</time></p>
                <div class="aporte__accion">
                  {#if action?.kind === 'locked'}
                    <Button
                      variant="secondary"
                      href={action.href}
                      disabled
                      title={LOCKED_HINT}
                      aria-label={`${action.label}: ${title}`}
                      aria-describedby="bloqueo-{contribution.id}"
                    >{action.label}</Button>
                    <span class="sr-only" id="bloqueo-{contribution.id}">{LOCKED_HINT}</span>
                  {:else if action}
                    <Button
                      variant={action.kind === 'fix' ? 'primary' : 'secondary'}
                      href={action.href}
                      aria-label={`${action.label}: ${title}`}
                    >{action.label}</Button>
                  {/if}
                </div>
                {#if contribution.reviewer_note}
                  <p class="aporte__nota"><b>Nota del equipo:</b> {contribution.reviewer_note}</p>
                {/if}
              </li>
            {/each}
          </ul>
        </section>
      {/each}
    {/if}
  </div>
</div>

<style>
  /* ---- Cabecera: cenefa de la huella a todo el ancho ---- */
  .aportes-cabeza {
    position: relative;
    isolation: isolate;
  }
  .aportes-cabeza :global(.aportes-cabeza__cenefa),
  .aportes-cabeza__velo {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: -1;
  }
  .aportes-cabeza__velo { background: var(--color-velo-perfil); }

  .aportes-cabeza__contenido {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-4) var(--space-6);
    min-height: var(--cenefa-alto);
    padding-bottom: var(--space-5);
  }

  .aportes-cabeza__usuario {
    color: var(--color-texto-alto);
    font-size: var(--text-sm);
    font-weight: 500;
    line-height: 1.25rem;
    text-decoration: none;
  }
  .aportes-cabeza__usuario:hover { color: var(--color-texto); text-decoration: underline; }

  .aportes-cabeza__titulo {
    margin: 6px 0 0;
    color: var(--color-texto);
    font-size: var(--text-aportes);
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1;
  }

  /* Cifras: el número arriba, grande, y su nombre debajo. */
  .aportes-cifras {
    display: flex;
    gap: var(--space-7);
    margin: 0;
  }
  .aportes-cifras div { display: flex; flex-direction: column-reverse; }
  .aportes-cifras dd {
    margin: 0;
    color: var(--color-texto);
    font-size: var(--text-cifra);
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: var(--text-cifra-lh);
  }
  .aportes-cifras dt {
    color: var(--color-texto-alto);
    font-size: var(--text-sm);
    line-height: 1.25rem;
  }
  .aportes-cifras-linea { display: none; }

  /* ---- Grupos y filas ---- */
  .aportes-cuerpo { padding-top: var(--space-6); padding-bottom: var(--page-pad-bottom); }

  .aportes-grupo + .aportes-grupo { margin-top: var(--space-6); }
  .aportes-grupo__titulo {
    margin: 0 0 var(--space-3);
    color: var(--color-texto);
    font-size: var(--text-aportes-grupo);
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: var(--text-aportes-grupo-lh);
  }
  .aportes-grupo__titulo span { font-weight: 500; color: var(--color-texto-medio); }

  .aportes-lista { margin: 0; padding: 0; list-style: none; }

  /* Portada · título y artista · estado · fecha · acción; la nota, debajo, desde la segunda columna. */
  .aporte {
    display: grid;
    grid-template-columns: var(--aportes-portada) minmax(0, 1fr) var(--aportes-col-estado) var(--aportes-col-fecha) var(--aportes-col-accion);
    align-items: center;
    column-gap: var(--space-5);
    padding: var(--space-3) 0;
    border-top: 1px solid var(--color-linea);
  }

  .aporte__portada,
  .aporte__sin-portada {
    display: block;
    width: var(--aportes-portada);
    height: var(--aportes-portada);
  }
  .aporte__portada :global(.ui-cover) { border-radius: var(--aportes-portada-radius); }
  .aporte__sin-portada {
    box-sizing: border-box;
    border: 1px dashed var(--color-linea-fuerte);
    border-radius: var(--aportes-portada-radius);
  }

  .aporte__principal { min-width: 0; }
  .aporte__titulo {
    margin: 0;
    color: var(--color-texto);
    font-size: var(--text-lg);
    font-weight: 600;
    line-height: 1.5rem;
    overflow-wrap: anywhere;
  }
  .aporte__sub,
  .aporte__fecha {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.25rem;
  }
  .aporte__sub { color: var(--color-texto-medio); overflow-wrap: anywhere; }
  .aporte__fecha { color: var(--color-texto); white-space: nowrap; }
  .aporte :global(.aporte__estado) { font-size: var(--text-sm); white-space: normal; }

  .aporte__accion { justify-self: end; }
  .aporte__accion :global(.ui-btn) { --btn-h: var(--control-h-md); }
  /* «Editar» que ya no se puede usar: gris, como lo pide el tablero. */
  .aporte__accion :global(.ui-btn[aria-disabled='true']) {
    border-color: var(--color-linea);
    background: var(--color-superficie-1);
  }

  .aporte__nota {
    grid-column: 2 / -1;
    margin: var(--space-2) 0 0;
    padding: 10px 14px;
    border: 1px solid var(--color-linea-formulario);
    border-radius: var(--radius-sm);
    background: var(--color-panel-formulario);
    color: var(--color-texto-alto);
    font-size: var(--text-sm);
    line-height: 1.25rem;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .aporte__nota b { color: var(--color-texto); font-weight: 600; }

  @media (max-width: 1023px) {
    .aporte {
      grid-template-columns: var(--aportes-portada) minmax(0, 1fr) auto;
      grid-template-areas: 'portada principal accion' 'portada estado fecha' 'nota nota nota';
      row-gap: var(--space-1);
    }
    .aporte__portada { grid-area: portada; align-self: start; }
    .aporte__principal { grid-area: principal; }
    .aporte :global(.aporte__estado) { grid-area: estado; }
    .aporte__fecha { grid-area: fecha; justify-self: end; }
    .aporte__accion { grid-area: accion; }
    .aporte__nota { grid-area: nota; }
  }

  @media (max-width: 768px) {
    .aportes-cabeza__velo { background: var(--color-velo-perfil-movil); }
    .aportes-cabeza__contenido { padding-bottom: var(--space-3); }
    .aportes-cabeza__titulo { margin-top: var(--space-1); font-size: var(--text-aportes-m); }
    .aportes-cifras { display: none; }
    .aportes-cifras-linea {
      display: block;
      margin: 0 0 var(--space-5);
      color: var(--color-texto-alto);
      font-size: var(--text-sm);
      line-height: 1.25rem;
    }
    .aportes-cuerpo { padding-top: var(--space-5); }
    .aportes-grupo + .aportes-grupo { margin-top: 1.75rem; }

    /* Fila apilada: portada y título; estado y fecha; nota; acción. */
    .aporte {
      grid-template-columns: var(--aportes-portada-m) minmax(0, 1fr);
      grid-template-areas: 'portada principal' 'meta meta' 'nota nota' 'accion accion';
      column-gap: var(--space-3);
      row-gap: 0;
      padding: 14px 0;
    }
    .aporte__portada,
    .aporte__sin-portada { width: var(--aportes-portada-m); height: var(--aportes-portada-m); align-self: center; }
    .aporte__titulo { font-size: var(--text-md); line-height: 1.375rem; }
    .aporte__sub { font-size: var(--text-xs); line-height: 1.125rem; }
    .aporte :global(.aporte__estado) { grid-area: meta; justify-self: start; margin-top: 10px; font-size: var(--text-xs); }
    .aporte__fecha { grid-area: meta; justify-self: end; margin-top: 10px; font-size: var(--text-xs); line-height: 1.125rem; }
    .aporte__nota { margin-top: 10px; font-size: var(--text-xs); line-height: 1.125rem; }
    .aporte__accion { justify-self: start; margin-top: 10px; }
    .aporte__accion :global(.ui-btn) { --btn-h: var(--control-h-lg); }
  }
</style>
