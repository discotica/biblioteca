<script lang="ts">
  // Reportes del Estudio (U17): la misma bandeja que Propuestas, solo para
  // administración. Estados de E18 traducidos y enlace al lanzamiento. La
  // clasificación es la de siempre (`admin_update_problem_report`). El layout ya
  // comprobó sesión y rol.
  import { page } from '$app/state';
  import { Button, Chip, EmptyState, ErrorState, LoadingIndicator, Notice, Select, Textarea } from '$lib/ui';
  import { InboxDetail, InboxField, InboxItem, InboxLayout, ToolHeader } from '$lib/layouts';
  import { getStudioContext } from '$lib/components/estudio/context';
  import { InboxSelection } from '$lib/components/estudio/inboxSelection.svelte';
  import { studioReleaseHref, studioReportsHref } from '$lib/domain/studio';
  import { REPORT_STATUS_TONES, reportContextRows, reportGroups, selectInboxItem } from '$lib/domain/studioInbox';
  import {
    loadProblemReports,
    updateProblemReport,
    REPORT_CATEGORIES,
    REPORT_STATUSES,
    reportStatusLabel,
    type ProblemReport
  } from '$lib/services/problemReports';

  const studio = getStudioContext();
  const userId = studio.userId;
  const catalogAvailable = studio.sections.includes('catalogo');
  const selection = new InboxSelection('reporte');
  const dateFormat = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const shortDate = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  const STATUS_OPTIONS = REPORT_STATUSES.map(([value, label]) => ({ value, label }));

  let loaded = $state(false);
  let reports = $state<ProblemReport[]>([]);
  let loadError = $state('');
  let actionError = $state('');
  let flash = $state('');
  let busy = $state('');
  let reportNotes = $state<Record<string, string>>({});
  let reportStates = $state<Record<string, ProblemReport['status']>>({});

  /** ?lanzamiento=<uuid>: solo los reportes de ese lanzamiento. */
  const releaseFilter = $derived(page.url.searchParams.get('lanzamiento'));
  const visible = $derived(releaseFilter ? reports.filter((report) => report.release_id === releaseFilter) : reports);
  const groups = $derived(reportGroups(visible));
  const ordered = $derived(groups.flatMap((group) => group.items));
  const ids = $derived(ordered.map((report) => report.id));
  const selectedId = $derived(loaded ? selectInboxItem(ids, selection.requested, selection.wide) : null);
  const selected = $derived(ordered.find((report) => report.id === selectedId) ?? null);

  async function load() {
    loaded = false;
    loadError = '';
    try {
      reports = await loadProblemReports();
    } catch (cause: any) {
      reports = [];
      loadError = cause?.message || 'Inténtalo de nuevo en un momento.';
    } finally {
      loaded = true;
    }
  }

  $effect(() => {
    void load();
  });

  $effect(() => {
    void selectedId;
    actionError = '';
  });

  const category = (value: string) => REPORT_CATEGORIES.find((item) => item[0] === value)?.[1] ?? 'Reporte';
  const date = (value: string) => dateFormat.format(new Date(value));
  /** La ruta de la página, sin el origen (los reportes antiguos guardaban la URL completa). */
  const route = (value: string) => {
    try {
      const url = new URL(value, 'https://discotica.invalid');
      return `${url.pathname}${url.search}`;
    } catch {
      return value;
    }
  };

  async function save(report: ProblemReport) {
    // Si pasa a "Resueltos y cerrados", sigue abierto en el detalle.
    await selection.pin(report.id);
    busy = report.id;
    actionError = '';
    flash = '';
    try {
      const updated = await updateProblemReport(report.id, reportStates[report.id] ?? report.status, userId, reportNotes[report.id] ?? '');
      reports = reports.map((entry) => (entry.id === updated.id ? updated : entry));
      delete reportStates[report.id];
      delete reportNotes[report.id];
      flash = `Reporte actualizado: ${reportStatusLabel(updated.status)}.`;
      studio.refreshCounts();
    } catch (cause: any) {
      actionError = cause?.message || 'No se pudo actualizar el reporte.';
    } finally {
      busy = '';
    }
  }
</script>

<svelte:head><title>Reportes · Estudio — Discótica</title></svelte:head>

<ToolHeader
  title="Reportes"
  description={releaseFilter
    ? 'Reportes de un lanzamiento.'
    : 'Los adjuntos y el contexto técnico solo los ve administración. Las respuestas se registran internamente; no envían correo.'}
