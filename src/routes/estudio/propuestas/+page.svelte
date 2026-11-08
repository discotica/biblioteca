<script lang="ts">
  // Propuestas del Estudio (U17): bandeja con la lista a la izquierda y el
  // detalle a la derecha. Muestra solo lo propuesto y marca lo que difiere de lo
  // detectado. Desde U19 (G3) la propuesta se corrige y se decide en el editor
  // del Estudio (?editar=<id>), el mismo para admin y colaborador. El layout ya
  // comprobó sesión y rol.
  // U23 (tableros 4 y 5): ítems con portada y punto de estado; el resumen con la
  // cabecera del editor y las decisiones (D2); ‹ n de N › en el editor; y la
  // transición entre el resumen y el editor sin mover la cabecera.
  import { goto, onNavigate } from '$app/navigation';
  import { page } from '$app/state';
  import { Button, EmptyState, ErrorState, LoadingIndicator, Notice } from '$lib/ui';
  import { InboxItem, InboxLayout, ToolHeader } from '$lib/layouts';
  import ProposalEditor, { type ProposalOutcome } from '$lib/components/estudio/ProposalEditor.svelte';
  import ProposalSummary from '$lib/components/estudio/ProposalSummary.svelte';
  import { getStudioContext } from '$lib/components/estudio/context';
  import { InboxSelection } from '$lib/components/estudio/inboxSelection.svelte';
  import { studioProposalEditorHref, studioProposalsHref, studioReleaseHref, withParams } from '$lib/domain/studio';
  import { inboxNeighbor, proposalGroups, relativeInboxDate, selectInboxItem } from '$lib/domain/studioInbox';
  import { CONTRIBUTION_DOT_TONES } from '$lib/domain/contributionRows';
  import { proposalCover } from '$lib/domain/proposalEditor';
  import {
    CONTRIBUTION_STATUS_LABELS,
    loadEditorialQueue,
    loadReleaseContributions,
    type Contribution
  } from '$lib/stores/contributionsStore';

  const studio = getStudioContext();
  const role = studio.role;
  const userId = studio.userId;
  const catalogAvailable = studio.sections.includes('catalogo');
  const selection = new InboxSelection('propuesta');

  let loaded = $state(false);
  let queue = $state<Contribution[]>([]);
  let loadError = $state('');
  let flash = $state('');
  /** Lanzamiento creado por la última aceptación, para abrirlo en el Catálogo. */
  let approvedReleaseId = $state<string | null>(null);
  /** El editor se abrió desde la bandeja en esta pestaña: "Volver" es atrás. */
  let openedFromInbox = false;

  /** ?lanzamiento=<uuid>: las propuestas que crearon ese lanzamiento (solo consulta). */
  const releaseFilter = $derived(page.url.searchParams.get('lanzamiento'));
  /** ?editar=<uuid>: la propuesta abierta en el editor (U19). */
  const editingId = $derived(page.url.searchParams.get('editar'));
  const groups = $derived(proposalGroups(queue, role, !!releaseFilter));
  const ordered = $derived(groups.flatMap((group) => group.items));
  const ids = $derived(ordered.map((item) => item.id));
  const selectedId = $derived(loaded ? selectInboxItem(ids, selection.requested, selection.wide) : null);
  const selected = $derived(ordered.find((item) => item.id === selectedId) ?? null);
  const groupOf = (item: Contribution) => groups.find((group) => group.items.includes(item))?.label ?? '';

  async function load(filter: string | null) {
    loaded = false;
    loadError = '';
    try {
      queue = filter ? await loadReleaseContributions(filter) : await loadEditorialQueue();
    } catch (cause: any) {
      queue = [];
      loadError = cause?.message || 'Inténtalo de nuevo en un momento.';
    } finally {
      loaded = true;
    }
  }

  $effect(() => {
    void load(releaseFilter);
  });

  const title = (item: Contribution) => item.payload.title?.trim() || 'Propuesta sin título';
  const editing = $derived(editingId ? (ordered.find((item) => item.id === editingId) ?? null) : null);
  /** ‹ n de N › en el editor: la posición en la bandeja, si la propuesta está en ella. */
  const position = $derived.by(() => {
    const index = editingId ? ids.indexOf(editingId) : -1;
    return index === -1 ? null : { index, total: ids.length, prev: ids[index - 1] ?? null, next: ids[index + 1] ?? null };
  });

  // Resumen ⇄ editor con View Transitions: portada y título se mueven a su sitio en lugar de
  // saltar. Sin la API, o con movimiento reducido, cambia sin animación.
  onNavigate((navigation) => {
    if (typeof document === 'undefined' || !document.startViewTransition) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const from = navigation.from?.url.searchParams.get('editar') ?? null;
    const to = navigation.to?.url.searchParams.get('editar') ?? null;
    if (navigation.from?.url.pathname !== navigation.to?.url.pathname || !from === !to) return;
    return new Promise((resolve) => {
      document.startViewTransition(async () => {
        resolve();
        await navigation.complete;
      });
    });
  });

  function openEditor(event: MouseEvent, id: string) {
    event.preventDefault();
    openedFromInbox = true;
    flash = '';
    approvedReleaseId = null;
    void goto(studioProposalEditorHref(id));
  }

  /** ‹ › del editor: otra propuesta de la bandeja, sin sumar historial («Volver» sigue llevando a la bandeja). */
  function step(id: string) {
    flash = '';
    void goto(studioProposalEditorHref(id), { replaceState: true, noScroll: false });
  }

  function closeEditor() {
    const id = editingId;
    if (openedFromInbox) {
      openedFromInbox = false;
      history.back();
      return;
    }
    void goto(withParams(page.url, { editar: null, propuesta: id }), { replaceState: true });
  }

  /** Se decidió en el editor: sale de la cola (o se actualiza, con el filtro de un lanzamiento) y se abre la siguiente. */
  function decided(id: string, outcome: ProposalOutcome) {
    const next = inboxNeighbor(ids, id);
    queue = releaseFilter
      ? queue.map((entry) => (entry.id === id && outcome.contribution ? outcome.contribution : entry))
      : queue.filter((entry) => entry.id !== id);
    flash = outcome.flash;
    approvedReleaseId = outcome.releaseId;
    openedFromInbox = false;
    studio.refreshCounts();
    if (releaseFilter) void load(releaseFilter);
    selection.advance(releaseFilter ? id : next, { editar: null });
  }
