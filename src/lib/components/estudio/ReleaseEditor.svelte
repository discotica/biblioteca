<script lang="ts">
  import { tick, untrack } from 'svelte';
  import EditorHistory from './EditorHistory.svelte';
  import ReleaseForm from './ReleaseForm.svelte';
  import { studioProposalsHref, studioReportsHref } from '$lib/domain/studio';
  import { EDITOR_SECTIONS, isPendingId, mergeById, missingFields, pendingName, validateRelease } from '$lib/domain/releaseEditor';
  import { Button, Chip, Dialog, ErrorState, LoadingIndicator, Menu, Notice, Textarea, type MenuItem } from '$lib/ui';
  import {
    getArtistsByIds,
    getCatalogHistory,
    getCatalogRelease,
    payload,
    revertCatalog,
    saveCatalog,
    type Artist,
    type CatalogHistory,
    type CatalogSnapshot,
    type CatalogStatus,
    type DictionaryEntry
  } from '$lib/services/adminCatalog';

  type Props = {
    /** Lanzamiento abierto (?lanzamiento=). */
    releaseId: string | null;
    labels: DictionaryEntry[];
    genres: DictionaryEntry[];
    countries: DictionaryEntry[];
    types: DictionaryEntry[];
    /** Nombres de artistas conocidos, compartidos con la lista. */
    artists: Artist[];
    onclose: () => void;
    /** Algo cambió en el servidor: la lista y los conteos se vuelven a leer. */
    onsaved: () => void;
  };

  let {
    releaseId,
    labels = $bindable(),
    genres,
    countries,
    types,
    artists = $bindable(),
    onclose,
    onsaved
  }: Props = $props();

  type DialogKind = 'publish' | 'archive' | 'revert' | null;
  type Feedback = { tone: 'error' | 'success'; text: string } | null;

  const STATUS_LABELS: Record<CatalogStatus, string> = { draft: 'Borrador', published: 'Publicado', archived: 'Archivado' };
  const STATUS_TONES: Record<CatalogStatus, 'neutral' | 'accent' | 'danger'> = { draft: 'neutral', published: 'accent', archived: 'danger' };

  let selected = $state<CatalogSnapshot | null>(null);
  let history = $state<CatalogHistory[]>([]);
  let loading = $state(false);
  let loadError = $state('');
  /** El payload tal como se leyó o guardó, para saber si hay cambios sin guardar. */
  let baseline = $state('');
  let observation = $state('');
  let busy = $state(false);
  let feedback = $state<Feedback>(null);
  let titleError = $state('');

  // Diálogos: confirmar publicar, archivar y revertir. Desde U19 no hay altas aparte: artistas y
  // sello nuevos se crean al guardar.
  let dialog = $state<DialogKind>(null);
  let dialogOpen = $state(false);
  let dialogError = $state('');
  let pendingHistory = $state<CatalogHistory | null>(null);
  let revertReason = $state('');
  let returnFocus = $state<HTMLElement | null>(null);

  let noteEl = $state<HTMLInputElement>();

  const dirty = $derived(selected ? JSON.stringify(payload(selected)) !== baseline : false);
  const missing = $derived(selected ? missingFields(selected) : []);
  const artistLine = $derived(
    selected ? selected.artist_ids.map((id) => (isPendingId(id) ? pendingName(id) : artists.find((artist) => artist.id === id)?.name ?? 'Artista sin resolver')).join(', ') : ''
  );
  const reports = $derived(selected?.signals?.open_report_count ?? 0);
  const menuItems = $derived.by<MenuItem[]>(() => {
    if (!selected?.id) return [];
    const items: MenuItem[] = [];
    if (selected.status === 'published') items.push({ label: 'Ver ficha pública', icon: 'flecha-externa', href: `/lanzamiento/${selected.slug}` });
    items.push({ label: reports ? `Reportes abiertos (${reports})` : 'Reportes', icon: 'reportar', href: studioReportsHref(selected.id) });
    items.push({ label: 'Propuestas', icon: 'lista', href: studioProposalsHref(selected.id) });
    if (selected.status !== 'archived') items.push({ label: 'Archivar lanzamiento', tone: 'danger', onselect: () => askFor('archive', null) });
    return items;
  });
  const dialogTitle = $derived({ publish: 'Publicar lanzamiento', archive: 'Archivar lanzamiento', revert: 'Revertir cambio' }[dialog ?? 'publish']);

  const formatDate = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value.length === 10 ? `${value}T12:00:00` : value))
      : 'Sin fecha';

  // Un aviso de éxito deja de valer en cuanto se vuelve a editar.
  $effect(() => {
    if (dirty) untrack(() => feedback?.tone === 'success' && (feedback = null));
  });

  // ---------------------------------------------------------------------------
  // Carga: la URL manda (la página pasa releaseId). Desde U19 no hay alta en blanco: los
  // lanzamientos nuevos entran por Sugerir.

  $effect(() => {
    const id = releaseId;
    untrack(() => void (id && selected?.id !== id && load(id)));
  });

  function assign(snapshot: CatalogSnapshot) {
    selected = snapshot;
    baseline = JSON.stringify(payload(snapshot));
    titleError = '';
  }

  /** RC2-P1-01: la lista se lee después del await y se fusiona por id; dos cargas cruzadas no se pisan. */
  async function ensureArtists(ids: string[]) {
    const unknown = [...new Set(ids)].filter((id) => id && !artists.some((artist) => artist.id === id));
    if (!unknown.length) return;
    const found = await getArtistsByIds(unknown);
    artists = mergeById(artists, found);
  }

  async function load(id: string) {
    loading = true;
    loadError = '';
    feedback = null;
    try {
      const snapshot = await getCatalogRelease(id);
      history = await getCatalogHistory(id);
      await ensureArtists([...snapshot.artist_ids, ...snapshot.collaborator_ids]);
      assign(snapshot);
      observation = '';
    } catch (cause: any) {
      selected = null;
      loadError = cause?.code === 'P0002' ? 'Ese lanzamiento no existe.' : cause?.message || 'No se pudo abrir el lanzamiento.';
    } finally {
      loading = false;
    }
  }

  /** Vuelve a leer el lanzamiento y su historial después de escribir. */
  async function refresh(id = selected?.id) {
    if (!id) return;
    const snapshot = await getCatalogRelease(id);
    history = await getCatalogHistory(id);
    await ensureArtists([...snapshot.artist_ids, ...snapshot.collaborator_ids]);
    assign(snapshot);
    onsaved();
  }

  // ---------------------------------------------------------------------------
  // Guardar, publicar, archivar y revertir (E06, sin cambios de payload)

  async function fail(text: string, focusNote = false) {
    feedback = { tone: 'error', text };
    if (focusNote) {
      await tick();
      noteEl?.focus();
    }
  }

  function needsObservation() {
    if (observation.trim()) return false;
    void fail('Añade una observación del cambio. El historial auditado la exige.', true);
    return true;
  }

  function askFor(kind: 'publish' | 'archive', trigger: HTMLElement | null) {
    if (!selected) return;
    if (kind === 'publish') {
      const invalid = validateRelease(selected, true);
      if (invalid) return void fail(invalid);
    }
    if (needsObservation()) return;
    feedback = null;
    openDialog(kind, trigger);
  }

  /** Lo que devuelve el servidor, en palabras del editor. */
  function saveError(cause: any) {
    if (cause?.message === 'credit_duplicate') return `«${cause?.details ?? ''}» ya es uno de los créditos.`;
    if (cause?.message === 'genre_not_selectable') return `«${cause?.details ?? ''}» no está en la lista de géneros.`;
    if (cause?.message === 'country_not_selectable') return `«${cause?.details ?? ''}» no está en la lista de países.`;
    return cause?.message || 'No se pudo guardar.';
  }

  async function submit(operation: 'update' | 'publish' | 'archive' = 'update') {
    if (!selected || busy) return;
    const invalid = validateRelease(selected, operation === 'publish');
    if (invalid) {
      if (!selected.title.trim()) titleError = invalid;
      return void fail(invalid);
    }
    if (needsObservation()) return;
    busy = true;
    feedback = null;
    try {
      const snapshot = $state.snapshot(selected) as CatalogSnapshot;
      const outcome = await saveCatalog(snapshot, observation, operation);
      await refresh(outcome.release_id);
      feedback = {
        tone: 'success',
        text: operation === 'archive' ? 'Lanzamiento archivado.' : operation === 'publish' ? 'Lanzamiento publicado.' : 'Cambios guardados.'
      };
      observation = '';
    } catch (cause: any) {
      if (cause?.code === '40001') {
        await refresh().catch(() => {});
        feedback = { tone: 'error', text: 'Otra persona editó este lanzamiento. Cargamos la versión más reciente; revisa el historial antes de guardar.' };
      } else feedback = { tone: 'error', text: saveError(cause) };
    } finally {
      busy = false;
      closeDialog();
    }
  }

  function askRevert(entry: CatalogHistory, trigger: HTMLElement) {
    pendingHistory = entry;
    revertReason = observation;
    openDialog('revert', trigger);
  }

  async function submitRevert() {
    if (!pendingHistory || !selected || busy) return;
    if (!revertReason.trim()) {
      dialogError = 'Añade una observación para explicar la reversión.';
      return;
    }
    busy = true;
    feedback = null;
    try {
      await revertCatalog(pendingHistory.change_set_id, pendingHistory.result_version, revertReason);
      await refresh();
      feedback = { tone: 'success', text: 'Cambio revertido mediante una nueva entrada auditada.' };
      observation = '';
    } catch (cause: any) {
      if (cause?.code === '40001') {
        await refresh().catch(() => {});
        feedback = { tone: 'error', text: 'No se revirtió porque existe una edición posterior. Cargamos el estado actual.' };
      } else feedback = { tone: 'error', text: cause?.message || 'No se pudo revertir.' };
    } finally {
      busy = false;
      closeDialog();
    }
  }

  function openDialog(kind: Exclude<DialogKind, null>, trigger: HTMLElement | null = null) {
    dialogError = '';
    returnFocus = trigger ?? (document.activeElement as HTMLElement | null);
    dialog = kind;
    dialogOpen = true;
  }

  function closeDialog() {
    dialogOpen = false;
    dialog = null;
    pendingHistory = null;
  }
