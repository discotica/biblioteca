<script lang="ts">
  // Colección (U14). Acciones explícitas arriba (compartir, editar, eliminar),
  // grilla o lista recordada, sin notas visibles y, para el dueño, orden manual
  // arrastrando (D1). Carga solo sus lanzamientos, por ID: nunca el catálogo.
  import { onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { pageSlice, totalPagesFor, RELEASES_PER_PAGE } from '$lib/domain/homeSearchView';
  import type { Release } from '$lib/utils/catalogoStore';
  import { slugFromLanzamiento } from '$lib/utils/slugLanzamiento';
  import {
    agregarItem,
    enlaceColeccion,
    lanzamientosDeItems,
    obtenerItemsOrdenados,
    quitarItem,
    reordenarItems,
    type Crate,
    type CrateItem
  } from '$lib/stores/cratesStore';
  import LanzamientoCard from '$lib/components/LanzamientoCard.svelte';
  import LanzamientoFila from '$lib/components/LanzamientoFila.svelte';
  import LanzamientoModal from '$lib/components/LanzamientoModal.svelte';
  import PageLayout from '$lib/layouts/PageLayout.svelte';
  import {
    Button,
    EmptyState,
    ErrorState,
    IconButton,
    LoadingIndicator,
    Notice,
    Pagination,
    Skeleton,
    Sortable,
    ViewToggle,
    readViewPreference,
    type ViewMode
  } from '$lib/ui';
  import CollectionFormDialog from '$lib/components/colecciones/CollectionFormDialog.svelte';
  import DeleteCollectionDialog from '$lib/components/colecciones/DeleteCollectionDialog.svelte';
  import { copyLink } from '$lib/components/colecciones/share';

  type PageCrate = Crate & { profiles: { username: string; display_name: string | null } };

  let {
    data
  }: {
    data: { crate: PageCrate; items: CrateItem[]; ordenManual: boolean; esDueno: boolean };
  } = $props();

  const VIEW_CONTEXT = 'coleccion';

  // svelte-ignore state_referenced_locally
  let crate = $state<PageCrate>(data.crate);
  // svelte-ignore state_referenced_locally
  let items = $state<CrateItem[]>(data.items);
  // svelte-ignore state_referenced_locally
  let ordenManual = $state(data.ordenManual);
  let releases = $state(new Map<string, Release>());
  let loading = $state(true);
  let loadError = $state(false);

  // Grilla o lista, leída antes del primer pintado para que la vista no salte.
  let view = $state<ViewMode>(readViewPreference(VIEW_CONTEXT) ?? 'grid');

  let copied = $state(false);
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  let notice = $state<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  /** Último elemento quitado, para deshacer. */
  let removed = $state<{ item: CrateItem; index: number; release: Release | undefined } | null>(null);

  let formOpen = $state(false);
  let deleteOpen = $state(false);
  let activeRelease = $state<Release | null>(null);

  const owner = $derived(crate.profiles);
  const esDueno = $derived(data.esDueno);
  const canReorder = $derived(esDueno && ordenManual && items.length > 1);
  const count = $derived(items.length);

  // Paginación "x de y" (U10). Quitar un elemento puede dejar la última página
  // vacía: se acota al total. Se reordena dentro de la página visible.
  let currentPage = $state(1);
  let resultsEl = $state<HTMLElement>();
  const totalPages = $derived(totalPagesFor(items.length));
  const pageNumber = $derived(Math.min(currentPage, totalPages));
  const visible = $derived(pageSlice(items, pageNumber));

  const crumbs = $derived(
    esDueno
      ? [{ label: 'Mis colecciones', href: '/mis-colecciones' }, { label: crate.name }]
      : [
          { label: `@${owner.username}`, href: `/perfil/${owner.username}` },
          { label: 'Colecciones', href: `/perfil/${owner.username}#colecciones` },
          { label: crate.name }
        ]
  );

  async function loadReleases() {
    loading = true;
    loadError = false;
    try {
      releases = await lanzamientosDeItems(items);
    } catch (error) {
      console.error('No se pudieron cargar los lanzamientos de la colección:', error);
      loadError = true;
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void loadReleases();
    return () => clearTimeout(copyTimer);
  });

  async function share() {
    if (!(await copyLink(enlaceColeccion(crate, owner.username)))) {
      notice = { tone: 'error', text: 'No pudimos copiar el enlace. Copia la dirección del navegador.' };
      return;
    }
    copied = true;
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => (copied = false), 1500);
  }

  async function goToPage(next: number) {
    currentPage = next;
    await tick();
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    resultsEl?.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' });
  }

  // ---------- Orden manual (D1) ----------
  // Cada cambio envía la colección completa. Los envíos van en cola: entre dos
  // seguidos gana el último, como en la base.
  let queue: Promise<void> = Promise.resolve();

  async function reload(message: string) {
    try {
      const fresh = await obtenerItemsOrdenados(crate.id);
      items = fresh.items;
      ordenManual = fresh.ordenManual;
      await loadReleases();
    } catch {
      loadError = true;
    }
    notice = { tone: 'info', text: message };
  }

  function reorderPage(pageItems: CrateItem[]) {
    const start = (pageNumber - 1) * RELEASES_PER_PAGE;
    const previous = items;
    const next = [...items.slice(0, start), ...pageItems, ...items.slice(start + pageItems.length)];
    items = next;
    notice = null;
    queue = queue.then(async () => {
      const result = await reordenarItems(crate.id, next.map((item) => item.id));
      if (result.ok) return;
      if (result.motivo === 'coleccion-cambio') {
        await reload('La colección cambió en otra ventana. Cargamos el orden actual; vuelve a mover lo que necesites.');
      } else {
        items = previous;
        notice = { tone: 'error', text: 'No pudimos guardar el orden. Vuelve a intentarlo.' };
      }
    });
  }

  // ---------- Quitar y deshacer ----------
  async function remove(item: CrateItem) {
    const index = items.findIndex((candidate) => candidate.id === item.id);
    if (!(await quitarItem(crate.id, item.id))) {
      notice = { tone: 'error', text: 'No pudimos quitarlo. Vuelve a intentarlo.' };
      return;
    }
    items = items.filter((candidate) => candidate.id !== item.id);
    removed = { item, index, release: releases.get(item.id) };
    notice = null;
  }

  async function undoRemove() {
    if (!removed) return;
    const { item, index, release } = removed;
    removed = null;
    const added = await agregarItem(crate.id, item.lanzamiento_slug, item.release_id ?? undefined, item.note ?? undefined);
    if (!added.ok && !added.yaExiste) {
      notice = { tone: 'error', text: 'No pudimos devolverlo a la colección.' };
      return;
    }
    // El alta vuelve al final (D1): se recoloca donde estaba.
    const fresh = await obtenerItemsOrdenados(crate.id).catch(() => null);
    if (!fresh) return reload('Recargamos la colección.');
    const restored = fresh.items.find((candidate) =>
      item.release_id ? candidate.release_id === item.release_id : candidate.lanzamiento_slug === item.lanzamiento_slug
    );
    if (restored && release) releases = new Map(releases).set(restored.id, release);
    if (!restored || !fresh.ordenManual) {
      items = fresh.items;
      return;
    }
    const order = fresh.items.filter((candidate) => candidate.id !== restored.id);
    order.splice(Math.min(index, order.length), 0, restored);
    items = order;
    const result = await reordenarItems(crate.id, order.map((candidate) => candidate.id));
    if (!result.ok) await reload('Lo devolvimos al final de la colección.');
  }

  const removedName = $derived(removed ? removed.release?.title ?? 'El lanzamiento' : '');
  const releaseName = (item: CrateItem) => releases.get(item.id)?.title ?? 'Lanzamiento no disponible';
