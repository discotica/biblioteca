<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { dropdownMenu } from '$lib/ui/overlay';
  import { MOBILE_QUERY } from '$lib/ui/breakpoints';
  import Button from '$lib/ui/Button.svelte';
  import IconButton from '$lib/ui/IconButton.svelte';
  import Icon from '$lib/ui/Icon.svelte';
  import Menu, { type MenuGroup } from '$lib/ui/Menu.svelte';
  import { supabase } from '$lib/supabase';
  import { user } from '$lib/stores/authStore';

  const suggestionReturn = '/sugerir';
  // "Mis aportes" es una página propia (U14); sin la función editorial no hay
  // aportes que mostrar.
  const editorialEnabled = import.meta.env.VITE_EDITORIAL_ENABLED === 'true';
  const menuItems = [
    { label: 'Manual', href: '/manual', icon: '/img/manual.svg' },
    { label: 'Reportar un problema', href: '/reportar', icon: '/img/sugerir.svg' },
    { label: 'Blog', href: 'https://www.discotica.com', icon: '/img/us.svg', external: true },
    { label: 'Substack', href: 'https://discotica.substack.com', icon: '/img/substack.svg', external: true },
    { label: 'Instagram', href: 'https://instagram.com/discotica_', icon: '/img/insta.svg', external: true }
  ];

  // En el Estudio (U15) el header acompaña al layout de herramienta: ancho
  // completo, con el logo sobre la barra lateral.
  $: toolRoute = $page.url.pathname.startsWith('/estudio');

  let menuAbierto = false;
  let accountMenuOpen = false;
  let headerVisible = true;
  let headerHeight = 0;
  // U16: en el Estudio el header es sticky (html.is-tool) y tapa lo que también
  // lo es. Publica cuánto ocupa mientras se ve para que el índice, el selector
  // y la barra lateral se coloquen debajo (--header-offset, tokens.css).
  $: if (typeof document !== 'undefined') {
    if (toolRoute) document.documentElement.style.setProperty('--header-offset', `${headerVisible ? headerHeight : 0}px`);
    else document.documentElement.style.removeProperty('--header-offset');
  }
  let lastScroll = 0;
  let keyboardViewport = false;
  let viewportHeight = 0;
  let desktopMenuTrigger: HTMLButtonElement | HTMLAnchorElement | undefined;
  let mobileMenuTrigger: HTMLButtonElement | HTMLAnchorElement | undefined;
  // Solo existe el menú del ancho actual (U13). Con los dos montados, el oculto
  // tomaba el toque en el visible por un clic fuera, lo cancelaba y cerraba el
  // menú antes del clic: ningún enlace del menú global navegaba.
  let menuMovil = false;

  $: suggestionHref = $user ? suggestionReturn : `/auth/login?redirect=${encodeURIComponent(suggestionReturn)}`;
  $: username = ($user?.user_metadata?.username as string | undefined) ?? '';
  $: profileHref = `/perfil/${username}`;
  const contributionsHref = '/mis-aportes';
  $: initial = (username || $user?.email || '?')[0].toUpperCase();
  $: accountName = username ? `@${username}` : 'Tu cuenta';
  // Menú de cuenta: Perfil, Mis colecciones, Mis aportes (ronda 3); Editar cuenta
  // (pedido del equipo en U12) va junto a Salir, con lo que afecta a la cuenta.
  $: accountGroups = [
    {
      label: accountName,
      items: [
        { label: 'Perfil', href: profileHref },
        { label: 'Mis colecciones', href: '/mis-colecciones' },
        ...(editorialEnabled ? [{ label: 'Mis aportes', href: contributionsHref }] : [])
      ]
    },
    {
      items: [
        { label: 'Editar cuenta', href: '/cuenta' },
        { label: 'Salir', icon: 'salir', onselect: cerrarSesion }
      ]
    }
  ] satisfies MenuGroup[];
  $: if (menuAbierto && typeof window !== 'undefined') lastScroll = window.scrollY;

  const cerrarMenu = () => { menuAbierto = false; };

  function hasFocusedField() {
    const active = document.activeElement;
    return active instanceof HTMLElement && active.matches('input, textarea, select, [contenteditable="true"]');
  }

  function freezeScrollDetection() {
    return menuAbierto || accountMenuOpen || hasFocusedField() || keyboardViewport;
  }

  async function cerrarSesion() {
    cerrarMenu();
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
      menuAbierto = false;
      headerVisible = true;
      resetBaseline();
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('focusin', onFocusChange);
    document.addEventListener('focusout', onFocusChange);
    visualViewport?.addEventListener('resize', onViewportResize);
    mobileQuery.addEventListener('change', onBreakpointChange);
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('focusin', onFocusChange);
      document.removeEventListener('focusout', onFocusChange);
      visualViewport?.removeEventListener('resize', onViewportResize);
      mobileQuery.removeEventListener('change', onBreakpointChange);
    };
  });
