<script lang="ts">
  // Propuestas del Estudio (U17): bandeja con la lista a la izquierda y el
  // detalle a la derecha. Muestra solo lo propuesto y marca lo que difiere de lo
  // detectado. Acciones, estados y RPC son los de la estación de E10 (contrato
  // E09). El layout ya comprobó sesión y rol.
  import { tick } from 'svelte';
  import { page } from '$app/state';
  import { Button, Chip, Cover, Dialog, EmptyState, ErrorState, Icon, LoadingIndicator, Notice, Textarea } from '$lib/ui';
  import { InboxDetail, InboxField, InboxItem, InboxLayout, ToolHeader } from '$lib/layouts';
  import { getStudioContext } from '$lib/components/estudio/context';
  import { InboxSelection } from '$lib/components/estudio/inboxSelection.svelte';
  import { studioProposalsHref, studioReleaseHref } from '$lib/domain/studio';
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
    prepareContributionForAdmin,
    reviewContribution,
    type Contribution
  } from '$lib/stores/contributionsStore';

  type Decision = 'approved' | 'rejected' | 'changes_requested';

  const studio = getStudioContext();
  const role = studio.role;
  const userId = studio.userId;
  const catalogAvailable = studio.sections.includes('catalogo');
  const selection = new InboxSelection('propuesta');
  const dateFormat = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

  let loaded = $state(false);
  let queue = $state<Contribution[]>([]);
  let loadError = $state('');
  /** Error de la última acción, en el detalle. */
  let actionError = $state('');
  let noteError = $state('');
  let flash = $state('');
  /** Lanzamiento creado por la última aprobación, para abrirlo en el Catálogo. */
  let approvedReleaseId = $state<string | null>(null);
  let busy = $state('');
  let notes = $state<Record<string, string>>({});
  let approvalOpen = $state(false);
  let noteField = $state<HTMLTextAreaElement>();

  /** ?lanzamiento=<uuid>: las propuestas que crearon ese lanzamiento (solo consulta). */
  const releaseFilter = $derived(page.url.searchParams.get('lanzamiento'));
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

  // Cada propuesta empieza sin errores de la anterior.
  $effect(() => {
    void selectedId;
    actionError = '';
    noteError = '';
  });

  const title = (item: Contribution) => item.payload.title?.trim() || 'Propuesta sin título';
  const date = (value: string | null | undefined) => (value ? dateFormat.format(new Date(value)) : '');
  const editedCount = (item: Contribution) => proposalFields(item, RELEASE_TYPE_OPTIONS).filter((field) => field.edited).length;
  const provider = (item: Contribution) => {
    const name = item.source_provider ?? '';
    return name ? name.charAt(0).toLocaleUpperCase('es') + name.slice(1) : 'Fuente';
  };

  function resolved(item: Contribution, updated: Contribution) {
    const next = inboxNeighbor(ids, item.id);
    queue = releaseFilter ? queue.map((entry) => (entry.id === item.id ? updated : entry)) : queue.filter((entry) => entry.id !== item.id);
    delete notes[item.id];
    studio.refreshCounts();
    if (!releaseFilter) selection.advance(next);
  }

  async function prepare(item: Contribution) {
    busy = item.id;
    actionError = '';
    flash = '';
    approvedReleaseId = null;
    try {
      const updated = await prepareContributionForAdmin(item.id, item.payload, notes[item.id] ?? '');
      flash = `${title(item)} quedó lista para administración.`;
      // El colaborador ya no la ve en su cola; un admin la vería en la prioritaria.
      if (role === 'colaborador') resolved(item, updated);
      else queue = queue.map((entry) => (entry.id === item.id ? updated : entry));
    } catch (cause: any) {
      actionError = cause?.message || 'No se pudo preparar la propuesta.';
    } finally {
      busy = '';
    }
  }

  async function decide(item: Contribution, action: Decision) {
    actionError = '';
    noteError = '';
    flash = '';
    approvedReleaseId = null;
    const note = notes[item.id]?.trim() ?? '';
    if (action !== 'approved' && !note) {
      noteError = action === 'rejected' ? 'Escribe una nota antes de rechazar.' : 'Escribe una nota para solicitar cambios.';
      await tick();
      noteField?.focus();
      return;
    }
    busy = item.id;
    try {
      const updated = await reviewContribution(item.id, action, note);
      approvalOpen = false;
      flash = `${title(item)}: ${CONTRIBUTION_STATUS_LABELS[updated.status]}.`;
      approvedReleaseId = action === 'approved' ? updated.release_id : null;
      resolved(item, updated);
    } catch (cause: any) {
      actionError = cause?.message || 'No se pudo registrar la decisión.';
      if (action === 'approved') approvalOpen = false;
    } finally {
      busy = '';
    }
  }
