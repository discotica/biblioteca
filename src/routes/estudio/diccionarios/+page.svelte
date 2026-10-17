<script lang="ts">
  // Diccionarios del Estudio (U19, G4): géneros, países, sellos y artistas, solo
  // para administración. Crear (géneros y países), renombrar, fusionar, marcar
  // seleccionable o legado y borrar los que no tienen lanzamientos. Cada
  // operación es un RPC de admin auditado con su observación; el servidor
  // comprueba todo de nuevo. El layout ya comprobó sesión, rol e interruptor.
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { ToolHeader } from '$lib/layouts';
  import {
    Button,
    Checkbox,
    Chip,
    Combobox,
    Dialog,
    EmptyState,
    ErrorState,
    Field,
    LoadingIndicator,
    Menu,
    Notice,
    Pagination,
    Select,
    Textarea,
    type ComboboxOption,
    type MenuItem
  } from '$lib/ui';
  import { BELOW_MOBILE_QUERY } from '$lib/ui/breakpoints';
  import {
    DICTIONARY_TABS,
    STATUS_HELP,
    STATUS_LABELS,
    STATUS_TONES,
    deleteDoneText,
    describeDictionaryError,
    dictionariesHref,
    dictionaryCapabilities,
    dictionaryFilterFromSlug,
    dictionaryFilterLabel,
    dictionaryFilters,
    dictionaryKindFromSlug,
    dictionaryLabel,
    dictionaryPublicHref,
    dictionarySingular,
    mergeConsequence,
    mergeDoneText,
    releaseTally,
    renameConsequence,
    type DictionaryFilter,
    type DictionaryItem,
    type DictionaryKind,
    type DictionaryPage
  } from '$lib/domain/dictionaries';
  import {
    DICTIONARY_DELETE_MAX,
    DICTIONARY_PAGE_SIZE,
    createDictionaryValue,
    deleteDictionaryOrphans,
    listDictionary,
    mergeDictionaryValues,
    renameDictionaryValue,
    setDictionaryStatus
  } from '$lib/services/adminDictionaries';

  type Mode = 'create' | 'rename' | 'merge' | 'status' | 'delete';
  type Status = 'selectable' | 'legacy';

  const DESCRIPTIONS: Record<DictionaryKind, string> = {
    genre: 'Lista cerrada: solo los seleccionables se ofrecen en Sugerir y en el editor.',
    country: 'Lista cerrada: solo los seleccionables se ofrecen en Sugerir y en el editor. Los de legado se conservan donde ya están.',
    label: 'Se crean al guardar o aceptar un lanzamiento. Aquí se corrigen, se fusionan y se borran los que no tienen lanzamientos.',
    artist: 'Se crean al guardar o aceptar un lanzamiento. Aquí se corrigen, se fusionan y se borran los que no tienen lanzamientos.'
  };

  // Estado de la URL: ?tipo=, ?filtro=, ?q= y ?p=.
  const kind = $derived(dictionaryKindFromSlug(page.url.searchParams.get('tipo')));
  const filter = $derived(dictionaryFilterFromSlug(kind, page.url.searchParams.get('filtro')));
  const urlQuery = $derived(page.url.searchParams.get('q') ?? '');
  const pageNumber = $derived(Math.max(1, Number(page.url.searchParams.get('p')) || 1));
  const can = $derived(dictionaryCapabilities(kind));
  const singular = $derived(dictionarySingular(kind));

  let mobile = $state(false);
  let query = $state('');
  let result = $state<DictionaryPage | null>(null);
  let loading = $state(false);
  let listError = $state('');
  let flash = $state('');
  let picked = $state<Record<string, string>>({});
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let requestId = 0;
  /** Última búsqueda que esta vista puso en la URL: no se vuelve a copiar al campo. */
  let pushedQuery = '';

  const items = $derived(result?.kind === kind ? result.items : []);
  const total = $derived(result?.kind === kind ? result.total : 0);
  const totalPages = $derived(Math.max(1, Math.ceil(total / DICTIONARY_PAGE_SIZE)));
  const pickedIds = $derived(Object.keys(picked));
  const orphansOnPage = $derived(items.filter((item) => item.release_count === 0));
  const pageAllPicked = $derived(orphansOnPage.length > 0 && orphansOnPage.every((item) => picked[item.id]));
  const hasFilters = $derived(filter !== 'all' || Boolean(urlQuery));
  const filterOptions = $derived(dictionaryFilters(kind).map((value) => {
    const count = result?.kind === kind ? result.counts[value] : undefined;
    return { value, label: count === undefined ? dictionaryFilterLabel(value) : `${dictionaryFilterLabel(value)} (${count.toLocaleString('es-CO')})` };
  }));

  onMount(() => {
    const media = window.matchMedia(BELOW_MOBILE_QUERY);
    const sync = () => (mobile = media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  });

  // La búsqueda escrita sigue a la URL (atrás, adelante y cambio de pestaña), salvo la que
  // acaba de poner esta vista: si no, lo escrito durante la navegación se perdería.
  $effect(() => {
    const next = urlQuery;
    if (next !== pushedQuery) query = next;
    pushedQuery = next;
  });

  // Al cambiar de pestaña se suelta la selección: los ids son de otro diccionario.
  $effect(() => {
    void kind;
    picked = {};
    flash = '';
  });

  $effect(() => {
    void load(kind, filter, urlQuery, pageNumber);
  });

  async function load(nextKind: DictionaryKind, nextFilter: DictionaryFilter, nextQuery: string, nextPage: number) {
    const id = ++requestId;
    loading = true;
    listError = '';
    try {
      const next = await listDictionary({ kind: nextKind, filter: nextFilter, query: nextQuery, page: nextPage });
      if (id === requestId) result = next;
    } catch (cause) {
      if (id === requestId) {
        result = null;
        listError = describeDictionaryError(cause as never);
      }
    } finally {
      if (id === requestId) loading = false;
    }
  }

  const reload = () => load(kind, filter, urlQuery, pageNumber);

  function go(href: string) {
    void goto(href, { replaceState: true, keepFocus: true, noScroll: true });
  }

  function withPage(href: string, value: number) {
    return value > 1 ? `${href}${href.includes('?') ? '&' : '?'}p=${value}` : href;
  }

  function search() {
    clearTimeout(searchTimer);
    pushedQuery = query.trim();
    go(dictionariesHref(kind, filter, query));
  }

  function scheduleSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(search, 300);
  }

  function chooseFilter(value: string) {
    go(dictionariesHref(kind, value as DictionaryFilter, query));
  }

  function clearFilters() {
    query = '';
    go(dictionariesHref(kind));
  }

  function togglePicked(item: DictionaryItem) {
    if (picked[item.id]) {
      const { [item.id]: _, ...rest } = picked;
      picked = rest;
    } else {
      picked = { ...picked, [item.id]: item.name };
    }
  }

  function togglePage() {
    if (pageAllPicked) {
      const next = { ...picked };
      for (const item of orphansOnPage) delete next[item.id];
      picked = next;
    } else {
      picked = { ...picked, ...Object.fromEntries(orphansOnPage.map((item) => [item.id, item.name])) };
    }
  }

  // ---- Diálogo ---------------------------------------------------------------------------------
  let dialogOpen = $state(false);
  let mode = $state<Mode>('create');
  let subject = $state<DictionaryItem | null>(null);
  let nameValue = $state('');
  let statusValue = $state<Status>('selectable');
  let reason = $state('');
  let busy = $state(false);
  let dialogError = $state('');
  let nameError = $state('');
  let deleteTargets = $state<{ id: string; name: string }[]>([]);
  // Fusionar: el valor que se conserva, buscado en el servidor.
  let targetQuery = $state('');
  let targetOptions = $state<ComboboxOption[]>([]);
  let targetLoading = $state(false);
  let target = $state<{ id: string; name: string } | null>(null);
  let targetTimer: ReturnType<typeof setTimeout> | undefined;
  let targetRequest = 0;
  const targetNames = new Map<string, string>();

  const dialogTitle = $derived.by(() => {
    if (mode === 'create') return kind === 'genre' ? 'Nuevo género' : 'Nuevo país';
    if (mode === 'rename') return `Renombrar «${subject?.name}»`;
    if (mode === 'merge') return `Fusionar «${subject?.name}»`;
    if (mode === 'status') return statusValue === 'selectable' ? `Marcar «${subject?.name}» como seleccionable` : `Marcar «${subject?.name}» como legado`;
    return deleteTargets.length === 1 ? `Borrar «${deleteTargets[0].name}»` : `Borrar ${deleteTargets.length} ${kind === 'artist' ? 'artistas' : 'sellos'}`;
  });
  const consequences = $derived.by(() => {
    if (mode === 'rename' && subject) return renameConsequence(kind, subject.name, nameValue);
    if (mode === 'merge' && subject && target) return mergeConsequence(kind, subject, target.name);
    return [];
  });
  const confirmLabel = $derived.by(() => {
    if (mode === 'create') return kind === 'genre' ? 'Crear género' : 'Crear país';
    if (mode === 'rename') return 'Renombrar';
    if (mode === 'merge') return 'Fusionar';
    if (mode === 'status') return statusValue === 'selectable' ? 'Marcar seleccionable' : 'Marcar legado';
    return deleteTargets.length === 1 ? 'Borrar' : `Borrar ${deleteTargets.length}`;
  });
  const canConfirm = $derived(
    Boolean(reason.trim())
      && (mode !== 'create' || Boolean(nameValue.trim()))
      && (mode !== 'rename' || (Boolean(nameValue.trim()) && nameValue.trim() !== subject?.name))
      && (mode !== 'merge' || Boolean(target))
      && (mode !== 'delete' || (deleteTargets.length > 0 && deleteTargets.length <= DICTIONARY_DELETE_MAX))
  );

  function openDialog(next: Mode, item: DictionaryItem | null = null, extra: { status?: Status; targets?: { id: string; name: string }[] } = {}) {
    mode = next;
    subject = item;
    nameValue = next === 'rename' && item ? item.name : '';
    statusValue = extra.status ?? 'selectable';
    deleteTargets = extra.targets ?? [];
    reason = '';
    dialogError = '';
    nameError = '';
    target = null;
    targetQuery = '';
    targetOptions = [];
    dialogOpen = true;
    if (next === 'merge') void searchTargets('');
  }

  function closeDialog() {
    if (busy) return;
    dialogOpen = false;
    clearTimeout(targetTimer);
  }

  async function searchTargets(text: string) {
    const id = ++targetRequest;
    targetLoading = true;
    try {
      const found = await listDictionary({ kind, query: text, pageSize: 20 });
      if (id !== targetRequest) return;
      targetOptions = found.items
        .filter((item) => item.id !== subject?.id)
        .map((item) => {
          targetNames.set(item.id, item.name);
          return { value: item.id, label: item.name, hint: item.status ? `${STATUS_LABELS[item.status]} · ${releaseTally(item)}` : releaseTally(item) };
        });
    } catch {
      if (id === targetRequest) targetOptions = [];
    } finally {
      if (id === targetRequest) targetLoading = false;
    }
  }

  $effect(() => {
    if (!dialogOpen || mode !== 'merge') return;
    const text = targetQuery;
    clearTimeout(targetTimer);
    targetTimer = setTimeout(() => void searchTargets(text), 250);
    return () => clearTimeout(targetTimer);
  });

  function chooseTarget(value: string[]) {
    const id = value[0];
    target = id ? { id, name: targetNames.get(id) ?? '' } : null;
  }

  async function confirm() {
    if (!canConfirm || busy) return;
    busy = true;
    dialogError = '';
    nameError = '';
    let message = '';
    try {
      if (mode === 'create') {
        const done = await createDictionaryValue(kind, nameValue, statusValue, reason);
        message = `Se creó «${done.value.name}» como ${STATUS_LABELS[statusValue].toLowerCase()}.`;
      } else if (mode === 'rename' && subject) {
        const done = await renameDictionaryValue(kind, subject.id, nameValue, reason);
        message = done.changed
          ? `«${done.previous_name}» ahora se llama «${done.value.name}».${done.alias_added ? ' La grafía vieja queda como alias.' : ''}`
          : 'El nombre no cambió.';
      } else if (mode === 'merge' && subject && target) {
        const done = await mergeDictionaryValues(kind, subject.id, target.id, reason);
        message = mergeDoneText(done.source.name, done.value.name, done.release_count);
      } else if (mode === 'status' && subject) {
        const done = await setDictionaryStatus(kind, subject.id, statusValue, reason);
        message = `«${done.value.name}» ahora es ${STATUS_LABELS[statusValue].toLowerCase()}.`;
      } else if (mode === 'delete') {
        const done = await deleteDictionaryOrphans(kind, deleteTargets.map((entry) => entry.id), reason);
        message = deleteDoneText(kind, done.items.map((entry) => entry.name));
        picked = {};
      }
      busy = false;
      dialogOpen = false;
      flash = '';
      // El aviso sale con la lista ya recargada, para que digan lo mismo.
      await reload();
      flash = message;
    } catch (cause) {
      const error = cause as { message?: string };
      const text = describeDictionaryError(cause as never);
      if ((mode === 'create' || mode === 'rename') && ['dictionary_value_exists', 'dictionary_alias_exists', 'dictionary_name_invalid'].includes(error?.message ?? '')) nameError = text;
      else dialogError = text;
      busy = false;
    }
  }

  function rowActions(item: DictionaryItem): MenuItem[] {
    const actions: MenuItem[] = [
      { label: 'Renombrar…', onselect: () => openDialog('rename', item) },
      { label: 'Fusionar con…', onselect: () => openDialog('merge', item) }
    ];
    if (can.status && item.status !== 'selectable') actions.push({ label: 'Marcar seleccionable', onselect: () => openDialog('status', item, { status: 'selectable' }) });
    if (can.status && item.status !== 'legacy') actions.push({ label: 'Marcar legado', onselect: () => openDialog('status', item, { status: 'legacy' }) });
    const publicHref = item.published_count ? dictionaryPublicHref(kind, item) : null;
    if (publicHref) actions.push({ label: 'Ver en el catálogo', href: publicHref });
    if (can.deleteOrphans && item.release_count === 0) {
      actions.push({ label: 'Borrar…', tone: 'danger', onselect: () => openDialog('delete', item, { targets: [{ id: item.id, name: item.name }] }) });
    }
    return actions;
  }