</script>

{#snippet avatar()}
  <span class="avatar-circle" aria-hidden="true">{initial}</span>
{/snippet}

<header class="site-header" class:oculto={!headerVisible} data-header-visible={headerVisible} bind:offsetHeight={headerHeight}>
  <div class="l-container inner" class:l-container--wide={!toolRoute} class:l-container--full={toolRoute}>
    <a class="logo" href="/" aria-label="Discótica inicio"><img src="/img/logo.svg" alt="Discótica" /></a>

    <nav class="desktop-nav" aria-label="Principal">
      <Button variant="secondary" href={suggestionHref} class="nav-btn">Sugerir</Button>
      {#if $user}
        <Menu label={`Cuenta ${accountName}`} groups={accountGroups} bind:open={accountMenuOpen} class="account-menu">
          {#snippet trigger()}{@render avatar()}{/snippet}
        </Menu>
      {:else}
        <Button href="/auth/login" class="nav-btn">Entrar</Button>
      {/if}
      <div class="menu-wrap">
        <Button
          variant="ghost"
          icon="menu"
          class="nav-btn menu-trigger"
          bind:element={desktopMenuTrigger}
          aria-expanded={menuAbierto}
          aria-controls="global-menu"
          onclick={() => (menuAbierto = !menuAbierto)}
        >Menú</Button>
        {#if menuAbierto && !menuMovil}
          <nav id="global-menu" class="global-menu" aria-label="Menú" use:dropdownMenu={{ onClose: cerrarMenu, trigger: desktopMenuTrigger }}>
            {#each menuItems as item}
              <a class="menu-link" href={item.href} target={item.external ? '_blank' : undefined} rel={item.external ? 'noopener noreferrer' : undefined} on:click={cerrarMenu}>
                <img class="nav-icon" src={item.icon} alt="" aria-hidden="true" /> {item.label}
              </a>
            {/each}
          </nav>
        {/if}
      </div>
    </nav>

    <div class="mobile-nav">
      <Button variant="secondary" size="sm" href={suggestionHref} class="nav-btn">Sugerir</Button>
      {#if !$user}<Button size="sm" href="/auth/login" class="nav-btn">Entrar</Button>{/if}
      <IconButton
        icon={menuAbierto ? 'cerrar' : 'menu'}
        label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
        tooltip="bottom"
        tooltipAlign="end"
        class="hamburger"
        bind:element={mobileMenuTrigger}
        aria-expanded={menuAbierto}
        aria-controls="global-menu"
        onclick={() => (menuAbierto = !menuAbierto)}
      />
      {#if menuAbierto && menuMovil}
        <nav id="global-menu" class="global-menu" aria-label="Menú" use:dropdownMenu={{ onClose: cerrarMenu, trigger: mobileMenuTrigger }}>
          {#if $user}
            <div class="mobile-account-group" role="group" aria-label="Cuenta">
              <p class="mobile-account-name">{@render avatar()} {accountName}</p>
              <a class="menu-link menu-link--indent" href={profileHref} on:click={cerrarMenu}>Perfil</a>
              <a class="menu-link menu-link--indent" href="/mis-colecciones" on:click={cerrarMenu}>Mis colecciones</a>
              {#if editorialEnabled}<a class="menu-link menu-link--indent" href={contributionsHref} on:click={cerrarMenu}>Mis aportes</a>{/if}
              <a class="menu-link menu-link--indent" href="/cuenta" on:click={cerrarMenu}>Editar cuenta</a>
              <button class="menu-link menu-link--button menu-link--salir" on:click={cerrarSesion}><Icon name="salir" size="sm" /> Salir</button>
            </div>
          {/if}
          {#each menuItems as item}
            <a class="menu-link" href={item.href} target={item.external ? '_blank' : undefined} rel={item.external ? 'noopener noreferrer' : undefined} on:click={cerrarMenu}>
              <img class="nav-icon" src={item.icon} alt="" aria-hidden="true" /> {item.label}
            </a>
          {/each}
        </nav>
      {/if}
    </div>
  </div>
</header>

<style>
  .site-header { position:sticky; top:0; z-index:calc(var(--layer-overlay) - 1); width:100%; background:var(--color-velo); backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px); border-bottom:1px solid var(--color-linea-sutil); padding:var(--header-pad-block) 0; transition:transform var(--motion-slow) var(--ease-emphasized); }
  .site-header.oculto { transform:translateY(-100%); }
  .inner { display:flex; align-items:center; justify-content:space-between; gap:var(--space-4); }
  .logo { display:flex; align-items:center; flex-shrink:0; text-decoration:none; }
  .logo img { height:var(--header-logo-h); display:block; transition:opacity var(--motion-fast) ease; }
  .logo:hover img { opacity:.75; }

  /* Navegación principal: botones del sistema, más anchos que altos, en mayúsculas sostenidas. */
  .desktop-nav { display:flex; align-items:center; gap:var(--space-2); }
  .site-header :global(.nav-btn) { font-size:var(--nav-font-size); font-weight:var(--nav-font-weight); letter-spacing:var(--nav-letter-spacing); text-transform:var(--nav-text-transform); }
  .menu-wrap,.mobile-nav { position:relative; }

  /* Avatar del menú de cuenta */
  .site-header :global(.account-menu .ui-menu__trigger) { padding-inline:var(--space-2); gap:var(--space-1); }
  .avatar-circle { width:var(--avatar-sm); height:var(--avatar-sm); flex:none; display:inline-grid; place-items:center; border:1px solid var(--color-acento-border); border-radius:50%; color:var(--color-acento); background:var(--color-acento-suave); font-size:var(--text-2xs); font-weight:700; letter-spacing:0; line-height:1; text-transform:none; }

  /* Menú secundario (navegación, no role="menu") */
  .nav-icon { width:var(--icon-sm); height:var(--icon-sm); flex-shrink:0; filter:brightness(0) invert(1); opacity:.58; }
  .global-menu { position:absolute; z-index:var(--layer-dropdown); top:calc(100% + var(--space-2)); right:0; min-width:var(--menu-min-w); display:flex; flex-direction:column; gap:2px; padding:var(--space-1); border:1px solid var(--color-linea); border-radius:var(--radius-base); background:var(--color-velo-opaco); box-shadow:var(--shadow-flotante); }
  .menu-link { min-height:var(--target-touch); box-sizing:border-box; display:flex; align-items:center; gap:var(--space-2); width:100%; padding:0 var(--space-3); border:0; border-radius:var(--radius-sm); background:transparent; color:var(--color-texto-medio); font:600 var(--text-xs)/1 var(--font-ui); letter-spacing:.04em; text-align:left; text-decoration:none; cursor:pointer; }
  .menu-link:hover { color:var(--color-acento); background:var(--color-acento-dim); }
  .menu-link--button { font-family:inherit; }
  /* Sin icono: el texto se alinea con el de los elementos que sí lo llevan. */
  .menu-link--indent { padding-left:calc(var(--space-3) + var(--icon-sm) + var(--space-2)); }
  .menu-link--salir:hover { color:var(--color-danger-texto); background:var(--color-danger-dim); }

  .mobile-nav { display:none; align-items:center; gap:var(--space-2); }
  .mobile-account-group { display:flex; flex-direction:column; gap:2px; margin-bottom:var(--space-1); padding-bottom:var(--space-1); border-bottom:1px solid var(--color-linea); }
  .mobile-account-name { display:flex; align-items:center; gap:var(--space-2); margin:0; padding:var(--space-2) var(--space-3); color:var(--color-texto); font-size:var(--text-xs); font-weight:700; }

  @media (max-width:768px) {
    .desktop-nav { display:none; }
    .mobile-nav { display:flex; }
    .logo img { height:var(--header-logo-h-mobile); }
    .global-menu { min-width:var(--menu-min-w); }
  }
  @media (prefers-reduced-motion:reduce) { .site-header { transition:none; } }
</style>