</script>

<svelte:head><title>Propuestas · Estudio — Discótica</title></svelte:head>

<ToolHeader
  title="Propuestas"
  description={releaseFilter
    ? 'Propuestas que crearon este lanzamiento.'
    : role === 'admin'
      ? 'Revisa cada propuesta y apruébala, pide cambios o recházala.'
      : 'Prepara propuestas de la comunidad para la revisión final de administración.'}
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
      {#if action === 'review'}
        <Textarea
          label="Nota para la persona autora"
          hint="Obligatoria al pedir cambios o rechazar."
          rows={3}
          bind:value={() => notes[item.id] ?? '', (value) => (notes[item.id] = value)}
          bind:element={noteField}
          error={noteError}
        />
        <div class="l-inbox-buttons">
          <Button onclick={() => (approvalOpen = true)} disabled={busy === item.id}>Revisar publicación</Button>
          <Button variant="secondary" onclick={() => decide(item, 'changes_requested')} disabled={busy === item.id}>Solicitar cambios</Button>
          <Button variant="destructive" onclick={() => decide(item, 'rejected')} disabled={busy === item.id}>Rechazar</Button>
        </div>
      {:else if action === 'prepare'}
        <Textarea label="Nota interna" optional hint="Evidencia o contexto para administración." rows={3} bind:value={() => notes[item.id] ?? '', (value) => (notes[item.id] = value)} />
        <div class="l-inbox-buttons">
          <Button onclick={() => prepare(item)} loading={busy === item.id} disabled={busy === item.id}>Marcar lista para administración</Button>
        </div>
      {:else if action === 'waiting'}
        <p class="propuestas__waiting">Pendiente de revisión administrativa.</p>
      {/if}
      {#if actionError}<Notice tone="error">{actionError}</Notice>{/if}
    {/snippet}
  </InboxDetail>
{/snippet}

{#if selected}
  {@const item = selected}
  <Dialog
    bind:open={approvalOpen}
    title={title(item)}
    description="Confirma el lanzamiento que se publicará con estos datos."
    initialFocus="[data-approval-back]"
  >
    <dl class="propuestas__summary">
      {#each proposalFields(item, RELEASE_TYPE_OPTIONS).filter((field) => field.key !== 'title') as field (field.key)}
        <InboxField label={field.label} value={field.value} />
      {/each}
    </dl>
    {#snippet footer()}
      <Button variant="secondary" data-approval-back onclick={() => (approvalOpen = false)}>Volver</Button>
      <Button onclick={() => decide(item, 'approved')} loading={busy === item.id} disabled={busy === item.id}>Aprobar y publicar</Button>
    {/snippet}
  </Dialog>
{/if}

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

  .propuestas__summary {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-4);
    margin: 0;
  }

  @media (max-width: 679px) {
    .propuestas__data--cover { grid-template-columns: minmax(0, 1fr); }
    .propuestas__cover { width: var(--tool-cover); }
    .propuestas__summary { grid-template-columns: minmax(0, 1fr); }
  }
</style>