</script>

<svelte:head><title>{selected ? `${selected.title || 'Sin título'} · ` : ''}Catálogo · Estudio — Discótica</title></svelte:head>

{#if loading && !selected}
  <div class="editor__state"><LoadingIndicator label="Abriendo el lanzamiento" /></div>
{:else if loadError || !selected}
  <ErrorState size="inline" message={loadError || 'No se pudo abrir el lanzamiento.'} actionLabel="Volver al catálogo" onaction={onclose} />
{:else}
  {@const release = selected}
  <ReleaseForm
    bind:release={selected}
    bind:labels
    bind:artists
    bind:titleError
    bind:note={observation}
    bind:noteElement={noteEl}
    {genres}
    {countries}
    {types}
    sections={EDITOR_SECTIONS}
    eyebrow="Editar lanzamiento"
    backLabel="Volver al catálogo"
    {onclose}
    createdWhen="al guardar"
    technical
    tally={history.length}
    tailNote="Cada entrada conserva quién, la observación y las versiones."
    {feedback}
    statusText={dirty ? 'Cambios sin guardar.' : 'Sin cambios.'}
    clean={!dirty}
    noteLabel="Observación del cambio"
    notePlaceholder="¿Qué cambió?"
    noteRequired
    onnoteenter={() => void submit()}
    onmessage={(text) => fail(text)}
  >
    {#snippet meta()}
      <Chip kind="status" tone={STATUS_TONES[release.status]} label={STATUS_LABELS[release.status]} />
      <span class="editor__version">v{release.catalog_version}</span>
      {#if reports}<a class="editor__reports" href={studioReportsHref(release.id)}>{reports === 1 ? '1 reporte' : `${reports} reportes`}</a>{/if}
      {#if menuItems.length}
        <Menu label="Más acciones" items={menuItems} />
      {/if}
    {/snippet}
    {#snippet tail()}
      <EditorHistory {history} unsaved={false} disabled={busy} onrevert={askRevert} />
    {/snippet}
    {#snippet actions()}
      {#if release.status !== 'published'}
        <Button variant="accent" disabled={busy || missing.length > 0} onclick={(event: MouseEvent) => askFor('publish', event.currentTarget as HTMLElement)}>Publicar</Button>
      {/if}
      <Button loading={busy && !dialogOpen} onclick={() => submit()}>Guardar cambios</Button>
    {/snippet}
  </ReleaseForm>
{/if}

<Dialog bind:open={dialogOpen} title={dialogTitle} size="sm" dismissible={!busy} {returnFocus} onclose={closeDialog} initialFocus="[data-dialog-focus]">
  {#if dialog === 'publish' && selected}
    <p class="editor__dialog-text"><strong>{selected.title}</strong> quedará visible en el catálogo. Se registrarán la observación y la versión actual.</p>
    <dl class="editor__dialog-facts">
      <dt>Artistas</dt><dd>{artistLine}</dd>
      <dt>Fecha</dt><dd>{formatDate(selected.release_date)}</dd>
    </dl>
  {:else if dialog === 'archive'}
    <p class="editor__dialog-text">El lanzamiento dejará de aparecer públicamente. Su identidad, colecciones e historial se conservarán.</p>
  {:else if dialog === 'revert' && pendingHistory}
    <p class="editor__dialog-text">Se restaurará el estado anterior a «{pendingHistory.reason}» mediante un nuevo cambio auditado. No se sobrescribirán ediciones posteriores.</p>
    <Textarea label="Observación de la reversión" required rows={2} bind:value={revertReason} placeholder="¿Por qué se revierte?" data-dialog-focus />
  {/if}
  {#if dialogError}<Notice tone="error" class="editor__dialog-error">{dialogError}</Notice>{/if}
  {#snippet footer()}
    <Button variant="secondary" disabled={busy} onclick={closeDialog}>{dialog === 'publish' ? 'Seguir editando' : 'Cancelar'}</Button>
    {#if dialog === 'publish'}
      <Button loading={busy} onclick={() => submit('publish')} data-dialog-focus>Confirmar publicación</Button>
    {:else if dialog === 'archive'}
      <Button variant="destructive" loading={busy} onclick={() => submit('archive')} data-dialog-focus>Archivar</Button>
    {:else if dialog === 'revert'}
      <Button variant="destructive" loading={busy} onclick={submitRevert}>Revertir cambio</Button>
    {/if}
  {/snippet}
</Dialog>

<style>
  .editor__state { display: grid; place-items: center; min-height: 16rem; }
  .editor__version { color: var(--color-texto-tenue); font-size: var(--text-2xs); font-variant-numeric: tabular-nums; }
  .editor__reports { color: var(--color-danger-texto); font-size: var(--text-2xs); }
  .editor__reports:hover { color: var(--color-texto); }

  /* ---- Diálogos --------------------------------------------------------- */
  .editor__dialog-text { margin: 0 0 var(--space-3); color: var(--color-texto-medio); font-size: var(--text-sm); line-height: 1.5; }
  .editor__dialog-facts {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: var(--space-2) var(--space-4);
    margin: 0;
    font-size: var(--text-sm);
  }
  .editor__dialog-facts dt { color: var(--color-texto-tenue); }
  .editor__dialog-facts dd { margin: 0; color: var(--color-texto); }
  :global(.editor__dialog-error) { margin-top: var(--space-3); }
</style>
