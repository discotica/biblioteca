<svelte:head>
  <title>Sugerir un lanzamiento — Discótica</title>
  <meta
    name="description"
    content="Sugiere un lanzamiento de música electrónica sudamericana para el catálogo de Discótica."
  />
</svelte:head>

<div class="container sugerir-page">

  <header class="sugerir__header">
    <p class="kicker">Catálogo abierto</p>
    <h1>Sugerir un lanzamiento</h1>
    <p class="lede">
      El archivo crece con la comunidad. Si hay un lanzamiento de música
      electrónica sudamericana que debería estar en el catálogo, puedes
      enviarlo aquí.
    </p>
  </header>

  <div class="sugerir__body">

    <div class="criterios">
      <h2>Qué entra al catálogo</h2>
      <ul class="lista">
        <li>Lanzamientos de música electrónica producidos en América del Sur, el Caribe o la diáspora latinoamericana</li>
        <li>Álbumes, EPs y singles publicados en plataformas digitales (Bandcamp, SoundCloud, Spotify, etc.)</li>
        <li>Artistas independientes, sellos y colectivos de la escena</li>
        <li>Sin límite de fecha — el catálogo incluye lanzamientos actuales e históricos</li>
      </ul>
    </div>

    <div class="cta-wrap">
      <a
        class="cta-btn"
        href="https://forms.gle/Zi3iX9v1j29XeCpQ9"
        target="_blank"
        rel="noopener noreferrer"
      >
        + SUGERIR
      </a>
    </div>

    <p class="alternativa">
      También puedes escribirnos por Instagram
      <a href="https://www.instagram.com/discotica_/" target="_blank" rel="noopener">@discotica_</a>.
    </p>

  </div>

</div>

<style>
  @import '$lib/styles/styles.css';

  .sugerir-page {
    padding-top: clamp(24px, 4vw, 56px);
    padding-bottom: clamp(40px, 6vw, 100px);
    max-width: 640px;
  }

  /* Header */
  .sugerir__header {
    margin-bottom: 40px;
  }

  .kicker {
    margin: 0 0 10px 0;
    font-weight: 800;
    letter-spacing: .08em;
    text-transform: uppercase;
    font-size: .78rem;
    color: rgba(150, 247, 25, .95);
  }

  h1 {
    margin: 0 0 14px 0;
    font-size: clamp(1.7rem, 3vw, 2.4rem);
    line-height: 1.06;
    font-weight: 800;
  }

  .lede {
    margin: 0;
    color: rgba(248, 255, 238, .72);
    font-size: 1rem;
    line-height: 1.6;
  }

  /* Body */
  .sugerir__body {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .criterios {
    border: 1px solid rgba(248, 255, 238, .10);
    border-radius: 16px;
    background: rgba(255, 255, 255, .025);
    padding: 20px 22px;
  }

  h2 {
    margin: 0 0 12px 0;
    font-size: 1rem;
    font-weight: 800;
  }

  /* Callout */
  .callout {
    border: 1px solid rgba(150, 247, 25, .28);
    border-radius: 16px;
    background: rgba(150, 247, 25, .05);
    padding: 18px 20px;
  }

  .callout__title {
    font-weight: 800;
    font-size: .94rem;
    margin-bottom: 10px;
  }

  .callout__body {
    color: rgba(248, 255, 238, .72);
    line-height: 1.55;
    font-size: .9rem;
  }

  /* Listas */
  .lista {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 7px;
    color: rgba(248, 255, 238, .72);
    font-size: .9rem;
    line-height: 1.5;
  }

  .lista li {
    display: flex;
    gap: 10px;
    align-items: baseline;
  }

  .lista li::before {
    content: '·';
    color: #96f719;
    font-weight: 900;
    flex-shrink: 0;
  }

  /* CTA */
  .cta-wrap {
    display: flex;
    justify-content: center;
    margin: 8px 0;
  }

  .cta-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(150, 247, 25, .75);
    background: rgba(150, 247, 25, .16);
    color: var(--color-texto, #f8ffee);
    border-radius: 999px;
    padding: .78rem 2.4rem;
    font-family: var(--font-base, 'Work Sans', sans-serif);
    font-size: 1.1rem;
    font-weight: 800;
    letter-spacing: .04em;
    text-decoration: none;
    position: relative;
    overflow: hidden;
    box-shadow: 0 0 0 1px rgba(150, 247, 25, .10), 0 18px 45px rgba(0, 0, 0, .28);
    transition: transform 120ms ease, filter 120ms ease, border-color 120ms ease;
  }

  .cta-btn::after {
    content: '';
    position: absolute;
    top: -20%;
    left: -35%;
    width: 30%;
    height: 140%;
    background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.85) 100%, rgba(255,255,255,0) 100%);
    mix-blend-mode: overlay;
    transform: skewX(-18deg);
    animation: sweep 4s ease-in-out infinite;
    pointer-events: none;
  }

  @keyframes sweep {
    0%   { transform: translateX(-40%) skewX(-18deg); opacity: 0; }
    22%  { transform: translateX(-40%) skewX(-18deg); opacity: 0; }
    30%  { opacity: .85; }
    70%  { transform: translateX(440%) skewX(-18deg); opacity: .65; }
    78%  { opacity: 0; }
    100% { transform: translateX(440%) skewX(-18deg); opacity: 0; }
  }

  .cta-btn:hover {
    filter: brightness(1.08);
    border-color: rgba(150, 247, 25, .90);
    transform: translateY(-1px);
  }

  .cta-btn:active {
    transform: translateY(0);
  }

  .alternativa {
    margin: 0;
    font-size: .88rem;
    color: rgba(248, 255, 238, .45);
    line-height: 1.5;
  }

  .alternativa a {
    color: rgba(150, 247, 25, .8);
    text-decoration: none;
    border-bottom: 1px solid rgba(150, 247, 25, .3);
    padding-bottom: 1px;
    transition: border-color 120ms ease;
  }

  .alternativa a:hover {
    border-bottom-color: rgba(150, 247, 25, .7);
  }
</style>