</script>

<svelte:head>{#if !editingId}<title>Propuestas · Estudio — Discótica</title>{/if}</svelte:head>

{#if editingId}
  {@const id = editingId}
  <ProposalEditor
    contributionId={id}
    {role}
    {userId}
    preview={editing ? { title: title(editing), cover: proposalCover(editing) } : null}
    {position}
    onstep={step}
    onclose={closeEditor}
    ondone={(outcome) => decided(id, outcome)}
  />
{:else}

<ToolHeader title="Propuestas" count={loaded && !loadError ? ids.length : undefined}>
  {#snippet actions()}
    {#if releaseFilter}
      <Button size="sm" variant="secondary" href={studioProposalsHref()}>Ver todas</Button>
      {#if catalogAvailable}<Button size="sm" variant="secondary" href={studioReleaseHref(releaseFilter)}>Abrir el lanzamiento</Button>{/if}
    {/if}
  {/snippet}
</ToolHeader>

{#if flash}
  <Notice tone="success" class="propuestas__notice">
    {flash}
    {#snippet actions()}
      {#if approvedReleaseId && catalogAvailable}
        <Button size="sm" variant="secondary" href={studioReleaseHref(approvedReleaseId)}>Abrir el lanzamiento en el Catálogo</Button>
      {/if}
    {/snippet}
  </Notice>
{/if}

{#if !loaded}
  <div class="propuestas__loading"><LoadingIndicator label="Cargando propuestas" /></div>
{:else if loadError}
  <ErrorState size="inline" message="No se pudieron cargar las propuestas." detail={loadError} onaction={() => load(releaseFilter)} />
{:else}
  <InboxLayout
    label={releaseFilter ? 'Propuestas de este lanzamiento' : 'Propuestas en cola'}
    {groups}
    key={(item) => item.id}
    open={!!selected}
    backLabel="Volver a las propuestas"
    onback={() => selection.back(selectedId)}
  >
    {#snippet item(entry: Contribution)}
      <InboxItem
        href={selection.href(entry.id)}
        title={title(entry)}
        current={entry.id === selectedId}
        cover={proposalCover(entry)}
        dot={{ label: CONTRIBUTION_STATUS_LABELS[entry.status], tone: CONTRIBUTION_DOT_TONES[entry.status] }}
        ready={entry.status === 'ready_for_admin' ? CONTRIBUTION_STATUS_LABELS.ready_for_admin : undefined}
        meta={[entry.payload.primary_artists?.join(', ') || 'Sin artistas', relativeInboxDate(entry.submitted_at ?? entry.updated_at)].filter(Boolean)}
        onselect={() => selection.select(entry.id)}
        data-inbox-item={entry.id}
      />
    {/snippet}

    {#snippet detail()}
      {#if selected}
        <ProposalSummary
          item={selected}
          {role}
          {userId}
          group={releaseFilter ? "" : groupOf(selected)}
          {catalogAvailable}
          bind:heading={selection.heading}
          editHref={studioProposalEditorHref(selected.id)}
          onedit={(event) => openEditor(event, selected.id)}
          ondone={(outcome) => decided(selected.id, outcome)}
        />
      {:else if ids.length}
        <EmptyState size="inline" message="Elige una propuesta de la lista." />
      {:else}
        <EmptyState size="inline" icon="bandeja" message="Sin propuestas" detail="No hay nada por revisar." />
      {/if}
    {/snippet}
  </InboxLayout>
{/if}
{/if}

<style>
  :global(.propuestas__notice) { margin-bottom: var(--density-pad); }
  .propuestas__loading { display: grid; place-items: center; min-height: 16rem; }
</style>
