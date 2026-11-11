<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { MOBILE_QUERY } from '$lib/ui/breakpoints';
  import Button from '$lib/ui/Button.svelte';
  import IconButton from '$lib/ui/IconButton.svelte';
  import Menu, { type MenuGroup, type MenuItem } from '$lib/ui/Menu.svelte';
  import { Cenefa, Huella, type Rol } from '$lib/generative';
  import { supabase } from '$lib/supabase';
  import { user } from '$lib/stores/authStore';
  import { loadProfileRole, profileRole } from '$lib/stores/profileRole';
  import { STUDIO_BASE, studioSectionsFor } from '$lib/domain/studio';
  import { headerModeFor } from './headerMode';

  // Cabecero único (U28, tablero J): la misma barra opaca y el mismo ancho en
  // todas las páginas, Estudio incluido. Variante por ruta en headerMode.ts.
  const suggestionReturn = '/sugerir';
  const editorialEnabled = import.meta.env.VITE_EDITORIAL_ENABLED === 'true';
  const adminCatalogEnabled = import.meta.env.VITE_ADMIN_CATALOG_ENABLED === 'true';

  $: toolRoute = $page.url.pathname.startsWith('/estudio');
  $: mode = headerModeFor($page.url.pathname, ($page.data as { header?: unknown } | undefined)?.header);

  let panelOpen = false;
  let headerVisible = true;
  let headerHeight = 0;
  // El header es sticky (U16 en el Estudio, U18 en todo el sitio) y tapa lo que
  // también lo es. Publica cuánto ocupa mientras se ve para que el índice del
  // manual y del editor, el selector y la barra lateral se coloquen debajo
  // (--header-offset, tokens.css); el panel a pantalla también empieza ahí.
  // Además publica cuánto reservar arriba al desplazarse a un elemento: al subir
  // el header vuelve en escritorio y tapa los primeros píxeles; en móvil solo
  // vuelve al inicio del documento (--header-reserve, scroll-padding de styles.css).
  $: if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--header-offset', `${headerVisible ? headerHeight : 0}px`);
    document.documentElement.style.setProperty('--header-reserve', `${menuMovil ? 0 : headerHeight}px`);
  }
  let lastScroll = 0;
  let keyboardViewport = false;
  let viewportHeight = 0;
  // Un solo menú montado (U13): el panel es el mismo en los dos anchos y solo
  // cambia su presentación (anclado en desktop, a pantalla en móvil). Con dos
  // montados, el oculto tomaba el toque en el visible por un clic fuera y
  // ningún enlace navegaba. Se lee ya al montar para no pintar primero desktop.
  let menuMovil = typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches;

  // El rol da el color de la huella (§2) y decide el acceso al Estudio, que sale
  // solo si el rol ve alguna sección.
  $: if ($user) void loadProfileRole($user.id).catch(() => {});
  $: roleKnown = Boolean($user && $profileRole?.userId === $user.id);
  $: sessionRole = roleKnown ? $profileRole?.role ?? '' : '';
  let huellaRol: Rol = 'usuario';
  $: huellaRol = sessionRole === 'admin' ? 'admin' : sessionRole === 'colaborador' ? 'colaborador' : 'usuario';
  $: staff = studioSectionsFor(sessionRole, { adminCatalog: adminCatalogEnabled, editorial: editorialEnabled }).length > 0;
  // Dentro del Estudio, la misma barra con «Volver al catálogo» en su lugar.
  $: studioLink = !staff ? null
    : toolRoute ? { label: 'Volver al catálogo', href: '/', icon: 'flecha-izquierda' as const }
    : { label: 'Estudio', href: STUDIO_BASE, icon: 'estudio' as const };

  $: suggestionHref = $user ? suggestionReturn : `/auth/login?redirect=${encodeURIComponent(suggestionReturn)}`;
  $: username = ($user?.user_metadata?.username as string | undefined) ?? '';
  $: huellaName = username || $user?.email || '';
  $: accountName = username ? `@${username}` : 'Tu cuenta';

  // Panel de cuenta (§3): la fila del perfil, «Tu cuenta» y «El sitio». Ajustes
  // lleva a /cuenta hasta que U33 le dé página propia.
  const siteGroup: MenuGroup = {
    label: 'El sitio',
    items: [
      { label: 'Manual', href: '/manual', icon: 'ayuda' },
      { label: 'Reportar un problema', href: '/reportar', icon: 'reportar' }
    ]
  };
  $: accountGroups = [
    { items: [{ label: 'Perfil y colecciones', href: `/perfil/${username}`, icon: 'persona' }] },
    {
      label: 'Tu cuenta',
      items: [
        { label: 'Editar perfil', href: '/cuenta', icon: 'editar' },
        { label: 'Ajustes', href: '/cuenta', icon: 'ajustes' },
        { label: 'Salir', icon: 'salir', onselect: cerrarSesion }
      ] satisfies MenuItem[]
    },
    siteGroup
  ] satisfies MenuGroup[];
  const visitorGroups: MenuGroup[] = [
    {
      appearance: 'buttons',
      items: [
        { label: 'Entrar', href: '/auth/login' },
        { label: 'Crear cuenta', href: '/auth/registro' }
      ]
    },
    siteGroup
  ];
  // Si la barra no cabe (equipo en un teléfono de 320), Sugerir queda en icono
  // con su nombre y ayuda. Se mide en lugar de usar un corte: la escala de
  // breakpoints no tiene uno para 320 y a 360 todo cabe con texto.
  let innerEl: HTMLDivElement | undefined;
  let logoEl: HTMLAnchorElement | undefined;
  let navEl: HTMLElement | undefined;
  let sugerirEl: HTMLButtonElement | HTMLAnchorElement | undefined;
  let sugerirFull = 0;
  let compacto = false;
  function encaja() {
    if (!innerEl || !logoEl || !navEl) return;
    // Con texto se mide; en icono mide lo que un control (--header-control-h).
    if (!compacto && sugerirEl?.isConnected) sugerirFull = sugerirEl.offsetWidth;
    const style = getComputedStyle(innerEl);
    const disponible = innerEl.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const icono = parseFloat(getComputedStyle(navEl).getPropertyValue('--header-control-h'));
    const recupera = compacto ? sugerirFull - icono : 0;
    compacto = logoEl.offsetWidth + parseFloat(style.columnGap) + navEl.scrollWidth + recupera > disponible + 0.5;
  }

  // bind:this llega después de onMount: se observa en cuanto existen.
  let fit: ResizeObserver | undefined;
  $: if (fit && innerEl && navEl) {
    fit.disconnect();
    fit.observe(innerEl);
    fit.observe(navEl);
  }

  // El panel sale 8 por debajo del cabecero, no del botón: (72 − 40) / 2 + 8.
  const panelGutter = 24;
  $: if (panelOpen && typeof window !== 'undefined') lastScroll = window.scrollY;

  function hasFocusedField() {
    const active = document.activeElement;
    return active instanceof HTMLElement && active.matches('input, textarea, select, [contenteditable="true"]');
  }

  function freezeScrollDetection() {
    return panelOpen || hasFocusedField() || keyboardViewport;
  }

  async function cerrarSesion() {
    panelOpen = false;
    await supabase.auth.signOut();
    await goto('/');
  }

  onMount(() => {
    const mobileQuery = window.matchMedia(MOBILE_QUERY);
    menuMovil = mobileQuery.matches;
    const visualViewport = window.visualViewport;
    viewportHeight = visualViewport?.height ?? window.innerHeight;
    lastScroll = window.scrollY;

    const resetBaseline = () => { lastScroll = window.scrollY; };
    const onScroll = () => {
      const y = window.scrollY;
      if (freezeScrollDetection()) {
        lastScroll = y;
        return;
      }

      if (!mobileQuery.matches) {
        // Desktop retains the established direction-based behaviour, with a
        // threshold that prevents trackpad noise from flickering the bar.
        if (Math.abs(y - lastScroll) >= 8) headerVisible = y < lastScroll || y < 10;
      } else if (y <= 0) {
        // Mobile only returns the global header at the document start.
        headerVisible = true;
      } else if (y - lastScroll >= 8) {
        headerVisible = false;
      }
      lastScroll = y;
    };
    const onViewportResize = () => {
      const nextHeight = visualViewport?.height ?? window.innerHeight;
      // Browser chrome is a small change; a larger reduction is the virtual
      // keyboard, during which transforms would make the header jump.
      keyboardViewport = Math.abs(nextHeight - viewportHeight) >= 120;
      if (!keyboardViewport) viewportHeight = nextHeight;
      resetBaseline();
    };
    const onFocusChange = () => window.setTimeout(resetBaseline, 0);
    const onBreakpointChange = () => {
      menuMovil = mobileQuery.matches;
      panelOpen = false;
      headerVisible = true;
      resetBaseline();
    };

    fit = new ResizeObserver(() => encaja());

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('focusin', onFocusChange);
    document.addEventListener('focusout', onFocusChange);
    visualViewport?.addEventListener('resize', onViewportResize);
    mobileQuery.addEventListener('change', onBreakpointChange);
    return () => {
      fit?.disconnect();
      fit = undefined;
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('focusin', onFocusChange);
      document.removeEventListener('focusout', onFocusChange);
      visualViewport?.removeEventListener('resize', onViewportResize);
      mobileQuery.removeEventListener('change', onBreakpointChange);
    };
  });
