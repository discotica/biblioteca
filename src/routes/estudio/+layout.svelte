<script lang="ts">
  import type { Snippet } from 'svelte';
  import { page } from '$app/state';
  import { user } from '$lib/stores/authStore';
  import { loadProfileRole } from '$lib/stores/profileRole';
  import { loadEditorialQueue } from '$lib/stores/contributionsStore';
  import { loadProblemReports } from '$lib/services/problemReports';
  import { getCatalogQuickViewCounts, type CatalogQuickViewCounts } from '$lib/services/adminCatalog';
  import { PageLayout, ToolLayout, type ToolSection } from '$lib/layouts';
  import { Button, ErrorState, LoadingIndicator, Notice } from '$lib/ui';
  import { setStudioContext } from '$lib/components/estudio/context';
  import {
    STUDIO_QUICK_VIEWS,
    STUDIO_SECTIONS,
    catalogHref,
    studioSectionOf,
    studioSectionsFor,
    type StudioRole,
    type StudioSectionId
  } from '$lib/domain/studio';

  let { children }: { children: Snippet } = $props();

  // Cada sección conserva el interruptor de la ruta que reemplaza (E07, E10).
  const flags = {
    adminCatalog: import.meta.env.VITE_ADMIN_CATALOG_ENABLED === 'true',
    editorial: import.meta.env.VITE_EDITORIAL_ENABLED === 'true'
  };
  const enabled = flags.adminCatalog || flags.editorial;
  const ICONS = { catalogo: 'grilla', propuestas: 'lista', reportes: 'reportar' } as const;

  let role = $state<string | null>(null);
  let roleError = $state('');
  let quickCounts = $state<Partial<CatalogQuickViewCounts>>({});
  let proposalCount = $state<number | undefined>();
  let reportCount = $state<number | undefined>();

  const userId = $derived($user?.id ?? '');
  const sections = $derived(studioSectionsFor(role ?? '', flags));
  const currentSection = $derived(studioSectionOf(page.url.pathname));
  const currentHref = $derived.by(() => {
    if (currentSection !== 'catalogo') return page.url.pathname;
    const vista = page.url.searchParams.get('vista');
    return STUDIO_QUICK_VIEWS.some((view) => view.slug === vista) ? `${page.url.pathname}?vista=${vista}` : page.url.pathname;
  });
  const loginHref = $derived(`/auth/login?redirect=${encodeURIComponent(page.url.pathname + page.url.search)}`);

  const toolSections = $derived<ToolSection[]>(
    STUDIO_SECTIONS.filter((section) => sections.includes(section.id)).map((section) => ({
      label: section.label,
      href: section.href,
      icon: ICONS[section.id],
      count: section.id === 'propuestas' ? proposalCount : section.id === 'reportes' ? reportCount : undefined,
      items:
        section.id === 'catalogo'
          ? STUDIO_QUICK_VIEWS.map((view) => ({ label: view.label, href: catalogHref(view.value), count: quickCounts[view.value] }))
          : undefined
    }))
  );

  async function checkRole(id: string) {
    roleError = '';
    try {
      role = await loadProfileRole(id);
    } catch {
      roleError = 'No pudimos comprobar tu acceso al Estudio.';
    }
  }

  $effect(() => {
    role = null;
    if (enabled && userId) void checkRole(userId);
  });

  /**
   * Conteos de la barra lateral. Cada uno es independiente: si uno falla (por
   * ejemplo, porque su contrato aún no está en ese entorno), su sección se ve
   * sin número y la vista sigue.
   */
  async function refreshCounts() {
    const has = (id: StudioSectionId) => sections.includes(id);
    if (has('catalogo')) {
      getCatalogQuickViewCounts()
        .then((counts) => (quickCounts = counts && typeof counts === 'object' ? counts : {}))
        .catch(() => (quickCounts = {}));
    }
    if (has('propuestas')) {
      loadEditorialQueue()
        .then((queue) => {
          if (!Array.isArray(queue)) return (proposalCount = undefined);
          // Lo que cada rol puede decidir o preparar, como en la estación de E10.
          proposalCount = role === 'admin'
            ? queue.length
            : queue.filter((item) => item.queue_kind === 'community' && item.status === 'pending' && item.author_id !== userId).length;
        })
        .catch(() => (proposalCount = undefined));
    }
    if (has('reportes')) {
      loadProblemReports()
        .then((reports) => {
          reportCount = Array.isArray(reports)
            ? reports.filter((report) => ['new', 'triaged', 'in_progress'].includes(report.status)).length
            : undefined;
        })
        .catch(() => (reportCount = undefined));
    }
  }

  $effect(() => {
    if (role && sections.length) void refreshCounts();
  });

  // U16: el Estudio usa position: sticky (barra lateral, índice y barra de
  // guardar del editor). Ver `html.is-tool` en styles.css.
  $effect(() => {
    document.documentElement.classList.add('is-tool');
    return () => document.documentElement.classList.remove('is-tool');
  });

  setStudioContext({
    get role() { return role as StudioRole; },
    get userId() { return userId; },
    get sections() { return sections; },
    refreshCounts: () => void refreshCounts()
  });
</script>

{#if !enabled}
  <PageLayout container="narrow" eyebrow="Estudio" title="El Estudio está desactivado" description="Las herramientas del equipo no están habilitadas en este entorno." />
{:else if !$user}
  <PageLayout container="narrow" eyebrow="Estudio" title="Inicia sesión" description="Necesitas una cuenta del equipo para usar el Estudio.">
    <Button href={loginHref}>Entrar</Button>
  </PageLayout>
{:else if roleError}
  <PageLayout container="narrow" eyebrow="Estudio">
    <ErrorState heading="h1" message={roleError} onaction={() => checkRole(userId)} />
  </PageLayout>
{:else if role === null}
  <PageLayout container="narrow">
    <div class="estudio-checking"><LoadingIndicator label="Comprobando acceso" /></div>
  </PageLayout>
{:else if !sections.length}
  <PageLayout container="narrow" eyebrow="Estudio" title="Sin acceso al Estudio" description="Tu cuenta no puede usar las herramientas del equipo. El servidor también rechaza cualquier operación forzada.">
    <Button variant="secondary" href="/">Volver al catálogo</Button>
  </PageLayout>
{:else}
  <ToolLayout name="Estudio" sections={toolSections} current={currentHref}>
    {#if currentSection && !sections.includes(currentSection)}
      <Notice tone="info" title="Esta sección es solo para administración">
        Con tu cuenta puedes usar {sections.length === 1 ? 'la sección' : 'las secciones'}
        {STUDIO_SECTIONS.filter((section) => sections.includes(section.id)).map((section) => section.label).join(', ')}.
        {#snippet actions()}
          <Button size="sm" href={`/estudio/${sections[0]}`}>Ir a {STUDIO_SECTIONS.find((section) => section.id === sections[0])?.label}</Button>
        {/snippet}
      </Notice>
    {:else}
      {@render children()}
    {/if}
  </ToolLayout>
{/if}

<style>
  .estudio-checking { display: grid; place-items: center; min-height: 40vh; }
</style>
