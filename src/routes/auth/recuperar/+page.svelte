<script lang="ts">
  import AbrirCorreo from '$lib/components/account/AbrirCorreo.svelte';
  import AccesoPagina from '$lib/components/account/AccesoPagina.svelte';
  import AccesoTitulo from '$lib/components/account/AccesoTitulo.svelte';
  import { Field, Button, FormPanel, Notice } from '$lib/ui';
  import { supabase } from '$lib/supabase';
  import { authLinkRedirect } from '$lib/domain/account';

  let email = $state('');
  let sent = $state(false);
  let loading = $state(false);
  let error = $state('');

  async function recover(event: SubmitEvent) {
    event.preventDefault();
    error = '';
    const target = email.trim();
    if (!target.includes('@')) {
      error = 'Escribe el correo de tu cuenta.';
      return;
    }
    loading = true;
    const { error: err } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: authLinkRedirect(window.location.origin)
    });
    loading = false;
    // Solo el límite de envíos se distingue; cualquier otro resultado muestra
    // la misma confirmación, exista o no la cuenta.
    if (err && (err.status === 429 || err.code?.startsWith('over_'))) {
      error = 'Espera unos minutos antes de pedir otro enlace.';
      return;
    }
    sent = true;
  }
</script>

<svelte:head>
  <title>Recuperar contraseña — Biblioteca Discótica</title>
</svelte:head>

<!-- Tablero M: panel de 480 sobre la huella gris. Al enviar, pasa a «Revisa tu correo». -->
<AccesoPagina contenedor="narrow" alinea="centro">
  {#if sent}
    <FormPanel size="narrow">
      <AccesoTitulo titulo="Revisa tu correo">
        Si <strong>{email.trim()}</strong> tiene una cuenta, te llegará un enlace en unos minutos. Si no lo ves, busca en spam.
      </AccesoTitulo>
      <AbrirCorreo />

      {#snippet actions()}
        <button type="button" class="recuperar__enlace" onclick={() => (sent = false)}>Usar otro correo</button>
      {/snippet}
    </FormPanel>
  {:else}
    <FormPanel as="form" size="narrow" onsubmit={recover} novalidate>
      <AccesoTitulo titulo="Recuperar contraseña">Te enviamos un enlace para elegir una nueva.</AccesoTitulo>
      <Field label="Correo" type="email" name="email" autocomplete="email" placeholder="tu@correo.com" bind:value={email} required />
      {#if error}<Notice tone="error">{error}</Notice>{/if}

      {#snippet actions()}
        <div class="recuperar__acciones">
          <Button type="submit" size="form" block {loading}>Enviar enlace</Button>
          <a class="recuperar__enlace" href="/auth/login">Volver a entrar</a>
        </div>
      {/snippet}
    </FormPanel>
  {/if}
</AccesoPagina>

<style>
  .recuperar__acciones { display: flex; flex-direction: column; gap: var(--space-2); width: 100%; }

  .recuperar__enlace {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: var(--target-touch);
    padding: 0;
    border: 0;
    background: none;
    color: var(--color-texto-alto);
    font: inherit;
    font-size: var(--text-sm);
    font-weight: 500;
    text-decoration: none;
    cursor: pointer;
    transition: color var(--motion-fast) ease;
  }
  .recuperar__enlace:hover { color: var(--color-acento); }
</style>
