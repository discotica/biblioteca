<script lang="ts">
  import { onMount } from 'svelte';
  import AccountLayout from '$lib/layouts/AccountLayout.svelte';
  import { Button, Notice, PasswordField } from '$lib/ui';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { supabase } from '$lib/supabase';

  /**
   * Destino de los enlaces de los correos de Auth: confirmar la cuenta
   * (`flow=signup`), elegir contraseña nueva (`flow=recovery`) y confirmar un
   * cambio de correo (`flow=email_change`). Con flujo implícito, el SDK crea la
   * sesión desde el fragmento (#) antes de que esta página decida.
   */
  type Flow = 'signup' | 'recovery' | 'email_change';

  let flow = $state<Flow | null>(null);
  let linkError = $state(false);
  let password = $state('');
  let passwordValid = $state(false);
  let confirmPassword = $state('');
  let errors = $state<{ password?: string; confirm?: string }>({});
  let formError = $state('');
  let loading = $state(false);

  const title = $derived(
    linkError
      ? flow === 'signup'
        ? 'El enlace de confirmación venció'
        : 'El enlace venció'
      : flow === 'recovery'
        ? 'Nueva contraseña'
        : 'Comprobando el enlace'
  );

  onMount(async () => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const params = $page.url.searchParams;
    const requested = params.get('flow') ?? params.get('type') ?? hash.get('type');
    flow = requested === 'signup' || requested === 'email_change' ? requested : 'recovery';

    if (params.get('error_description') ?? hash.get('error_description')) {
      linkError = true;
      return;
    }

    const code = params.get('code');
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        linkError = true;
        return;
      }
    } else {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        linkError = true;
        return;
      }
    }

    if (flow === 'signup') goto('/mis-colecciones?aviso=cuenta-confirmada', { replaceState: true });
    else if (flow === 'email_change') goto('/cuenta?aviso=correo', { replaceState: true });
  });

  async function updatePassword(event: SubmitEvent) {
    event.preventDefault();
    formError = '';
    errors = {
      password: passwordValid ? undefined : 'La contraseña necesita 8 caracteres o más.',
      confirm: confirmPassword === password ? undefined : 'Las contraseñas no coinciden.'
    };
    if (errors.password || errors.confirm) return;

    loading = true;
    const { error } = await supabase.auth.updateUser({ password });
    loading = false;
    if (error) {
      formError =
        error.code === 'same_password'
          ? 'La contraseña nueva tiene que ser distinta de la anterior.'
          : error.code === 'weak_password'
            ? 'Esa contraseña es demasiado fácil de adivinar. Prueba con otra.'
            : 'No pudimos guardar la contraseña. Vuelve a intentarlo.';
      return;
    }
    goto('/mis-colecciones?aviso=contrasena', { replaceState: true });
  }
</script>

<svelte:head>
  <title>{flow === 'recovery' ? 'Nueva contraseña' : 'Confirmar enlace'} — Biblioteca Discótica</title>
</svelte:head>

<AccountLayout {title}>
  {#if linkError}
    <Notice tone="error">
      {#if flow === 'signup'}
        <p>El enlace ya se usó o pasó demasiado tiempo. Si ya confirmaste tu cuenta, puedes entrar; si no, pide otro enlace.</p>
      {:else if flow === 'email_change'}
        <p>El enlace ya se usó o pasó demasiado tiempo. Puedes pedir el cambio de correo otra vez desde tu cuenta.</p>
      {:else}
        <p>El enlace ya se usó o pasó demasiado tiempo. Pide uno nuevo para elegir tu contraseña.</p>
      {/if}
    </Notice>
    <div class="link-actions">
      {#if flow === 'signup'}
        <Button href="/auth/confirmar" block>Pedir otro enlace</Button>
        <Button href="/auth/login" variant="secondary" block>Entrar</Button>
      {:else if flow === 'email_change'}
        <Button href="/cuenta" block>Ir a mi cuenta</Button>
      {:else}
        <Button href="/auth/recuperar" block>Pedir otro enlace</Button>
      {/if}
    </div>
  {:else if flow === 'recovery'}
    <form class="account-form" onsubmit={updatePassword} novalidate>
      <PasswordField label="Contraseña nueva" name="password" bind:value={password} bind:valid={passwordValid} error={errors.password} required />
      <PasswordField
        label="Repite la contraseña"
        name="password-confirm"
        autocomplete="new-password"
        showRules={false}
        bind:value={confirmPassword}
        error={errors.confirm}
        required
      />
      {#if formError}<Notice tone="error">{formError}</Notice>{/if}
      <Button type="submit" block {loading}>Guardar contraseña</Button>
    </form>
  {:else}
    <p class="checking" role="status">Comprobando el enlace…</p>
  {/if}
</AccountLayout>

<style>
  .account-form,
  .link-actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }
  .link-actions { gap: var(--space-3); margin-top: var(--space-5); }
  .checking {
    margin: 0;
    color: var(--color-texto-medio);
    font-size: var(--text-sm);
  }
</style>
