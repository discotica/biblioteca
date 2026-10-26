<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import PageLayout from '$lib/layouts/PageLayout.svelte';
  import { Button, Cover, Notice, Select, Skeleton, Textarea } from '$lib/ui';
  import { user } from '$lib/stores/authStore';
  import { fetchReleasesForCrate, type Lanzamiento } from '$lib/utils/catalogoStore';
  import { createProblemReport, REPORT_CATEGORIES, type ReportCategory, validateScreenshot } from '$lib/services/problemReports';

  // Flujo de E18. Desde la ficha (U9) se llega con ?release_id={uuid}: el
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

<PageLayout
  container="narrow"
  eyebrow="Soporte"
  title="Reportar un problema"
  description="Cuéntanos sobre un error de catálogo, un problema técnico o una mejora. Este canal requiere una sesión para proteger tu reporte."
>
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

  <form class="reportar__form" novalidate onsubmit={submit}>
    <Select label="Categoría" id="report-category" options={categoryOptions} bind:value={category} />
    <Textarea
      label="Descripción"
      id="report-description"
      bind:value={description}
      rows={7}
      maxlength={5000}
      placeholder="¿Qué ocurrió y qué esperabas que pasara?"
      error={descriptionError}
      required
    />

    <div class="reportar__file">
      <span class="reportar__file-label" id="report-screenshot-label">Captura <span class="reportar__optional">(opcional)</span></span>
      <input
        bind:this={fileInput}
        class="sr-only"
        id="report-screenshot"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-labelledby="report-screenshot-label"
        aria-describedby="report-screenshot-hint"
        tabindex="-1"
        onchange={chooseFile}
      />
      <div class="reportar__file-row">
        <Button variant="secondary" size="sm" icon="agregar" onclick={() => fileInput?.click()}>
          {screenshot ? 'Cambiar imagen' : 'Elegir imagen'}<span class="sr-only"> para la captura</span>
        </Button>
        <span class="reportar__file-name" class:is-empty={!screenshot} aria-live="polite">{screenshot?.name ?? 'Ningún archivo elegido'}</span>
        {#if screenshot}
          <Button variant="ghost" size="sm" onclick={clearFile}>Quitar<span class="sr-only"> la captura</span></Button>
        {/if}
      </div>
      <p class="reportar__hint" id="report-screenshot-hint">JPEG, PNG o WebP de hasta 5 MB.</p>
    </div>

    <Notice title="Contexto técnico incluido">
      Ruta, lanzamiento si aplica, fecha, versión, fuente de catálogo, navegador, viewport, idioma y conexión. Nunca incluimos cookies, tokens, contraseñas ni el contenido de otros formularios.
    </Notice>

    {#if error}<Notice tone="error">{error}</Notice>{/if}
    {#if notice}
      <Notice tone="success">
        {notice}
        {#snippet actions()}
          {#if release}<Button variant="secondary" size="sm" href={`/lanzamiento/${release.slug}`}>Volver al lanzamiento</Button>{/if}
        {/snippet}
      </Notice>
    {/if}

    <div class="reportar__actions">
      <Button type="submit" loading={busy}>{busy ? 'Enviando…' : 'Enviar reporte'}</Button>
    </div>
  </form>
</PageLayout>

<style>
  .reportar__release {
    display: grid;
    grid-template-columns: var(--reportar-cover) minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-4);
    margin-top: var(--space-5);
    padding: var(--space-3);
    border: 1px solid var(--color-linea-sutil);
    border-radius: var(--radius-base);
    background: var(--color-superficie-1);
    --reportar-cover: calc(var(--space-8) + var(--space-5));
  }
  .reportar__release:has(> p),
  .reportar__release:has(> :global(.reportar__skeleton)) { grid-template-columns: minmax(0, 1fr); }
  .reportar__release-text { display: grid; gap: var(--space-1); min-width: 0; margin: 0; color: var(--color-texto-medio); font-size: var(--text-sm); line-height: 1.4; }
  .reportar__release-text strong { overflow: hidden; color: var(--color-texto); font-size: var(--text-md); text-overflow: ellipsis; white-space: nowrap; }
  .reportar__release-text > span:last-child:not(.reportar__release-kicker) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .reportar__release-kicker { color: var(--color-texto-tenue); font-size: var(--text-2xs); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }

  .reportar__form { display: grid; gap: var(--space-5); margin-top: var(--space-5); }

  .reportar__file { display: grid; gap: var(--space-2); }
  .reportar__file-label { color: var(--color-texto-alto); font-size: var(--text-sm); font-weight: 600; line-height: 1.3; }
  .reportar__optional { margin-left: var(--space-1); color: var(--color-texto-tenue); font-weight: 400; }
  .reportar__file-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); min-width: 0; }
  .reportar__file-name { min-width: 0; overflow: hidden; color: var(--color-texto); font-size: var(--text-sm); text-overflow: ellipsis; white-space: nowrap; }
  .reportar__file-name.is-empty { color: var(--color-texto-tenue); }
  .reportar__hint { margin: 0; color: var(--color-texto-tenue); font-size: var(--text-2xs); line-height: 1.45; }

  .reportar__actions { display: flex; }

  @media (max-width: 679px) {
    .reportar__release { grid-template-columns: var(--reportar-cover) minmax(0, 1fr); }
    .reportar__release :global(.ui-btn) { grid-column: 2; justify-self: start; }
    .reportar__actions :global(.ui-btn) { flex: 1 1 auto; }
  }
</style>