</script>

<svelte:head>
  <title>{crate.name} — Biblioteca Discótica</title>
</svelte:head>

<PageLayout breadcrumbs={crumbs} title={crate.name} description={crate.description || undefined}>
  {#snippet meta()}
    <p class="collection-meta">
      {count} {count === 1 ? 'lanzamiento' : 'lanzamientos'}{#if !crate.is_public} · Privada: solo tú la ves{/if}
    </p>
  {/snippet}
  {#snippet actions()}
    <div class="collection-actions">
      <Button
        variant="secondary"
        icon={copied ? 'check' : undefined}
        disabled={!crate.is_public}
        title={crate.is_public ? undefined : 'Es privada: hazla pública para compartirla'}
        onclick={share}
      >{copied ? 'Copiado' : 'Compartir'}</Button>
      {#if esDueno}
        <Button variant="secondary" onclick={() => (formOpen = true)}>Editar</Button>
        <Button variant="destructive" onclick={() => (deleteOpen = true)}>Eliminar</Button>
      {/if}
      <span class="sr-only" role="status">{copied ? 'Enlace copiado' : ''}</span>
    </div>
  {/snippet}

  {#if removed}
    <Notice tone="info" class="collection-notice">
      «{removedName}» ya no está en la colección.
      {#snippet actions()}<Button variant="secondary" size="sm" onclick={undoRemove}>Deshacer</Button>{/snippet}
    </Notice>
  {:else if notice}
    <Notice tone={notice.tone} class="collection-notice">{notice.text}</Notice>
  {/if}

  {#if items.length > 0}
    <div class="collection-toolbar">
      <p class="collection-toolbar__hint">
        {#if canReorder}Arrastra el asa para cambiar el orden.{/if}
      </p>
      <ViewToggle bind:value={view} context={VIEW_CONTEXT} />
    </div>
  {/if}

  {#if items.length === 0}
    <EmptyState
      message="Esta colección está vacía."
      detail={esDueno ? 'Añade lanzamientos desde su ficha, con «Añadir a colección».' : undefined}
      actionLabel={esDueno ? 'Explorar el catálogo' : undefined}
      actionHref={esDueno ? '/' : undefined}
    />
  {:else if loadError}
    <ErrorState message="No pudimos cargar los lanzamientos de esta colección." onaction={loadReleases} />
  {:else if loading}
    <LoadingIndicator label="Cargando lanzamientos" />
    <div class={view === 'grid' ? 'lanzamientos-grilla' : 'lanzamientos-lista'} aria-hidden="true">
      {#each visible as item (item.id)}<Skeleton variant={view === 'grid' ? 'card' : 'row'} />{/each}
    </div>
  {:else}
    <div class="collection-results" class:collection-results--list={view === 'list'} bind:this={resultsEl}>
      {#if canReorder}
        {#key `${view}-${pageNumber}`}
          <Sortable
            items={visible}
            key={(item) => item.id}
            itemLabel={releaseName}
            label={`Orden de «${crate.name}»`}
            layout={view === 'grid' ? 'grid' : 'list'}
            listClass={view === 'grid' ? 'lanzamientos-grilla' : 'lanzamientos-lista'}
            bare
            onreorder={reorderPage}
          >
            {#snippet item(entry)}{@render collectionItem(entry)}{/snippet}
          </Sortable>
        {/key}
      {:else}
        <ul class={view === 'grid' ? 'lanzamientos-grilla' : 'lanzamientos-lista'} aria-label={`Lanzamientos de «${crate.name}»`}>
          {#each visible as entry (entry.id)}<li class="collection-cell">{@render collectionItem(entry)}</li>{/each}
        </ul>
      {/if}
    </div>
    {#if totalPages > 1}
      <div class="collection-pagination">
        <Pagination page={pageNumber} {totalPages} label="Paginación de la colección" onchange={goToPage} />
      </div>
    {/if}
  {/if}
</PageLayout>

{#snippet collectionItem(entry: CrateItem)}
  {@const release = releases.get(entry.id)}
  <div class="collection-item collection-item--{view}">
    {#if release}
      {#if view === 'grid'}
        <LanzamientoCard lanzamiento={release} onabrir={(next) => (activeRelease = next)} />
      {:else}
        <LanzamientoFila lanzamiento={release} onabrir={(next) => (activeRelease = next)} />
      {/if}
    {:else}
      <div class="collection-missing">
        <p>Este lanzamiento ya no está en el catálogo.</p>
      </div>
    {/if}
    {#if esDueno}
      <span class="collection-item__remove">
        <IconButton
          icon="cerrar"
          label={`Quitar «${releaseName(entry)}» de la colección`}
          size="sm"
          variant={view === 'grid' ? 'secondary' : 'ghost'}
          tooltipAlign="end"
          onclick={() => remove(entry)}
        />
      </span>
    {/if}
  </div>
{/snippet}

{#if activeRelease}
  {#key slugFromLanzamiento(activeRelease)}
    <LanzamientoModal lanzamiento={activeRelease} on:cerrar={() => (activeRelease = null)} />
  {/key}
{/if}

{#if esDueno}
  <CollectionFormDialog
    bind:open={formOpen}
    {crate}
    onsaved={(saved) => {
      crate = { ...crate, name: saved.name, description: saved.description, is_public: saved.is_public };
      notice = { tone: 'success', text: 'Guardamos los cambios.' };
    }}
  />
  <DeleteCollectionDialog
    bind:open={deleteOpen}
    crate={{ ...crate, item_count: items.length }}
    ondeleted={() => goto('/mis-colecciones')}
  />
{/if}

<style>
  .collection-actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  /* Móvil: las tres acciones en una línea, repartidas. */
  @media (max-width: 479px) {
    .collection-actions { flex-wrap: nowrap; width: 100%; }
    .collection-actions :global(.ui-btn) { flex: 1 1 0; --btn-px: var(--space-3); }
  }
  .collection-meta { margin: 0; color: var(--color-texto-tenue); font-size: var(--text-xs); }
  :global(.collection-notice) { margin-bottom: var(--space-5); }

  .collection-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    margin-bottom: var(--space-4);
  }
  .collection-toolbar__hint { margin: 0; color: var(--color-texto-tenue); font-size: var(--text-xs); }

  .collection-results { scroll-margin-top: var(--space-6); }
  .collection-results ul { margin: 0; padding: 0; list-style: none; }
  .collection-pagination { display: flex; justify-content: center; margin: var(--space-6) 0; }

  /* La celda se estira con su fila (U8): la tarjeta ocupa el alto sobrante. */
  .collection-cell { display: flex; width: 100%; min-width: 0; }
  .collection-item { position: relative; display: flex; flex: 1; flex-direction: column; width: 100%; min-width: 0; }
  .collection-item > :global(.card) { flex: 1; }

  /* Lista: la fila ocupa el ancho y "Quitar" va a su derecha; el separador es de
     la celda completa (asa, fila y quitar), no solo de la fila. */
  .collection-item--list { flex-direction: row; align-items: center; }
  .collection-item--list > :global(.fila) { flex: 1; min-width: 0; border-bottom: 0; }
  .collection-results--list :global(.lanzamientos-lista > li) { border-bottom: 1px solid var(--color-linea-sutil); }

  /* Grilla: "Quitar" sobre la esquina de la portada, como el asa en la opuesta. */
  .collection-item--grid .collection-item__remove {
    position: absolute;
    top: var(--space-2);
    right: var(--space-2);
    z-index: var(--layer-raised);
  }
  .collection-item--grid .collection-item__remove :global(.ui-btn) { background: var(--color-velo); }
  .collection-item--list .collection-item__remove { flex: none; padding-right: var(--space-2); }

  .collection-missing {
    display: grid;
    place-items: center;
    flex: 1;
    min-height: var(--row-cover);
    padding: var(--space-5);
    border: 1px dashed var(--color-linea);
    border-radius: var(--radius-sm);
    color: var(--color-texto-tenue);
    font-size: var(--text-sm);
    text-align: center;
  }
  .collection-missing p { margin: 0; }
  .collection-item--grid .collection-missing { aspect-ratio: 1 / 1; }
</style>
