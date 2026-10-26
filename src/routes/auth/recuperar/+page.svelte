<script lang="ts">
  import AccountLayout from '$lib/layouts/AccountLayout.svelte';
  import { Button, Field, Notice } from '$lib/ui';
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

<AccountLayout
  title="Recuperar contraseña"
  help={sent ? undefined : 'Escribe el correo de tu cuenta y te enviamos un enlace para elegir una contraseña nueva.'}
>
  {#if sent}
    <Notice tone="success" title="Revisa tu correo">
      <p>Si <strong>{email.trim()}</strong> tiene una cuenta, te llegará un enlace en unos minutos. Si no lo ves, busca en spam.</p>
    </Notice>
  {:else}
    <form class="account-form" onsubmit={recover} novalidate>
      <Field label="Correo" type="email" name="email" autocomplete="email" bind:value={email} required />
      {#if error}<Notice tone="error">{error}</Notice>{/if}
      <Button type="submit" block {loading}>Enviar enlace</Button>
    </form>
  {/if}

  {#snippet footer()}
    <a href="/auth/login">Volver a Entrar</a>
  {/snippet}
</AccountLayout>

<style>
  .account-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }
</style>
