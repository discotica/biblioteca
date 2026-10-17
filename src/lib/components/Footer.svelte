<footer class="site-footer">
  <div class="accent-rule" aria-hidden="true"></div>

  <div class="l-container l-container--wide inner">
    <nav class="footer-links" aria-label="Links">
      <a href="https://instagram.com/discotica_" target="_blank" rel="noopener noreferrer">
        <img src="/img/insta.svg" alt="" aria-hidden="true" />
        Instagram
      </a>
      <a href="https://discotica.substack.com" target="_blank" rel="noopener noreferrer">
        <img src="/img/substack.svg" alt="" aria-hidden="true" />
        Substack
      </a>
      <a href="/manual">
        <img src="/img/manual.svg" alt="" aria-hidden="true" />
        Manual
      </a>
      <a href="https://www.discotica.com" target="_blank" rel="noopener noreferrer">
        <img src="/img/us.svg" alt="" aria-hidden="true" />
        Blog
      </a>
    </nav>

    <p class="claim">Una biblioteca para pies y cabeza — Orgullo sudaca</p>
    <p class="copy">&copy; {new Date().getFullYear()} Discótica</p>
  </div>
</footer>

<style>
  .site-footer {
    padding: 3rem 0 2rem;
    background: var(--color-sombra);
    border-top: 1px solid var(--color-linea-sutil);
    position: relative;
  }

  /* Short accent dash centered at the top */
  .accent-rule {
    position: absolute;
    top: -1px;
    left: 50%;
    transform: translateX(-50%);
    width: 48px;
    height: 2px;
    background: var(--color-acento);
    opacity: .55;
    border-radius: var(--radius-xs);
  }

  .inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.4rem;
  }

  /* Links */
  .footer-links {
    display: flex;
    align-items: center;
    gap: 2.25rem;
  }

  .footer-links a {
    display: flex;
    align-items: center;
    gap: .45rem;
    font-size: var(--nav-font-size);
    font-weight: var(--nav-font-weight);
    letter-spacing: var(--nav-letter-spacing);
    text-transform: var(--nav-text-transform);
    color: var(--color-texto-tenue);
    text-decoration: none;
    transition: color var(--motion-fast) ease;
  }

  .footer-links a:hover {
    color: var(--color-acento);
  }

  .footer-links img {
    width: 15px;
    height: 15px;
    filter: brightness(0) invert(1);
    opacity: .5;
    transition: opacity var(--motion-fast) ease;
    flex-shrink: 0;
  }

  .footer-links a:hover img { opacity: .9; }

  @media (max-width: 480px) {
    .footer-links { flex-wrap: wrap; justify-content: center; gap: .75rem 1.5rem; }
  }

  /* Text */
  .claim {
    margin: 0;
    font-size: var(--text-2xs);
    letter-spacing: .13em;
    text-transform: uppercase;
    color: var(--color-texto-tenue);
    text-align: center;
  }

  .copy {
    margin: 0;
    font-size: var(--text-2xs);
    color: var(--color-texto-tenue);
  }
</style>
