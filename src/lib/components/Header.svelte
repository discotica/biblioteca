<script lang="ts">
  import { onMount } from 'svelte';

  let menuAbierto = false;
  let headerVisible = true;
  let lastScroll = 0;

  const cerrarMenu = () => { menuAbierto = false; };

  onMount(() => {
    const onScroll = () => {
      const y = window.scrollY;
      headerVisible = y < lastScroll || y < 10;
      lastScroll = y;
    };
    const onClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.hamburger')) cerrarMenu();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('click', onClickOutside);
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('click', onClickOutside);
    };
  });
</script>

<header class="site-header" class:oculto={!headerVisible}>
  <div class="container inner">

    <a class="logo" href="/" aria-label="Discótica inicio">
      <img src="/img/logo.svg" alt="Discótica" />
    </a>

    <!-- Desktop nav -->
    <nav class="nav" aria-label="Principal">
      <a class="nav-link" href="https://instagram.com/discotica_" target="_blank" rel="noopener noreferrer">
        <img class="nav-icon" src="/img/insta.svg" alt="" aria-hidden="true" />
        Instagram
      </a>
      <a class="nav-link" href="https://discotica.substack.com" target="_blank" rel="noopener noreferrer">
        <img class="nav-icon" src="/img/substack.svg" alt="" aria-hidden="true" />
        Substack
      </a>
      <a class="nav-link" href="/manual">
        <img class="nav-icon" src="/img/manual.svg" alt="" aria-hidden="true" />
        Manual
      </a>
      <a class="nav-link" href="https://www.discotica.com" target="_blank" rel="noopener noreferrer">
        <img class="nav-icon" src="/img/us.svg" alt="" aria-hidden="true" />
        Blog
      </a>
      <a class="nav-link nav-link--cta" href="/sugerir">
        <img class="nav-icon" src="/img/sugerir.svg" alt="" aria-hidden="true" />
        Sugerir
      </a>
    </nav>

    <!-- Mobile hamburger -->
    <button
      class="hamburger"
      class:abierto={menuAbierto}
      aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
      aria-expanded={menuAbierto}
      on:click|stopPropagation={() => (menuAbierto = !menuAbierto)}
    >
      <span class="bar"></span>
      <span class="bar"></span>
      <span class="bar"></span>

      {#if menuAbierto}
        <nav class="mobile-menu" aria-label="Menú móvil">
          <a class="mobile-link" href="https://instagram.com/discotica_" target="_blank" rel="noopener noreferrer" on:click={cerrarMenu}>Instagram</a>
          <a class="mobile-link" href="https://discotica.substack.com" target="_blank" rel="noopener noreferrer" on:click={cerrarMenu}>Substack</a>
          <a class="mobile-link" href="/manual" on:click={cerrarMenu}>Manual</a>
          <a class="mobile-link" href="https://www.discotica.com" target="_blank" rel="noopener noreferrer" on:click={cerrarMenu}>Blog</a>
          <a class="mobile-link mobile-link--cta" href="/sugerir" on:click={cerrarMenu}>+ Sugerir disco</a>
        </nav>
      {/if}
    </button>

  </div>
</header>

<style>
  .site-header {
    position: sticky;
    top: 0;
    z-index: 999;
    width: 100%;
    background: rgba(13, 13, 13, .88);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    border-bottom: 1px solid rgba(255, 255, 255, .06);
    padding: .85rem 0;
    transition: transform 280ms cubic-bezier(.22, .1, .25, 1);
  }

  .site-header.oculto {
    transform: translateY(-100%);
  }

  .inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  /* Logo */
  .logo {
    display: flex;
    align-items: center;
    text-decoration: none;
    flex-shrink: 0;
  }

  .logo img {
    height: 22px;
    display: block;
    transition: opacity 150ms ease;
  }

  .logo:hover img { opacity: .75; }

  /* Desktop nav */
  .nav {
    display: flex;
    align-items: center;
    gap: 2.25rem;
  }

  .nav-link {
    display: flex;
    align-items: center;
    gap: .4rem;
    font-size: .72rem;
    font-weight: 700;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: rgba(248, 255, 238, .45);
    text-decoration: none;
    position: relative;
    padding-bottom: 2px;
    transition: color 140ms ease;
  }

  .nav-icon {
    width: 15px;
    height: 15px;
    flex-shrink: 0;
    filter: brightness(0) invert(1);
    opacity: .45;
    transition: opacity 140ms ease;
  }

  .nav-link:hover .nav-icon { opacity: .85; }

  .nav-link::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 0;
    width: 100%;
    height: 1.5px;
    background: var(--color-acento);
    transform: scaleX(0);
    transform-origin: left center;
    transition: transform 200ms ease;
    border-radius: 1px;
  }

  .nav-link:hover {
    color: rgba(248, 255, 238, .9);
  }

  .nav-link:hover::after {
    transform: scaleX(1);
  }

  /* Hamburger */
  .hamburger {
    display: none;
    flex-direction: column;
    gap: 5px;
    cursor: pointer;
    background: none;
    border: none;
    padding: 4px;
    position: relative;
    z-index: 10;
  }

  .bar {
    display: block;
    width: 22px;
    height: 1.5px;
    background: rgba(248, 255, 238, .7);
    border-radius: 1px;
    transition: transform 260ms ease, opacity 200ms ease, background 140ms ease;
    transform-origin: center;
  }

  .hamburger.abierto .bar:nth-child(1) { transform: translateY(6.5px) rotate(45deg); background: var(--color-acento); }
  .hamburger.abierto .bar:nth-child(2) { opacity: 0; }
  .hamburger.abierto .bar:nth-child(3) { transform: translateY(-6.5px) rotate(-45deg); background: var(--color-acento); }

  /* Mobile dropdown */
  .mobile-menu {
    position: absolute;
    top: calc(100% + .75rem);
    right: 0;
    min-width: 160px;
    background: rgba(13, 13, 13, .97);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    border: 1px solid rgba(255, 255, 255, .08);
    border-radius: 14px;
    padding: .5rem;
    display: flex;
    flex-direction: column;
    gap: .15rem;
    box-shadow: 0 20px 50px rgba(0, 0, 0, .5);
    animation: menuIn 160ms ease;
  }

  @keyframes menuIn {
    from { opacity: 0; transform: translateY(-6px) scale(.97); }
    to   { opacity: 1; transform: translateY(0)   scale(1); }
  }

  .mobile-link {
    display: block;
    padding: .65rem .85rem;
    border-radius: 9px;
    font-size: .82rem;
    font-weight: 600;
    letter-spacing: .04em;
    color: rgba(248, 255, 238, .65);
    text-decoration: none;
    transition: background 120ms ease, color 120ms ease;
  }

  .mobile-link:hover {
    background: rgba(150, 247, 25, .08);
    color: var(--color-acento);
  }

  .mobile-link--cta {
    color: rgba(150, 247, 25, .85);
    margin-top: .25rem;
    border-top: 1px solid rgba(255, 255, 255, .06);
    padding-top: .85rem;
  }
  .mobile-link--cta:hover {
    background: rgba(150, 247, 25, .12);
    color: var(--color-acento);
  }

  /* CTA link en desktop nav */
  .nav-link--cta {
    color: rgba(150, 247, 25, .75);
    margin-left: .25rem;
    padding-left: .9rem;
    border-left: 1px solid rgba(255, 255, 255, .08);
  }
  .nav-link--cta .nav-icon {
    filter: brightness(0) saturate(100%) invert(77%) sepia(61%) saturate(600%) hue-rotate(42deg) brightness(105%);
    opacity: .75;
  }
  .nav-link--cta:hover {
    color: #96f719;
  }
  .nav-link--cta:hover .nav-icon {
    opacity: 1;
  }

  @media (max-width: 768px) {
    .nav { display: none; }
    .hamburger { display: flex; }
    .logo img { height: 20px; }
  }
</style>
