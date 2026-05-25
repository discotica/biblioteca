<footer class="site-footer">
  <div class="accent-rule" aria-hidden="true"></div>

  <div class="container inner">
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
    background: rgba(0, 0, 0, .35);
    border-top: 1px solid rgba(255, 255, 255, .06);
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
    border-radius: 1px;
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
    font-size: .72rem;
    font-weight: 700;
    letter-spacing: .09em;
    text-transform: uppercase;
    color: rgba(248, 255, 238, .35);
    text-decoration: none;
    transition: color 140ms ease;
  }

  .footer-links a:hover {
    color: var(--color-acento);
  }

  .footer-links img {
    width: 15px;
    height: 15px;
    filter: brightness(0) invert(1);
    opacity: .5;
    transition: opacity 140ms ease;
    flex-shrink: 0;
  }

  .footer-links a:hover img { opacity: .9; }

  @media (max-width: 540px) {
    .footer-links { gap: 1.5rem; }
    .footer-links a { font-size: .68rem; }
  }

  /* Text */
  .claim {
    margin: 0;
    font-size: .62rem;
    letter-spacing: .13em;
    text-transform: uppercase;
    color: rgba(248, 255, 238, .18);
    text-align: center;
  }

  .copy {
    margin: 0;
    font-size: .68rem;
    color: rgba(248, 255, 238, .12);
  }
</style>