</script>

<svelte:head><title>Diccionarios · Estudio — Discótica</title></svelte:head>

<div class="dic">
  <ToolHeader title="Diccionarios" description={DESCRIPTIONS[kind]}>
    {#snippet actions()}
      {#if can.create}
        <Button icon="agregar" onclick={() => openDialog('create')}>{kind === 'genre' ? 'Nuevo género' : 'Nuevo país'}</Button>
      {/if}
    {/snippet}
  </ToolHeader>

  <nav class="dic__tabs" aria-label="Diccionarios">
    {#each DICTIONARY_TABS as entry (entry.kind)}
      <a class="dic__tab" href={dictionariesHref(entry.kind)} aria-current={entry.kind === kind ? 'page' : undefined}>{entry.label}</a>
    {/each}
  </nav>

  {#if flash}<Notice tone="success" class="dic__notice">{flash}</Notice>{/if}

  <div class="dic__toolbar" role="search" aria-label={`Buscar en ${dictionaryLabel(kind).toLowerCase()}`}>
    <Field
      class="dic__search"
      type="search"
      icon="buscar"
      label={`Buscar en ${dictionaryLabel(kind).toLowerCase()}`}
      hideLabel
      placeholder="Buscar por nombre o alias"
      bind:value={query}
      oninput={scheduleSearch}
      onkeydown={(event: KeyboardEvent) => { if (event.key === 'Enter') search(); }}
    />
    <Select label="Mostrar" inline options={filterOptions} value={filter} onchange={chooseFilter} />
  </div>

  {#if can.deleteOrphans && pickedIds.length && !mobile}
    <div class="dic__batch" role="region" aria-label="Selección">
      <p class="dic__batch-count" role="status">
        <strong>{pickedIds.length}</strong> {pickedIds.length === 1 ? 'seleccionado' : 'seleccionados'}
        {#if pickedIds.length > DICTIONARY_DELETE_MAX}<span class="dic__batch-limit">· Se borran hasta {DICTIONARY_DELETE_MAX} a la vez.</span>{/if}
      </p>
      <div class="dic__batch-actions">
        <Button size="sm" variant="destructive" disabled={pickedIds.length > DICTIONARY_DELETE_MAX}
          onclick={() => openDialog('delete', null, { targets: pickedIds.map((id) => ({ id, name: picked[id] })) })}>Borrar</Button>
        <Button size="sm" variant="ghost" onclick={() => (picked = {})}>Quitar selección</Button>
      </div>
    </div>
  {/if}

  <section class="dic__card" aria-labelledby="dic-tabla">
    <header class="dic__card-head">
      <h2 id="dic-tabla">{filter === 'all' ? dictionaryLabel(kind) : `${dictionaryLabel(kind)} · ${dictionaryFilterLabel(filter)}`}</h2>
      <span>{total.toLocaleString('es-CO')} {total === 1 ? singular : dictionaryLabel(kind).toLowerCase()}</span>
    </header>
    {#if loading && !items.length}
      <div class="dic__state"><LoadingIndicator label={`Cargando ${dictionaryLabel(kind).toLowerCase()}`} /></div>
    {:else if listError}
      <ErrorState size="inline" message={listError} onaction={reload} retrying={loading} />
    {:else if !items.length}
      <EmptyState
        size="inline"
        message={hasFilters ? `No encontramos ${dictionaryLabel(kind).toLowerCase()}` : `Aún no hay ${dictionaryLabel(kind).toLowerCase()}`}
        detail={hasFilters ? 'Prueba otra búsqueda o quita los filtros.' : undefined}
        actionLabel={hasFilters ? 'Quitar filtros' : undefined}
        onaction={hasFilters ? clearFilters : undefined}
      />
    {:else}
      <div class="dic__scroll" class:is-loading={loading}>
        <table class="dic__table dic__table--{kind}">
          <thead>
            <tr>
              {#if can.deleteOrphans && !mobile}
                <th class="col-check" scope="col">
                  {#if orphansOnPage.length}
                    <Checkbox hideLabel checked={pageAllPicked} onchange={togglePage}>Seleccionar los {orphansOnPage.length} sin lanzamientos de esta página</Checkbox>
                  {/if}
                </th>
              {/if}
              <th scope="col" class="col-name">Nombre</th>
              {#if can.status}<th scope="col" class="col-status">Estado</th>{/if}
              <th scope="col" class="col-count">Lanzamientos</th>
              {#if !can.status}<th scope="col" class="col-url">URL</th>{/if}
              <th scope="col" class="col-action"><span class="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {#each items as item (item.id)}
              {@const publicHref = item.published_count ? dictionaryPublicHref(kind, item) : null}
              <tr class:is-picked={!!picked[item.id]}>
                {#if can.deleteOrphans && !mobile}
                  <td class="col-check">
                    {#if item.release_count === 0}
                      <Checkbox hideLabel checked={!!picked[item.id]} onchange={() => togglePicked(item)}>Seleccionar {item.name}</Checkbox>
                    {/if}
                  </td>
                {/if}
                <td class="col-name">
                  <strong>{item.name}</strong>
                  {#if item.aliases.length}<small>También: {item.aliases.join(', ')}</small>{/if}
                </td>
                {#if can.status && item.status}
                  <td class="col-status"><Chip kind="status" tone={STATUS_TONES[item.status]} label={STATUS_LABELS[item.status]} /></td>
                {/if}
                <td class="col-count" class:is-empty={!item.release_count}>{releaseTally(item)}</td>
                {#if !can.status}
                  <td class="col-url">
                    {#if publicHref}<a href={publicHref}>{publicHref}</a>{:else}<span class="dic__muted">Sin página pública</span>{/if}
                    {#if item.slug_aliases.length}<small>Redirigen: {item.slug_aliases.join(', ')}</small>{/if}
                  </td>
                {/if}
                <td class="col-action">
                  <Menu label={`Acciones de ${item.name}`} icon="mas-opciones" size="sm" variant="ghost" align="end" items={rowActions(item)} />
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <footer class="dic__card-foot">
        <span>Mostrando {((pageNumber - 1) * DICTIONARY_PAGE_SIZE + 1).toLocaleString('es-CO')}–{Math.min(pageNumber * DICTIONARY_PAGE_SIZE, total).toLocaleString('es-CO')} de {total.toLocaleString('es-CO')}</span>
        <Pagination page={pageNumber} {totalPages} size="sm" label={`Páginas de ${dictionaryLabel(kind).toLowerCase()}`} onchange={(next) => go(withPage(dictionariesHref(kind, filter, urlQuery), next))} />
      </footer>
    {/if}
  </section>
</div>

<Dialog bind:open={dialogOpen} title={dialogTitle} size="md" onclose={closeDialog} dismissible={!busy}>
  {#if mode === 'create'}
    <Field label="Nombre" bind:value={nameValue} required error={nameError} hint="Con tildes y mayúsculas como debe verse." />
    <Select
      label="Estado"
      options={[{ value: 'selectable', label: STATUS_LABELS.selectable }, { value: 'legacy', label: STATUS_LABELS.legacy }]}
      value={statusValue}
      onchange={(value) => (statusValue = value as Status)}
      hint={STATUS_HELP[statusValue]}
    />
  {:else if mode === 'rename'}
    <Field label="Nombre nuevo" bind:value={nameValue} required error={nameError} />
  {:else if mode === 'merge' && subject}
    <p class="dic__lead">«{subject.name}» tiene {releaseTally(subject).toLowerCase()}. Elige el {singular} que se conserva.</p>
    <Combobox
      label="Conservar"
      single
      filter={false}
      options={targetOptions}
      bind:query={targetQuery}
      loading={targetLoading}
      value={target ? [target.id] : []}
      onchange={chooseTarget}
      placeholder={`Busca un ${singular}`}
      emptyText={`No hay otro ${singular} con ese nombre`}
      removeLabel={(text) => `Quitar ${text}`}
    />
  {:else if mode === 'status' && subject}
    <p class="dic__lead">{STATUS_HELP[statusValue]}{#if subject.release_count} Sus {releaseTally(subject).toLowerCase()} lo conservan.{/if}</p>
  {:else if mode === 'delete'}
    <p class="dic__lead">Solo se borran si siguen sin lanzamientos: el servidor lo comprueba y, si alguno tiene, no borra ninguno. Sus alias se borran con ellos.</p>
    {#if deleteTargets.length > 1}
      <ul class="dic__list" aria-label="Se borran">
        {#each deleteTargets as entry (entry.id)}<li>{entry.name}</li>{/each}
      </ul>
    {/if}
  {/if}
  {#if consequences.length}
    <ul class="dic__consequences" aria-label="Qué va a pasar">
      {#each consequences as line}<li>{line}</li>{/each}
    </ul>
  {/if}
  <Textarea label="Observación del cambio" required rows={2} bind:value={reason} hint="Queda en el registro del diccionario." />
  {#if dialogError}<Notice tone="error">{dialogError}</Notice>{/if}
  {#snippet footer()}
    <Button variant="secondary" onclick={closeDialog} disabled={busy}>Cancelar</Button>
    <Button variant={mode === 'merge' || mode === 'delete' ? 'destructive' : 'primary'} loading={busy} disabled={!canConfirm} onclick={confirm}>{confirmLabel}</Button>
  {/snippet}
</Dialog>

<style>
  /* ---- Diccionarios (U19). Misma tabla y densidad que el Catálogo (U15). ---- */
  .dic { color: var(--color-texto); }
  .dic > :global(.dic__notice) { margin-bottom: var(--density-pad); }
  .dic__state { display: grid; place-items: center; min-height: 16rem; }

  .dic__tabs {
    display: flex;
    gap: var(--space-1);
    margin-bottom: var(--space-4);
    overflow-x: auto;
    border-bottom: 1px solid var(--color-borde);
    scrollbar-width: none;
  }
  .dic__tab {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    min-height: var(--target-touch);
    margin-bottom: -1px;
    padding: 0 var(--space-3);
    border-bottom: 2px solid transparent;
    color: var(--color-texto-medio);
    font-size: var(--text-sm);
    font-weight: 600;
    text-decoration: none;
  }
  .dic__tab:hover { color: var(--color-texto); }
  .dic__tab[aria-current='page'] { border-bottom-color: var(--color-acento); color: var(--color-texto); }
  .dic__tab:focus-visible { outline: 2px solid var(--color-acento); outline-offset: -2px; }

  .dic__toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-4);
    margin-bottom: var(--space-3);
  }
  .dic__toolbar :global(.dic__search) { flex: 1 1 22rem; min-width: 0; }

  .dic__batch {
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
  .dic__batch-count { margin: 0; color: var(--color-texto-medio); font-size: var(--density-text); }
  .dic__batch-count strong { color: var(--color-acento); }
  .dic__batch-limit { color: var(--color-aviso); }
  .dic__batch-actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }

  .dic__card {
    overflow: hidden;
    border: 1px solid var(--color-borde);
    border-radius: var(--radius-sm);
    background: var(--color-panel);
  }
  .dic__card-head,
  .dic__card-foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2) var(--space-3);
    padding: var(--space-3) var(--space-4);
  }
  .dic__card-head { align-items: baseline; border-bottom: 1px solid var(--color-borde); }
  .dic__card-head h2 { margin: 0; font-size: var(--text-sm); font-weight: 700; }
  .dic__card-head span,
  .dic__card-foot { color: var(--color-texto-tenue); font-size: var(--text-2xs); font-variant-numeric: tabular-nums; }
  .dic__card-foot { padding-block: var(--space-2); border-top: 1px solid var(--color-borde); }

  .dic__scroll { position: relative; overflow-x: auto; transition: opacity var(--motion-fast) var(--ease-standard); }
  .dic__scroll.is-loading { opacity: 0.55; }
  .dic__table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .dic__table th {
    height: var(--density-row-h);
    padding: 0 var(--space-3);
    color: var(--color-texto-tenue);
    font-size: var(--text-2xs);
    font-weight: 700;
    letter-spacing: var(--nav-letter-spacing);
    text-align: left;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .dic__table td {
    height: var(--tool-row-h);
    padding: 0 var(--space-3);
    border-top: 1px solid var(--color-borde);
    color: var(--color-texto-alto);
    font-size: var(--text-2xs);
    vertical-align: middle;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .dic__table tbody tr:hover { background: var(--color-superficie-1); }
  .dic__table tbody tr.is-picked { background: var(--color-acento-tinte); }

  .dic__table .col-check { width: calc(var(--target-touch) + var(--space-2)); padding: 0 0 0 var(--space-2); }
  .dic__table .col-status { width: 9rem; }
  .dic__table .col-count { width: 13rem; font-variant-numeric: tabular-nums; }
  .dic__table .col-url { width: 34%; }
  /* Sin recorte: el área táctil de 44 del disparador sm sale de su caja (::after). */
  .dic__table .col-action { width: calc(var(--target-touch) + var(--space-2)); padding: 0 var(--space-1); overflow: visible; text-align: right; }
  .col-count.is-empty { color: var(--color-texto-tenue); }

  .col-name strong,
  .col-name small,
  .col-url small { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  /* El enlace ocupa los 44 de alto de la fila: es un objetivo, no texto dentro de una frase. */
  .col-url a { display: flex; align-items: center; min-height: var(--target-touch); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .col-url a + small { margin-top: 0; }
  .col-name strong { color: var(--color-texto); font-size: var(--text-xs); }
  .col-name small,
  .col-url small { margin-top: var(--space-1); color: var(--color-texto-tenue); }
  .col-url a { color: var(--color-texto-alto); }
  .col-url a:hover { color: var(--color-acento); }
  .dic__muted { color: var(--color-texto-tenue); }

  .dic__lead { margin: 0 0 var(--space-3); color: var(--color-texto-medio); font-size: var(--text-sm); line-height: 1.5; }
  .dic__consequences,
  .dic__list {
    display: grid;
    gap: var(--space-1);
    margin: var(--space-3) 0;
    padding: var(--space-3) var(--space-3) var(--space-3) var(--space-6);
    border: 1px solid var(--color-borde);
    border-radius: var(--radius-sm);
    color: var(--color-texto-alto);
    font-size: var(--text-2xs);
    line-height: 1.5;
  }
  .dic__list { max-height: var(--tool-dialog-list-max-h); overflow-y: auto; }

  /* Móvil: consulta y acciones de a una, como el Catálogo. Sin selección en lote. */
  @media (max-width: 767px) {
    .dic__toolbar { display: grid; grid-template-columns: minmax(0, 1fr); }
    .dic__toolbar :global(.ui-select__control) { flex: 1; }
    .dic__scroll { overflow: visible; }
    .dic__table { table-layout: auto; }
    .dic__table thead { display: none; }
    .dic__table,
    .dic__table tbody { display: block; }
    .dic__table tbody tr {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: var(--space-1) var(--space-2);
      padding: var(--space-3) var(--space-4);
      border-top: 1px solid var(--color-borde);
    }
    .dic__table td { display: block; height: auto; padding: 0; border: 0; }
    .dic__table .col-name { grid-column: 1; width: auto; }
    .dic__table .col-action { grid-column: 2; grid-row: 1 / span 2; width: var(--target-touch); text-align: center; }
    .dic__table .col-status,
    .dic__table .col-count,
    .dic__table .col-url { grid-column: 1; width: auto; }
    .dic__table--genre .col-status,
    .dic__table--country .col-status { justify-self: start; }
  }
</style>