</script>

<header class="site-header" class:oculto={!headerVisible} data-header-visible={headerVisible} data-header-mode={mode} bind:offsetHeight={headerHeight}>
  <div class="l-container l-container--wide inner" class:inner--crowded={Boolean(studioLink) && mode !== 'minimo'} bind:this={innerEl}>
    <a class="logo" href="/" aria-label="Discótica inicio" bind:this={logoEl}>
      <img src="/img/logo.svg" alt="Discótica" />
      <span class="beta" aria-hidden="true">beta</span>
    </a>

    <nav class="nav" aria-label="Principal" bind:this={navEl}>
      {#if mode === 'minimo'}
        {#if !$user}<Button variant="secondary" href="/auth/login">Entrar</Button>{/if}
      {:else}
        {#if studioLink}
          <!-- En móvil, solo el icono: no caben los tres controles con texto. -->
          {#if menuMovil}
            <IconButton variant="secondary" icon={studioLink.icon} label={studioLink.label} href={studioLink.href} tooltip="bottom" />
          {:else}
            <Button variant="secondary" icon={studioLink.icon} href={studioLink.href}>{studioLink.label}</Button>
          {/if}
        {/if}
        {#if compacto}
          <IconButton variant={mode === 'acceso' ? 'secondary' : 'primary'} icon="agregar" label="Sugerir" href={suggestionHref} tooltip="bottom" bind:element={sugerirEl} />
        {:else}
          <Button variant={mode === 'acceso' ? 'secondary' : 'primary'} icon="agregar" href={suggestionHref} bind:element={sugerirEl}>Sugerir</Button>
        {/if}
        {#if $user}
          <Menu
            label={`Cuenta ${accountName}`}
            groups={accountGroups}
            presentation="panel"
            fullscreen={menuMovil}
            gutter={panelGutter}
            bind:open={panelOpen}
            class="header-panel"
          >
            {#snippet trigger()}
              {#if roleKnown}
                <Huella nombre={huellaName} rol={huellaRol} tamano={32} class="header-avatar" />
              {:else}
                <span class="header-avatar header-avatar--pending"></span>
              {/if}
            {/snippet}
            {#snippet header()}
              <Cenefa nombre={huellaName} rol={huellaRol} alto={96} velo={false} class="panel-cenefa">
                <span class="panel-cenefa__name">{accountName}</span>
              </Cenefa>
            {/snippet}
          </Menu>
        {:else}
          <Menu
            label="Menú"
            icon={panelOpen && menuMovil ? 'cerrar' : 'menu'}
            tooltip="bottom"
            groups={visitorGroups}
            presentation="panel"
            fullscreen={menuMovil}
            gutter={panelGutter}
            bind:open={panelOpen}
            class="header-panel"
          />
        {/if}
      {/if}
    </nav>
  </div>
</header>

<style>
  .site-header {
    position: sticky;
    top: 0;
    z-index: calc(var(--layer-overlay) - 1);
    display: flex;
    align-items: center;
    width: 100%;
    height: var(--header-h);
    box-sizing: border-box;
    background: var(--color-fondo);
    border-bottom: 1px solid var(--color-linea);
    transition: transform var(--motion-slow) var(--ease-emphasized);
  }
  .site-header.oculto { transform: translateY(-100%); }
  .inner { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); }

  .logo { display: flex; align-items: flex-end; gap: var(--space-2); flex: none; text-decoration: none; }
  .logo img { height: var(--header-logo-h); display: block; transition: opacity var(--motion-fast) ease; }
  .logo:hover img { opacity: .75; }
  .beta { color: var(--color-acento); font-size: var(--text-2xs); font-weight: 500; line-height: 1; }

  /* Controles de 40 separados 8, iconos de 18 (§3). */
  .nav { display: flex; align-items: center; gap: var(--space-2); min-width: 0; }
  .nav :global(.ui-btn) { --btn-h: var(--header-control-h); --btn-px: var(--space-4); }
  .nav :global(.ui-btn .ui-icon) { width: var(--icon-nav); height: var(--icon-nav); }
  .nav :global(.ui-btn--ghost) { color: var(--color-texto); }

  /* Avatar de huella con chevron. */
  .nav :global(.header-panel .ui-menu__trigger) { padding: 0 var(--header-avatar-pad-end) 0 var(--header-avatar-pad-start); }
  .nav :global(.header-avatar) { width: var(--control-h-sm); height: var(--control-h-sm); }
  .header-avatar--pending { display: block; flex: none; border-radius: 50%; background: var(--color-superficie-2); }

  /* Cenefa del panel: huella con el color del rol y el nombre sobre un velo. */
  :global(.panel-cenefa.panel-cenefa) { border-radius: var(--radius-sm); }
  :global(.panel-cenefa)::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, var(--color-velo-panel), var(--color-velo-panel-medio) 60%, var(--color-velo-panel-nada));
  }
  .panel-cenefa__name {
    position: absolute;
    z-index: var(--layer-raised);
    left: var(--space-3);
    right: var(--space-3);
    bottom: var(--space-2);
    overflow: hidden;
    color: var(--color-texto);
    font-size: var(--text-2xl);
    font-weight: 700;
    line-height: 1.167;
    letter-spacing: -.01em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (max-width: 768px) {
    .site-header { height: var(--header-h-mobile); }
    .logo { gap: var(--space-1); }
    .logo img { height: var(--header-logo-h-mobile); }
    .nav :global(.ui-btn:not(.ui-btn--square)) { --btn-px: var(--space-3); }
  }
  /* Equipo en un teléfono estrecho: tres controles junto al logo. Se ajustan
     los huecos para que todo quepa dentro del margen del contenedor a 360. */
  @media (max-width: 480px) {
    .inner--crowded { gap: var(--space-2); }
    .inner--crowded :global(.ui-btn) { gap: var(--space-1); }
    .inner--crowded :global(.header-panel .ui-menu__trigger) { padding-inline-end: var(--space-1); }
  }
  @media (prefers-reduced-motion: reduce) { .site-header { transition: none; } }
</style>
