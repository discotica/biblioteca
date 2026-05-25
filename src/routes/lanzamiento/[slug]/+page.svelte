<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  export let data;

  onMount(() => {
    goto(`/?modal=${data.slug}`, { replaceState: true });
  });
</script>

<div class="cargando">
  <span class="dot"></span>
  <span class="dot"></span>
  <span class="dot"></span>
</div>

<style>
  .cargando {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    background: #0e0e0e;
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--color-acento, #96f719);
    animation: pulse 1s ease-in-out infinite;
  }
  .dot:nth-child(2) { animation-delay: 0.15s; }
  .dot:nth-child(3) { animation-delay: 0.3s; }

  @keyframes pulse {
    0%, 100% { opacity: 0.2; transform: scale(0.8); }
    50%       { opacity: 1;   transform: scale(1.1); }
  }
</style>
