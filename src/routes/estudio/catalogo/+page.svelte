<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { afterNavigate, goto } from '$app/navigation';
  import { page as pageStore } from '$app/stores';
  import ReleaseEditor from '$lib/components/estudio/ReleaseEditor.svelte';
  import { getStudioContext } from '$lib/components/estudio/context';
  import { mergeById, missingFields } from '$lib/domain/releaseEditor';
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
    reportReturnId,
    studioReportHref,
    type StudioQuickView
  } from '$lib/domain/studio';
  import SelectionBar from '$lib/components/estudio/SelectionBar.svelte';
  import { ToolHeader } from '$lib/layouts';
  import {
    Button,
    Checkbox,
    Dialog,
    EmptyState,
    ErrorState,
    Field,
    Icon,
    IconButton,
    LoadingIndicator,
    Notice,
    Pagination,
    Select,
    StatusDot,
    Textarea,
    type IconName,
    type StatusTone
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
  // Verde = publicado · contorno = borrador · rojo = archivado (guía de voz, regla 4).
  const statusTones: Record<CatalogStatus, StatusTone> = {
    draft: 'draft',
    published: 'ok',
    archived: 'danger'
  };
  /**
   * Vacío por vista (guía de voz, regla 5): título de dos o tres palabras, una
   * línea de contexto y, si hay a dónde ir, una acción.
   */
  const emptyByView: Record<StudioQuickView, { icon: IconName; message: string; detail: string }> = {
    draft: { icon: 'bandeja', message: 'Sin borradores', detail: 'Todo lo que entra al catálogo está publicado o archivado.' },
    incomplete: { icon: 'check', message: 'Nada incompleto', detail: 'Todos se podrían publicar hoy.' },
    missing_cover: { icon: 'check', message: 'Todo con portada', detail: 'Ninguno está sin portada ni con una que no use HTTPS.' },
    open_reports: { icon: 'check', message: 'Sin reportes abiertos', detail: 'Ningún lanzamiento tiene reportes por resolver.' }
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
  $: empty = hasFilters
    ? { icon: 'buscar' as IconName, message: 'Sin resultados', detail: 'Prueba otra búsqueda o quita los filtros.', action: 'Quitar filtros' }
    : quickView
      ? { ...emptyByView[quickView], action: 'Ver todo el catálogo' }
      : { icon: 'bandeja' as IconName, message: 'Sin lanzamientos', detail: undefined, action: undefined };
  $: from = (page - 1) * PAGE_SIZE + 1;
  $: to = Math.min(page * PAGE_SIZE, total);
  $: statusOptions = [
    { value: '', label: 'Todos' },
    ...(Object.entries(statusLabels) as [CatalogStatus, string][]).map(([value, label]) => ({ value, label }))
  ];
  $: typeOptions = [{ value: '', label: 'Todos' }, ...types.map((type) => ({ value: type.id, label: type.name }))];
  $: viewOptions = [
    { value: '', label: 'Todos' },
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
  /** RC2-P1-01: la lista se lee después del await y se fusiona por id; la carga del editor no se pierde. */
  async function ensureArtists(ids: string[]) {
    const known = new Set(artists.map((artist) => artist.id));
    const missing = [...new Set(ids)].filter((id) => id && !known.has(id));
    if (!missing.length) return;
    const found = await getArtistsByIds(missing);
    artists = mergeById(artists, found);
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

  /** U24: abierto desde un reporte (?desde=reporte:<id>): cerrar y guardar vuelven a él. */
  $: fromReport = reportReturnId($pageStore.url.searchParams.get('desde'));

  function closeEditor() {
    if (fromReport) void goto(studioReportHref(fromReport));
    else if (openedFromList) window.history.back();
    else void goto(withParams($pageStore.url, { lanzamiento: null }));
  }
  function editorSaved(written = false) {
    studio.refreshCounts();
    // Guardado desde un reporte: vuelve con «Resuelto» elegido, sin guardarlo.
    if (written && fromReport) return void goto(studioReportHref(fromReport, true));
    void loadList();
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
      {genres}
      bind:artists
      {countries}
      {types}
      onclose={closeEditor}
      backLabel={fromReport ? 'Volver al reporte' : undefined}
      onsaved={editorSaved}
    />
  {:else}
    <ToolHeader
      title={viewLabel || 'Catálogo'}
      crumb={viewLabel ? 'Catálogo' : undefined}
      count={listLoaded && !listError ? total : undefined}
    >
      {#snippet actions()}
        <!-- El nombre accesible conserva «lanzamiento»: la etiqueta visible es «Nuevo». -->
        {#if !mobile}<Button icon="agregar" href={NEW_RELEASE_HREF} aria-label="Nuevo lanzamiento">Nuevo</Button>{/if}
      {/snippet}
    </ToolHeader>

    {#if notice}<Notice tone="success" class="catalogo__notice">{notice}</Notice>{/if}

    {#if pickedCount && !mobile}
      <SelectionBar
        class="catalogo__selection"
        count={pickedCount}
        note={overLimit ? `Un lote admite hasta ${CATALOG_BATCH_MAX}. Quita ${pickedCount - CATALOG_BATCH_MAX} para continuar.` : undefined}
        onclear={clearPicked}
      >
        <Button size="sm" variant="secondary" icon="check" disabled={overLimit} onclick={() => openBatch('publish')}>Publicar</Button>
        <Button size="sm" variant="secondary" disabled={overLimit} onclick={() => openBatch('archive')}>Archivar</Button>
      </SelectionBar>
    {:else}
      <div class="catalogo__toolbar" role="search" aria-label="Buscar y filtrar el catálogo">
        <Field
          class="catalogo__search"
          type="search"
          icon="buscar"
          label="Buscar en el catálogo"
          hideLabel
          placeholder="Título, artista, sello o ID"
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
    {/if}

    <section class="catalogo__table-card" aria-label="Lanzamientos">
      {#if loading && !items.length}
        <div class="catalogo__state"><LoadingIndicator label="Cargando lanzamientos" /></div>
      {:else if listError}
        <ErrorState size="inline" message={listError} onaction={loadList} retrying={loading} />
      {:else}
        <div class="catalogo__scroll" class:is-loading={loading}>
          <table class="catalogo__table">
            <thead>
              <tr>
                {#if !mobile}
                  <th class="col-check" scope="col">
                    {#if items.length}<Checkbox hideLabel checked={pageAllPicked} onchange={togglePage}>Seleccionar los {items.length} de esta página</Checkbox>{/if}
                  </th>
                {/if}
                <th scope="col" class="col-release">Lanzamiento</th>
                <th scope="col" class="col-artists">Artistas</th>
                <th scope="col" class="col-type">Tipo</th>
                <th scope="col" class="col-label">Sello</th>
                <th scope="col" class="col-date">Fecha</th>
                <th scope="col" class="col-status">Estado</th>
                <th scope="col" class="col-signals"><span class="sr-only">Señales</span></th>
                <th scope="col" class="col-action"><span class="sr-only">Abrir</span></th>
              </tr>
            </thead>
            {#if items.length}
              <tbody>
                {#each items as item (item.id)}
                  {@const missing = missingOf(item)}
                  {@const lacksCover = missing.includes('Portada')}
                  {@const lacksData = missing.filter((field) => field !== 'Portada')}
                  {@const reports = item.signals?.open_report_count ?? 0}
                  {@const href = withParams($pageStore.url, { lanzamiento: item.id, nuevo: null })}
                  {@const artists = item.artist_ids.map((id) => artistNames.get(id) ?? 'Artista sin resolver').join(', ') || 'Sin artista'}
                  <tr class:is-picked={!!picked[item.id]}>
                    {#if !mobile}
                      <td class="col-check">
                        <Checkbox hideLabel checked={!!picked[item.id]} onchange={() => togglePicked(item)}>Seleccionar {item.title || 'lanzamiento sin título'}</Checkbox>
                      </td>
                    {/if}
                    <td class="col-release">
                      <!-- D3: el slug y la última edición salen de la fila y quedan en el tooltip del título. -->
                      <a class="release-cell" {href} title={`${item.slug} · Editado ${formatDate(item.updated_at, true)}`}>
                        {#if item.cover_url}<img src={item.cover_url} alt="" loading="lazy" />{:else}<span class="release-cell__nocover" aria-hidden="true"></span>{/if}
                        <strong>{item.title || 'Sin título'}</strong>
                      </a>
                    </td>
                    <td class="col-artists" title={artists}>{artists}</td>
                    <td class="col-type" title={nameOf(types, item.release_type_id)}>{nameOf(types, item.release_type_id)}</td>
                    <td class="col-label" title={nameOf(labels, item.label_id)}>{nameOf(labels, item.label_id)}</td>
                    <td class="col-date">{formatDate(item.release_date)}</td>
                    <td class="col-status"><StatusDot tone={statusTones[item.status]} label={statusLabels[item.status]} /></td>
                    <td class="col-signals">
                      {#if lacksCover}
                        <span class="signal signal--missing" role="img" aria-label="Falta: Portada" title="Falta: Portada"><Icon name="imagen-off" size="sm" /></span>
                      {/if}
                      {#if lacksData.length}
                        <span class="signal signal--missing" role="img" aria-label={`Falta: ${lacksData.join(', ')}`} title={`Falta: ${lacksData.join(', ')}`}><Icon name="aviso" size="sm" /></span>
                      {/if}
                      {#if reports}
                        <a
                          class="signal signal--reports"
                          href={studioReportsHref(item.id)}
                          aria-label={reports === 1 ? '1 reporte abierto' : `${reports} reportes abiertos`}
                          title={reports === 1 ? '1 reporte abierto' : `${reports} reportes abiertos`}
                        ><Icon name="reportar" size="sm" />{reports}</a>
                      {/if}
                    </td>
                    <td class="col-action">
                      <IconButton icon="chevron-derecha" size="sm" label={`Editar ${item.title}`} {href} tooltipAlign="end" />
                    </td>
                  </tr>
                {/each}
              </tbody>
            {/if}
          </table>
        </div>
        {#if items.length}
          <footer class="catalogo__table-foot">
            <span>{from.toLocaleString('es-CO')}–{to.toLocaleString('es-CO')} de {total.toLocaleString('es-CO')}</span>
            <Pagination {page} {totalPages} size="sm" label="Páginas del catálogo" onchange={goToPage} />
          </footer>
        {:else}
          <EmptyState
            size="inline"
            class="catalogo__empty"
            icon={empty.icon}
            message={empty.message}
            detail={empty.detail}
            actionLabel={empty.action}
            onaction={empty.action ? clearFilters : undefined}
          />
        {/if}
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
  /* ---- Lista del Estudio (U15, rediseño U21). Primitivas y tokens; ritmo --tool-*. ---- */
  .catalogo { color: var(--color-texto); }
  .catalogo__state { display: grid; place-items: center; min-height: 16rem; }
  .catalogo > :global(.catalogo__notice) { margin-bottom: var(--density-pad); }

  /* Búsqueda, filtros y, mientras hay selección, la barra de lote: una sola fila. */
  .catalogo__toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--tool-gap-row);
  }
  .catalogo__toolbar :global(.catalogo__search) { flex: 1 1 22rem; min-width: 0; }
  .catalogo__vista { display: none; }
  .catalogo > :global(.catalogo__selection) { min-height: var(--density-control-h); }
  .catalogo__toolbar,
  .catalogo > :global(.catalogo__selection) { margin-bottom: var(--tool-gap-header); }

  .catalogo__table-card {
    overflow: hidden;
    border: 1px solid var(--color-borde);
    border-radius: var(--radius-sm);
    background: var(--color-panel);
  }

  /* Posicionado: los textos solo para lectores (absolutos) de las celdas se
     quedan dentro del desplazamiento horizontal y no ensanchan la página. */
  .catalogo__scroll { position: relative; overflow-x: auto; transition: opacity var(--motion-fast) var(--ease-standard); }
  .catalogo__scroll.is-loading { opacity: 0.55; }
  .catalogo__table { width: 100%; min-width: var(--tool-table-min-w); border-collapse: collapse; table-layout: fixed; }
  .catalogo__table th {
    height: var(--density-row-h);
    padding: 0 var(--tool-pad-cell);
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
    height: var(--tool-table-row-h);
    padding: 0 var(--tool-pad-cell);
    border-top: 1px solid var(--color-borde);
    color: var(--color-texto-alto);
    font-size: var(--text-xs);
    vertical-align: middle;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .catalogo__table tbody tr:hover { background: var(--color-superficie-1); }
  .catalogo__table tbody tr.is-picked { background: var(--color-acento-tinte); }

  .catalogo__table .col-check { width: calc(var(--target-touch) + var(--space-2)); padding: 0 0 0 var(--space-2); }
  /* U25: fecha y estado tienen ancho propio para no cortarse nunca (sin contar el padding de celda);
     el título se queda con el resto. */
  .catalogo__table .col-artists { width: 11%; }
  .catalogo__table .col-type { width: 4.75%; }
  .catalogo__table .col-label { width: 8%; }
  .catalogo__table .col-date { width: 7.75rem; font-variant-numeric: tabular-nums; }
  .catalogo__table .col-status { width: 5.75rem; }
  .catalogo__table .col-signals { width: 5.5rem; padding-inline: 0; }
  .catalogo__table .col-action { width: calc(var(--target-touch) + var(--space-2)); padding: 0 var(--space-1); text-align: right; }

  .release-cell {
    display: flex;
    align-items: center;
    gap: var(--tool-pad-control);
    min-width: 0;
    color: inherit;
    text-decoration: none;
  }
  .release-cell img,
  .release-cell__nocover {
    flex: 0 0 var(--tool-table-thumb);
    width: var(--tool-table-thumb);
    height: var(--tool-table-thumb);
    border-radius: var(--radius-xs);
    object-fit: cover;
    background: var(--color-superficie-2);
  }
  .release-cell__nocover { border: 1px dashed var(--color-linea-fuerte); box-sizing: border-box; }
  .release-cell strong { min-width: 0; overflow: hidden; color: var(--color-texto); font-size: var(--text-sm); font-weight: 600; white-space: nowrap; text-overflow: ellipsis; }
  .release-cell:hover strong { color: var(--color-acento); }

  /* Señales: un icono con tooltip por cosa que falta, y los reportes abiertos con su número. */
  .col-signals { line-height: 1; }
  .signal { display: inline-flex; align-items: center; gap: var(--space-1); margin-right: var(--space-3); font-size: var(--text-2xs); font-weight: 600; vertical-align: middle; }
  .signal--missing { color: var(--color-aviso); }
  .signal--reports { min-height: var(--target-touch); color: var(--color-danger-texto); text-decoration: none; font-variant-numeric: tabular-nums; }
  .signal--reports:hover { color: var(--color-texto); }

  .catalogo__table-foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-2) var(--tool-pad-cell);
    border-top: 1px solid var(--color-borde);
    color: var(--color-texto-tenue);
    font-size: var(--text-2xs);
    font-variant-numeric: tabular-nums;
  }

  /* Vacío bajo la cabecera de la tabla, centrado como en el tablero 2 del lienzo. */
  .catalogo__table-card > :global(.catalogo__empty) {
    align-items: center;
    padding-block: var(--space-8);
    border-top: 1px solid var(--color-borde);
    text-align: center;
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


  /* U25: sin ancho para todo, quedan las mismas columnas que en móvil: tipo, sello y fecha ceden su
     sitio para que título y estado no se corten (el filtro y el editor los conservan). */
  @media (max-width: 1279px) {
    .catalogo__table .col-type,
    .catalogo__table .col-label,
    .catalogo__table .col-date { display: none; }
    .catalogo__table .col-artists { width: 18%; }
  }

  /* Tablet: sin barra lateral (ToolLayout), la vista rápida va en el selector. */
  @media (max-width: 1023px) {
    .catalogo__vista { display: block; }
  }

  /* Móvil: consulta, como el editor de E07. Sin selección ni lote; la vista
     rápida pasa a un selector porque la barra lateral solo muestra secciones. */
  @media (max-width: 767px) {
    .catalogo__toolbar { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--space-2) var(--tool-pad-control); }
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
      align-items: center;
      padding: var(--tool-pad-item-y) var(--tool-pad-item-x);
      border-top: 1px solid var(--color-borde);
    }
    .catalogo__table td { display: block; height: auto; padding: 0; border: 0; white-space: normal; }
    .catalogo__table .col-release { grid-column: 1; width: auto; }
    .catalogo__table .col-action { grid-column: 2; grid-row: 1; width: auto; }
    .catalogo__table .col-artists { grid-column: 1 / -1; width: auto; padding-left: calc(var(--tool-table-thumb) + var(--tool-pad-control)); }
    .catalogo__table .col-status { grid-column: 1; width: auto; padding-left: calc(var(--tool-table-thumb) + var(--tool-pad-control)); }
    .catalogo__table .col-signals { grid-column: 2; width: auto; white-space: nowrap; }
    .catalogo__table .col-signals .signal { margin-right: 0; margin-left: var(--space-3); }
    .catalogo__table .col-artists { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; }
    .catalogo__table .col-type,
    .catalogo__table .col-label,
    .catalogo__table .col-date { display: none; }
  }
</style>