>
  {#snippet actions()}
    {#if releaseFilter}
      <Button size="sm" variant="secondary" href={studioReportsHref()}>Ver todos</Button>
      {#if catalogAvailable}<Button size="sm" variant="secondary" href={studioReleaseHref(releaseFilter)}>Abrir el lanzamiento</Button>{/if}
    {/if}
  {/snippet}
</ToolHeader>

{#if flash}<Notice tone="success" class="reportes__notice">{flash}</Notice>{/if}

{#if !loaded}
  <div class="reportes__loading"><LoadingIndicator label="Cargando reportes" /></div>
{:else if loadError}
  <ErrorState size="inline" message="No se pudieron cargar los reportes." detail={loadError} onaction={load} />
{:else}
  <InboxLayout
    label={releaseFilter ? 'Reportes de este lanzamiento' : 'Reportes'}
    {groups}
    key={(report) => report.id}
    open={!!selected}
    backLabel="Volver a los reportes"
    onback={() => selection.back(selectedId)}
  >
    {#snippet item(report: ProblemReport)}
      <InboxItem
        href={selection.href(report.id)}
        title={report.description}
        current={report.id === selectedId}
        status={{ label: reportStatusLabel(report.status), tone: REPORT_STATUS_TONES[report.status] }}
        meta={[category(report.category), shortDate.format(new Date(report.created_at)), report.release_id ? 'Con lanzamiento' : ''].filter(Boolean)}
        onselect={() => selection.select(report.id)}
        data-inbox-item={report.id}
      />
    {/snippet}

    {#snippet detail()}
      {#if selected}
        {@render Detail(selected)}
      {:else}
        <EmptyState
          size="inline"
          message={ids.length ? 'Elige un reporte de la lista.' : releaseFilter ? 'Este lanzamiento no tiene reportes.' : 'No hay reportes.'}
        />
      {/if}
    {/snippet}
  </InboxLayout>
{/if}

{#snippet Detail(report: ProblemReport)}
  {@const context = reportContextRows(report.technical_context)}
  <InboxDetail title={category(report.category)} bind:heading={selection.heading}>
    {#snippet eyebrow()}
      <Chip kind="status" label={reportStatusLabel(report.status)} tone={REPORT_STATUS_TONES[report.status]} />
      <span>Recibido el {date(report.created_at)}</span>
    {/snippet}
    {#snippet meta()}
      {#if report.release_id && catalogAvailable}
        <a class="reportes__link" href={studioReleaseHref(report.release_id)}>Abrir el lanzamiento en el Catálogo</a>
        {#if !releaseFilter}<a class="reportes__link" href={studioReportsHref(report.release_id)}>Ver sus reportes</a>{/if}
      {/if}
    {/snippet}

    <div class="l-inbox-note"><strong>Descripción</strong><p>{report.description}</p></div>

    <dl class="l-inbox-fields">
      <InboxField label="Página" value={route(report.page_url)} />
      <InboxField label="Captura" value={report.screenshot_path ? 'Adjunta (privada)' : 'Sin captura'} />
      <InboxField label="Asignado" value={report.assigned_to ? 'Administración' : 'Sin asignar'} />
    </dl>

    {#if context.length}
      <details class="reportes__context">
        <summary>Contexto técnico</summary>
        <dl class="l-inbox-fields">
          {#each context as row (row.label)}<InboxField label={row.label} value={row.value} wide={row.label === 'Navegador'} />{/each}
        </dl>
      </details>
    {/if}

    {#snippet actions()}
      <Select
        label="Estado"
        options={STATUS_OPTIONS}
        value={reportStates[report.id] ?? report.status}
        onchange={(value) => (reportStates[report.id] = value as ProblemReport['status'])}
      />
      <Textarea
        label="Respuesta interna"
        optional
        hint="Clasificación o respuesta para el equipo. No se envía a quien reportó."
        rows={3}
        bind:value={() => reportNotes[report.id] ?? '', (value) => (reportNotes[report.id] = value)}
      />
      <div class="l-inbox-buttons">
        <Button onclick={() => save(report)} loading={busy === report.id} disabled={busy === report.id}>Guardar clasificación</Button>
      </div>
      {#if actionError}<Notice tone="error">{actionError}</Notice>{/if}
    {/snippet}
  </InboxDetail>
{/snippet}

<style>
  :global(.reportes__notice) { margin-bottom: var(--density-pad); }
  .reportes__loading { display: grid; place-items: center; min-height: 16rem; }

  .reportes__link {
    display: inline-flex;
    align-items: center;
    min-height: var(--target-touch);
    color: var(--color-acento);
    font-size: var(--text-2xs);
  }

  .reportes__context summary {
    display: flex;
    align-items: center;
    min-height: var(--target-touch);
    color: var(--color-texto-medio);
    font-size: var(--density-text);
    font-weight: 650;
    cursor: pointer;
  }
  .reportes__context[open] summary { margin-bottom: var(--space-3); }
</style>
