<script lang="ts">
  // Propuestas del Estudio (U17): bandeja con la lista a la izquierda y el
  // detalle a la derecha. Muestra solo lo propuesto y marca lo que difiere de lo
  // detectado. Desde U19 (G3) la propuesta se corrige y se decide en el editor
  // del Estudio (?editar=<id>), el mismo para admin y colaborador. El layout ya
  // comprobó sesión y rol.
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { Button, Chip, Cover, EmptyState, ErrorState, Icon, LoadingIndicator, Notice } from '$lib/ui';
  import { InboxDetail, InboxField, InboxItem, InboxLayout, ToolHeader } from '$lib/layouts';
  import ProposalEditor, { type ProposalOutcome } from '$lib/components/estudio/ProposalEditor.svelte';
  import { getStudioContext } from '$lib/components/estudio/context';
  import { InboxSelection } from '$lib/components/estudio/inboxSelection.svelte';
  import { studioProposalEditorHref, studioProposalsHref, studioReleaseHref, withParams } from '$lib/domain/studio';
  import {
    inboxNeighbor,
    proposalAction,
    proposalDetection,
    proposalFields,
    proposalGroups,
    selectInboxItem
  } from '$lib/domain/studioInbox';
  import { CONTRIBUTION_ROW_TONES } from '$lib/domain/contributionRows';
  import {
    CONTRIBUTION_STATUS_LABELS,
    RELEASE_TYPE_OPTIONS,
    loadEditorialQueue,
    loadReleaseContributions,
    type Contribution
  } from '$lib/stores/contributionsStore';

  const studio = getStudioContext();
  const role = studio.role;
  const userId = studio.userId;
  const catalogAvailable = studio.sections.includes('catalogo');
  const selection = new InboxSelection('propuesta');
  const dateFormat = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

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
  const date = (value: string | null | undefined) => (value ? dateFormat.format(new Date(value)) : '');
  const editedCount = (item: Contribution) => proposalFields(item, RELEASE_TYPE_OPTIONS).filter((field) => field.edited).length;
  const provider = (item: Contribution) => {
    const name = item.source_provider ?? '';
    return name ? name.charAt(0).toLocaleUpperCase('es') + name.slice(1) : 'Fuente';
  };

  function openEditor(event: MouseEvent, id: string) {
    event.preventDefault();
    openedFromInbox = true;
    flash = '';
    approvedReleaseId = null;
    void goto(studioProposalEditorHref(id));
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
  <ProposalEditor contributionId={id} {role} {userId} onclose={closeEditor} ondone={(outcome) => decided(id, outcome)} />
{:else}

<ToolHeader
  title="Propuestas"
  description={releaseFilter
    ? 'Propuestas que crearon este lanzamiento.'
    : role === 'admin'
      ? 'Revisa cada propuesta y ábrela en el editor para corregirla, aceptarla, pedir cambios o rechazarla.'
      : 'Corrige propuestas de la comunidad en el editor y márcalas listas para administración.'}
>
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
      {@const edited = editedCount(entry)}
      <InboxItem
        href={selection.href(entry.id)}
        title={title(entry)}
        current={entry.id === selectedId}
        status={{ label: CONTRIBUTION_STATUS_LABELS[entry.status], tone: CONTRIBUTION_ROW_TONES[entry.status] }}
        flag={edited ? (edited === 1 ? '1 campo editado' : `${edited} campos editados`) : undefined}
        meta={[entry.payload.primary_artists?.join(', ') || 'Sin artistas', date(entry.submitted_at ?? entry.updated_at)].filter(Boolean)}
        onselect={() => selection.select(entry.id)}
        data-inbox-item={entry.id}
      />
    {/snippet}

    {#snippet detail()}
      {#if selected}
        {@render Detail(selected)}
      {:else}
        <EmptyState size="inline" message={ids.length ? 'Elige una propuesta de la lista.' : 'No hay propuestas por revisar.'} />
      {/if}
    {/snippet}
  </InboxLayout>
{/if}
{/if}

{#snippet Detail(item: Contribution)}
  {@const fields = proposalFields(item, RELEASE_TYPE_OPTIONS)}
  {@const detection = proposalDetection(item)}
  {@const action = proposalAction(item, role, userId)}
  {@const cover = typeof item.detected_metadata?.cover_url === 'string' ? item.detected_metadata.cover_url : ''}
  <InboxDetail title={title(item)} bind:heading={selection.heading}>
    {#snippet eyebrow()}
      <Chip kind="status" label={CONTRIBUTION_STATUS_LABELS[item.status]} tone={CONTRIBUTION_ROW_TONES[item.status]} />
      <span>{groupOf(item)}</span>
      {#if item.submitted_at}<span>Enviada el {date(item.submitted_at)}</span>{/if}
    {/snippet}
    {#snippet meta()}
      <a class="propuestas__link" href={item.source_url} target="_blank" rel="noreferrer">
        Abrir la fuente en {provider(item)}<Icon name="flecha-externa" size="em" />
      </a>
      {#if item.release_id && catalogAvailable}
        <a class="propuestas__link" href={studioReleaseHref(item.release_id)}>Abrir el lanzamiento en el Catálogo</a>
      {/if}
    {/snippet}

    {#if detection === 'unavailable'}
      <p class="propuestas__legend">La fuente no se pudo leer: todos los datos se escribieron a mano.</p>
    {:else if fields.some((field) => field.edited)}
      <p class="propuestas__legend"><Chip kind="status" tone="warning" label="Editado" /> difiere de lo que detectó la fuente.</p>
    {:else}
      <p class="propuestas__legend">Coincide con lo que detectó la fuente.</p>
    {/if}

    <div class="propuestas__data" class:propuestas__data--cover={!!cover}>
      {#if cover}
        <figure class="propuestas__cover">
          <Cover src={cover} alt="Portada de la fuente para {title(item)}" radius="sm" />
          <figcaption>De la fuente. Se publica con el lanzamiento.</figcaption>
        </figure>
      {/if}
      <dl class="l-inbox-fields">
        {#each fields as field (field.key)}
          <InboxField
            label={field.label}
            value={field.value}
            wide={field.key === 'title' || field.key === 'primary_artists'}
            mark={field.edited ? { label: 'Editado', description: 'Difiere de lo que detectó la fuente.' } : undefined}
          />
        {/each}
      </dl>
    </div>

    {#if item.payload.team_note?.trim()}
      <div class="l-inbox-note"><strong>Nota de quien propone</strong><p>{item.payload.team_note}</p></div>
    {:else}
      <div class="l-inbox-note l-inbox-note--empty"><strong>Nota de quien propone</strong><p>Sin nota</p></div>
    {/if}
    {#if item.reviewer_note && action === 'none'}
      <div class="l-inbox-note"><strong>Nota de la revisión</strong><p>{item.reviewer_note}</p></div>
    {/if}

    {#snippet actions()}
      {#if action === 'review' || action === 'prepare'}
        <div class="l-inbox-buttons">
          <Button href={studioProposalEditorHref(item.id)} onclick={(event: MouseEvent) => openEditor(event, item.id)}>Abrir en el editor</Button>
        </div>
        <p class="propuestas__waiting">
          {action === 'review'
            ? 'En el editor la corriges y decides: aceptar como borrador o publicando, pedir cambios o rechazar.'
            : 'En el editor la corriges y la marcas lista para administración.'}
        </p>
      {:else if action === 'waiting'}
        <p class="propuestas__waiting">Pendiente de revisión administrativa.</p>
      {/if}
    {/snippet}
  </InboxDetail>
{/snippet}

<style>
  :global(.propuestas__notice) { margin-bottom: var(--density-pad); }
  .propuestas__loading { display: grid; place-items: center; min-height: 16rem; }

  .propuestas__link {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    min-height: var(--target-touch);
    color: var(--color-acento);
    font-size: var(--text-2xs);
  }

  .propuestas__legend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    color: var(--color-texto-tenue);
    font-size: var(--text-2xs);
  }

  .propuestas__data { display: grid; gap: var(--density-pad); }
  .propuestas__data--cover { grid-template-columns: var(--tool-cover) minmax(0, 1fr); align-items: start; }
  .propuestas__cover { margin: 0; }
  .propuestas__cover figcaption { margin-top: var(--space-2); color: var(--color-texto-tenue); font-size: var(--text-2xs); line-height: 1.4; }

  .propuestas__waiting { margin: 0; color: var(--color-texto-medio); font-size: var(--density-text); }

  @media (max-width: 679px) {
    .propuestas__data--cover { grid-template-columns: minmax(0, 1fr); }
    .propuestas__cover { width: var(--tool-cover); }
  }
</style>
