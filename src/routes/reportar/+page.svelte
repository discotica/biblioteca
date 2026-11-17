<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import AccesoPagina from '$lib/components/account/AccesoPagina.svelte';
  import AccesoTitulo from '$lib/components/account/AccesoTitulo.svelte';
  import { Button, Cover, FormPanel, Notice, Select, Skeleton, Textarea } from '$lib/ui';
  import { user } from '$lib/stores/authStore';
  import { fetchReleasesForCrate, type Lanzamiento } from '$lib/utils/catalogoStore';
  import { createProblemReport, REPORT_CATEGORIES, type ReportCategory, validateScreenshot } from '$lib/services/problemReports';

  // Flujo de E18 (U33, tablero M: un solo panel de 576 sobre el campo de puntos). Desde la ficha (U9) se llega con ?release_id={uuid}: el
  // lanzamiento se muestra identificado y la categoría parte de "Error de
  // catálogo". Desde el menú global, sin lanzamiento.

  const categoryOptions = REPORT_CATEGORIES.map(([value, label]) => ({ value, label }));

  let category = $state<ReportCategory>('technical_bug');
  let description = $state('');
  let screenshot = $state<File | null>(null);
  let fileInput = $state<HTMLInputElement>();
  let descriptionError = $state('');
  let error = $state('');
  let notice = $state('');
  let busy = $state(false);
  let releaseId = $state<string | null>(null);
  let release = $state<Lanzamiento | null>(null);
  let releaseState = $state<'idle' | 'loading' | 'ready' | 'missing'>('idle');

  const returnTo = $derived(`${page.url.pathname}${page.url.search}`);
  const releaseArtists = $derived(release?.primaryArtists.map((credit) => credit.name).join(', ') ?? '');

  onMount(() => {
    const candidate = page.url.searchParams.get('release_id');
    releaseId = candidate && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(candidate) ? candidate : null;
    if (!$user) {
      void goto(`/auth/login?redirect=${encodeURIComponent(returnTo)}`);
      return;
    }
    if (!releaseId) return;
    category = 'catalog_error';
    releaseState = 'loading';
    fetchReleasesForCrate([releaseId], [])
      .then(([found]) => {
        release = found ?? null;
        releaseState = found ? 'ready' : 'missing';
      })
      .catch(() => { releaseState = 'missing'; });
  });

  function chooseFile(event: Event) {
    error = '';
    const input = event.currentTarget as HTMLInputElement;
    const next = input.files?.[0] ?? null;
    try {
      validateScreenshot(next);
      screenshot = next;
    } catch (cause: any) {
      screenshot = null;
      input.value = '';
      error = cause?.message ?? 'No se pudo usar esta captura.';
    }
  }

  function clearFile() {
    screenshot = null;
    if (fileInput) fileInput.value = '';
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    error = '';
    notice = '';
    descriptionError = '';
    if (!description.trim()) {
      descriptionError = 'Describe el problema para poder investigarlo.';
      document.getElementById('report-description')?.focus();
      return;
    }
    busy = true;
    try {
      const result = await createProblemReport({ category, description, releaseId, screenshot });
      notice = result.screenshotError ?? 'Tu reporte fue enviado. Gracias por ayudarnos a mejorar la biblioteca.';
      description = '';
      clearFile();
    } catch (cause: any) {
      error = cause?.message ?? 'No se pudo enviar el reporte. Intenta de nuevo.';
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>Reportar un problema — Discótica</title></svelte:head>

<AccesoPagina contenedor="narrow" alinea="arriba">
  <FormPanel as="form" size="wide" onsubmit={submit} novalidate aria-label="Reportar un problema">
    <AccesoTitulo titulo="Reportar un problema" />

    {#if releaseId}
      <section class="reportar__release" aria-label="Lanzamiento del reporte">
        {#if releaseState === 'ready' && release}
          <div class="reportar__cover"><Cover src={release.coverUrl} alt="" radius="sm" loading="eager" /></div>
          <div class="reportar__release-text">
            <span class="reportar__release-kicker">Lanzamiento</span>
            <strong>{release.title}</strong>
            {#if releaseArtists}<span>{releaseArtists}</span>{/if}
          </div>
          <Button variant="link" size="sm" href={`/lanzamiento/${release.slug}`}>Ver ficha</Button>
        {:else if releaseState === 'loading'}
          <Skeleton variant="row" class="reportar__skeleton" />
        {:else}
          <p class="reportar__release-text">Este reporte incluye el lanzamiento desde el que llegaste.</p>
        {/if}
      </section>
    {/if}

    <Select label="Categoría" id="report-category" options={categoryOptions} bind:value={category} />
    <Textarea
      label="Descripción"
      id="report-description"
      bind:value={description}
      rows={5}
      maxlength={5000}
      placeholder="Cuéntanos qué pasó"
      error={descriptionError}
      required
    />

    <div class="reportar__file">
      <input
        bind:this={fileInput}
        class="sr-only"
        id="report-screenshot"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label="Captura de pantalla"
        tabindex="-1"
        onchange={chooseFile}
      />
      <div class="reportar__file-row">
        <Button variant="secondary" icon="agregar" onclick={() => fileInput?.click()}>{screenshot ? 'Cambiar captura' : 'Añadir captura'}</Button>
        {#if screenshot}
          <span class="reportar__file-name" aria-live="polite">{screenshot.name}</span>
          <Button variant="ghost" size="sm" onclick={clearFile}>Quitar<span class="sr-only"> la captura</span></Button>
        {/if}
      </div>
    </div>

    <!-- Verificado contra technicalReportContext (problemReports.ts): ruta, fecha, versión, fuente, navegador, viewport, idioma y conexión. Ninguna cookie. -->
    <p class="reportar__hint">Incluimos datos técnicos de la página. Nunca cookies.</p>

    {#if error}<Notice tone="error">{error}</Notice>{/if}
    {#if notice}
      <Notice tone="success">
        {notice}
        {#snippet actions()}
          {#if release}<Button variant="secondary" size="sm" href={`/lanzamiento/${release.slug}`}>Volver al lanzamiento</Button>{/if}
        {/snippet}
      </Notice>
    {/if}

    {#snippet actions()}
      <Button type="submit" size="form" block loading={busy}>{busy ? 'Enviando…' : 'Enviar reporte'}</Button>
    {/snippet}
  </FormPanel>
</AccesoPagina>

<style>
  .reportar__release {
    display: grid;
    grid-template-columns: var(--reportar-cover) minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-3);
    border: 1px solid var(--color-linea-sutil);
    border-radius: var(--radius-sm);
    background: var(--color-superficie-1);
    --reportar-cover: calc(var(--space-8) + var(--space-5));
  }
  .reportar__release:has(> p),
  .reportar__release:has(> :global(.reportar__skeleton)) { grid-template-columns: minmax(0, 1fr); }
  .reportar__release-text { display: grid; gap: var(--space-1); min-width: 0; margin: 0; color: var(--color-texto-medio); font-size: var(--text-sm); line-height: 1.4; }
  .reportar__release-text strong { overflow: hidden; color: var(--color-texto); font-size: var(--text-md); text-overflow: ellipsis; white-space: nowrap; }
  .reportar__release-text > span:last-child:not(.reportar__release-kicker) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .reportar__release-kicker { color: var(--color-texto-tenue); font-size: var(--text-2xs); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }

  .reportar__file-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); min-width: 0; }
  .reportar__file-name { min-width: 0; overflow: hidden; color: var(--color-texto); font-size: var(--text-sm); text-overflow: ellipsis; white-space: nowrap; }
  .reportar__hint { margin: calc(-1 * var(--space-2)) 0 0; color: var(--color-texto-medio); font-size: var(--text-xs); line-height: 1.4; }

  @media (max-width: 679px) {
    .reportar__release { grid-template-columns: var(--reportar-cover) minmax(0, 1fr); }
    .reportar__release :global(.ui-btn) { grid-column: 2; justify-self: start; }
  }
</style>
