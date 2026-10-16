<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { afterNavigate, goto } from '$app/navigation';
  import { page as pageStore } from '$app/stores';
  import ReleaseEditor from '$lib/components/estudio/ReleaseEditor.svelte';
  import { getStudioContext } from '$lib/components/estudio/context';
  import { missingFields } from '$lib/domain/releaseEditor';
  import {
    NEW_RELEASE_HREF,
    STUDIO_QUICK_VIEWS,
    batchItemText,
    batchSummary,
    catalogHref,
    quickViewFromSlug,
    quickViewSlug,
    studioReleaseHref,
    studioReportsHref,
    withParams,
    type StudioQuickView
  } from '$lib/domain/studio';
  import { ToolHeader } from '$lib/layouts';
  import {
    Button,
    Checkbox,
    Chip,
    Dialog,
    EmptyState,
    ErrorState,
    Field,
    IconButton,
    LoadingIndicator,
    Notice,
    Pagination,
    Select,
    Textarea
  } from '$lib/ui';
  import { BELOW_MOBILE_QUERY } from '$lib/ui/breakpoints';
  import {
    CATALOG_BATCH_MAX,
    CATALOG_MISSING_FIELD_LABELS,
    batchUpdateCatalog,
    dictionaries,
    getArtistsByIds,
    listCatalog,
    type Artist,
    type CatalogBatchOperation,
    type CatalogBatchResult,
    type CatalogSnapshot,
    type CatalogStatus,
    type DictionaryEntry
  } from '$lib/services/adminCatalog';

  /** Lo que el lote necesita de cada lanzamiento seleccionado, tal como se leyó. */
  type Picked = Pick<CatalogSnapshot, 'id' | 'catalog_version' | 'title' | 'status'> & { missing: string[] };

  // El layout del Estudio ya comprobó sesión, rol admin y el interruptor de E07.
  const studio = getStudioContext();
  const PAGE_SIZE = 25;
  const statusLabels: Record<CatalogStatus, string> = {
    draft: 'Borrador',
    published: 'Publicado',
    archived: 'Archivado'
  };
  const statusTones: Record<CatalogStatus, 'neutral' | 'accent' | 'danger'> = {
    draft: 'neutral',
    published: 'accent',
    archived: 'danger'
  };
  const viewDescriptions: Record<StudioQuickView | 'all', string> = {
    all: 'Todos los lanzamientos, del más reciente al más antiguo.',
    draft: 'Lanzamientos en borrador.',
    incomplete: 'No se podrían publicar hoy por falta de datos, en cualquier estado.',
    missing_cover: 'Sin portada, o con una que no usa HTTPS.',
    open_reports: 'Con al menos un reporte sin resolver.'
  };

  let ready = false;
  let loading = false;
  let mobile = false;
  let notice = '';
  let listError = '';
  let query = '';
  let page = 1;
  let total = 0;
  let statusFilter: CatalogStatus | '' = '';
  let typeFilter = '';
  let quickView: StudioQuickView | null = null;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let items: CatalogSnapshot[] = [];
  let picked: Record<string, Picked> = {};
  let artists: Artist[] = [];
  let labels: DictionaryEntry[] = [];
  let genres: DictionaryEntry[] = [];
  let countries: DictionaryEntry[] = [];
  let types: DictionaryEntry[] = [];
  /** Editor (U16): lo abre la URL, ?lanzamiento=<uuid>. */
  let editorId: string | null = null;
  /** El editor se abrió desde la lista en esta pestaña: "Volver" es atrás. */
  let openedFromList = false;
  /** La lista ya se pidió al menos una vez. */
  let listLoaded = false;

  // Lote (D2): confirmar y después el informe por elemento.
  let batchOpen = false;
  let batchOperation: CatalogBatchOperation = 'publish';
  let batchReason = '';
  let batchError = '';
  let batchBusy = false;
  let batchResult: CatalogBatchResult | null = null;
  let batchSummaryEl: HTMLElement | null = null;

  const nameOf = (entries: DictionaryEntry[], id: string | null) => entries.find((entry) => entry.id === id)?.name ?? 'Sin asignar';

  // Nombres de artistas de la lista. Llegan después de las filas: leer `artists`
  // aquí lo vuelve estado y la tabla se actualiza al recibirlos.
  $: artistNames = new Map(artists.map((artist) => [artist.id, artist.name]));
  $: editing = Boolean(editorId);
  $: pickedList = Object.values(picked);
  $: pickedCount = pickedList.length;
  $: overLimit = pickedCount > CATALOG_BATCH_MAX;
  $: pageAllPicked = items.length > 0 && items.every((item) => picked[item.id]);
  $: totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  $: blockedForPublish = pickedList.filter((item) => item.missing.length > 0);
  $: hasFilters = Boolean(query.trim() || statusFilter || typeFilter);
  $: viewLabel = STUDIO_QUICK_VIEWS.find((view) => view.value === quickView)?.label ?? '';
  $: viewDescription = quickView ? `${viewLabel} · ${viewDescriptions[quickView]}` : viewDescriptions.all;
  $: statusOptions = [
    { value: '', label: 'Todos' },
    ...(Object.entries(statusLabels) as [CatalogStatus, string][]).map(([value, label]) => ({ value, label }))
  ];
  $: typeOptions = [{ value: '', label: 'Todos' }, ...types.map((type) => ({ value: type.id, label: type.name }))];
  $: viewOptions = [
    { value: '', label: 'Todos los lanzamientos' },
    ...STUDIO_QUICK_VIEWS.map((view) => ({ value: view.slug, label: view.label }))
  ];
  $: batchTitle = batchResult
    ? batchResult.applied ? 'Lote aplicado' : 'No se aplicó el lote'
    : `${batchOperation === 'publish' ? 'Publicar' : 'Archivar'} ${pickedCount === 1 ? '1 lanzamiento' : `${pickedCount} lanzamientos`}`;

  function formatDate(value: string | null, includeTime = false) {
    if (!value) return 'Sin fecha';
    const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value);
    return new Intl.DateTimeFormat('es-CO', includeTime ? { dateStyle: 'medium', timeStyle: 'short' } : { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed);
  }
  /**
   * Lo que falta para publicar, según las señales del servidor (D2). Sin ellas
   * (un entorno sin D2), la misma comprobación de cliente que usa el editor.
   */
  function missingOf(snapshot: CatalogSnapshot) {
    if (snapshot.signals) return snapshot.signals.missing_fields.map((field) => CATALOG_MISSING_FIELD_LABELS[field] ?? field);
    return missingFields(snapshot);
  }
  async function ensureArtists(ids: string[]) {
    const known = new Set(artists.map((artist) => artist.id));
    const missing = [...new Set(ids)].filter((id) => id && !known.has(id));
    if (missing.length) artists = [...artists, ...(await getArtistsByIds(missing))];
  }

  // ---------------------------------------------------------------------------
  // Lista

  async function loadList() {
    loading = true;
    listError = '';
    try {
      const result = await listCatalog({
        query,
        statuses: statusFilter ? [statusFilter] : [],
        qualities: [],
        typeIds: typeFilter ? [typeFilter] : [],
        page,
        quickView
      });
      items = result.items;
      total = result.total;
      // La selección guarda la versión leída; si la fila se volvió a leer, vale la nueva.
      let refreshed = false;
      for (const item of items) {
        if (picked[item.id]) {
          picked[item.id] = pick(item);
          refreshed = true;
        }
      }
      if (refreshed) picked = { ...picked };
      await ensureArtists(items.flatMap((item) => [...item.artist_ids, ...item.collaborator_ids]));
    } catch (cause: any) {
      listError = cause?.code === '42501' ? 'El servidor denegó el acceso administrativo.' : 'No pudimos cargar el catálogo.';
    } finally {
      loading = false;
      listLoaded = true;
    }
  }
  function scheduleListSearch() {
    clearTimeout(searchTimer);
    page = 1;
    searchTimer = setTimeout(loadList, 260);
  }
  function applyFilters() {
    page = 1;
    void loadList();
  }
  function clearFilters() {
    query = '';
    statusFilter = '';
    typeFilter = '';
    if (quickView) void goto(catalogHref());
    else applyFilters();
  }
  function goToPage(next: number) {
    page = next;
    void loadList();
  }
  function chooseView(slug: string) {
    void goto(catalogHref(quickViewFromSlug(slug)));
  }

  // ---------------------------------------------------------------------------
  // Selección y lote

  function pick(item: CatalogSnapshot): Picked {
    return { id: item.id, catalog_version: item.catalog_version, title: item.title, status: item.status, missing: missingOf(item) };
  }
  function togglePicked(item: CatalogSnapshot) {
    if (picked[item.id]) {
      const { [item.id]: _removed, ...rest } = picked;
      picked = rest;
    } else picked = { ...picked, [item.id]: pick(item) };
  }
  function togglePage() {
    if (pageAllPicked) {
      const next = { ...picked };
      for (const item of items) delete next[item.id];
      picked = next;
    } else {
      const next = { ...picked };
      for (const item of items) next[item.id] = pick(item);
      picked = next;
    }
  }
  function clearPicked() {
    picked = {};
  }
  function dropFromPicked(ids: string[]) {
    const next = { ...picked };
    for (const id of ids) delete next[id];
    picked = next;
  }
  function openBatch(operation: CatalogBatchOperation) {
    if (!pickedCount || overLimit) return;
    batchOperation = operation;
    batchReason = '';
    batchError = '';
    batchResult = null;
    batchOpen = true;
  }
  async function confirmBatch() {
    if (batchBusy) return;
    if (!batchReason.trim()) {
      batchError = 'Añade una observación del cambio. El historial de cada lanzamiento la guarda.';
      return;
    }
    if (batchOperation === 'publish' && blockedForPublish.length) return;
    batchBusy = true;
    batchError = '';
    try {
      batchResult = await batchUpdateCatalog(batchOperation, pickedList, batchReason.trim());
      if (batchResult.applied) {
        picked = {};
        notice = batchSummary(batchOperation, batchResult);
      }
      studio.refreshCounts();
      await loadList();
      await tick();
      batchSummaryEl?.focus();
    } catch (cause: any) {
      batchError = cause?.code === '42501'
        ? 'El servidor no permitió el lote. Solo administración puede publicar o archivar.'
        : cause?.code === '22023'
          ? `El lote no es válido: revisa que no pase de ${CATALOG_BATCH_MAX} lanzamientos y que la observación no esté vacía.`
          : 'No pudimos enviar el lote. Inténtalo de nuevo.';
    } finally {
      batchBusy = false;
    }
  }
  function closeBatch() {
    batchOpen = false;
    batchResult = null;
  }
  function rejectedIds(result: CatalogBatchResult) {
    return result.items.filter((item) => item.result === 'rejected').map((item) => item.release_id);
  }
  function titleOfPicked(id: string) {
    return picked[id]?.title || items.find((item) => item.id === id)?.title || 'Lanzamiento';
  }
  // Títulos del último lote, para el informe aunque la selección ya se haya vaciado.
  let batchTitles: Record<string, string> = {};
  $: if (batchOpen && !batchResult) batchTitles = Object.fromEntries(pickedList.map((item) => [item.id, item.title]));
  // ---------------------------------------------------------------------------
  // Editor (U16, en ReleaseEditor). Se abre por la URL, ?lanzamiento=<uuid>, así se puede
  // enlazar desde Propuestas y Reportes. Los lanzamientos nuevos entran por Sugerir (U19):
  // el ?nuevo=1 de antes redirige allí.

  function closeEditor() {
    if (openedFromList) window.history.back();
    else void goto(withParams($pageStore.url, { lanzamiento: null }));
  }
  function editorSaved() {
    void loadList();
    studio.refreshCounts();
  }

  /** La URL manda: vista rápida o lanzamiento abierto. */
  function syncFromUrl(url: URL) {
    const view = quickViewFromSlug(url.searchParams.get('vista'));
    if (view !== quickView || !listLoaded) {
      quickView = view;
      page = 1;
      void loadList();
    }
    const id = url.searchParams.get('lanzamiento');
    if (id) notice = '';
    editorId = id;
  }

  onMount(() => {
    if ($pageStore.url.searchParams.has('nuevo')) {
      void goto(NEW_RELEASE_HREF, { replaceState: true });
      return;
    }
    const media = window.matchMedia(BELOW_MOBILE_QUERY);
    const updateMobile = () => mobile = media.matches;
    updateMobile();
    media.addEventListener('change', updateMobile);
    void (async () => {
      try {
        ({ labels, genres, countries, types } = await dictionaries());
      } catch {
        listError = 'No pudimos cargar los diccionarios del catálogo.';
      }
      ready = true;
      syncFromUrl($pageStore.url);
    })();
    return () => {
      media.removeEventListener('change', updateMobile);
      clearTimeout(searchTimer);
    };
  });

  afterNavigate((navigation) => {
    const to = navigation.to?.url;
    if (!ready || !to || to.pathname !== $pageStore.url.pathname) return;
    if (to.searchParams.has('nuevo')) return void goto(NEW_RELEASE_HREF, { replaceState: true });
    const from = navigation.from?.url;
    const toEditor = to.searchParams.has('lanzamiento');
    const fromList = !!from && from.pathname === to.pathname && !from.searchParams.has('lanzamiento');
    if (!toEditor) openedFromList = false;
    else if (navigation.type !== 'popstate' && !editorId) openedFromList = fromList;
    if (toEditor) closeBatch();
    syncFromUrl(to);
  });
