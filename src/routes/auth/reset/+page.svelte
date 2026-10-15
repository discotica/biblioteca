<script lang="ts">
  import { onMount } from 'svelte';
  import AccountLayout from '$lib/layouts/AccountLayout.svelte';
  import { Button, Notice, PasswordField } from '$lib/ui';
  import { goto, replaceState } from '$app/navigation';
  import { page } from '$app/stores';
  import { supabase } from '$lib/supabase';
  import { readAuthLink, type AuthLinkFlow } from '$lib/domain/account';

  /**
   * Destino de los enlaces de los correos de Auth: confirmar la cuenta,
   * elegir contraseña nueva y confirmar un cambio de correo (RC2-P0-01).
   * - `?token_hash=…&type=…` (las plantillas): se canjea aquí con `verifyOtp`.
   *   No depende del navegador en que se pidió el enlace.
   * - `?code=…` (enlaces PKCE anteriores): el SDK ya lo canjeó al cargar
   *   (`detectSessionInUrl`). Canjearlo otra vez falla, así que solo se mira la sesión.
   * - `#access_token=…` (flujo implícito): igual, la sesión ya está creada.
   */
  let flow = $state<AuthLinkFlow | null>(null);
  let linkError = $state(false);
  /** Cambio de correo con doble confirmación: falta el enlace de la otra dirección. */
  let otherAddressPending = $state(false);
  /** El formulario de contraseña no aparece hasta que el enlace está verificado. */
  let checking = $state(true);
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
      : otherAddressPending
        ? 'Falta un paso'
        : flow === 'recovery' && !checking
          ? 'Nueva contraseña'
          : 'Comprobando el enlace'
  );

  onMount(async () => {
    await checkLink();
    checking = false;
  });

  async function checkLink() {
    const link = readAuthLink($page.url.searchParams, new URLSearchParams(window.location.hash.slice(1)));
    flow = link.flow;
    if (link.error) {
      linkError = true;
      return;
    }

    if (link.tokenHash && link.otpType) {
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: link.tokenHash, type: link.otpType });
      // El token es de un solo uso: fuera de la URL, recargar no lo reintenta.
      replaceState(`/auth/reset?flow=${link.flow}`, {});
      if (error) {
        linkError = true;
        return;
      }
      if (!data.session) {
        // Auth acepta la primera de las dos confirmaciones de un cambio de correo sin abrir sesión.
        if (link.flow === 'email_change') otherAddressPending = true;
        else linkError = true;
        return;
      }
    } else {
      // getSession espera a que el SDK termine de leer la URL (code o fragmento).
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        linkError = true;
        return;
      }
    }

    if (flow === 'signup') goto('/mis-colecciones?aviso=cuenta-confirmada', { replaceState: true });
    else if (flow === 'email_change') goto('/cuenta?aviso=correo', { replaceState: true });
  }

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
  {:else if otherAddressPending}
    <Notice tone="info">
      <p>Confirmamos esta dirección. Abre también el enlace que llegó a la otra dirección para terminar el cambio de correo.</p>
    </Notice>
    <div class="link-actions">
      <Button href="/cuenta" variant="secondary" block>Ir a mi cuenta</Button>
    </div>
  {:else if flow === 'recovery' && !checking}
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