</script>

<svelte:head>{#if !editing}<title>Catálogo · Estudio — Discótica</title>{/if}</svelte:head>

<div class="catalogo">
  {#if !ready}
    <div class="catalogo__state"><LoadingIndicator label="Cargando el catálogo" /></div>
  {:else if editing}
    <ReleaseEditor
      releaseId={editorId}
      bind:labels
      bind:genres
      bind:artists
      {countries}
      {types}
      onclose={closeEditor}
      onsaved={editorSaved}
    />
  {:else}
    <ToolHeader title="Catálogo" description={viewDescription}>
      {#snippet actions()}
        {#if !mobile}<Button icon="agregar" href={NEW_RELEASE_HREF}>Nuevo lanzamiento</Button>{/if}
      {/snippet}
    </ToolHeader>

    {#if notice}<Notice tone="success" class="catalogo__notice">{notice}</Notice>{/if}

    <div class="catalogo__toolbar" role="search" aria-label="Buscar y filtrar el catálogo">
      <Field
        class="catalogo__search"
        type="search"
        icon="buscar"
        label="Buscar en el catálogo"
        hideLabel
        placeholder="Buscar por título, artista, sello o ID"
        bind:value={query}
        oninput={scheduleListSearch}
        onkeydown={(event: KeyboardEvent) => { if (event.key === 'Enter') { clearTimeout(searchTimer); applyFilters(); } }}
      />
      <div class="catalogo__vista">
        <Select label="Vista" inline options={viewOptions} value={quickViewSlug(quickView) ?? ''} onchange={chooseView} />
      </div>
      <Select label="Estado" inline options={statusOptions} bind:value={statusFilter} onchange={applyFilters} />
      <Select label="Tipo" inline options={typeOptions} bind:value={typeFilter} onchange={applyFilters} />
    </div>

    {#if pickedCount && !mobile}
      <div class="catalogo__batch" role="region" aria-label="Selección">
        <p class="catalogo__batch-count" role="status">
          <strong>{pickedCount}</strong> {pickedCount === 1 ? 'seleccionado' : 'seleccionados'}
          {#if overLimit}<span class="catalogo__batch-limit">· Un lote admite hasta {CATALOG_BATCH_MAX}. Quita {pickedCount - CATALOG_BATCH_MAX} para continuar.</span>{/if}
        </p>
        <div class="catalogo__batch-actions">
          <Button size="sm" variant="secondary" icon="check" disabled={overLimit} onclick={() => openBatch('publish')}>Publicar</Button>
          <Button size="sm" variant="secondary" disabled={overLimit} onclick={() => openBatch('archive')}>Archivar</Button>
          <Button size="sm" variant="ghost" onclick={clearPicked}>Quitar selección</Button>
        </div>
      </div>
    {/if}

    <section class="catalogo__table-card" aria-labelledby="catalogo-tabla">
      <header class="catalogo__table-head">
        <h2 id="catalogo-tabla">{viewLabel || 'Todos los lanzamientos'}</h2>
        <span>{total.toLocaleString('es-CO')} {total === 1 ? 'lanzamiento' : 'lanzamientos'}</span>
      </header>
      {#if loading && !items.length}
        <div class="catalogo__state"><LoadingIndicator label="Cargando lanzamientos" /></div>
      {:else if listError}
        <ErrorState size="inline" message={listError} onaction={loadList} retrying={loading} />
      {:else if !items.length}
        <EmptyState
          size="inline"
          message={quickView && !hasFilters ? `No hay lanzamientos en «${viewLabel}»` : 'No encontramos lanzamientos'}
          detail={hasFilters || quickView ? 'Prueba otra búsqueda o quita los filtros.' : undefined}
          actionLabel={hasFilters || quickView ? 'Quitar filtros' : undefined}
          onaction={hasFilters || quickView ? clearFilters : undefined}
        />
      {:else}
        <div class="catalogo__scroll" class:is-loading={loading}>
          <table class="catalogo__table">
            <thead>
              <tr>
                {#if !mobile}
                  <th class="col-check" scope="col">
                    <Checkbox hideLabel checked={pageAllPicked} onchange={togglePage}>Seleccionar los {items.length} de esta página</Checkbox>
                  </th>
                {/if}
                <th scope="col" class="col-release">Lanzamiento</th>
                <th scope="col" class="col-artists">Artistas</th>
                <th scope="col" class="col-type">Tipo</th>
                <th scope="col" class="col-label">Sello</th>
                <th scope="col" class="col-date">Fecha / edición</th>
                <th scope="col" class="col-status">Estado</th>
                <th scope="col" class="col-action"><span class="sr-only">Abrir</span></th>
              </tr>
            </thead>
            <tbody>
              {#each items as item (item.id)}
                {@const missing = missingOf(item)}
                {@const reports = item.signals?.open_report_count ?? 0}
                {@const href = withParams($pageStore.url, { lanzamiento: item.id, nuevo: null })}
                <tr class:is-picked={!!picked[item.id]}>
                  {#if !mobile}
                    <td class="col-check">
                      <Checkbox hideLabel checked={!!picked[item.id]} onchange={() => togglePicked(item)}>Seleccionar {item.title || 'lanzamiento sin título'}</Checkbox>
                    </td>
                  {/if}
                  <td class="col-release">
                    <a class="release-cell" {href}>
                      {#if item.cover_url}<img src={item.cover_url} alt="" loading="lazy" />{:else}<span class="release-cell__nocover" aria-hidden="true"></span>{/if}
                      <span class="release-cell__text">
                        <strong>{item.title || 'Sin título'}</strong>
                        <small>{item.slug}</small>
                      </span>
                    </a>
                  </td>
                  <td class="col-artists">{item.artist_ids.map((id) => artistNames.get(id) ?? 'Artista sin resolver').join(', ') || 'Sin artista'}</td>
                  <td class="col-type">{nameOf(types, item.release_type_id)}</td>
                  <td class="col-label">{nameOf(labels, item.label_id)}</td>
                  <td class="col-date">
                    <span>{formatDate(item.release_date)}</span>
                    <small>Editado {formatDate(item.updated_at, true)}</small>
                  </td>
                  <td class="col-status">
                    <Chip kind="status" tone={statusTones[item.status]} label={statusLabels[item.status]} />
                    {#if missing.length || reports}
                      <span class="signals">
                        {#if missing.length}<span class="signal signal--missing" title={`Falta: ${missing.join(', ')}`}>Falta: {missing.join(', ')}</span>{/if}
                        {#if reports}<a class="signal signal--reports" href={studioReportsHref(item.id)}>{reports === 1 ? '1 reporte' : `${reports} reportes`}</a>{/if}
                      </span>
                    {/if}
                  </td>
                  <td class="col-action">
                    <IconButton icon="chevron-derecha" size="sm" label={`Editar ${item.title}`} {href} tooltipAlign="end" />
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <footer class="catalogo__table-foot">
          <span>Mostrando {((page - 1) * PAGE_SIZE + 1).toLocaleString('es-CO')}–{Math.min(page * PAGE_SIZE, total).toLocaleString('es-CO')} de {total.toLocaleString('es-CO')}</span>
          <Pagination {page} {totalPages} size="sm" label="Páginas del catálogo" onchange={goToPage} />
        </footer>
      {/if}
    </section>
  {/if}
</div>

<Dialog bind:open={batchOpen} title={batchTitle} size="md" onclose={closeBatch} dismissible={!batchBusy}>
  {#if !batchResult}
    <p class="batch__lead">
      {#if batchOperation === 'publish'}
        Quedarán visibles en el catálogo. Cada uno pasa por la misma validación que al publicarlo desde el editor; si uno falla, no cambia ninguno.
      {:else}
        Dejarán de verse en el catálogo. Su identidad, colecciones e historial se conservan; si uno falla, no cambia ninguno.
      {/if}
    </p>
    {#if batchOperation === 'publish' && blockedForPublish.length}
      <Notice tone="error" title={blockedForPublish.length === 1 ? '1 lanzamiento no se puede publicar' : `${blockedForPublish.length} lanzamientos no se pueden publicar`}>
        Les faltan datos. Complétalos en el editor o quítalos de la selección.
        {#snippet actions()}
          <Button size="sm" variant="secondary" onclick={() => dropFromPicked(blockedForPublish.map((item) => item.id))}>Quitar de la selección</Button>
        {/snippet}
      </Notice>
    {/if}
    <ul class="batch__list" aria-label="Lanzamientos del lote">
      {#each pickedList as item (item.id)}
        <li class="batch__item">
          <span class="batch__title">{item.title || 'Sin título'}</span>
          {#if batchOperation === 'publish' && item.missing.length}
            <span class="batch__detail batch__detail--warn">Falta: {item.missing.join(', ')}</span>
          {:else}
            <span class="batch__detail">{statusLabels[item.status]}</span>
          {/if}
        </li>
      {/each}
    </ul>
    <Textarea label="Observación del cambio" required rows={2} bind:value={batchReason} hint="Se guarda en el historial de cada lanzamiento del lote." />
    {#if batchError}<Notice tone="error">{batchError}</Notice>{/if}
  {:else}
    <div class="batch__summary" tabindex="-1" bind:this={batchSummaryEl}>
      <Notice tone={batchResult.applied ? 'success' : 'error'} title={batchSummary(batchResult.operation, batchResult)}>
        {#if !batchResult.applied && batchResult.items.some((item) => item.result === 'rejected' && item.error.code === '40001')}
          Alguien cambió uno o más lanzamientos mientras los tenías seleccionados. La lista ya se recargó con las versiones nuevas.
        {:else if !batchResult.applied}
          Corrige o quita los rechazados y vuelve a intentarlo.
        {/if}
      </Notice>
    </div>
    <ul class="batch__list" aria-label="Resultado por lanzamiento">
      {#each batchResult.items as item (item.release_id)}
        <li class="batch__item batch__item--{item.result}">
          <span class="batch__title">{batchTitles[item.release_id] || titleOfPicked(item.release_id)}</span>
          <span class="batch__detail">{batchItemText(batchResult.operation, item)}</span>
          {#if item.result === 'rejected' && item.error.code !== 'P0002'}
            <a class="batch__open" href={studioReleaseHref(item.release_id)}>Abrir en el editor</a>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
  {#snippet footer()}
    {#if !batchResult}
      <Button variant="secondary" onclick={closeBatch} disabled={batchBusy}>Cancelar</Button>
      <Button
        variant={batchOperation === 'archive' ? 'destructive' : 'primary'}
        loading={batchBusy}
        disabled={batchOperation === 'publish' && blockedForPublish.length > 0}
        onclick={confirmBatch}
      >
        {batchOperation === 'publish' ? 'Publicar' : 'Archivar'} {pickedCount}
      </Button>
    {:else}
      {#if !batchResult.applied && rejectedIds(batchResult).length}
        <Button variant="secondary" onclick={() => { dropFromPicked(rejectedIds(batchResult!)); closeBatch(); }}>Quitar los rechazados</Button>
      {/if}
      <Button onclick={closeBatch}>Cerrar</Button>
    {/if}
  {/snippet}
</Dialog>

<style>
  /* ---- Lista del Estudio (U15). Primitivas y tokens; densidad de E07. ---- */
  .catalogo { color: var(--color-texto); }
  .catalogo__state { display: grid; place-items: center; min-height: 16rem; }
  .catalogo > :global(.catalogo__notice) { margin-bottom: var(--density-pad); }

  .catalogo__toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-4);
    margin-bottom: var(--space-3);
  }
  .catalogo__toolbar :global(.catalogo__search) { flex: 1 1 22rem; min-width: 0; }
  .catalogo__vista { display: none; }

  .catalogo__batch {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2) var(--space-4);
    margin-bottom: var(--space-3);
    padding: var(--space-2) var(--space-4);
    border: 1px solid var(--color-acento-border);
    border-radius: var(--radius-sm);
    background: var(--color-acento-tinte);
  }
  .catalogo__batch-count { margin: 0; color: var(--color-texto-medio); font-size: var(--density-text); }
  .catalogo__batch-count strong { color: var(--color-acento); }
  .catalogo__batch-limit { color: var(--color-aviso); }
  .catalogo__batch-actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }

  .catalogo__table-card {
    overflow: hidden;
    border: 1px solid var(--color-borde);
    border-radius: var(--radius-sm);
    background: var(--color-panel);
  }
  .catalogo__table-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--color-borde);
  }
  .catalogo__table-head h2 { margin: 0; font-size: var(--text-sm); font-weight: 700; }
  .catalogo__table-head span { color: var(--color-texto-tenue); font-size: var(--text-2xs); font-variant-numeric: tabular-nums; }

  /* Posicionado: los textos solo para lectores (absolutos) de las celdas se
     quedan dentro del desplazamiento horizontal y no ensanchan la página. */
  .catalogo__scroll { position: relative; overflow-x: auto; transition: opacity var(--motion-fast) var(--ease-standard); }
  .catalogo__scroll.is-loading { opacity: 0.55; }
  .catalogo__table { width: 100%; min-width: var(--tool-table-min-w); border-collapse: collapse; table-layout: fixed; }
  .catalogo__table th {
    height: var(--density-row-h);
    padding: 0 var(--space-3);
    color: var(--color-texto-tenue);
    font-size: var(--text-2xs);
    font-weight: 700;
    letter-spacing: var(--nav-letter-spacing);
    text-align: left;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .catalogo__table td {
    height: var(--tool-row-h);
    padding: 0 var(--space-3);
    border-top: 1px solid var(--color-borde);
    color: var(--color-texto-alto);
    font-size: var(--text-2xs);
    vertical-align: middle;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .catalogo__table tbody tr:hover { background: var(--color-superficie-1); }
  .catalogo__table tbody tr.is-picked { background: var(--color-acento-tinte); }

  .catalogo__table .col-check { width: calc(var(--target-touch) + var(--space-2)); padding: 0 0 0 var(--space-2); }
  .catalogo__table .col-release { width: 27%; }
  .catalogo__table .col-artists { width: 17%; }
  .catalogo__table .col-type { width: 8%; }
  .catalogo__table .col-label { width: 12%; }
  .catalogo__table .col-date { width: 14%; }
  .catalogo__table .col-status { width: 14%; }
  .catalogo__table .col-action { width: calc(var(--target-touch) + var(--space-2)); padding: 0 var(--space-1); text-align: right; }

  .release-cell {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
    color: inherit;
    text-decoration: none;
  }
  .release-cell img,
  .release-cell__nocover {
    flex: 0 0 var(--tool-thumb);
    width: var(--tool-thumb);
    height: var(--tool-thumb);
    border-radius: var(--radius-xs);
    object-fit: cover;
    background: var(--color-superficie-2);
  }
  .release-cell__nocover { border: 1px dashed var(--color-linea-fuerte); box-sizing: border-box; }
  .release-cell__text { display: grid; min-width: 0; }
  .release-cell strong,
  .release-cell small { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .release-cell strong { color: var(--color-texto); font-size: var(--text-xs); }
  .release-cell small { color: var(--color-texto-tenue); font-size: var(--text-2xs); }
  .release-cell:hover strong { color: var(--color-acento); }

  .col-date span,
  .col-date small { display: block; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
  .col-date small { margin-top: var(--space-1); color: var(--color-texto-tenue); }

  .col-status { line-height: 1.3; }
  .signals { display: flex; gap: var(--space-2); min-width: 0; margin-top: var(--space-1); }
  .signal { min-width: 0; overflow: hidden; font-size: var(--text-2xs); white-space: nowrap; text-overflow: ellipsis; }
  .signal--missing { color: var(--color-aviso); }
  .signal--reports { flex-shrink: 0; color: var(--color-danger-texto); }
  .signal--reports:hover { color: var(--color-texto); }

  .catalogo__table-foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    border-top: 1px solid var(--color-borde);
    color: var(--color-texto-tenue);
    font-size: var(--text-2xs);
    font-variant-numeric: tabular-nums;
  }

  /* Lote */
  .batch__lead { margin: 0 0 var(--space-3); color: var(--color-texto-medio); font-size: var(--text-sm); line-height: 1.5; }
  .batch__list {
    max-height: var(--tool-dialog-list-max-h);
    overflow-y: auto;
    margin: var(--space-3) 0;
    padding: 0;
    border: 1px solid var(--color-borde);
    border-radius: var(--radius-sm);
    list-style: none;
  }
  .batch__item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--space-1) var(--space-3);
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-2xs);
  }
  .batch__item + .batch__item { border-top: 1px solid var(--color-borde); }
  .batch__title { overflow: hidden; color: var(--color-texto); font-weight: 600; white-space: nowrap; text-overflow: ellipsis; }
  .batch__detail { color: var(--color-texto-tenue); text-align: right; }
  .batch__detail--warn,
  .batch__item--rejected .batch__detail { color: var(--color-danger-texto); }
  .batch__item--applied .batch__detail { color: var(--color-acento); }
  .batch__item--rejected .batch__detail { grid-column: 1 / -1; text-align: left; }
  .batch__open { grid-column: 1 / -1; color: var(--color-acento); font-size: var(--text-2xs); }
  .batch__summary:focus { outline: none; }


  /* Tablet: sin barra lateral (ToolLayout), la vista rápida va en el selector. */
  @media (max-width: 1023px) {
    .catalogo__vista { display: block; }
    /* El tipo cede su sitio para que estado y señales no se corten. */
    .catalogo__table .col-type { display: none; }
    .catalogo__table .col-release { width: 30%; }
    .catalogo__table .col-artists { width: 18%; }
    .catalogo__table .col-status { width: 17%; }
  }

  /* Móvil: consulta, como el editor de E07. Sin selección ni lote; la vista
     rápida pasa a un selector porque la barra lateral solo muestra secciones. */
  @media (max-width: 767px) {
    .catalogo__toolbar { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--space-2) var(--space-3); }
    .catalogo__toolbar :global(.catalogo__search),
    .catalogo__vista { display: block; grid-column: 1 / -1; }
    .catalogo__toolbar :global(.ui-select__control) { flex: 1; }
    .catalogo__scroll { overflow: visible; }
    .catalogo__table { min-width: 0; table-layout: auto; }
    .catalogo__table thead { display: none; }
    .catalogo__table,
    .catalogo__table tbody { display: block; }
    .catalogo__table tbody tr {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: var(--space-1) var(--space-2);
      padding: var(--space-3) var(--space-4);
      border-top: 1px solid var(--color-borde);
    }
    .catalogo__table td { display: block; height: auto; padding: 0; border: 0; white-space: normal; }
    .catalogo__table .col-release { grid-column: 1; width: auto; }
    .catalogo__table .col-action { grid-column: 2; grid-row: 1; width: auto; }
    .catalogo__table .col-artists,
    .catalogo__table .col-status { grid-column: 1 / -1; width: auto; padding-left: calc(var(--tool-thumb) + var(--space-3)); }
    .catalogo__table .col-artists { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; }
    .catalogo__table .col-type,
    .catalogo__table .col-label,
    .catalogo__table .col-date { display: none; }
    .signals { flex-wrap: wrap; }
  }
</style>
